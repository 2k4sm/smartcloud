import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { projectRole, canWrite } from '@/lib/access'
import { sendTestNotification } from '@/lib/notify'

type Params = { params: Promise<{ projectId: string; channelId: string }> }

// POST /api/projects/:projectId/channels/:channelId/test
// Sends a one-off test notification through the channel and reports success or
// the real delivery error (so SMTP/webhook config can be verified).
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId, channelId } = await params

  const service = createServiceClient()
  if (!canWrite(await projectRole(service, projectId, auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: channel } = await service
    .from('notification_channels')
    .select('id, type, target, secret')
    .eq('id', channelId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  try {
    await sendTestNotification({
      type: channel.type,
      target: channel.target,
      secret: channel.secret,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, sent_to: channel.target })
}
