import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { rotatePool } from '@/lib/poolRotation'

type Params = { params: Promise<{ poolId: string }> }

// POST /api/pools/:poolId/rotate — manually rotate to the least-used active key.
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { poolId } = await params

  const service = createServiceClient()
  const { data: pool } = await service
    .from('key_pools')
    .select('id, project_id, current_key_id')
    .eq('id', poolId)
    .maybeSingle()
  if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canWrite(await projectRole(service, pool.project_id, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await rotatePool(service, pool, 'manual')
  if (!result.rotated) {
    return NextResponse.json(
      { error: result.detail, ...result },
      { status: 409 }
    )
  }
  return NextResponse.json(result)
}
