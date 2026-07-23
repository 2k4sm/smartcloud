import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { KeyRound, LayoutGrid } from 'lucide-react'
import type { RiskLevel } from '@/lib/risk'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/dashboard/page-header'
import { NewProjectDialog } from '@/components/projects/NewProjectDialog'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: projects }, { data: riskRows }, { data: secretRows }] = await Promise.all([
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
    secretsByProject.set(s.project_id, (secretsByProject.get(s.project_id) ?? 0) + 1)
  }

  return (
    <div data-full-width>
      <PageHeader title="Projects" description="Manage your secret projects" className="mb-8">
        <NewProjectDialog />
      </PageHeader>

      {!projects?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutGrid className="mb-4 size-10 text-muted-foreground/50" />
            <p className="mb-1 font-medium">No projects yet</p>
            <p className="mb-5 text-sm text-muted-foreground">
              Create a project to start storing encrypted secrets.
            </p>
            <NewProjectDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => {
            const high = highByProject.get(project.id) ?? 0
            const count = secretsByProject.get(project.id) ?? 0
            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full gap-4 transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate transition-colors group-hover:text-primary">
                        {project.name}
                      </CardTitle>
                      {high > 0 && (
                        <Badge variant="destructive" className="shrink-0">
                          {high} high
                        </Badge>
                      )}
                    </div>
                    {project.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">
                        No description
                      </p>
                    )}
                  </CardHeader>
                  <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t pt-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <KeyRound className="size-3.5" />
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
