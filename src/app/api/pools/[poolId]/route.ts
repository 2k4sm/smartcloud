import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { computePoolRisk } from '@/lib/poolRotation'
import type { KeyPool, PoolKeyMeta, PoolRotation } from '@/lib/types'

type Params = { params: Promise<{ poolId: string }> }

async function loadPool(service: ReturnType<typeof createServiceClient>, poolId: string) {
  const { data } = await service
    .from('key_pools')
    .select(
      'id, project_id, name, description, rotation_interval_days, rotate_on_high_risk, risk_threshold, current_key_id, last_rotated_at, created_at, updated_at'
    )
    .eq('id', poolId)
    .maybeSingle()
  return data as KeyPool | null
}

// GET — pool detail: keys (metadata only), current key, history, live risk.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { poolId } = await params

  const service = createServiceClient()
  const pool = await loadPool(service, poolId)
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await projectRole(service, pool.project_id, auth.userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [{ data: keys }, { data: rotations }, risk] = await Promise.all([
    service
      .from('pool_keys')
      .select('id, pool_id, label, active, usage_count, last_used_at, created_at')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: true }),
    service
      .from('pool_rotations')
      .select('id, pool_id, from_key_id, to_key_id, trigger, reason, rotated_at')
      .eq('pool_id', poolId)
      .order('rotated_at', { ascending: false })
      .limit(20),
    computePoolRisk(service, poolId),
  ])

  const keyMeta = ((keys ?? []) as PoolKeyMeta[]).map((k) => ({
    ...k,
    is_current: k.id === pool.current_key_id,
  }))

  return NextResponse.json({
    pool,
    keys: keyMeta,
    rotations: (rotations ?? []) as PoolRotation[],
    risk,
  })
}

// PATCH — update rotation policy / description.
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { poolId } = await params

  const service = createServiceClient()
  const pool = await loadPool(service, poolId)
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canWrite(await projectRole(service, pool.project_id, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    description?: string | null
    rotation_interval_days?: number | null
    rotate_on_high_risk?: boolean
    risk_threshold?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.description !== undefined) updates.description = body.description
  if (body.rotation_interval_days !== undefined) {
    updates.rotation_interval_days =
      body.rotation_interval_days === null ? null : Number(body.rotation_interval_days)
  }
  if (body.rotate_on_high_risk !== undefined) {
    updates.rotate_on_high_risk = Boolean(body.rotate_on_high_risk)
  }
  if (body.risk_threshold !== undefined) updates.risk_threshold = Number(body.risk_threshold)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await service
    .from('key_pools')
    .update(updates)
    .eq('id', poolId)
    .select('id, project_id, name, description, rotation_interval_days, rotate_on_high_risk, risk_threshold, current_key_id, last_rotated_at, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pool: data })
}

// DELETE — remove the pool and all its keys.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { poolId } = await params

  const service = createServiceClient()
  const pool = await loadPool(service, poolId)
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canWrite(await projectRole(service, pool.project_id, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await service.from('key_pools').delete().eq('id', poolId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
