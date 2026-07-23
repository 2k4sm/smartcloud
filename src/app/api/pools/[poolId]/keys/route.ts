import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { encrypt } from '@/lib/encryption'

type Params = { params: Promise<{ poolId: string }> }

// POST /api/pools/:poolId/keys — add a real key to the pool.
// Body: { value: string, label?: string }
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { poolId } = await params

  const service = createServiceClient()
  const { data: pool } = await service
    .from('key_pools')
    .select('id, project_id, current_key_id')
    .eq('id', poolId)
    .maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canWrite(await projectRole(service, pool.project_id, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { value?: string; label?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.value) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 })
  }

  const payload = encrypt(body.value)
  const { data: key, error } = await service
    .from('pool_keys')
    .insert({
      pool_id: poolId,
      project_id: pool.project_id,
      user_id: auth.userId,
      label: body.label ?? null,
      encrypted_value: payload.encrypted_value,
      iv: payload.iv,
      auth_tag: payload.auth_tag,
    })
    .select('id, pool_id, label, active, usage_count, last_used_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // First key added becomes the current served key.
  if (!pool.current_key_id) {
    await service.from('key_pools').update({ current_key_id: key.id }).eq('id', poolId)
  }

  return NextResponse.json({ key }, { status: 201 })
}
