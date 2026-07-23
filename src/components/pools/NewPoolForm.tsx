'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewPoolForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name, description }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create pool')
        return
      }
      router.push(`/dashboard/projects/${projectId}/pools/${data.pool.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass-card p-8 space-y-4 max-w-lg">
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Pool name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="glass-input w-full" placeholder="e.g. OPENAI_API_KEY" />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Description (optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="glass-input w-full resize-none" placeholder="A pool of interchangeable OpenAI keys" />
      </div>
      {error && <p className="text-rose-400 text-sm">{error}</p>}
      <p className="text-gray-500 text-xs">
        After creating the pool, add several real, interchangeable keys. One is served
        at a time; rotation switches to the least-used active key.
      </p>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? <span className="spinner" /> : 'Create pool'}
      </button>
    </form>
  )
}
