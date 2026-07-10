import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { randomBytes } from 'crypto'
import type { NotificationChannel } from '@/lib/types'

type Params = { params: Promise<{ projectId: string }> }

const VALID_EVENTS = ['rotation', 'high_risk']
const VALID_TYPES = ['email', 'webhook']

// GET — list a project's notification channels (signing secret never returned).
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId } = await params

  const { data, error } = await auth.supabase
    .from('notification_channels')
    .select('id, project_id, type, target, events, active, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load channels' }, { status: 500 })
  }
  return NextResponse.json({ channels: (data ?? []) as NotificationChannel[] })
}

// POST — create a channel. Body: { type, target, events }
// Webhook channels get a generated HMAC signing secret (returned once).
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { projectId } = await params
  const { userId, supabase } = auth

  let body: { type?: string; target?: string; events?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { type, target, events } = body
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type must be email or webhook' }, { status: 400 })
  }
  if (!target) {
    return NextResponse.json({ error: 'target is required' }, { status: 400 })
  }
  const evs = (events ?? []).filter((e) => VALID_EVENTS.includes(e))
  if (evs.length === 0) {
    return NextResponse.json(
      { error: 'select at least one event (rotation, high_risk)' },
      { status: 400 }
    )
  }

  const signingSecret = type === 'webhook' ? randomBytes(24).toString('hex') : null

  const { data, error } = await supabase
    .from('notification_channels')
    .insert({
      user_id: userId,
      project_id: projectId,
      type,
      target,
      events: evs,
      secret: signingSecret,
    })
    .select('id, project_id, type, target, events, active, created_at')
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to create channel (owner/admin only)' },
      { status: 403 }
    )
  }

  // Return the signing secret exactly once so the user can configure verification.
  return NextResponse.json({ channel: data, signing_secret: signingSecret }, { status: 201 })
}
