import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/encryption'
import { adapterFromRow, type CloudProviderRow } from '@/lib/cloud/store'

type Params = { params: Promise<{ secretId: string }> }

// POST /api/secrets/:secretId/sync — push the secret's value to cloud providers.
// Body: { provider_id?: string }  (omit to push to every configured provider)
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { secretId } = await params
  const { userId, supabase } = auth

  let body: { provider_id?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is allowed (sync to all)
  }

  // Load + decrypt the secret (scoped to caller).
  let secretQuery = supabase
    .from('secrets')
    .select('id, key_name, project_id, encrypted_value, iv, auth_tag')
    .eq('id', secretId)
  if (auth.requiresUserFilter) secretQuery = secretQuery.eq('user_id', userId)
  const { data: secret } = await secretQuery.single()
  if (!secret) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  // Authorization: owner/admin for browser/JWT (API keys are owner-scoped).
  if (!auth.requiresUserFilter) {
    const { data: role } = await supabase.rpc('current_project_role', {
      pid: secret.project_id,
    })
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const value = decrypt({
    encrypted_value: secret.encrypted_value,
    iv: secret.iv,
    auth_tag: secret.auth_tag,
  })

  const service = createServiceClient()
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

// GET — recent sync history for this secret.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { secretId } = await params

  const { data, error } = await auth.supabase
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
