import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { encrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId } = auth

  let body: {
    project_id?: string
    key_name?: string
    value?: string
    description?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { project_id, key_name, value, description } = body
  if (!project_id || !key_name?.trim() || !value) {
    return NextResponse.json(
      { error: 'project_id, key_name, and value are required' },
      { status: 400 }
    )
  }

  // Authorize + write with the service-role client (server-verified), so this
  // doesn't depend on RLS auth.uid() being forwarded in a route handler.
  const service = createServiceClient()

  // Caller must be owner or admin. Non-members get 404 (no existence leak).
  const role = await projectRole(service, project_id, userId)
  if (!role) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  if (!canWrite(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { encrypted_value, iv, auth_tag } = encrypt(value)

  const { data, error } = await service
    .from('secrets')
    .insert({
      project_id,
      user_id: userId,
      key_name: key_name.trim().toUpperCase(),
      encrypted_value,
      iv,
      auth_tag,
      description: description ?? null,
    })
    .select('id, project_id, key_name, description, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A secret with this key name already exists in this project' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await service.from('access_logs').insert({
    secret_id: data.id,
    user_id: userId,
    project_id,
    key_name: data.key_name,
    action: 'CREATE',
    ip_address: request.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return NextResponse.json({ secret: data }, { status: 201 })
}
