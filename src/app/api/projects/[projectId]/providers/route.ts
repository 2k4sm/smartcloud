import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { encryptCredentials } from '@/lib/cloud/store'
import { validateProviderPayload, PROVIDER_KINDS } from '@/lib/cloud/validate'
import type { ProviderKind, ProviderConfig, ProviderCredentials } from '@/lib/cloud/types'
import type { CloudProviderSummary } from '@/lib/types'

// Credentials are decrypted here, so this must not run on the edge runtime.
export const runtime = 'nodejs'

type Params = { params: Promise<{ projectId: string }> }

const KINDS: ProviderKind[] = PROVIDER_KINDS

// GET — list configured providers (credentials never returned).
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId } = await params

  const service = createServiceClient()
  if (!(await projectRole(service, projectId, auth.userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await service
    .from('cloud_providers')
    .select('id, project_id, provider, name, config, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 })
  }
  return NextResponse.json({ providers: (data ?? []) as CloudProviderSummary[] })
}

// POST — connect a new provider. Body: { provider, name, config, credentials }
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId } = await params

  const service = createServiceClient()
  if (!canWrite(await projectRole(service, projectId, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    provider?: ProviderKind
    name?: string
    config?: ProviderConfig
    credentials?: ProviderCredentials
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { provider, name, config, credentials } = body
  if (!provider || !KINDS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!name?.trim() || !config || !credentials) {
    return NextResponse.json(
      { error: 'name, config and credentials are required' },
      { status: 400 }
    )
  }

  // Validate the shape here, where the user can still fix it. A mismatched
  // payload (say AWS fields against an `azure` provider) would otherwise store
  // cleanly and only surface much later as an opaque SDK error at sync time.
  const invalid = validateProviderPayload(provider, config, credentials)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const enc = encryptCredentials(credentials)

  const { data, error } = await service
    .from('cloud_providers')
    .insert({
      user_id: auth.userId,
      project_id: projectId,
      provider,
      name,
      config,
      encrypted_credentials: enc.encrypted_value,
      iv: enc.iv,
      auth_tag: enc.auth_tag,
    })
    .select('id, project_id, provider, name, config, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to connect provider' }, { status: 500 })
  }
  return NextResponse.json({ provider: data }, { status: 201 })
}
