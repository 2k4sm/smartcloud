import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import MembersManager from '@/components/members/MembersManager'

type Props = { params: Promise<{ projectId: string }> }

export default async function MembersPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  return (
    <div data-full-width>
      <MembersManager projectId={projectId} projectName={project.name} />
    </div>
  )
}
