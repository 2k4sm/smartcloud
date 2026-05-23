import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import type { RiskScore } from '@/lib/types'

// GET /api/risk?project_id=...            -> latest risk score per secret
// GET /api/risk?project_id=...&secret_id= -> full score history for one secret
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth

  const projectId = request.nextUrl.searchParams.get('project_id')
  const secretId = request.nextUrl.searchParams.get('secret_id')
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  let query = supabase
    .from('risk_scores')
    .select(
      'id, secret_id, user_id, project_id, score, level, factors, sample_size, ai_summary, window_start, window_end, computed_at'
    )
    .eq('project_id', projectId)
    .order('computed_at', { ascending: false })
  if (secretId) query = query.eq('secret_id', secretId)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to load risk scores' }, { status: 500 })
  }

  const rows = (data ?? []) as RiskScore[]

  // History mode returns everything (already newest-first).
  if (secretId) {
    return NextResponse.json({ project_id: projectId, scores: rows })
  }

  // Latest-per-secret: rows are newest-first, so keep the first seen per secret.
  const latest = new Map<string, RiskScore>()
  for (const r of rows) {
    if (!latest.has(r.secret_id)) latest.set(r.secret_id, r)
  }

  return NextResponse.json({
    project_id: projectId,
    scores: [...latest.values()],
  })
}
