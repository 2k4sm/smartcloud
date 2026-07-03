import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import AnalyzeRiskButton from '@/components/risk/AnalyzeRiskButton'
import RotationPanel from '@/components/rotation/RotationPanel'
import CloudSyncPanel from '@/components/cloud/CloudSyncPanel'
import type { RiskScore, RotationJob } from '@/lib/types'

type Props = { params: Promise<{ projectId: string; secretId: string }> }

export default async function SecretDetailPage({ params }: Props) {
  const { projectId, secretId } = await params
  const supabase = await createServerSupabaseClient()

  const [{ data: secret }, { data: scores }, { data: logs }, { data: jobs }] =
    await Promise.all([
    supabase
      .from('secrets')
      .select(
        'id, key_name, description, project_id, created_at, updated_at, auto_rotate, rotation_interval_days, last_rotated_at, rotate_on_high_risk'
      )
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
    supabase
      .from('rotation_jobs')
      .select('id, secret_id, status, trigger, strategy, detail, rotated_at, created_at')
      .eq('secret_id', secretId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!secret) notFound()

  const history = (scores ?? []) as RiskScore[]
  const latest = history[0]
  const rotationJobs = (jobs ?? []) as RotationJob[]

  return (
    <div className="max-w-4xl">
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to project
      </Link>

      <div className="flex items-start justify-between mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white font-mono tracking-tight">
            {secret.key_name}
          </h1>
          {secret.description && (
            <p className="text-gray-400 text-sm mt-2">{secret.description}</p>
          )}
        </div>
        <RecomputeRiskButton projectId={projectId} />
      </div>

      {!latest ? (
        <div className="glass-card border-dashed text-center py-12">
          <p className="text-gray-400">No risk analysis yet.</p>
          <p className="text-gray-500 text-sm mt-1">
            Run “Recompute risk” to score this secret from its access history.
          </p>
        </div>
      ) : (
        <>
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold text-white">{latest.score}</span>
                <span className="text-gray-500 text-sm">/ 100</span>
                <RiskBadge level={latest.level} size="md" />
              </div>
              <div className="text-right text-xs text-gray-500">
                <div>{latest.sample_size} access log(s) analyzed</div>
                <div>updated {new Date(latest.computed_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-cyan-300 text-xs font-medium">AI analysis</div>
                <AnalyzeRiskButton
                  projectId={projectId}
                  secretId={secretId}
                  hasSummary={Boolean(latest.ai_summary)}
                />
              </div>
              {latest.ai_summary ? (
                <p className="text-gray-300 text-sm leading-relaxed">{latest.ai_summary}</p>
              ) : (
                <p className="text-gray-500 text-sm">
                  No AI explanation yet. Analyze this score to get a plain-English summary.
                </p>
              )}
            </div>

            <div className="space-y-4">
              {latest.factors.map((f) => (
                <div key={f.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-300">{f.label}</span>
                    <span className="text-gray-500 text-xs">
                      {f.points} / {f.max}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${f.max ? (f.points / f.max) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{f.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <h2 className="text-white font-medium mb-3 text-sm">Score history</h2>
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {new Date(h.computed_at).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-gray-300">{h.score}</span>
                      <RiskBadge level={h.level} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="text-white font-medium mb-3 text-sm">Recent access</h2>
              {logs && logs.length ? (
                <div className="space-y-2">
                  {logs.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-gray-400">{l.action}</span>
                      <span className="text-gray-500">{l.ip_address ?? '—'}</span>
                      <span className="text-gray-500">
                        {new Date(l.accessed_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs">No access recorded yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <RotationPanel
          secretId={secretId}
          initialAutoRotate={secret.auto_rotate ?? false}
          initialInterval={secret.rotation_interval_days ?? null}
          initialRotateOnHighRisk={secret.rotate_on_high_risk ?? false}
          initialJobs={rotationJobs}
        />
        <CloudSyncPanel projectId={projectId} secretId={secretId} />
      </div>
    </div>
  )
}
