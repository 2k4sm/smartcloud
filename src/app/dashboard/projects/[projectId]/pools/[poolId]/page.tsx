import Link from 'next/link'
import PoolDetail from '@/components/pools/PoolDetail'

type Props = { params: Promise<{ projectId: string; poolId: string }> }

export default async function PoolPage({ params }: Props) {
  const { projectId, poolId } = await params
  return (
    <div>
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to project
      </Link>
      <PoolDetail poolId={poolId} />
    </div>
  )
}
