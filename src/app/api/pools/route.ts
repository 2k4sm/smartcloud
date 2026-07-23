import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import type { KeyPool } from '@/lib/types'

// GET /api/pools?project_id=...  — list pools in a project.
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projectId = request.nextUrl.searchParams.get('project_id')
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  const service = createServiceClient()
  if (!(await projectRole(service, projectId, auth.userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await service
    .from('key_pools')
    .select(
      'id, project_id, name, description, rotation_interval_days, rotate_on_high_risk, risk_threshold, current_key_id, last_rotated_at, created_at, updated_at'
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to load pools' }, { status: 500 })

  // Attach active key counts for the list view.
  const pools = (data ?? []) as KeyPool[]
  const withCounts = await Promise.all(
    pools.map(async (p) => {
      const { count } = await service
        .from('pool_keys')
        .select('id', { count: 'exact', head: true })
        .eq('pool_id', p.id)
        .eq('active', true)
      return { ...p, active_key_count: count ?? 0 }
    })
  )

  return NextResponse.json({ pools: withCounts })
}

// POST /api/pools — create a pool. Body: { project_id, name, description?,
// rotation_interval_days?, rotate_on_high_risk?, risk_threshold? }
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    project_id?: string
    name?: string
    description?: string
    rotation_interval_days?: number | null
    rotate_on_high_risk?: boolean
    risk_threshold?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { project_id, name } = body
  if (!project_id || !name?.trim()) {
    return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const role = await projectRole(service, project_id, auth.userId)
  if (!canWrite(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await service
    .from('key_pools')
    .insert({
      project_id,
      user_id: auth.userId,
      name: name.trim().toUpperCase(),
      description: body.description ?? null,
      rotation_interval_days: body.rotation_interval_days ?? null,
      rotate_on_high_risk: Boolean(body.rotate_on_high_risk),
      risk_threshold: body.risk_threshold ?? 67,
    })
    .select('id, project_id, name, description, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A pool with this name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pool: data }, { status: 201 })
}
