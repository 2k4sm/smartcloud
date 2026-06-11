import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/encryption'

type Params = { params: Promise<{ secretId: string }> }

// GET returns metadata only — plaintext is only available via POST /api/secrets/fetch
export async function GET(_request: NextRequest, { params }: Params) {
  const { secretId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('secrets')
    .select('id, project_id, key_name, description, created_at, updated_at')
    .eq('id', secretId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  return NextResponse.json({ secret: data })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { secretId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { value, description, auto_rotate, rotation_interval_days } =
    await request.json()
  const updates: Record<string, unknown> = {}

  if (description !== undefined) updates.description = description
  if (auto_rotate !== undefined) updates.auto_rotate = Boolean(auto_rotate)
  if (rotation_interval_days !== undefined) {
    updates.rotation_interval_days =
      rotation_interval_days === null ? null : Number(rotation_interval_days)
  }

  if (value) {
    const { encrypted_value, iv, auth_tag } = encrypt(value)
    updates.encrypted_value = encrypted_value
    updates.iv = iv
    updates.auth_tag = auth_tag
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('secrets')
    .update(updates)
    .eq('id', secretId)
    .select('id, project_id, key_name, description, created_at, updated_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  // Log UPDATE action
  const serviceClient = createServiceClient()
  await serviceClient.from('access_logs').insert({
    secret_id: data.id,
    user_id: user.id,
    project_id: data.project_id,
    key_name: data.key_name,
    action: 'UPDATE',
    ip_address: request.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return NextResponse.json({ secret: data })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { secretId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch metadata before deletion for the log
  const { data: secretMeta } = await supabase
    .from('secrets')
    .select('id, project_id, key_name')
    .eq('id', secretId)
    .single()

  if (!secretMeta) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  const { error } = await supabase
    .from('secrets')
    .delete()
    .eq('id', secretId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log DELETE action (cascade will delete the log if secret is deleted, but log it anyway)
  const serviceClient = createServiceClient()
  await serviceClient.from('access_logs').insert({
    secret_id: secretMeta.id,
    user_id: user.id,
    project_id: secretMeta.project_id,
    key_name: secretMeta.key_name,
    action: 'DELETE',
    ip_address: request.headers.get('x-forwarded-for') ?? 'unknown',
  })

  return new NextResponse(null, { status: 204 })
}
