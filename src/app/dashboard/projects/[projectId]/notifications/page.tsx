import { notFound } from 'next/navigation'
import Link from 'next/link'
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
    <div>
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to project
      </Link>
      <h1 className="text-3xl font-bold text-white mt-2 mb-1 tracking-tight">Notifications</h1>
      <p className="text-gray-400 text-sm mb-8">
        Get alerted about rotations and high-risk events in{' '}
        <span className="text-gray-200">{project.name}</span>.
      </p>
      <NotificationsManager projectId={projectId} />
    </div>
  )
}
