'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/api-keys')
    const data = await res.json()
    if (data.api_keys) setKeys(data.api_keys)
  }, [])

  useEffect(() => {
    // Initial async data load on mount (not a synchronous render-time setState).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKeys()
  }, [fetchKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')
    setNewKey(null)

    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to create API key')
      return
    }

    setNewKey(data.api_key.key)
    setName('')
    fetchKeys()
  }

  async function handleDelete(id: string) {
    if (!confirm('Revoke this API key? Any integrations using it will stop working.')) return

    setDeletingId(id)
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    fetchKeys()
  }

  async function handleCopy() {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-white mt-2 tracking-tight">API Keys</h1>
        <p className="text-gray-400 text-sm mt-1">
          Generate long-lived API keys for programmatic access via the SDK or CLI.
        </p>
      </div>

      {/* New key banner */}
      {newKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6">
          <p className="text-emerald-300 text-sm font-medium mb-2">
            API key created. Copy it now — you won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/5 border border-white/10 text-emerald-300 text-xs font-mono px-3 py-2 rounded-xl overflow-x-auto">
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs px-3 py-2 rounded-xl transition-colors"
            >
              {copied ? (
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : 'Copy'}
            </button>
          </div>
          <p className="text-gray-400 text-xs mt-3">
            Use this as <code className="text-cyan-400">SMARTCLOUD_TOKEN</code> in your project&apos;s <code className="text-cyan-400">.env</code> file.
          </p>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="glass-card p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Create new API key</h2>
        {error && <p className="text-rose-400 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. CI/CD pipeline, local dev)"
            className="glass-input flex-1"
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary whitespace-nowrap"
          >
            {loading ? <span className="inline-flex items-center gap-2"><span className="spinner" /> Creating...</span> : 'Generate key'}
          </button>
        </div>
      </form>

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="glass-card border-dashed text-center py-12">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
          <p className="text-gray-400">No API keys yet.</p>
          <p className="text-gray-500 text-sm mt-1">Create one above to get started.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Key</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Created</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Last used</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-white">{key.name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {key.key_prefix}...
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(key.id)}
                      disabled={deletingId === key.id}
                      className="text-rose-400/70 hover:text-rose-300 hover:bg-rose-400/10 text-xs px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {deletingId === key.id ? <span className="spinner" /> : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
