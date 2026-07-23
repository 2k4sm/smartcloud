'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import RiskBadge from '@/components/risk/RiskBadge'
import type { KeyPool, PoolKeyMeta, PoolRotation } from '@/lib/types'
import type { RiskLevel } from '@/lib/risk'

interface PoolData {
  pool: KeyPool
  keys: PoolKeyMeta[]
  rotations: PoolRotation[]
  risk: { score: number; level: RiskLevel }
}

export default function PoolDetail({ poolId }: { poolId: string }) {
  const router = useRouter()
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // add-key form
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/pools/${poolId}`)
    if (res.ok) setData(await res.json())
    else setError((await res.json().catch(() => ({}))).error ?? 'Failed to load')
    setLoading(false)
  }, [poolId])

  useEffect(() => {
    load()
  }, [load])

  async function addKey(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pools/${poolId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue, label: newLabel || undefined }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? 'Failed to add key')
        return
      }
      setNewValue('')
      setNewLabel('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(k: PoolKeyMeta) {
    await fetch(`/api/pools/${poolId}/keys/${k.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !k.active }),
    })
    await load()
  }

  async function removeKey(id: string) {
    if (!confirm('Remove this key from the pool?')) return
    await fetch(`/api/pools/${poolId}/keys/${id}`, { method: 'DELETE' })
    await load()
  }

  async function rotate() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pools/${poolId}/rotate`, { method: 'POST' })
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Rotate failed')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function savePolicy(patch: Partial<KeyPool>) {
    await fetch(`/api/pools/${poolId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await load()
  }

  async function deletePool() {
    if (!confirm('Delete this pool and all its keys?')) return
    const res = await fetch(`/api/pools/${poolId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push(`/dashboard/projects/${data?.pool.project_id ?? ''}`)
      router.refresh()
    }
  }

  if (loading) return <div className="glass-card p-8 text-center"><span className="spinner" /></div>
  if (!data) return <div className="glass-card p-8 text-rose-400">{error ?? 'Not found'}</div>

  const { pool, keys, rotations, risk } = data
  const maxUsage = Math.max(1, ...keys.map((k) => k.usage_count))
  const activeCount = keys.filter((k) => k.active).length

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-mono tracking-tight">{pool.name}</h1>
          {pool.description && <p className="text-gray-400 text-sm mt-1">{pool.description}</p>}
          <div className="flex items-center gap-2 mt-2">
            <RiskBadge level={risk.level} score={risk.score} />
            <span className="text-gray-500 text-xs">
              {activeCount} active key{activeCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={rotate} disabled={busy || activeCount < 2} className="btn-secondary text-sm disabled:opacity-50" title={activeCount < 2 ? 'Need 2+ active keys to rotate' : 'Rotate to least-used key'}>
            {busy ? <span className="spinner" /> : 'Rotate now'}
          </button>
          <button onClick={deletePool} className="text-rose-400/70 hover:text-rose-300 text-xs px-2">delete pool</button>
        </div>
      </div>

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      {/* Keys */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 text-sm text-white font-medium">Keys in pool</div>
        {keys.length === 0 ? (
          <div className="px-4 py-6 text-gray-500 text-sm">No keys yet — add one below.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-200">{k.label || 'key'}</span>
                      {k.is_current && (
                        <span className="text-[10px] uppercase tracking-wide text-cyan-300 border border-cyan-400/30 rounded px-1.5 py-0.5">current</span>
                      )}
                      {!k.active && <span className="text-[10px] text-gray-500">inactive</span>}
                    </div>
                    <div className="mt-1.5 h-1.5 w-40 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${(k.usage_count / maxUsage) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                    {k.usage_count} use{k.usage_count === 1 ? '' : 's'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => toggleActive(k)} className="text-xs text-gray-400 hover:text-white px-2">
                      {k.active ? 'deactivate' : 'activate'}
                    </button>
                    <button onClick={() => removeKey(k.id)} className="text-xs text-rose-400/70 hover:text-rose-300 px-2">remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={addKey} className="p-4 border-t border-white/10 flex flex-col sm:flex-row gap-2">
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (optional)" className="glass-input sm:w-40" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} required placeholder="Paste a real key value" className="glass-input flex-1 font-mono text-xs" />
          <button type="submit" disabled={busy} className="btn-primary">Add key</button>
        </form>
      </div>

      {/* Policy + history */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-white font-medium text-sm">Rotation policy</h2>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={pool.rotate_on_high_risk} onChange={(e) => savePolicy({ rotate_on_high_risk: e.target.checked })} className="accent-cyan-500" />
            Rotate when risk is High
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-300">Rotate every</span>
            <input
              type="number"
              min={1}
              defaultValue={pool.rotation_interval_days ?? ''}
              onBlur={(e) => savePolicy({ rotation_interval_days: e.target.value ? Number(e.target.value) : null })}
              placeholder="—"
              className="glass-input w-20 py-1 text-sm"
            />
            <span className="text-gray-400">days (blank = off)</span>
          </div>
          <p className="text-gray-500 text-xs">Rotation switches the served key to the least-used active one. All keys stay valid.</p>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-white font-medium text-sm mb-3">Rotation history</h2>
          {rotations.length === 0 ? (
            <p className="text-gray-500 text-xs">No rotations yet.</p>
          ) : (
            <div className="space-y-2">
              {rotations.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{r.trigger}</span>
                  <span className="text-gray-500">{new Date(r.rotated_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
