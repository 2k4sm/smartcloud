import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { shouldRotate } from '@/lib/pool'
import { rotatePool, computePoolRisk } from '@/lib/poolRotation'
import { dispatch } from '@/lib/notify'

// GET /api/cron/rotate — invoked by Vercel Cron (see vercel.json).
// Rotates key pools whose schedule is due or whose risk crossed the threshold.
// Protected by CRON_SECRET (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: pools, error } = await service
    .from('key_pools')
    .select(
      'id, project_id, name, rotation_interval_days, rotate_on_high_risk, risk_threshold, current_key_id, last_rotated_at'
    )
  if (error) {
    return NextResponse.json({ error: 'Failed to load pools' }, { status: 500 })
  }

  const now = new Date()
  const results = []

  for (const pool of pools ?? []) {
    let riskScore: number | null = null
    if (pool.rotate_on_high_risk) {
      riskScore = (await computePoolRisk(service, pool.id, now)).score
    }

    const decision = shouldRotate(
      {
        rotation_interval_days: pool.rotation_interval_days,
        last_rotated_at: pool.last_rotated_at,
        rotate_on_high_risk: pool.rotate_on_high_risk,
        risk_threshold: pool.risk_threshold,
      },
      riskScore,
      now
    )
    if (!decision.rotate || !decision.trigger) continue

    const reason =
      decision.trigger === 'risk' ? `risk score ${riskScore}` : 'scheduled interval'
    const res = await rotatePool(service, pool, decision.trigger, { reason, now })

    if (res.rotated) {
      await dispatch(service, {
        projectId: pool.project_id,
        event: decision.trigger === 'risk' ? 'high_risk' : 'rotation',
        subject: `Key pool "${pool.name}" rotated (${decision.trigger})`,
        message: `SmartCloud rotated the active key for pool "${pool.name}" — ${reason}.`,
        data: { pool_id: pool.id, trigger: decision.trigger },
      })
    }
    results.push({ pool: pool.name, trigger: decision.trigger, ...res })
  }

  return NextResponse.json({
    checked: pools?.length ?? 0,
    rotated: results.filter((r) => r.rotated).length,
    results,
  })
}
