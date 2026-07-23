import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole } from '@/lib/access'
import { decrypt } from '@/lib/encryption'
import { selectNextActiveKey, type PoolKeyInfo } from '@/lib/pool'

// POST /api/pools/fetch
// Body: { project_id, name }  — returns the pool's CURRENT active key value,
// increments its usage, and logs the access (feeds risk). The SDK/CLI use this.
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { project_id?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { project_id, name } = body
  if (!project_id || !name) {
    return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 })
  }

  const service = createServiceClient()
  if (!(await projectRole(service, project_id, auth.userId))) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  const { data: pool } = await service
    .from('key_pools')
    .select('id, current_key_id')
    .eq('project_id', project_id)
    .eq('name', name.toUpperCase())
    .maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

  // Resolve the current key. (Re)select the least-used active key if current is
  // unset OR points at an inactive/deleted key (avoids a spurious 409 while a
  // reassignment is in-flight or after a key was deactivated).
  const { data: keyMetas } = await service
    .from('pool_keys')
    .select('id, active, usage_count, created_at')
    .eq('pool_id', pool.id)
  const keys = (keyMetas ?? []) as PoolKeyInfo[]

  let currentId = pool.current_key_id
  const currentIsActive = !!currentId && keys.some((k) => k.id === currentId && k.active)
  if (!currentIsActive) {
    currentId = selectNextActiveKey(keys, currentId)
    if (currentId) {
      await service.from('key_pools').update({ current_key_id: currentId }).eq('id', pool.id)
    }
  }
  if (!currentId) {
    return NextResponse.json({ error: 'Pool has no active keys' }, { status: 409 })
  }

  const { data: key } = await service
    .from('pool_keys')
    .select('id, encrypted_value, iv, auth_tag, active, usage_count')
    .eq('id', currentId)
    .maybeSingle()
  if (!key || !key.active) {
    return NextResponse.json({ error: 'Pool has no active keys' }, { status: 409 })
  }

  let value: string
  try {
    value = decrypt({ encrypted_value: key.encrypted_value, iv: key.iv, auth_tag: key.auth_tag })
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt key' }, { status: 500 })
  }

  const now = new Date().toISOString()
  await service.rpc('bump_pool_key_usage', { p_key_id: key.id }) // atomic increment
  await service.from('pool_access_logs').insert({
    pool_id: pool.id,
    pool_key_id: key.id,
    user_id: auth.userId,
    project_id,
    action: 'READ',
    ip_address:
      request.headers.get('x-forwarded-for') ??
      request.headers.get('x-real-ip') ??
      'unknown',
  })

  return NextResponse.json({
    name: name.toUpperCase(),
    value,
    key_id: key.id,
    project_id,
    fetched_at: now,
  })
}
