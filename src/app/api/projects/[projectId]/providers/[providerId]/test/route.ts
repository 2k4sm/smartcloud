import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { adapterFromRow, type CloudProviderRow } from '@/lib/cloud/store'

type Params = { params: Promise<{ projectId: string; providerId: string }> }

// POST /api/projects/:projectId/providers/:providerId/test
//
// Verify the stored credentials can actually reach the provider. Without this,
// a typo in a key or a missing IAM permission stays invisible until the first
// real sync fails. The check is a one-item list call: it creates nothing,
// writes nothing, and needs no pre-existing secret.
//
// Node runtime: the cloud SDKs and credential decryption both need it.
export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, providerId } = await params

  const service = createServiceClient()
  // Credentials are involved, so require write access rather than membership.
  if (!canWrite(await projectRole(service, projectId, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: row } = await service
    .from('cloud_providers')
    .select('id, provider, name, config, encrypted_credentials, iv, auth_tag')
    .eq('id', providerId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  const started = Date.now()
  try {
    const adapter = adapterFromRow(row as CloudProviderRow)
    await adapter.testConnection()
    return NextResponse.json({
      provider_id: providerId,
      provider: row.provider,
      ok: true,
      latency_ms: Date.now() - started,
    })
  } catch (err) {
    // 200 with ok:false — the request succeeded, the *connection* is what failed.
    // The provider's message is the useful part (bad key id, no permission,
    // wrong region), and it never contains the credential itself.
    return NextResponse.json({
      provider_id: providerId,
      provider: row.provider,
      ok: false,
      latency_ms: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
