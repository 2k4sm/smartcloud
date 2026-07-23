import type { SupabaseClient } from '@supabase/supabase-js'
import { selectNextActiveKey, type PoolKeyInfo } from '@/lib/pool'
import { assessRisk, type RiskLogEntry, type RiskLevel } from '@/lib/risk'

export interface RotatePoolResult {
  pool_id: string
  rotated: boolean
  from_key_id: string | null
  to_key_id: string | null
  detail: string
}

// Switch a pool's current key to the least-used active key. All keys stay valid,
// so this never breaks a consumer — it just prefers a different working key.
// Uses a service-role client (works from routes + cron).
export async function rotatePool(
  service: SupabaseClient,
  pool: { id: string; project_id: string; current_key_id: string | null },
  trigger: 'manual' | 'scheduled' | 'risk',
  opts: { reason?: string; now?: Date } = {}
): Promise<RotatePoolResult> {
  const { data: keys } = await service
    .from('pool_keys')
    .select('id, active, usage_count, created_at')
    .eq('pool_id', pool.id)

  const next = selectNextActiveKey(
    (keys ?? []) as PoolKeyInfo[],
    pool.current_key_id
  )

  if (!next || next === pool.current_key_id) {
    return {
      pool_id: pool.id,
      rotated: false,
      from_key_id: pool.current_key_id,
      to_key_id: next,
      detail: 'no alternative active key to rotate to',
    }
  }

  const now = (opts.now ?? new Date()).toISOString()
  await service
    .from('key_pools')
    .update({ current_key_id: next, last_rotated_at: now })
    .eq('id', pool.id)
  await service.from('pool_rotations').insert({
    pool_id: pool.id,
    project_id: pool.project_id,
    from_key_id: pool.current_key_id,
    to_key_id: next,
    trigger,
    reason: opts.reason ?? null,
  })

  return {
    pool_id: pool.id,
    rotated: true,
    from_key_id: pool.current_key_id,
    to_key_id: next,
    detail: opts.reason ?? `rotated (${trigger})`,
  }
}

// Live risk for a pool, computed over its access logs (not persisted).
export async function computePoolRisk(
  service: SupabaseClient,
  poolId: string,
  now = new Date()
): Promise<{ score: number; level: RiskLevel }> {
  const { data: logs } = await service
    .from('pool_access_logs')
    .select('action, ip_address, accessed_at')
    .eq('pool_id', poolId)
  const a = assessRisk((logs ?? []) as RiskLogEntry[], { now })
  return { score: a.score, level: a.level }
}
