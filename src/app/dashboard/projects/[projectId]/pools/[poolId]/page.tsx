import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PoolDetail from '@/components/pools/PoolDetail'

type Props = { params: Promise<{ projectId: string; poolId: string }> }

export default async function PoolPage({ params }: Props) {
  const { projectId, poolId } = await params
  return (
    <div>
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to project
      </Link>
      <PoolDetail poolId={poolId} />
    </div>
  )
}
