'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Requests a Gemini-generated explanation for this secret's latest risk score.
export default function AnalyzeRiskButton({
  projectId,
  secretId,
  hasSummary,
}: {
  projectId: string
  secretId: string
  hasSummary: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function analyze() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/risk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, secret_id: secretId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'AI analysis failed')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={analyze}
        disabled={busy}
        className="btn-secondary text-xs py-1.5 disabled:opacity-50"
      >
        {busy ? (
          <span className="spinner" />
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
        {hasSummary ? 'Re-analyze with AI' : 'Analyze with AI'}
      </button>
      {error && <span className="text-rose-400 text-xs">{error}</span>}
    </div>
  )
}
