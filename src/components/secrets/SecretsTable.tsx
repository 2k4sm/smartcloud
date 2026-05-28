'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SecretMetadata } from '@/lib/types'
import type { RiskLevel } from '@/lib/risk'
import RiskBadge from '@/components/risk/RiskBadge'

export interface SecretRisk {
  score: number
  level: RiskLevel
}

interface SecretsTableProps {
  secrets: SecretMetadata[]
  projectId: string
  risk?: Record<string, SecretRisk>
}

export default function SecretsTable({ secrets, projectId, risk }: SecretsTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({})
  const [fetchingId, setFetchingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleReveal(secret: SecretMetadata) {
    setFetchingId(secret.id)
    const res = await fetch('/api/secrets/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, key_name: secret.key_name }),
    })
    const data = await res.json()
    if (res.ok) {
      setRevealedValues((prev) => ({ ...prev, [secret.id]: data.value }))
    }
    setFetchingId(null)
  }

  function handleHide(secretId: string) {
    setRevealedValues((prev) => {
      const next = { ...prev }
      delete next[secretId]
      return next
    })
  }

  async function handleCopy(secretId: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedId(secretId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleDelete(secretId: string) {
    if (!confirm('Delete this secret? This cannot be undone.')) return
    setDeletingId(secretId)

    await fetch(`/api/secrets/${secretId}`, { method: 'DELETE' })

    setDeletingId(null)
    router.refresh()
  }

  if (!secrets.length) {
    return (
      <div className="glass-card border-dashed text-center py-16">
        <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
        <p className="text-gray-400">No secrets yet.</p>
        <Link
          href={`/dashboard/projects/${projectId}/secrets/new`}
          className="text-cyan-400 hover:text-cyan-300 text-sm mt-2 inline-block transition-colors"
        >
          Add your first secret
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="text-left text-gray-400 font-medium px-4 py-3">Key</th>
            <th className="text-left text-gray-400 font-medium px-4 py-3">Value</th>
            <th className="text-left text-gray-400 font-medium px-4 py-3">Risk</th>
            <th className="text-left text-gray-400 font-medium px-4 py-3">Description</th>
            <th className="text-left text-gray-400 font-medium px-4 py-3">Updated</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {secrets.map((secret) => (
            <tr key={secret.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03] transition-colors">
              <td className="px-4 py-3 font-mono text-cyan-400">{secret.key_name}</td>
              <td className="px-4 py-3">
                {revealedValues[secret.id] ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-300 text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg max-w-48 truncate">
                      {revealedValues[secret.id]}
                    </span>
                    <button
                      onClick={() => handleCopy(secret.id, revealedValues[secret.id])}
                      className="text-gray-500 hover:text-cyan-400 transition-colors"
                      title="Copy value"
                    >
                      {copiedId === secret.id ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleHide(secret.id)}
                      className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                    >
                      hide
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleReveal(secret)}
                    disabled={fetchingId === secret.id}
                    className="text-gray-500 hover:text-cyan-400 text-xs font-mono disabled:opacity-50 transition-colors"
                  >
                    {fetchingId === secret.id ? <span className="spinner" /> : '••••••••'}
                  </button>
                )}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/projects/${projectId}/secrets/${secret.id}`}
                  className="hover:opacity-80 transition-opacity"
                  title="View risk detail"
                >
                  {risk?.[secret.id] ? (
                    <RiskBadge level={risk[secret.id].level} score={risk[secret.id].score} />
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">{secret.description ?? '—'}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {new Date(secret.updated_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => handleDelete(secret.id)}
                  disabled={deletingId === secret.id}
                  className="text-rose-400/70 hover:text-rose-300 hover:bg-rose-400/10 text-xs px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {deletingId === secret.id ? <span className="spinner" /> : 'delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
