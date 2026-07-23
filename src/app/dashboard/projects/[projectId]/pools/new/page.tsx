import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NewPoolForm from '@/components/pools/NewPoolForm'

type Props = { params: Promise<{ projectId: string }> }

export default async function NewPoolPage({ params }: Props) {
  const { projectId } = await params
  return (
    <div>
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to project
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold tracking-tight">New key pool</h1>
      <NewPoolForm projectId={projectId} />
    </div>
  )
}
