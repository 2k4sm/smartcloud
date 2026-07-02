import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rotateSecret, type RotatableSecret } from '@/lib/rotation'
import { rotateHighRiskSecrets } from '@/lib/autoRotation'

// GET /api/cron/rotate — invoked by Vercel Cron (see vercel.json).
// Rotates every secret whose scheduled interval is due. Protected by CRON_SECRET:
// Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the env
// var is set.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: secrets, error } = await service
    .from('secrets')
    .select('id, key_name, project_id, user_id, rotation_interval_days, last_rotated_at')
    .eq('auto_rotate', true)

  if (error) {
    return NextResponse.json({ error: 'Failed to load secrets' }, { status: 500 })
  }

  const now = Date.now()
  const due = (secrets ?? []).filter((s) => {
    if (!s.rotation_interval_days || s.rotation_interval_days <= 0) return false
    if (!s.last_rotated_at) return true // never rotated -> due now
    const nextDue =
      new Date(s.last_rotated_at).getTime() +
      s.rotation_interval_days * 86_400_000
    return now >= nextDue
  })

  const results = []
  for (const s of due) {
    const result = await rotateSecret(service, s as RotatableSecret, {
      trigger: 'scheduled',
    })
    // Don't leak generated values from the cron path.
    delete result.new_value
    results.push(result)
  }

  // Risk-driven pass: recompute risk and rotate secrets that crossed HIGH.
  const risk = await rotateHighRiskSecrets(service)

  return NextResponse.json({
    scheduled: {
      checked: secrets?.length ?? 0,
      rotated: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    },
    risk_driven: risk,
  })
}
