import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SecretsTable, { type SecretRisk } from '@/components/secrets/SecretsTable'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import { AddSecretDialog } from '@/components/secrets/AddSecretDialog'
import { PageHeader } from '@/components/dashboard/page-header'
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
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description || undefined}
      >
        <RecomputeRiskButton projectId={projectId} />
        <AddSecretDialog projectId={projectId} />
      </PageHeader>

      <span className="inline-block rounded-md border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
        {project.id}
      </span>

      <SecretsTable secrets={secrets ?? []} projectId={projectId} risk={risk} />
    </div>
  )
}
