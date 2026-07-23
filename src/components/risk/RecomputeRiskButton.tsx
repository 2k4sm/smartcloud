'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Triggers a rule-based risk recompute for every secret in the project.
export default function RecomputeRiskButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function recompute() {
    setBusy(true)
    try {
      const res = await fetch('/api/risk/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      if (res.ok) {
        toast.success('Risk scores recomputed')
        router.refresh()
      } else {
        toast.error('Failed to recompute risk')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      onClick={recompute}
      disabled={busy}
      variant="outline"
      title="Recompute rule-based risk scores"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      Recompute risk
    </Button>
  )
}
