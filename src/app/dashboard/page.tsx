import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LayoutGrid, Plus } from 'lucide-react'
import type { RiskLevel } from '@/lib/risk'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: projects }, { data: riskRows }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, description, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('risk_scores')
      .select('secret_id, project_id, level, computed_at')
      .order('computed_at', { ascending: false }),
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

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your secret projects</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="size-4" />
            New project
          </Link>
        </Button>
      </div>

      {!projects?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutGrid className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No projects yet.</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-primary">
              <Link href="/dashboard/projects/new">Create your first project</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="transition-colors group-hover:text-primary">
                      {project.name}
                    </CardTitle>
                    {(highByProject.get(project.id) ?? 0) > 0 && (
                      <Badge variant="destructive" className="shrink-0">
                        {highByProject.get(project.id)} high
                      </Badge>
                    )}
                  </div>
                  {project.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </CardHeader>
                <CardFooter className="mt-auto flex-col items-start gap-1 border-t pt-4">
                  <p
                    className="w-full truncate font-mono text-xs text-muted-foreground"
                    title={project.id}
                  >
                    ID: {project.id}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
