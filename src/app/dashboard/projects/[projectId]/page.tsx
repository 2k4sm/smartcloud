import { notFound } from 'next/navigation'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SecretsTable, { type SecretRisk } from '@/components/secrets/SecretsTable'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import { AddSecretDialog } from '@/components/secrets/AddSecretDialog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
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
  const highCount = Object.values(risk).filter((r) => r.level === 'HIGH').length

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title={project.name}
        description={
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex min-w-0 max-w-full rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs">
              <MidTruncate text={project.id} tailChars={8} />
            </span>
            {project.description && (
              <span className="min-w-0 break-words">{project.description}</span>
            )}
          </span>
        }
      >
        <RecomputeRiskButton projectId={projectId} />
        <AddSecretDialog projectId={projectId} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Card className="gap-0 p-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <KeyRound className="size-3.5" />
            Secrets
          </span>
          <span className="mt-1 text-2xl font-semibold">{totalSecrets}</span>
        </Card>
        <Card className="gap-0 p-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5" />
            High risk
          </span>
          <span
            className={`mt-1 text-2xl font-semibold ${
              highCount > 0 ? 'text-destructive' : ''
            }`}
          >
            {highCount}
          </span>
        </Card>
      </div>

      <SecretsTable secrets={secretList} projectId={projectId} risk={risk} />
    </div>
  )
}
