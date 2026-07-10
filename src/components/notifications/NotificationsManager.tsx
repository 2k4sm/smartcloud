'use client'

import { useEffect, useState, useCallback } from 'react'
import type { NotificationChannel } from '@/lib/types'

const EVENTS = [
  { key: 'rotation', label: 'Rotations' },
  { key: 'high_risk', label: 'High-risk alerts' },
]

export default function NotificationsManager({ projectId }: { projectId: string }) {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'email' | 'webhook'>('email')
  const [target, setTarget] = useState('')
  const [events, setEvents] = useState<string[]>(['high_risk'])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/channels`)
    if (res.ok) setChannels((await res.json()).channels)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  function toggleEvent(key: string) {
    setEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]
    )
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    setNewSecret(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, target, events }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create channel')
        return
      }
      if (data.signing_secret) setNewSecret(data.signing_secret)
      setTarget('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(ch: NotificationChannel) {
    await fetch(`/api/projects/${projectId}/channels/${ch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !ch.active }),
    })
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this notification channel?')) return
    await fetch(`/api/projects/${projectId}/channels/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={create} className="glass-card p-5">
        <h2 className="text-white font-medium mb-3 text-sm">Add a channel</h2>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'email' | 'webhook')}
            className="glass-input sm:w-36"
          >
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
          <input
            required
            placeholder={type === 'email' ? 'alerts@example.com' : 'https://hooks.example.com/…'}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="glass-input flex-1"
          />
        </div>
        <div className="flex items-center gap-4 mb-3">
          {EVENTS.map((ev) => (
            <label key={ev.key} className="flex items-center gap-2 text-gray-300 text-sm">
              <input
                type="checkbox"
                checked={events.includes(ev.key)}
                onChange={() => toggleEvent(ev.key)}
                className="accent-cyan-500"
              />
              {ev.label}
            </label>
          ))}
        </div>
        {error && <p className="text-rose-400 text-xs mb-2">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? <span className="spinner" /> : 'Add channel'}
        </button>

        {newSecret && (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
            <div className="text-amber-300 text-xs font-medium mb-1">
              Webhook signing secret (shown once)
            </div>
            <code className="font-mono text-amber-200 text-xs break-all">{newSecret}</code>
            <p className="text-gray-500 text-xs mt-1">
              Verify the <code>X-SmartCloud-Signature</code> HMAC-SHA256 header with this.
            </p>
          </div>
        )}
      </form>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="py-6 text-center text-gray-500"><span className="spinner" /></div>
        ) : channels.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">No channels yet.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {channels.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-gray-200 break-all">{c.target}</div>
                    <div className="text-gray-500 text-xs">
                      {c.type} · {c.events.join(', ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`text-xs px-2 py-1 rounded-lg mr-1 transition-colors ${
                        c.active
                          ? 'text-emerald-300 hover:bg-emerald-400/10'
                          : 'text-gray-500 hover:bg-white/5'
                      }`}
                    >
                      {c.active ? 'active' : 'paused'}
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="text-rose-400/70 hover:text-rose-300 hover:bg-rose-400/10 text-xs px-2 py-1 rounded-lg transition-colors"
                    >
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
