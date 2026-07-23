import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
    <div>
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to project
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold tracking-tight">Team</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Manage who can access <span className="text-foreground">{project.name}</span>.
      </p>
      <MembersManager projectId={projectId} />
    </div>
  )
}
