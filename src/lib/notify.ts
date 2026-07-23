import { createHmac } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationEvent = 'rotation' | 'high_risk'

interface Channel {
  id: string
  type: 'email' | 'webhook'
  target: string
  events: string[]
  secret: string | null
}

export interface NotifyResult {
  channel_id: string
  type: string
  ok: boolean
  detail?: string
}

// Fan a domain event out to a project's active notification channels.
// Best-effort: a failing channel never throws to the caller. Delivery is a
// no-op when the underlying transport isn't configured (e.g. no RESEND_API_KEY).
export async function dispatch(
  service: SupabaseClient,
  opts: {
    projectId: string
    event: NotificationEvent
    subject: string
    message: string
    data?: Record<string, unknown>
  }
): Promise<NotifyResult[]> {
  const { data: channels } = await service
    .from('notification_channels')
    .select('id, type, target, events, secret')
    .eq('project_id', opts.projectId)
    .eq('active', true)

  const targets = ((channels ?? []) as Channel[]).filter((c) =>
    c.events.includes(opts.event)
  )

  const results: NotifyResult[] = []
  for (const c of targets) {
    try {
      if (c.type === 'webhook') {
        await deliverWebhook(c, opts)
      } else {
        await deliverEmail(c, opts)
      }
      results.push({ channel_id: c.id, type: c.type, ok: true })
    } catch (err) {
      results.push({
        channel_id: c.id,
        type: c.type,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}

// Block SSRF: reject loopback / link-local (cloud metadata) / private-range hosts.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    if (a === 0 || a === 127 || a === 10) return true
    if (a === 169 && b === 254) return true // link-local incl. 169.254.169.254 metadata
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  }
  return false
}

async function deliverWebhook(
  channel: Channel,
  opts: { event: NotificationEvent; subject: string; message: string; data?: Record<string, unknown> }
) {
  let url: URL
  try {
    url = new URL(channel.target)
  } catch {
    throw new Error('invalid webhook URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('webhook must use http(s)')
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error('webhook host not allowed (private/loopback/metadata)')
  }

  const body = JSON.stringify({
    event: opts.event,
    subject: opts.subject,
    message: opts.message,
    data: opts.data ?? {},
  })
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (channel.secret) {
    headers['X-SmartCloud-Signature'] = createHmac('sha256', channel.secret)
      .update(body)
      .digest('hex')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    // `redirect: 'manual'` so a 3xx can't bounce us to an internal host.
    const res = await fetch(channel.target, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`webhook responded ${res.status}`)
  } finally {
    clearTimeout(timer)
  }
}

async function deliverEmail(
  channel: Channel,
  opts: { subject: string; message: string }
) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_EMAIL_FROM
  // Graceful no-op when email transport isn't configured.
  if (!apiKey || !from) {
    console.warn('[notify] email skipped (RESEND_API_KEY/NOTIFY_EMAIL_FROM unset)')
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: channel.target,
      subject: opts.subject,
      text: opts.message,
    }),
  })
  if (!res.ok) throw new Error(`email responded ${res.status}`)
}
