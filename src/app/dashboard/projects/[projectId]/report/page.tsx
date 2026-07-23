import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import AccessTimeline, { type DayCount } from '@/components/reports/AccessTimeline'
import ReportActions from '@/components/reports/ReportActions'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RiskLevel } from '@/lib/risk'

type Props = { params: Promise<{ projectId: string }> }

export default async function ReportPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single()
  if (!project) notFound()

  const [{ data: secrets }, { data: risks }, { data: logs }] = await Promise.all([
    supabase.from('secrets').select('id, key_name').eq('project_id', projectId),
    supabase
      .from('risk_scores')
      .select('secret_id, score, level, computed_at')
      .eq('project_id', projectId)
      .order('computed_at', { ascending: false }),
    supabase
      .from('access_logs')
      .select('secret_id, accessed_at')
      .eq('project_id', projectId),
  ])

  const latestRisk = new Map<string, { score: number; level: RiskLevel }>()
  for (const r of (risks ?? []) as { secret_id: string; score: number; level: RiskLevel }[]) {
    if (!latestRisk.has(r.secret_id)) latestRisk.set(r.secret_id, { score: r.score, level: r.level })
  }
  const accessCounts = new Map<string, number>()
  for (const l of (logs ?? []) as { secret_id: string }[]) {
    accessCounts.set(l.secret_id, (accessCounts.get(l.secret_id) ?? 0) + 1)
  }

  // Build a 14-day access timeline (local-ish, UTC day buckets).
  const days: DayCount[] = []
  const today = new Date()
  const byDay = new Map<string, number>()
  for (const l of (logs ?? []) as { accessed_at: string }[]) {
    const key = l.accessed_at.slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, count: byDay.get(key) ?? 0 })
  }

  const rows = ((secrets ?? []) as { id: string; key_name: string }[]).map((s) => ({
    ...s,
    risk: latestRisk.get(s.id) ?? null,
    access: accessCounts.get(s.id) ?? 0,
  }))

  return (
    <div className="max-w-4xl">
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        <ArrowLeft className="size-4" />
        Back to project
      </Link>

      <div className="mt-2 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.name} · generated {new Date().toLocaleString()}
          </p>
        </div>
        <ReportActions projectId={projectId} />
      </div>

      <div className="mb-6">
        <AccessTimeline days={days} />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Secret</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-primary">{r.key_name}</TableCell>
                <TableCell>
                  {r.risk ? (
                    <RiskBadge level={r.risk.level} score={r.risk.score} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{r.access}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
