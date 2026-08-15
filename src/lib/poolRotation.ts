import type { SupabaseClient } from '@supabase/supabase-js'
import { selectNextActiveKey, type PoolKeyInfo } from '@/lib/pool'
import { assessRisk, type RiskLogEntry, type RiskLevel } from '@/lib/risk'
import { dispatch } from '@/lib/notify'

export interface RotatePoolResult {
  pool_id: string
  rotated: boolean
  from_key_id: string | null
  to_key_id: string | null
  detail: string
}

export interface RotatablePool {
  id: string
  project_id: string
  name?: string
  current_key_id: string | null
}

// Switch a pool's current key to the least-used active key. All keys stay valid,
// so this never breaks a consumer — it just prefers a different working key.
// Uses a service-role client (works from routes + cron).
export async function rotatePool(
  service: SupabaseClient,
  pool: RotatablePool,
  trigger: 'manual' | 'scheduled' | 'risk',
  opts: { reason?: string; now?: Date; notify?: boolean } = {}
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

  const result: RotatePoolResult = {
    pool_id: pool.id,
    rotated: true,
    from_key_id: pool.current_key_id,
    to_key_id: next,
    detail: opts.reason ?? `rotated (${trigger})`,
  }

  if (opts.notify !== false) {
    await notifyRotation(service, pool, trigger, result, opts.reason)
  }

  return result
}

/** Announce a rotation on the project's notification channels. */
export async function notifyRotation(
  service: SupabaseClient,
  pool: RotatablePool,
  trigger: 'manual' | 'scheduled' | 'risk',
  result: RotatePoolResult,
  reason?: string
): Promise<void> {
  if (!result.rotated) return
  const label = pool.name ?? pool.id
  await dispatch(service, {
    projectId: pool.project_id,
    event: trigger === 'risk' ? 'high_risk' : 'rotation',
    subject: `Key pool "${label}" rotated (${trigger})`,
    message:
      `SmartCloud rotated the active key for pool "${label}"` +
      (reason ? ` — ${reason}.` : '.'),
    data: {
      pool_id: pool.id,
      trigger,
      from_key_id: result.from_key_id,
      to_key_id: result.to_key_id,
    },
  })
}

// How far back pool risk is ever assessed. Matches the risk engine's own
// longest window (`ipWindowDays`), so nothing outside it can affect a score.
export const RISK_WINDOW_DAYS = 7
// Hard cap on rows pulled for one assessment. Without an explicit limit,
// PostgREST silently truncates at its default (1000) — and without an ORDER BY
// that truncation drops an ARBITRARY subset, which on a busy pool can discard
// exactly the recent rows the frequency rule depends on.
const RISK_MAX_ROWS = 5000

export interface PoolRiskOptions {
  /**
   * Ignore activity at or before this timestamp. The cron passes the pool's
   * `last_rotated_at`: evidence that already caused a rotation shouldn't cause
   * the next one, so the window resets and the score genuinely decays after
   * rotating instead of staying pinned high.
   */
  since?: string | null
}

// Live risk for a pool, computed over its recent access logs (not persisted).
export async function computePoolRisk(
  service: SupabaseClient,
  poolId: string,
  now = new Date(),
  opts: PoolRiskOptions = {}
): Promise<{ score: number; level: RiskLevel; window_start: string; sample_size: number }> {
  const windowFloor = now.getTime() - RISK_WINDOW_DAYS * 86_400_000
  const sinceMs = opts.since ? new Date(opts.since).getTime() : NaN
  const startMs = Number.isNaN(sinceMs) ? windowFloor : Math.max(windowFloor, sinceMs)
  const windowStart = new Date(startMs).toISOString()

  const { data: logs } = await service
    .from('pool_access_logs')
    .select('action, ip_address, accessed_at')
    .eq('pool_id', poolId)
    .gte('accessed_at', windowStart)
    .order('accessed_at', { ascending: false })
    .limit(RISK_MAX_ROWS)

  const a = assessRisk((logs ?? []) as RiskLogEntry[], { now })
  return {
    score: a.score,
    level: a.level,
    window_start: windowStart,
    sample_size: a.sample_size,
  }
}
