import Link from 'next/link'
import { KeyRound, LayoutGrid, ShieldAlert } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { RiskLevel } from '@/lib/risk'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { PageHeader } from '@/components/dashboard/page-header'
import { NewProjectDialog } from '@/components/projects/NewProjectDialog'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: projects }, { data: riskRows }, { data: secretRows }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, name, description, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('risk_scores')
        .select('secret_id, project_id, level, computed_at')
        .order('computed_at', { ascending: false }),
      supabase.from('secrets').select('project_id'),
    ])

  // Count HIGH-risk secrets per project using each secret's latest score.
  const seenSecret = new Set<string>()
  const highByProject = new Map<string, number>()
  for (const r of (riskRows ?? []) as {
    secret_id: string
    project_id: string
    level: RiskLevel
  }[]) {
    if (seenSecret.has(r.secret_id)) continue
    seenSecret.add(r.secret_id)
    if (r.level === 'HIGH') {
      highByProject.set(r.project_id, (highByProject.get(r.project_id) ?? 0) + 1)
    }
  }

  // Total secrets per project.
  const secretsByProject = new Map<string, number>()
  for (const s of (secretRows ?? []) as { project_id: string }[]) {
    secretsByProject.set(
      s.project_id,
      (secretsByProject.get(s.project_id) ?? 0) + 1,
    )
  }

  const projectList = projects ?? []

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every project is an isolated set of encrypted secrets, with its own team, cloud targets and alerts."
      >
        {projectList.length > 0 && <NewProjectDialog />}
      </PageHeader>

      {projectList.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              Create a project to start storing encrypted secrets, then invite
              your team and connect a cloud provider.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewProjectDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {projectList.map((project) => {
            const high = highByProject.get(project.id) ?? 0
            const count = secretsByProject.get(project.id) ?? 0
            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full gap-4 transition-shadow duration-200 group-hover:border-brand/40 group-hover:shadow-[var(--shadow-e2)]">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 truncate font-semibold transition-colors group-hover:text-brand">
                        {project.name}
                      </div>
                      {high > 0 && (
                        <Badge
                          variant="outline"
                          className="shrink-0 gap-1 border-danger-border bg-danger-bg text-danger"
                        >
                          <ShieldAlert className="size-3" aria-hidden />
                          {high} high
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {project.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">
                        No description
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t pt-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <KeyRound className="size-3.5" aria-hidden />
                      {count} {count === 1 ? 'secret' : 'secrets'}
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
