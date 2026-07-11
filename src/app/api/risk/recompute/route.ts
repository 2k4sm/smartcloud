import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { assessRisk, type RiskLogEntry } from '@/lib/risk'
import { dispatch } from '@/lib/notify'

// POST /api/risk/recompute
// Body: { project_id: string, secret_id?: string }
// Recomputes the rule-based risk score for one secret, or every secret in a
// project when secret_id is omitted. Persists a new risk_scores row per secret
// and returns the fresh assessments.
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth

  let body: { project_id?: string; secret_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { project_id, secret_id } = body
  if (!project_id) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  // Resolve the target secrets (scoped to the caller).
  let secretQuery = supabase
    .from('secrets')
    .select('id, key_name, project_id')
    .eq('project_id', project_id)
  if (secret_id) secretQuery = secretQuery.eq('id', secret_id)
  if (auth.requiresUserFilter) secretQuery = secretQuery.eq('user_id', userId)
  const { data: secrets, error: secretsError } = await secretQuery

  if (secretsError) {
    return NextResponse.json({ error: 'Failed to load secrets' }, { status: 500 })
  }
  if (!secrets || secrets.length === 0) {
    return NextResponse.json({ error: 'No matching secrets' }, { status: 404 })
  }

  const service = createServiceClient()
  const now = new Date()
  const results: {
    secret_id: string
    key_name: string
    score: number
    level: string
  }[] = []

  for (const secret of secrets) {
    // Pull the access-log history for this secret (scoped to the caller).
    let logsQuery = supabase
      .from('access_logs')
      .select('action, ip_address, accessed_at')
      .eq('secret_id', secret.id)
      .order('accessed_at', { ascending: true })
    if (auth.requiresUserFilter) logsQuery = logsQuery.eq('user_id', userId)
    const { data: logs } = await logsQuery

    const assessment = assessRisk((logs ?? []) as RiskLogEntry[], { now })

    // Persist history row via service client (RLS write path is server-only).
    await service.from('risk_scores').insert({
      secret_id: secret.id,
      user_id: userId,
      project_id: secret.project_id,
      score: assessment.score,
      level: assessment.level,
      factors: assessment.factors,
      sample_size: assessment.sample_size,
      window_start: assessment.window_start,
      window_end: assessment.window_end,
      computed_at: now.toISOString(),
    })

    // Alert subscribers when a secret lands in HIGH risk.
    if (assessment.level === 'HIGH') {
      await dispatch(service, {
        projectId: secret.project_id,
        event: 'high_risk',
        subject: `High risk: ${secret.key_name} (${assessment.score}/100)`,
        message:
          `Secret "${secret.key_name}" scored ${assessment.score}/100 (HIGH). ` +
          `Review its access pattern in the SmartCloud dashboard.`,
        data: { secret_id: secret.id, score: assessment.score },
      })
    }

    results.push({
      secret_id: secret.id,
      key_name: secret.key_name,
      score: assessment.score,
      level: assessment.level,
    })
  }

  return NextResponse.json({
    project_id,
    computed_at: now.toISOString(),
    count: results.length,
    results,
  })
}
