import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RiskBadge from '@/components/risk/RiskBadge'
import AccessTimeline, { type DayCount } from '@/components/reports/AccessTimeline'
import ReportActions from '@/components/reports/ReportActions'
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

  const [{ data: secrets }, { data: risks }, { data: logs }, { data: jobs }] =
    await Promise.all([
      supabase.from('secrets').select('id, key_name, last_rotated_at').eq('project_id', projectId),
      supabase
        .from('risk_scores')
        .select('secret_id, score, level, computed_at')
        .eq('project_id', projectId)
        .order('computed_at', { ascending: false }),
      supabase
        .from('access_logs')
        .select('secret_id, accessed_at')
        .eq('project_id', projectId),
      supabase
        .from('rotation_jobs')
        .select('secret_id')
        .eq('project_id', projectId)
        .eq('status', 'success'),
    ])

  const latestRisk = new Map<string, { score: number; level: RiskLevel }>()
  for (const r of (risks ?? []) as { secret_id: string; score: number; level: RiskLevel }[]) {
    if (!latestRisk.has(r.secret_id)) latestRisk.set(r.secret_id, { score: r.score, level: r.level })
  }
  const accessCounts = new Map<string, number>()
  const rotationCounts = new Map<string, number>()
  for (const l of (logs ?? []) as { secret_id: string }[]) {
    accessCounts.set(l.secret_id, (accessCounts.get(l.secret_id) ?? 0) + 1)
  }
  for (const j of (jobs ?? []) as { secret_id: string }[]) {
    rotationCounts.set(j.secret_id, (rotationCounts.get(j.secret_id) ?? 0) + 1)
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

  const rows = ((secrets ?? []) as { id: string; key_name: string; last_rotated_at: string | null }[]).map((s) => ({
    ...s,
    risk: latestRisk.get(s.id) ?? null,
    access: accessCounts.get(s.id) ?? 0,
    rotations: rotationCounts.get(s.id) ?? 0,
  }))

  return (
    <div className="max-w-4xl">
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1 transition-colors print:hidden"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to project
      </Link>

      <div className="flex items-start justify-between mt-2 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Security report</h1>
          <p className="text-gray-400 text-sm mt-1">
            {project.name} · generated {new Date().toLocaleString()}
          </p>
        </div>
        <ReportActions projectId={projectId} />
      </div>

      <div className="mb-6">
        <AccessTimeline days={days} />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="text-left text-gray-400 font-medium px-4 py-3">Secret</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Risk</th>
              <th className="text-right text-gray-400 font-medium px-4 py-3">Access</th>
              <th className="text-right text-gray-400 font-medium px-4 py-3">Rotations</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Last rotated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-4 py-3 font-mono text-cyan-400">{r.key_name}</td>
                <td className="px-4 py-3">
                  {r.risk ? <RiskBadge level={r.risk.level} score={r.risk.score} /> : <span className="text-gray-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{r.access}</td>
                <td className="px-4 py-3 text-right text-gray-300">{r.rotations}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {r.last_rotated_at ? new Date(r.last_rotated_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
