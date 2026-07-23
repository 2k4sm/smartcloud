import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { aiEnabled, summarizeAnomalies, AiUnavailableError } from '@/lib/ai'
import type { RiskLogEntry } from '@/lib/risk'

// POST /api/ai/anomalies
// Body: { project_id }
// Summarizes suspicious patterns across a project's recent access logs.
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

  let body: { project_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.project_id) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  let projectQuery = supabase.from('projects').select('id, name').eq('id', body.project_id)
  if (auth.requiresUserFilter) projectQuery = projectQuery.eq('user_id', userId)
  const { data: project } = await projectQuery.single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let logsQuery = supabase
    .from('access_logs')
    .select('action, ip_address, accessed_at')
    .eq('project_id', body.project_id)
    .order('accessed_at', { ascending: false })
    .limit(100)
  if (auth.requiresUserFilter) logsQuery = logsQuery.eq('user_id', userId)
  const { data: logs } = await logsQuery

  try {
    const summary = await summarizeAnomalies({
      projectName: project.name,
      logs: (logs ?? []) as RiskLogEntry[],
    })
    return NextResponse.json({ project_id: body.project_id, summary })
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      const status = err.code === 'rate_limited' ? 429 : 503
      return NextResponse.json({ error: err.message }, { status })
    }
    throw err
  }
}
