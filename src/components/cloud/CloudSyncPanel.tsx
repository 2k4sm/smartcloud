'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { CloudProviderSummary, CloudSync } from '@/lib/types'

export default function CloudSyncPanel({
  projectId,
  secretId,
}: {
  projectId: string
  secretId: string
}) {
  const [providers, setProviders] = useState<CloudProviderSummary[]>([])
  const [syncs, setSyncs] = useState<CloudSync[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      fetch(`/api/projects/${projectId}/providers`),
      fetch(`/api/secrets/${secretId}/sync`),
    ])
    if (p.ok) setProviders((await p.json()).providers)
    if (s.ok) setSyncs((await s.json()).syncs)
    setLoading(false)
  }, [projectId, secretId])

  useEffect(() => {
    load()
  }, [load])

  async function sync(providerId?: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/secrets/${secretId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providerId ? { provider_id: providerId } : {}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Sync failed')
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  const providerName = (id: string) =>
    providers.find((p) => p.id === id)?.name ?? id.slice(0, 8)

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-medium text-sm">Cloud sync</h2>
        {providers.length > 0 && (
          <button
            onClick={() => sync()}
            disabled={busy}
            className="btn-secondary text-xs py-1.5 disabled:opacity-50"
          >
            {busy ? <span className="spinner" /> : 'Sync to all'}
          </button>
        )}
      </div>

      {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

      {loading ? (
        <div className="text-center py-4">
          <span className="spinner" />
        </div>
      ) : providers.length === 0 ? (
        <p className="text-gray-500 text-xs">
          No providers connected.{' '}
          <Link
            href={`/dashboard/projects/${projectId}/providers`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Connect one →
          </Link>
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {p.name}{' '}
                <span className="text-gray-500 text-xs uppercase">{p.provider}</span>
              </span>
              <button
                onClick={() => sync(p.id)}
                disabled={busy}
                className="text-cyan-400 hover:text-cyan-300 text-xs disabled:opacity-50"
              >
                push →
              </button>
            </div>
          ))}
        </div>
      )}

      {syncs.length > 0 && (
        <div className="border-t border-white/10 pt-3 space-y-2">
          <div className="text-gray-400 text-xs mb-1">Recent syncs</div>
          {syncs.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span
                  className={s.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}
                >
                  {s.status}
                </span>
                <span className="text-gray-500">{providerName(s.provider_id)}</span>
              </span>
              <span className="text-gray-500">
                {new Date(s.synced_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
