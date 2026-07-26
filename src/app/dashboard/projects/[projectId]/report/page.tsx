import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Activity, CalendarClock, KeyRound, ShieldAlert } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import AccessTimeline, {
  type DayCount,
} from '@/components/reports/AccessTimeline'
import ReportActions from '@/components/reports/ReportActions'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
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

  const [{ data: secrets }, { data: risks }, { data: logs }] = await Promise.all(
    [
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
    ],
  )

  const latestRisk = new Map<string, { score: number; level: RiskLevel }>()
  for (const r of (risks ?? []) as {
    secret_id: string
    score: number
    level: RiskLevel
  }[]) {
    if (!latestRisk.has(r.secret_id))
      latestRisk.set(r.secret_id, { score: r.score, level: r.level })
  }
  const accessCounts = new Map<string, number>()
  for (const l of (logs ?? []) as { secret_id: string }[]) {
    accessCounts.set(l.secret_id, (accessCounts.get(l.secret_id) ?? 0) + 1)
  }

  // Build a 14-day access timeline (UTC day buckets).
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
      const rank =
        (b.risk ? RISK_RANK[b.risk.level] : 0) -
        (a.risk ? RISK_RANK[a.risk.level] : 0)
      return rank !== 0 ? rank : b.access - a.access
    })

  const highRisk = rows.filter((r) => r.risk?.level === 'HIGH').length
  const totalAccess = rows.reduce((sum, r) => sum + r.access, 0)
  const access14 = days.reduce((sum, d) => sum + d.count, 0)
  const maxAccess = Math.max(1, ...rows.map((r) => r.access))

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title="Security report"
        eyebrow={project.name}
        description={`Generated ${new Date().toLocaleString()}`}
      >
        <ReportActions projectId={projectId} />
      </PageHeader>

      <StatGrid columns={4}>
        <StatCard label="Total secrets" value={rows.length} icon={KeyRound} />
        <StatCard
          label="High risk"
          value={highRisk}
          icon={ShieldAlert}
          tone={highRisk > 0 ? 'danger' : 'default'}
        />
        <StatCard label="Total accesses" value={totalAccess} icon={Activity} />
        <StatCard
          label="Accesses (14 days)"
          value={access14}
          icon={CalendarClock}
        />
      </StatGrid>

      <AccessTimeline days={days} />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm">
            Secrets by risk, then by access volume
          </CardTitle>
        </CardHeader>

        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRound />
              </EmptyMedia>
              <EmptyTitle>Nothing to report yet</EmptyTitle>
              <EmptyDescription>
                This project has no secrets, so there is no risk or access data
                to summarise.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Secret</TableHead>
                <TableHead className="w-36">Risk</TableHead>
                <TableHead className="w-1/3 min-w-40 pr-4">Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-0 pl-4">
                    <Link
                      href={`/dashboard/projects/${projectId}/secrets/${r.id}`}
                      className="block truncate font-mono font-medium text-brand hover:underline"
                      title={r.key_name}
                    >
                      {r.key_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.risk ? (
                      <RiskBadge level={r.risk.level} score={r.risk.score} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not scored
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center gap-3">
                      <Progress
                        value={(r.access / maxAccess) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="w-10 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                        {r.access}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
