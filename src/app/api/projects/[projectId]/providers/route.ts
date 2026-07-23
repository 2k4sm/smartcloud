import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { encryptCredentials } from '@/lib/cloud/store'
import type { ProviderKind, ProviderConfig, ProviderCredentials } from '@/lib/cloud/types'
import type { CloudProviderSummary } from '@/lib/types'

type Params = { params: Promise<{ projectId: string }> }

const KINDS: ProviderKind[] = ['aws', 'azure', 'gcp']

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
  if (!name || !config || !credentials) {
    return NextResponse.json(
      { error: 'name, config and credentials are required' },
      { status: 400 }
    )
  }

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
