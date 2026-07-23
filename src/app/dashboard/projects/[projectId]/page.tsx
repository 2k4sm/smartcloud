import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Boxes, Plus } from 'lucide-react'
import SecretsTable, { type SecretRisk } from '@/components/secrets/SecretsTable'
import RecomputeRiskButton from '@/components/risk/RecomputeRiskButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RiskLevel } from '@/lib/risk'

type Props = { params: Promise<{ projectId: string }> }

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const [{ data: project }, { data: secrets }, { data: riskRows }, { data: pools }] =
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
      supabase
        .from('key_pools')
        .select('id, name, description')
        .eq('project_id', projectId)
        .order('name', { ascending: true }),
    ])

  if (!project) notFound()

  const keyPools = (pools ?? []) as { id: string; name: string; description: string | null }[]

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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <span className="inline-block rounded-md border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {project.id}
          </span>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RecomputeRiskButton projectId={projectId} />
          <Button asChild>
            <Link href={`/dashboard/projects/${projectId}/secrets/new`}>
              <Plus className="size-4" />
              Add secret
            </Link>
          </Button>
        </div>
      </div>

      <SecretsTable secrets={secrets ?? []} projectId={projectId} risk={risk} />

      {/* Key pools — rotating pools of interchangeable real keys */}
      <div className="mt-10">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Key pools</h2>
            <p className="text-sm text-muted-foreground">
              Pools of interchangeable keys; the active one rotates by least-used, on schedule or risk.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/dashboard/projects/${projectId}/pools/new`}>
              <Plus className="size-4" />
              New pool
            </Link>
          </Button>
        </div>
        {keyPools.length === 0 ? (
          <Card className="border-dashed py-10 text-center">
            <CardContent className="text-sm text-muted-foreground">
              No key pools yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {keyPools.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/projects/${projectId}/pools/${p.id}`}
                className="group"
              >
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-mono text-primary">
                      <Boxes className="size-4 shrink-0" />
                      {p.name}
                    </CardTitle>
                    {p.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
