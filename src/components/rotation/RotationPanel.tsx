'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RotationJob } from '@/lib/types'

export default function RotationPanel({
  secretId,
  initialAutoRotate,
  initialInterval,
  initialJobs,
}: {
  secretId: string
  initialAutoRotate: boolean
  initialInterval: number | null
  initialJobs: RotationJob[]
}) {
  const router = useRouter()
  const [jobs, setJobs] = useState<RotationJob[]>(initialJobs)
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate)
  const [interval, setInterval] = useState<string>(
    initialInterval ? String(initialInterval) : '30'
  )
  const [rotating, setRotating] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [newValue, setNewValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refreshJobs() {
    const res = await fetch(`/api/secrets/${secretId}/rotate`)
    if (res.ok) setJobs((await res.json()).jobs)
  }

  async function rotateNow() {
    if (!confirm('Rotate this secret now? The current value will be replaced.')) return
    setRotating(true)
    setError(null)
    setNewValue(null)
    try {
      const res = await fetch(`/api/secrets/${secretId}/rotate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Rotation failed')
        return
      }
      setNewValue(data.new_value)
      await refreshJobs()
      router.refresh()
    } finally {
      setRotating(false)
    }
  }

  async function saveSettings() {
    setSavingSettings(true)
    setError(null)
    try {
      const res = await fetch(`/api/secrets/${secretId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_rotate: autoRotate,
          rotation_interval_days: autoRotate ? Number(interval) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to save settings')
      }
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-medium text-sm">Rotation</h2>
        <button
          onClick={rotateNow}
          disabled={rotating}
          className="btn-secondary text-xs py-1.5 disabled:opacity-50"
        >
          {rotating ? <span className="spinner" /> : 'Rotate now'}
        </button>
      </div>

      {newValue && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
          <div className="text-amber-300 text-xs font-medium mb-1">
            New value (shown once)
          </div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-amber-200 text-xs bg-black/30 px-2 py-1 rounded break-all flex-1">
              {newValue}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newValue)}
              className="text-gray-400 hover:text-cyan-400 text-xs"
            >
              copy
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

      <div className="flex items-center gap-3 mb-4 text-sm">
        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => setAutoRotate(e.target.checked)}
            className="accent-cyan-500"
          />
          Auto-rotate every
        </label>
        <input
          type="number"
          min={1}
          value={interval}
          disabled={!autoRotate}
          onChange={(e) => setInterval(e.target.value)}
          className="glass-input w-20 py-1 text-sm disabled:opacity-40"
        />
        <span className="text-gray-400 text-sm">days</span>
        <button
          onClick={saveSettings}
          disabled={savingSettings}
          className="btn-secondary text-xs py-1 ml-auto disabled:opacity-50"
        >
          {savingSettings ? <span className="spinner" /> : 'Save'}
        </button>
      </div>

      <div className="space-y-2">
        {jobs.length === 0 ? (
          <p className="text-gray-500 text-xs">No rotations yet.</p>
        ) : (
          jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span
                  className={
                    j.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {j.status}
                </span>
                <span className="text-gray-500">· {j.trigger}</span>
              </span>
              <span className="text-gray-500">
                {new Date(j.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
