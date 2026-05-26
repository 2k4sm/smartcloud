import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { findUserIdByEmail, resolveEmails } from '@/lib/members'
import type { ProjectMember, ProjectRole } from '@/lib/types'

type Params = { params: Promise<{ projectId: string }> }

const INVITABLE_ROLES: ProjectRole[] = ['admin', 'viewer']

// GET /api/projects/:id/members — list members (roster + owner), with emails.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId } = await params
  const { supabase } = auth

  // Project must be visible to the caller (RLS) and gives us the owner.
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: members } = await supabase
    .from('project_members')
    .select('id, project_id, user_id, role, invited_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const rows = (members ?? []) as ProjectMember[]
  const emails = await resolveEmails([project.user_id, ...rows.map((m) => m.user_id)])

  // Synthesize an "owner" row so the UI shows the full team in one list.
  const owner: ProjectMember = {
    id: `owner:${project.user_id}`,
    project_id: projectId,
    user_id: project.user_id,
    role: 'owner',
    invited_by: null,
    created_at: '',
    email: emails[project.user_id],
  }

  return NextResponse.json({
    members: [
      owner,
      ...rows.map((m) => ({ ...m, email: emails[m.user_id] })),
    ],
  })
}

// POST /api/projects/:id/members — invite an existing user by email.
// Body: { email: string, role: 'admin' | 'viewer' }
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId } = await params
  const { supabase, userId } = auth

  let body: { email?: string; role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim()
  const role = (body.role ?? 'viewer') as ProjectRole
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "role must be 'admin' or 'viewer'" },
      { status: 400 }
    )
  }

  // Only owner/admin may invite (belt-and-suspenders alongside RLS).
  const { data: callerRole } = await supabase.rpc('current_project_role', {
    pid: projectId,
  })
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const targetId = await findUserIdByEmail(email)
  if (!targetId) {
    return NextResponse.json(
      { error: 'No account with that email. Ask them to sign up first.' },
      { status: 404 }
    )
  }
  if (targetId === userId) {
    return NextResponse.json(
      { error: 'You already have access to this project.' },
      { status: 409 }
    )
  }

  const { data: member, error } = await supabase
    .from('project_members')
    .upsert(
      { project_id: projectId, user_id: targetId, role, invited_by: userId },
      { onConflict: 'project_id,user_id' }
    )
    .select('id, project_id, user_id, role, invited_by, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }

  return NextResponse.json({ member: { ...member, email } }, { status: 201 })
}
