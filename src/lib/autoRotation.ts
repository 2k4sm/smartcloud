import type { SupabaseClient } from '@supabase/supabase-js'
import { assessRisk, type RiskLogEntry } from '@/lib/risk'
import { rotateSecret, type RotatableSecret } from '@/lib/rotation'
import { dispatch } from '@/lib/notify'

export interface RiskRotationOutcome {
  secret_id: string
  key_name: string
  score: number
  level: string
  rotated: boolean
  detail?: string | null
}

export interface RiskRotationSummary {
  evaluated: number
  rotated: number
  results: RiskRotationOutcome[]
}

// Recompute risk for every secret opted into high-risk rotation and rotate the
// ones at/above the threshold. Persists a fresh risk_scores row per secret and
// fires a 'rotation' notification for each rotation. Uses a service-role client
// so it can run from the cron endpoint.
export async function rotateHighRiskSecrets(
  service: SupabaseClient,
  opts: { threshold?: number; now?: Date } = {}
): Promise<RiskRotationSummary> {
  const threshold = opts.threshold ?? 67 // HIGH
  const now = opts.now ?? new Date()

  const { data: secrets } = await service
    .from('secrets')
    .select('id, key_name, project_id, user_id')
    .eq('rotate_on_high_risk', true)

  const results: RiskRotationOutcome[] = []

  for (const s of (secrets ?? []) as RotatableSecret[]) {
    const { data: logs } = await service
      .from('access_logs')
      .select('action, ip_address, accessed_at')
      .eq('secret_id', s.id)

    const assessment = assessRisk((logs ?? []) as RiskLogEntry[], { now })

    await service.from('risk_scores').insert({
      secret_id: s.id,
      user_id: s.user_id,
      project_id: s.project_id,
      score: assessment.score,
      level: assessment.level,
      factors: assessment.factors,
      sample_size: assessment.sample_size,
      window_start: assessment.window_start,
      window_end: assessment.window_end,
      computed_at: now.toISOString(),
    })

    if (assessment.score >= threshold) {
      const rot = await rotateSecret(service, s, { trigger: 'risk' })
      if (rot.status === 'success') {
        await dispatch(service, {
          projectId: s.project_id,
          event: 'rotation',
          subject: `SmartCloud rotated ${s.key_name} (risk ${assessment.score})`,
          message:
            `Secret "${s.key_name}" was automatically rotated because its risk ` +
            `score reached ${assessment.score}/100 (${assessment.level}).`,
          data: { secret_id: s.id, score: assessment.score, trigger: 'risk' },
        })
      }
      results.push({
        secret_id: s.id,
        key_name: s.key_name,
        score: assessment.score,
        level: assessment.level,
        rotated: rot.status === 'success',
        detail: rot.detail,
      })
    } else {
      results.push({
        secret_id: s.id,
        key_name: s.key_name,
        score: assessment.score,
        level: assessment.level,
        rotated: false,
      })
    }
  }

  return {
    evaluated: results.length,
    rotated: results.filter((r) => r.rotated).length,
    results,
  }
}
