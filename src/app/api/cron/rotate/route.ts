import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { shouldRotate } from '@/lib/pool'
import { rotatePool, computePoolRisk } from '@/lib/poolRotation'

// GET /api/cron/rotate — rotation scheduler tick.
//
// Invoked by the `scheduler` service in docker-compose.yml (see
// DEPLOY-DOKPLOY.md). Any external scheduler works — systemd timer, pg_cron +
// pg_net, GitHub Actions, Vercel Cron — as long as it sends
// `Authorization: Bearer <CRON_SECRET>`. Ticking hourly is recommended: the
// decision itself is idempotent (a pool rotates only when its interval has
// actually elapsed or its risk crossed the threshold), so a more frequent tick
// only improves how promptly a risk spike is acted on.
//
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PAGE_SIZE = 500

interface PoolRow {
  id: string
  project_id: string
  name: string
  rotation_interval_days: number | null
  rotate_on_high_risk: boolean
  risk_threshold: number
  current_key_id: string | null
  last_rotated_at: string | null
}

const POOL_COLUMNS =
  'id, project_id, name, rotation_interval_days, rotate_on_high_risk, risk_threshold, current_key_id, last_rotated_at'

// Page through every pool that has a rotation policy at all. Paging matters:
// an unbounded select is silently capped at PostgREST's default row limit, so
// on a large install the pools past that cap would never rotate.
async function loadPolicyPools(
  service: ReturnType<typeof createServiceClient>
): Promise<PoolRow[]> {
  const pools: PoolRow[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await service
      .from('key_pools')
      .select(POOL_COLUMNS)
      .or('rotation_interval_days.not.is.null,rotate_on_high_risk.is.true')
      .order('created_at', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    pools.push(...((data ?? []) as PoolRow[]))
    if (!data || data.length < PAGE_SIZE) return pools
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  let pools: PoolRow[]
  try {
    pools = await loadPolicyPools(service)
  } catch (err) {
    console.error('cron/rotate: failed to load pools', err)
    return NextResponse.json({ error: 'Failed to load pools' }, { status: 500 })
  }

  const now = new Date()
  const results = []
  const errors: { pool: string; detail: string }[] = []

  for (const pool of pools) {
    // One bad pool must not abort the whole tick — every other pool still
    // deserves its rotation.
    try {
      let risk: { score: number; level: string } | null = null
      if (pool.rotate_on_high_risk) {
        // Assess only activity since the last rotation (bounded to the risk
        // engine's 7-day window). Evidence that already triggered a rotation
        // shouldn't trigger the next one.
        risk = await computePoolRisk(service, pool.id, now, {
          since: pool.last_rotated_at,
        })
      }

      const decision = shouldRotate(
        {
          rotation_interval_days: pool.rotation_interval_days,
          last_rotated_at: pool.last_rotated_at,
          rotate_on_high_risk: pool.rotate_on_high_risk,
          risk_threshold: pool.risk_threshold,
        },
        risk?.score ?? null,
        now
      )
      if (!decision.rotate || !decision.trigger) continue

      const reason =
        decision.trigger === 'risk'
          ? `risk score ${risk?.score} (${risk?.level}) at or above threshold ${pool.risk_threshold}`
          : `scheduled interval of ${pool.rotation_interval_days} day(s) elapsed`

      // rotatePool dispatches the notification itself.
      const res = await rotatePool(service, pool, decision.trigger, { reason, now })
      results.push({ pool: pool.name, trigger: decision.trigger, ...res })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`cron/rotate: pool ${pool.id} failed`, err)
      errors.push({ pool: pool.name, detail })
    }
  }

  return NextResponse.json({
    checked: pools.length,
    rotated: results.filter((r) => r.rotated).length,
    errors,
    results,
  })
}
