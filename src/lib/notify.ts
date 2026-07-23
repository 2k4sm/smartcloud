import { createHmac } from 'crypto'
import nodemailer, { type Transporter } from 'nodemailer'
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

// Lazily-built SMTP transport. `undefined` = not yet checked, `null` = not
// configured (email is a no-op). Reused across sends within a process.
let transport: Transporter | null | undefined

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    transport = null
    return null
  }

  const port = Number(process.env.SMTP_PORT ?? 587)
  // `secure` = implicit TLS (usually port 465). 587/25 use STARTTLS (secure:false).
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465

  transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
  return transport
}

/** True when SMTP is configured (email notifications can actually send). */
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

// Send a one-off test notification through a single channel. Throws on failure
// (SMTP/webhook errors) so callers can surface the real reason. Unlike dispatch,
// email is NOT a silent no-op here — an unconfigured SMTP is reported as an error.
export async function sendTestNotification(channel: {
  type: 'email' | 'webhook'
  target: string
  secret: string | null
}): Promise<void> {
  const opts = {
    event: 'rotation' as NotificationEvent,
    subject: 'SmartCloud test notification',
    message:
      'This is a test notification from SmartCloud. If you received it, this ' +
      'channel is configured correctly.',
    data: { test: true },
  }
  const full: Channel = { id: 'test', events: ['rotation'], ...channel }
  if (channel.type === 'webhook') {
    await deliverWebhook(full, opts)
  } else {
    if (!emailConfigured()) {
      throw new Error(
        'SMTP is not configured on the server (set SMTP_HOST, SMTP_USER, SMTP_PASS)'
      )
    }
    await deliverEmail(full, opts)
  }
}

async function deliverEmail(
  channel: Channel,
  opts: { subject: string; message: string }
) {
  const t = getTransport()
  // From-address: explicit NOTIFY_EMAIL_FROM, else the authenticated SMTP user.
  const from = process.env.NOTIFY_EMAIL_FROM || process.env.SMTP_USER
  // Graceful no-op when SMTP isn't configured.
  if (!t || !from) {
    console.warn('[notify] email skipped (SMTP_HOST/SMTP_USER/SMTP_PASS unset)')
    return
  }

  await t.sendMail({
    from,
    to: channel.target,
    subject: opts.subject,
    text: opts.message,
  })
}
