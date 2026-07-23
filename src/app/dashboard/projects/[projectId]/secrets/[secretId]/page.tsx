import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import AnalyzeRiskButton from '@/components/risk/AnalyzeRiskButton'
import CloudSyncPanel from '@/components/cloud/CloudSyncPanel'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { RiskScore } from '@/lib/types'

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

  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href={`/dashboard/projects/${projectId}`}>
          <ArrowLeft className="size-4" />
          Back to project
        </Link>
      </Button>

      <div className="mt-2 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {secret.key_name}
          </h1>
          {secret.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {secret.description}
            </p>
          )}
        </div>
        <RecomputeRiskButton projectId={projectId} />
      </div>

      {!latest ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent>
            <p className="text-muted-foreground">No risk analysis yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Run “Recompute risk” to score this secret from its access history.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold">{latest.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                  <RiskBadge level={latest.level} size="md" />
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{latest.sample_size} access log(s) analyzed</div>
                  <div>updated {new Date(latest.computed_at).toLocaleString()}</div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-xs font-medium text-primary">
                    AI analysis
                  </div>
                  <AnalyzeRiskButton
                    projectId={projectId}
                    secretId={secretId}
                    hasSummary={Boolean(latest.ai_summary)}
                  />
                </div>
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
              </div>

              <div className="space-y-4">
                {latest.factors.map((f) => (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{f.label}</span>
                      <span className="text-xs text-muted-foreground">
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

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Score history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">
                      {new Date(h.computed_at).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span>{h.score}</span>
                      <RiskBadge level={h.level} />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent access</CardTitle>
              </CardHeader>
              <CardContent>
                {logs && logs.length ? (
                  <div className="space-y-2">
                    {logs.map((l, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-mono text-muted-foreground">
                          {l.action}
                        </span>
                        <span className="text-muted-foreground">
                          {l.ip_address ?? '—'}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(l.accessed_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No access recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="mt-6">
        <CloudSyncPanel projectId={projectId} secretId={secretId} />
      </div>
    </div>
  )
}
