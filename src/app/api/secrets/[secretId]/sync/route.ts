import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { decrypt } from '@/lib/encryption'
import { pushToProviders, loadProviders } from '@/lib/cloud/sync'

// The cloud SDKs and AES decryption both require the Node runtime.
export const runtime = 'nodejs'

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

  const providers = await loadProviders(service, secret.project_id, body.provider_id)
  if (providers.length === 0) {
    return NextResponse.json({ error: 'No cloud providers configured' }, { status: 404 })
  }

  const summary = await pushToProviders(
    service,
    { projectId: secret.project_id, secretId: secret.id, name: secret.key_name },
    value,
    { providerId: body.provider_id }
  )

  return NextResponse.json({ secret_id: secret.id, ...summary })
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
