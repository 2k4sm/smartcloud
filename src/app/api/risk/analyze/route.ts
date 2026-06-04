import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { aiEnabled, explainRisk, AiUnavailableError } from '@/lib/ai'
import type { RiskScore } from '@/lib/types'

// POST /api/risk/analyze
// Body: { project_id, secret_id }
// Generates a natural-language explanation for the secret's latest risk score
// (via Gemini through the LiteLLM proxy) and stores it on the score row.
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth

  if (!aiEnabled()) {
    return NextResponse.json(
      { error: 'AI analysis is not configured on this server.' },
      { status: 503 }
    )
  }

  let body: { project_id?: string; secret_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { project_id, secret_id } = body
  if (!project_id || !secret_id) {
    return NextResponse.json(
      { error: 'project_id and secret_id are required' },
      { status: 400 }
    )
  }

  // Latest risk score for this secret (scoped to caller).
  let scoreQuery = supabase
    .from('risk_scores')
    .select(
      'id, secret_id, user_id, project_id, score, level, factors, sample_size, ai_summary, window_start, window_end, computed_at'
    )
    .eq('secret_id', secret_id)
    .eq('project_id', project_id)
    .order('computed_at', { ascending: false })
    .limit(1)
  if (auth.requiresUserFilter) scoreQuery = scoreQuery.eq('user_id', userId)
  const { data: rows } = await scoreQuery
  const latest = (rows ?? [])[0] as RiskScore | undefined

  if (!latest) {
    return NextResponse.json(
      { error: 'No risk score yet — recompute risk first.' },
      { status: 404 }
    )
  }

  // Secret key name for the prompt.
  let secretQuery = supabase
    .from('secrets')
    .select('key_name')
    .eq('id', secret_id)
  if (auth.requiresUserFilter) secretQuery = secretQuery.eq('user_id', userId)
  const { data: secret } = await secretQuery.single()

  let summary: string
  try {
    summary = await explainRisk({
      keyName: secret?.key_name ?? 'secret',
      assessment: {
        score: latest.score,
        level: latest.level,
        factors: latest.factors,
        sample_size: latest.sample_size,
      },
    })
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      const status = err.code === 'rate_limited' ? 429 : 503
      return NextResponse.json({ error: err.message }, { status })
    }
    throw err
  }

  // Persist the summary on the latest score row (service client, server-only write).
  await createServiceClient()
    .from('risk_scores')
    .update({ ai_summary: summary })
    .eq('id', latest.id)

  return NextResponse.json({ secret_id, summary })
}
