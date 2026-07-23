import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { decrypt } from '@/lib/encryption'
import { adapterFromRow, type CloudProviderRow } from '@/lib/cloud/store'

type Params = { params: Promise<{ secretId: string }> }

// POST /api/secrets/:secretId/sync — push the secret's value to cloud providers.
// Body: { provider_id?: string }  (omit to push to every configured provider)
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { secretId } = await params

  let body: { provider_id?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is allowed (sync to all)
  }

  const service = createServiceClient()
  const { data: secret } = await service
    .from('secrets')
    .select('id, key_name, project_id, encrypted_value, iv, auth_tag')
    .eq('id', secretId)
    .maybeSingle()
  if (!secret) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  // Owner/admin required — for every auth method (not just browser/JWT).
  if (!canWrite(await projectRole(service, secret.project_id, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let value: string
  try {
    value = decrypt({
      encrypted_value: secret.encrypted_value,
      iv: secret.iv,
      auth_tag: secret.auth_tag,
    })
  } catch (err) {
    console.error('Decryption failed for secret:', secret.id, err)
    return NextResponse.json({ error: 'Failed to decrypt secret' }, { status: 500 })
  }

  let providerQuery = service
    .from('cloud_providers')
    .select('id, provider, name, config, encrypted_credentials, iv, auth_tag')
    .eq('project_id', secret.project_id)
  if (body.provider_id) providerQuery = providerQuery.eq('id', body.provider_id)
  const { data: providers } = await providerQuery

  if (!providers || providers.length === 0) {
    return NextResponse.json({ error: 'No cloud providers configured' }, { status: 404 })
  }

  const results = []
  for (const row of providers as CloudProviderRow[]) {
    let status: 'success' | 'failed' = 'success'
    let remoteId: string | null = null
    let detail: string | null = null
    try {
      const adapter = adapterFromRow(row)
      const res = await adapter.upsertSecret(secret.key_name, value)
      remoteId = res.remoteId
    } catch (err) {
      status = 'failed'
      detail = err instanceof Error ? err.message : String(err)
    }

    await service.from('cloud_syncs').insert({
      provider_id: row.id,
      secret_id: secret.id,
      project_id: secret.project_id,
      status,
      remote_id: remoteId,
      detail,
    })

    results.push({ provider_id: row.id, provider: row.provider, name: row.name, status, remote_id: remoteId, detail })
  }

  return NextResponse.json({
    secret_id: secret.id,
    synced: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  })
}

// GET — recent sync history for this secret (scoped to the caller's project).
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { secretId } = await params

  const service = createServiceClient()
  const { data: secret } = await service
    .from('secrets')
    .select('id, project_id')
    .eq('id', secretId)
    .maybeSingle()
  if (!secret) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await projectRole(service, secret.project_id, auth.userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await service
    .from('cloud_syncs')
    .select('id, provider_id, secret_id, project_id, status, remote_id, detail, synced_at')
    .eq('secret_id', secretId)
    .order('synced_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to load sync history' }, { status: 500 })
  }
  return NextResponse.json({ secret_id: secretId, syncs: data ?? [] })
}
