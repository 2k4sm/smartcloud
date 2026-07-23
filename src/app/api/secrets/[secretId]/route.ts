import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/encryption'

type Params = { params: Promise<{ secretId: string }> }

// GET returns metadata only — plaintext is only available via POST /api/secrets/fetch
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { secretId } = await params

  let query = supabase
    .from('secrets')
    .select('id, project_id, key_name, description, created_at, updated_at')
    .eq('id', secretId)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { data, error } = await query.single()

  if (error || !data) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  return NextResponse.json({ secret: data })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { secretId } = await params

  const { value, description } = await request.json()
  const updates: Record<string, unknown> = {}

  if (description !== undefined) updates.description = description

  if (value) {
    const { encrypted_value, iv, auth_tag } = encrypt(value)
    updates.encrypted_value = encrypted_value
    updates.iv = iv
    updates.auth_tag = auth_tag
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  let query = supabase.from('secrets').update(updates).eq('id', secretId)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { data, error } = await query
    .select('id, project_id, key_name, description, created_at, updated_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  await createServiceClient().from('access_logs').insert({
    secret_id: data.id,
    user_id: userId,
    project_id: data.project_id,
    key_name: data.key_name,
    action: 'UPDATE',
    ip_address: request.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return NextResponse.json({ secret: data })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { secretId } = await params

  // Fetch metadata before deletion for the audit log.
  let metaQuery = supabase
    .from('secrets')
    .select('id, project_id, key_name')
    .eq('id', secretId)
  if (auth.requiresUserFilter) metaQuery = metaQuery.eq('user_id', userId)
  const { data: secretMeta } = await metaQuery.single()

  if (!secretMeta) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  let delQuery = supabase.from('secrets').delete().eq('id', secretId)
  if (auth.requiresUserFilter) delQuery = delQuery.eq('user_id', userId)
  const { error } = await delQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await createServiceClient().from('access_logs').insert({
    secret_id: secretMeta.id,
    user_id: userId,
    project_id: secretMeta.project_id,
    key_name: secretMeta.key_name,
    action: 'DELETE',
    ip_address: request.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return new NextResponse(null, { status: 204 })
}
