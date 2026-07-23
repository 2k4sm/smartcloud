import PoolDetail from '@/components/pools/PoolDetail'

type Props = { params: Promise<{ projectId: string; poolId: string }> }

export default async function PoolPage({ params }: Props) {
  const { projectId, poolId } = await params
  return (
    <div data-full-width>
      <PoolDetail poolId={poolId} projectId={projectId} />
    </div>
  )
}
