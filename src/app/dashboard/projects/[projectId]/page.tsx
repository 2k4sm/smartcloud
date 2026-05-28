import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SecretsTable, { type SecretRisk } from '@/components/secrets/SecretsTable'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import type { RiskLevel } from '@/lib/risk'

type Props = { params: Promise<{ projectId: string }> }

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const [{ data: project }, { data: secrets }, { data: riskRows }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, name, description')
        .eq('id', projectId)
        .single(),
      supabase
        .from('secrets')
        .select('id, project_id, key_name, description, created_at, updated_at')
        .eq('project_id', projectId)
        .order('key_name', { ascending: true }),
      supabase
        .from('risk_scores')
        .select('secret_id, score, level, computed_at')
        .eq('project_id', projectId)
        .order('computed_at', { ascending: false }),
    ])

  if (!project) notFound()

  // Latest risk score per secret (rows are newest-first).
  const risk: Record<string, SecretRisk> = {}
  for (const r of (riskRows ?? []) as {
    secret_id: string
    score: number
    level: RiskLevel
  }[]) {
    if (!risk[r.secret_id]) risk[r.secret_id] = { score: r.score, level: r.level }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Projects
          </Link>
          <h1 className="text-3xl font-bold text-white mt-2 tracking-tight">{project.name}</h1>
          <span className="inline-block bg-white/5 border border-white/10 text-gray-400 text-xs font-mono px-2 py-0.5 rounded-lg mt-1.5">
            {project.id}
          </span>
          {project.description && (
            <p className="text-gray-400 text-sm mt-2">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RecomputeRiskButton projectId={projectId} />
          <Link href={`/dashboard/projects/${projectId}/members`} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Team
          </Link>
          <Link href={`/dashboard/projects/${projectId}/secrets/new`} className="btn-primary inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add secret
          </Link>
        </div>
      </div>

      <SecretsTable secrets={secrets ?? []} projectId={projectId} risk={risk} />
    </div>
  )
}
