import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { RiskLevel } from '@/lib/risk'

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your secret projects</p>
        </div>
        <Link href="/dashboard/projects/new" className="btn-primary inline-flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New project
        </Link>
      </div>

      {!projects?.length ? (
        <div className="glass-card border-dashed text-center py-16">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <p className="text-gray-400">No projects yet.</p>
          <Link
            href="/dashboard/projects/new"
            className="text-cyan-400 hover:text-cyan-300 text-sm mt-2 inline-block transition-colors"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="group glass-card p-6 hover:shadow-lg hover:shadow-blue-500/5 hover:border-white/20 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">{project.name}</h3>
                {(highByProject.get(project.id) ?? 0) > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium rounded-full border px-2 py-0.5 bg-rose-400/10 text-rose-300 border-rose-400/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {highByProject.get(project.id)} high
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{project.description}</p>
              )}
              <div className="border-t border-white/5 mt-4 pt-3">
                <p className="text-gray-500 text-xs font-mono truncate" title={project.id}>
                  ID: {project.id}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
