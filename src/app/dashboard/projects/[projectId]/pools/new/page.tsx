import Link from 'next/link'
import NewPoolForm from '@/components/pools/NewPoolForm'

type Props = { params: Promise<{ projectId: string }> }

export default async function NewPoolPage({ params }: Props) {
  const { projectId } = await params
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
      <h1 className="text-3xl font-bold text-white mt-2 mb-6 tracking-tight">New key pool</h1>
      <NewPoolForm projectId={projectId} />
    </div>
  )
}
