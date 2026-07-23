import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import type { ProjectRole } from '@/lib/types'

type Params = { params: Promise<{ projectId: string; memberId: string }> }

const ASSIGNABLE_ROLES: ProjectRole[] = ['admin', 'viewer']

// PATCH /api/projects/:id/members/:memberId — change a member's role.
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, memberId } = await params

  const supabase = createServiceClient()
  if (!canWrite(await projectRole(supabase, projectId, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const role = body.role as ProjectRole
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "role must be 'admin' or 'viewer'" },
      { status: 400 }
    )
  }

  // RLS (members_update, owner/admin only) enforces authorization.
  const { data, error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .eq('project_id', projectId)
    .select('id, project_id, user_id, role, invited_by, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Member not found or not permitted' },
      { status: 404 }
    )
  }
  return NextResponse.json({ member: data })
}

// DELETE /api/projects/:id/members/:memberId — remove a member.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, memberId } = await params

  const supabase = createServiceClient()
  if (!canWrite(await projectRole(supabase, projectId, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
