'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

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

  async function analyze() {
    setBusy(true)
    try {
      const res = await fetch('/api/risk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, secret_id: secretId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'AI analysis failed')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={analyze} disabled={busy} variant="outline" size="sm">
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {hasSummary ? 'Re-analyze with AI' : 'Analyze with AI'}
    </Button>
  )
}
