'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Cloud, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CloudProviderSummary, CloudSync } from '@/lib/types'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

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
    try {
      const res = await fetch(`/api/secrets/${secretId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providerId ? { provider_id: providerId } : {}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Sync failed')
      } else {
        toast.success('Secret synced')
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  const providerName = (id: string) =>
    providers.find((p) => p.id === id)?.name ?? id.slice(0, 8)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Cloud sync</CardTitle>
        {providers.length > 0 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Cloud className="size-4" />
              )}
              Sync to all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : providers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No providers connected.{' '}
            <Link
              href={`/dashboard/projects/${projectId}/providers`}
              className="text-primary hover:underline"
            >
              Connect one →
            </Link>
          </p>
        ) : (
          <div className="space-y-1">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {p.name}{' '}
                  <span className="text-xs uppercase text-muted-foreground">
                    {p.provider}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-primary"
                  onClick={() => sync(p.id)}
                  disabled={busy}
                >
                  push
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {syncs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Recent syncs</div>
              {syncs.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        s.status === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-destructive'
                      }
                    >
                      {s.status}
                    </span>
                    <span className="text-muted-foreground">
                      {providerName(s.provider_id)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(s.synced_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
