import { notFound } from 'next/navigation'
import { KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import SecretsTable, { type SecretRisk } from '@/components/secrets/SecretsTable'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import { AddSecretDialog } from '@/components/secrets/AddSecretDialog'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { MidTruncate } from '@/components/ui/mid-truncate'
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

  const secretList = secrets ?? []
  const totalSecrets = secretList.length
  const scored = Object.values(risk)
  const highCount = scored.filter((r) => r.level === 'HIGH').length
  const lowCount = scored.filter((r) => r.level === 'LOW').length

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title={project.name}
        description={
          project.description || 'Encrypted secrets for this project.'
        }
      >
        <RecomputeRiskButton projectId={projectId} />
        <AddSecretDialog projectId={projectId} />
      </PageHeader>

      <div className="inline-flex max-w-full items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
        <span className="shrink-0">Project ID</span>
        <MidTruncate
          text={project.id}
          tailChars={8}
          className="font-mono text-foreground"
        />
      </div>

      {totalSecrets > 0 && (
        <StatGrid>
          <StatCard label="Secrets" value={totalSecrets} icon={KeyRound} />
          <StatCard
            label="Scored low risk"
            value={lowCount}
            icon={ShieldCheck}
            tone={lowCount > 0 ? 'success' : 'default'}
          />
          <StatCard
            label="High risk"
            value={highCount}
            icon={ShieldAlert}
            tone={highCount > 0 ? 'danger' : 'default'}
            hint={
              highCount > 0
                ? 'Review these before they are read again.'
                : undefined
            }
          />
        </StatGrid>
      )}

      <SecretsTable secrets={secretList} projectId={projectId} risk={risk} />
    </div>
  )
}
