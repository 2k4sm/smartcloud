import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { encryptCredentials } from '@/lib/cloud/store'
import type { ProviderConfig, ProviderCredentials } from '@/lib/cloud/types'

type Params = { params: Promise<{ projectId: string; providerId: string }> }

// PATCH — update a provider's label/config, and optionally rotate credentials.
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, providerId } = await params

  let body: {
    name?: string
    config?: ProviderConfig
    credentials?: ProviderCredentials
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.config !== undefined) updates.config = body.config
  if (body.credentials !== undefined) {
    const enc = encryptCredentials(body.credentials)
    updates.encrypted_credentials = enc.encrypted_value
    updates.iv = enc.iv
    updates.auth_tag = enc.auth_tag
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('cloud_providers')
    .update(updates)
    .eq('id', providerId)
    .eq('project_id', projectId)
    .select('id, project_id, provider, name, config, created_at, updated_at')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Provider not found or not permitted' },
      { status: 404 }
    )
  }
  return NextResponse.json({ provider: data })
}

// DELETE — remove a provider connection.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, providerId } = await params

  const { error } = await auth.supabase
    .from('cloud_providers')
    .delete()
    .eq('id', providerId)
    .eq('project_id', projectId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
