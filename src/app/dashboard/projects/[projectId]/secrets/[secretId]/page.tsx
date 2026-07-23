import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import AnalyzeRiskButton from '@/components/risk/AnalyzeRiskButton'
import CloudSyncPanel from '@/components/cloud/CloudSyncPanel'
import { PageHeader } from '@/components/dashboard/page-header'
import { MidTruncate } from '@/components/ui/mid-truncate'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RiskScore } from '@/lib/types'

// Colored chip per access action — readable in light and dark.
const ACTION_STYLES: Record<string, string> = {
  READ: 'bg-muted text-muted-foreground border-transparent',
  CREATE: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  UPDATE: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  DELETE: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right break-words">{children}</span>
    </div>
  )
}

type Props = { params: Promise<{ projectId: string; secretId: string }> }

export default async function SecretDetailPage({ params }: Props) {
  const { projectId, secretId } = await params
  const supabase = await createServerSupabaseClient()

  const [{ data: secret }, { data: scores }, { data: logs }] = await Promise.all([
    supabase
      .from('secrets')
      .select('id, key_name, description, project_id, created_at, updated_at')
      .eq('id', secretId)
      .eq('project_id', projectId)
      .single(),
    supabase
      .from('risk_scores')
      .select(
        'id, secret_id, user_id, project_id, score, level, factors, sample_size, ai_summary, window_start, window_end, computed_at'
      )
      .eq('secret_id', secretId)
      .order('computed_at', { ascending: false })
      .limit(20),
    supabase
      .from('access_logs')
      .select('action, ip_address, accessed_at')
      .eq('secret_id', secretId)
      .order('accessed_at', { ascending: false })
      .limit(15),
  ])

  if (!secret) notFound()

  const history = (scores ?? []) as RiskScore[]
  const latest = history[0]
  const accessLogs = (logs ?? []) as {
    action: string
    ip_address: string | null
    accessed_at: string
  }[]

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title={<span className="font-mono">{secret.key_name}</span>}
        description="Risk analysis, access activity and cloud sync for this secret."
      >
        {latest && <RiskBadge level={latest.level} score={latest.score} size="md" />}
        <RecomputeRiskButton projectId={projectId} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {!latest ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <Sparkles className="mb-3 size-9 text-muted-foreground/50" />
                <p className="mb-1 font-medium">No risk analysis yet</p>
                <p className="text-sm text-muted-foreground">
                  Run “Recompute risk” to score this secret from its access
                  history.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Risk score</CardTitle>
                  <CardAction className="text-right text-xs text-muted-foreground">
                    <div>{latest.sample_size} access log(s) analyzed</div>
                    <div>updated {new Date(latest.computed_at).toLocaleString()}</div>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold tracking-tight tabular-nums">
                      {latest.score}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                    <RiskBadge level={latest.level} size="md" />
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Risk factors
                    </p>
                    {latest.factors.map((f) => (
                      <div key={f.key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>{f.label}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {f.points} / {f.max}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="brand-gradient h-full rounded-full"
                            style={{
                              width: `${f.max ? (f.points / f.max) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {f.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Sparkles className="size-4" />
                    AI analysis
                  </CardTitle>
                  <CardAction>
                    <AnalyzeRiskButton
                      projectId={projectId}
                      secretId={secretId}
                      hasSummary={Boolean(latest.ai_summary)}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {latest.ai_summary ? (
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {latest.ai_summary}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No AI explanation yet. Analyze this score to get a
                      plain-English summary.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-sm">Recent access</CardTitle>
            </CardHeader>
            {accessLogs.length ? (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28">Action</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead className="w-52 text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessLogs.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full font-medium',
                            ACTION_STYLES[l.action] ?? ACTION_STYLES.READ,
                          )}
                        >
                          {l.action}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="truncate font-mono text-muted-foreground"
                        title={l.ip_address ?? undefined}
                      >
                        {l.ip_address ?? '—'}
                      </TableCell>
                      <TableCell className="truncate text-right text-muted-foreground">
                        {new Date(l.accessed_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No access recorded yet.
              </CardContent>
            )}
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {secret.description && (
                <MetaRow label="Description">{secret.description}</MetaRow>
              )}
              <MetaRow label="Created">
                {new Date(secret.created_at).toLocaleDateString()}
              </MetaRow>
              <MetaRow label="Updated">
                {new Date(secret.updated_at).toLocaleDateString()}
              </MetaRow>
              <MetaRow label="Secret ID">
                <MidTruncate
                  text={secret.id}
                  tailChars={8}
                  className="font-mono text-xs text-muted-foreground"
                />
              </MetaRow>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Score history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {new Date(h.computed_at).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{h.score}</span>
                      <RiskBadge level={h.level} />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <CloudSyncPanel projectId={projectId} secretId={secretId} />
        </div>
      </div>
    </div>
  )
}
