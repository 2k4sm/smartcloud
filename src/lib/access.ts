import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectRole } from '@/lib/types'

// Deterministic project authorization via the service-role client — mirrors the
// current_project_role() SQL function but in app code, so writes don't depend on
// RLS auth.uid() being forwarded (see the projects/secrets create fix).
export async function projectRole(
  service: SupabaseClient,
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  const { data: project } = await service
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return null
  if (project.user_id === userId) return 'owner'

  const { data: member } = await service
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  return (member?.role as ProjectRole) ?? null
}

/** owner/admin may write; viewer is read-only. */
export function canWrite(role: ProjectRole | null): boolean {
  return role === 'owner' || role === 'admin'
}
