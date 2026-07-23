import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import NotificationsManager from '@/components/notifications/NotificationsManager'

type Props = { params: Promise<{ projectId: string }> }

export default async function NotificationsPage({ params }: Props) {
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
      <NotificationsManager projectId={projectId} projectName={project.name} />
    </div>
  )
}
