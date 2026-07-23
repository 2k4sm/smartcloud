import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { rotatePool } from '@/lib/poolRotation'

type Params = { params: Promise<{ poolId: string; keyId: string }> }

// If we just took the current key out of service, move current to another active key.
async function reassignCurrentIfNeeded(
  service: ReturnType<typeof createServiceClient>,
  pool: { id: string; project_id: string; current_key_id: string | null },
  affectedKeyId: string
) {
  if (pool.current_key_id !== affectedKeyId) return
  await rotatePool(service, pool, 'manual', { reason: 'current key removed/deactivated' })
  // If no alternative existed, clear current.
  const { data: after } = await service
    .from('key_pools')
    .select('current_key_id')
    .eq('id', pool.id)
    .maybeSingle()
  if (after?.current_key_id === affectedKeyId) {
    await service.from('key_pools').update({ current_key_id: null }).eq('id', pool.id)
  }
}

// PATCH — activate/deactivate a key. Body: { active: boolean }
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { poolId, keyId } = await params

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

  let body: { active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'active (boolean) is required' }, { status: 400 })
  }

  const { data, error } = await service
    .from('pool_keys')
    .update({ active: body.active })
    .eq('id', keyId)
    .eq('pool_id', poolId)
    .select('id, pool_id, label, active, usage_count, last_used_at, created_at')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

  if (body.active === false) await reassignCurrentIfNeeded(service, pool, keyId)

  return NextResponse.json({ key: data })
}

// DELETE — remove a key from the pool.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { poolId, keyId } = await params

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

  // Move current off this key first (FK is ON DELETE SET NULL, but we prefer a live key).
  await reassignCurrentIfNeeded(service, pool, keyId)

  const { error } = await service.from('pool_keys').delete().eq('id', keyId).eq('pool_id', poolId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
