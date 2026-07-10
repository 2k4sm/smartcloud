import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'

type Params = { params: Promise<{ projectId: string; channelId: string }> }

// PATCH — toggle active or update the subscribed events.
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, channelId } = await params

  let body: { active?: boolean; events?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.active !== undefined) updates.active = Boolean(body.active)
  if (body.events !== undefined) {
    updates.events = body.events.filter((e) =>
      ['rotation', 'high_risk'].includes(e)
    )
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('notification_channels')
    .update(updates)
    .eq('id', channelId)
    .eq('project_id', projectId)
    .select('id, project_id, type, target, events, active, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Channel not found or not permitted' }, { status: 404 })
  }
  return NextResponse.json({ channel: data })
}

// DELETE — remove a channel.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, channelId } = await params

  const { error } = await auth.supabase
    .from('notification_channels')
    .delete()
    .eq('id', channelId)
    .eq('project_id', projectId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
