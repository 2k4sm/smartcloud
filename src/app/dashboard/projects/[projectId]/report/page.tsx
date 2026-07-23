import { notFound } from 'next/navigation'
import { Activity, CalendarClock, KeyRound, ShieldAlert } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import AccessTimeline, { type DayCount } from '@/components/reports/AccessTimeline'
import ReportActions from '@/components/reports/ReportActions'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/lib/risk'

type Props = { params: Promise<{ projectId: string }> }

const RISK_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }

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

  const rows = ((secrets ?? []) as { id: string; key_name: string }[])
    .map((s) => ({
      ...s,
      risk: latestRisk.get(s.id) ?? null,
      access: accessCounts.get(s.id) ?? 0,
    }))
    // HIGH risk first, then most-accessed.
    .sort((a, b) => {
      const rank = (b.risk ? RISK_RANK[b.risk.level] : 0) - (a.risk ? RISK_RANK[a.risk.level] : 0)
      return rank !== 0 ? rank : b.access - a.access
    })

  const highRisk = rows.filter((r) => r.risk?.level === 'HIGH').length
  const totalAccess = rows.reduce((sum, r) => sum + r.access, 0)
  const access14 = days.reduce((sum, d) => sum + d.count, 0)
  const maxAccess = Math.max(1, ...rows.map((r) => r.access))

  const stats = [
    { label: 'Total secrets', value: rows.length, icon: KeyRound, tint: 'text-primary bg-primary/10' },
    {
      label: 'High risk',
      value: highRisk,
      icon: ShieldAlert,
      tint: highRisk > 0 ? 'text-rose-600 bg-rose-500/10 dark:text-rose-400' : 'text-muted-foreground bg-muted',
      valueClass: highRisk > 0 ? 'text-rose-600 dark:text-rose-400' : undefined,
    },
    { label: 'Total accesses', value: totalAccess, icon: Activity, tint: 'text-primary bg-primary/10' },
    { label: 'Accesses (14d)', value: access14, icon: CalendarClock, tint: 'text-primary bg-primary/10' },
  ]

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title="Security report"
        description={`${project.name} · generated ${new Date().toLocaleString()}`}
      >
        <ReportActions projectId={projectId} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4">
              <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', s.tint)}>
                <s.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className={cn('text-2xl font-semibold tabular-nums', s.valueClass)}>
                  {s.value}
                </div>
                <div className="truncate text-sm text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AccessTimeline days={days} />

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Secret</TableHead>
              <TableHead className="w-40">Risk</TableHead>
              <TableHead className="w-1/3">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">
                  No secrets in this project yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium text-primary">{r.key_name}</TableCell>
                  <TableCell>
                    {r.risk ? (
                      <RiskBadge level={r.risk.level} score={r.risk.score} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-chart-1"
                          style={{ width: `${(r.access / maxAccess) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                        {r.access}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
