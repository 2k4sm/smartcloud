import { notFound } from 'next/navigation'
import { Activity, Sparkles } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import AnalyzeRiskButton from '@/components/risk/AnalyzeRiskButton'
import CloudSyncPanel from '@/components/cloud/CloudSyncPanel'
import { PageHeader } from '@/components/dashboard/page-header'
import { MidTruncate } from '@/components/ui/mid-truncate'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { RiskScore } from '@/lib/types'

// Colored chip per access action. Create/update/delete are state changes
// worth spotting in a scan; a plain read stays neutral.
const ACTION_STYLES: Record<string, string> = {
  READ: 'bg-muted text-muted-foreground border-transparent',
  CREATE: 'bg-success-bg text-success border-success-border',
  UPDATE: 'bg-warning-bg text-warning border-warning-border',
  DELETE: 'bg-danger-bg text-danger border-danger-border',
}

function MetaRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
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

  const [{ data: secret }, { data: scores }, { data: logs }] = await Promise.all(
    [
      supabase
        .from('secrets')
        .select('id, key_name, description, project_id, created_at, updated_at')
        .eq('id', secretId)
        .eq('project_id', projectId)
        .single(),
      supabase
        .from('risk_scores')
        .select(
          'id, secret_id, user_id, project_id, score, level, factors, sample_size, ai_summary, window_start, window_end, computed_at',
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
    ],
  )

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
        backHref={`/dashboard/projects/${projectId}`}
        backLabel="Secrets"
        title={<span className="font-mono break-all">{secret.key_name}</span>}
        description={
          secret.description ||
          'Risk analysis, access activity and cloud sync for this secret.'
        }
      >
        {latest && (
          <RiskBadge level={latest.level} score={latest.score} size="md" />
        )}
        <RecomputeRiskButton projectId={projectId} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {!latest ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Sparkles />
                </EmptyMedia>
                <EmptyTitle>No risk analysis yet</EmptyTitle>
                <EmptyDescription>
                  Run “Recompute risk” to score this secret from its access
                  history.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Risk score</CardTitle>
                  <CardAction className="text-right text-xs text-muted-foreground">
                    <div>{latest.sample_size} access log(s) analyzed</div>
                    <div>
                      updated {new Date(latest.computed_at).toLocaleString()}
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* The hero figure: proportional digits, since it stands
                      alone rather than aligning down a column. */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                    <span className="text-5xl font-semibold tracking-tight">
                      {latest.score}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / 100
                    </span>
                    <RiskBadge level={latest.level} size="md" />
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Risk factors
                    </p>
                    {latest.factors.map((f) => (
                      <div key={f.key}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span>{f.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {f.points} / {f.max}
                          </span>
                        </div>
                        <Progress
                          value={f.max ? (f.points / f.max) * 100 : 0}
                          className="h-2"
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {f.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-brand/25 bg-brand-subtle">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-brand">
                    <Sparkles className="size-4" aria-hidden />
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
                    <p className="text-sm leading-relaxed">
                      {latest.ai_summary}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No AI explanation yet. Analyze this score to get a
                      plain-English summary of why it landed where it did.
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
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28 pl-4">Action</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead className="w-52 pr-4 text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessLogs.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-4">
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
                      <TableCell className="max-w-0 font-mono text-muted-foreground">
                        <span
                          className="block truncate"
                          title={l.ip_address ?? undefined}
                        >
                          {l.ip_address ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">
                        {new Date(l.accessed_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Activity />
                  </EmptyMedia>
                  <EmptyTitle>No access recorded</EmptyTitle>
                  <EmptyDescription>
                    Nothing has read or written this secret yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </Card>
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-6">
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
            <Card className="gap-0 overflow-hidden py-0">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-sm">Score history</CardTitle>
              </CardHeader>
              <ItemGroup>
                {history.map((h, i) => (
                  <div key={h.id}>
                    {i > 0 && <ItemSeparator />}
                    <Item size="sm">
                      <ItemContent>
                        <ItemTitle className="text-xs font-normal text-muted-foreground tabular-nums">
                          {new Date(h.computed_at).toLocaleString()}
                        </ItemTitle>
                      </ItemContent>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm tabular-nums">{h.score}</span>
                        <RiskBadge level={h.level} />
                      </div>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            </Card>
          )}

          <CloudSyncPanel projectId={projectId} secretId={secretId} />
        </div>
      </div>
    </div>
  )
}
