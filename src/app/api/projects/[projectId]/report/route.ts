import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole } from '@/lib/access'
import type { RiskLevel } from '@/lib/risk'

type Params = { params: Promise<{ projectId: string }> }

interface SecretReportRow {
  key_name: string
  risk_score: number | null
  risk_level: RiskLevel | null
  access_count: number
}

// GET /api/projects/:id/report?format=csv|json
// Aggregates a per-secret security report for the project.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId } = await params
  const { supabase } = auth
  const format = request.nextUrl.searchParams.get('format') ?? 'json'

  if (!(await projectRole(createServiceClient(), projectId, auth.userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: secrets }, { data: risks }, { data: logs }] = await Promise.all([
    supabase.from('secrets').select('id, key_name').eq('project_id', projectId),
    supabase
      .from('risk_scores')
      .select('secret_id, score, level, computed_at')
      .eq('project_id', projectId)
      .order('computed_at', { ascending: false }),
    supabase.from('access_logs').select('secret_id').eq('project_id', projectId),
  ])

  const latestRisk = new Map<string, { score: number; level: RiskLevel }>()
  for (const r of (risks ?? []) as { secret_id: string; score: number; level: RiskLevel }[]) {
    if (!latestRisk.has(r.secret_id)) latestRisk.set(r.secret_id, { score: r.score, level: r.level })
  }
  const accessCounts = new Map<string, number>()
  for (const l of (logs ?? []) as { secret_id: string }[]) {
    accessCounts.set(l.secret_id, (accessCounts.get(l.secret_id) ?? 0) + 1)
  }

  const rows: SecretReportRow[] = (
    (secrets ?? []) as { id: string; key_name: string }[]
  ).map((s) => ({
    key_name: s.key_name,
    risk_score: latestRisk.get(s.id)?.score ?? null,
    risk_level: latestRisk.get(s.id)?.level ?? null,
    access_count: accessCounts.get(s.id) ?? 0,
  }))

  if (format === 'csv') {
    const header = 'Secret,Risk Score,Risk Level,Access Count'
    const body = rows
      .map((r) =>
        [
          csv(r.key_name),
          r.risk_score ?? '',
          r.risk_level ?? '',
          r.access_count,
        ].join(',')
      )
      .join('\n')
    return new NextResponse(`${header}\n${body}\n`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug(project.name)}-report.csv"`,
      },
    })
  }

  return NextResponse.json({
    project: { id: project.id, name: project.name },
    generated_at: new Date().toISOString(),
    secret_count: rows.length,
    secrets: rows,
  })
}

// Minimal CSV field escaping.
function csv(field: string): string {
  if (/[",\n]/.test(field)) return `"${field.replace(/"/g, '""')}"`
  return field
}
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'
}
