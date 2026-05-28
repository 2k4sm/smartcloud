'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Triggers a rule-based risk recompute for every secret in the project.
export default function RecomputeRiskButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function recompute() {
    setBusy(true)
    try {
      await fetch('/api/risk/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={recompute}
      disabled={busy}
      className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
      title="Recompute rule-based risk scores"
    >
      {busy ? (
        <span className="spinner" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      )}
      Recompute risk
    </button>
  )
}
