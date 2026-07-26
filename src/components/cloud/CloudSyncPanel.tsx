'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Cloud } from 'lucide-react'
import { toast } from 'sonner'

import type { CloudProviderSummary, CloudSync } from '@/lib/types'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'

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
              {busy ? <Spinner /> : <Cloud className="size-4" />}
              Sync to all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No providers connected.{' '}
            <Link
              href={`/dashboard/projects/${projectId}/providers`}
              className="text-brand hover:underline"
            >
              Connect one →
            </Link>
          </p>
        ) : (
          <ItemGroup className="gap-1.5">
            {providers.map((p) => (
              <Item key={p.id} variant="muted" size="sm">
                <ItemMedia>
                  <Cloud className="size-4 text-muted-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="w-full min-w-0">
                    <span className="truncate">{p.name}</span>
                    <Badge
                      variant="outline"
                      className="shrink-0 font-normal uppercase"
                    >
                      {p.provider}
                    </Badge>
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-brand"
                    onClick={() => sync(p.id)}
                    disabled={busy}
                  >
                    Push
                    <ArrowRight className="size-3.5" />
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}

        {syncs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Recent syncs
              </div>
              <ul className="space-y-2">
                {syncs.slice(0, 8).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          s.status === 'success'
                            ? 'border-success-border bg-success-bg text-success'
                            : 'border-danger-border bg-danger-bg text-danger'
                        }
                      >
                        {s.status}
                      </Badge>
                      <span className="truncate text-muted-foreground">
                        {providerName(s.provider_id)}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {new Date(s.synced_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
