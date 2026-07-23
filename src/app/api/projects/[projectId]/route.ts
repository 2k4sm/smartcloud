import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { projectId } = await params

  let query = supabase
    .from('projects')
    .select('id, name, description, created_at, updated_at')
    .eq('id', projectId)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { data, error } = await query.single()

  if (error || !data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  return NextResponse.json({ project: data })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { projectId } = await params

  let body: { name?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, string | null> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description

  let query = supabase.from('projects').update(updates).eq('id', projectId)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { data, error } = await query
    .select('id, name, description, created_at, updated_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  return NextResponse.json({ project: data })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { projectId } = await params

  let query = supabase.from('projects').delete().eq('id', projectId)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
