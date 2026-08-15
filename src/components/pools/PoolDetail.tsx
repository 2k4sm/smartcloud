'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import RiskBadge from '@/components/risk/RiskBadge'
import { PageHeader } from '@/components/dashboard/page-header'
import type { KeyPool, PoolKeyMeta, PoolRotation } from '@/lib/types'
import type { RiskLevel } from '@/lib/risk'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatDateTime } from '@/lib/datetime'

interface PoolData {
  pool: KeyPool
  keys: PoolKeyMeta[]
  rotations: PoolRotation[]
  risk: { score: number; level: RiskLevel }
}

export default function PoolDetail({
  poolId,
  projectId,
}: {
  poolId: string
  projectId?: string
}) {
  const router = useRouter()
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // add-key form
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/pools/${poolId}`)
    if (res.ok) setData(await res.json())
    else setError((await res.json().catch(() => ({}))).error ?? 'Failed to load')
    setLoading(false)
  }, [poolId])

  useEffect(() => {
    load()
  }, [load])

  async function addKey(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(`/api/pools/${poolId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue, label: newLabel || undefined }),
      })
      if (!res.ok) {
        toast.error(
          (await res.json().catch(() => ({}))).error ?? 'Failed to add key',
        )
        return
      }
      setNewValue('')
      setNewLabel('')
      toast.success('Key added to pool')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(k: PoolKeyMeta) {
    await fetch(`/api/pools/${poolId}/keys/${k.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !k.active }),
    })
    await load()
  }

  async function removeKey(id: string) {
    await fetch(`/api/pools/${poolId}/keys/${id}`, { method: 'DELETE' })
    toast.success('Key removed')
    await load()
  }

  async function rotate() {
    setBusy(true)
    try {
      const res = await fetch(`/api/pools/${poolId}/rotate`, { method: 'POST' })
      if (!res.ok) {
        toast.error(
          (await res.json().catch(() => ({}))).error ?? 'Rotate failed',
        )
      } else {
        toast.success('Rotated to the least-used active key')
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function savePolicy(patch: Partial<KeyPool>) {
    await fetch(`/api/pools/${poolId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await load()
  }

  async function deletePool() {
    const res = await fetch(`/api/pools/${poolId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push(
        `/dashboard/projects/${data?.pool.project_id ?? projectId ?? ''}`,
      )
      router.refresh()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full max-w-md rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRound />
          </EmptyMedia>
          <EmptyTitle>Pool unavailable</EmptyTitle>
          <EmptyDescription>{error ?? 'Not found'}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const { pool, keys, rotations, risk } = data
  const maxUsage = Math.max(1, ...keys.map((k) => k.usage_count))
  const activeCount = keys.filter((k) => k.active).length
  const backHref = `/dashboard/projects/${pool.project_id ?? projectId ?? ''}/pools`

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={backHref}
        backLabel="Key pools"
        title={<span className="font-mono break-all">{pool.name}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RiskBadge level={risk.level} score={risk.score} />
            <span>
              {activeCount} active key{activeCount === 1 ? '' : 's'} ·{' '}
              {keys.length} total
            </span>
            {pool.description && <span>· {pool.description}</span>}
          </span>
        }
      >
        <Button
          variant="outline"
          onClick={rotate}
          disabled={busy || activeCount < 2}
          title={
            activeCount < 2
              ? 'Two or more active keys are needed to rotate'
              : 'Rotate to the least-used active key'
          }
        >
          {busy ? <Spinner /> : <RefreshCw className="size-4" />}
          Rotate now
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label="Delete pool"
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this pool?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the pool and all of its keys. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={deletePool}>
                Delete pool
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Keys */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b py-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              Keys in pool
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              {keys.length}
            </Badge>
          </CardHeader>

          {keys.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No keys yet — add one below.
            </div>
          ) : (
            <ItemGroup>
              {keys.map((k, i) => (
                <div key={k.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item className="flex-wrap gap-x-4 gap-y-3">
                    <ItemContent className="min-w-48 basis-full sm:basis-auto">
                      <ItemTitle className="flex-wrap gap-2">
                        <span className="truncate">{k.label || 'key'}</span>
                        {k.is_current && (
                          <Badge
                            variant="outline"
                            className="border-brand/40 text-brand"
                          >
                            current
                          </Badge>
                        )}
                        {!k.active && (
                          <Badge variant="secondary" className="font-normal">
                            inactive
                          </Badge>
                        )}
                      </ItemTitle>
                      <div className="flex items-center gap-2 pt-1">
                        <Progress
                          value={(k.usage_count / maxUsage) * 100}
                          className="h-1.5 max-w-56 flex-1"
                        />
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {k.usage_count} use{k.usage_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </ItemContent>

                    <ItemActions className="ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(k)}
                      >
                        {k.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Remove ${k.label || 'key'}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove this key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The key will be removed from the pool.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => removeKey(k.id)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          )}

          <Separator />
          <form onSubmit={addKey} className="flex flex-col gap-2 p-4 sm:flex-row">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              aria-label="Key label"
              className="sm:w-44"
            />
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              required
              placeholder="Paste a real key value"
              aria-label="Key value"
              className="flex-1 font-mono text-xs"
            />
            <Button type="submit" disabled={busy || !newValue}>
              {busy ? <Spinner /> : <Plus className="size-4" />}
              Add key
            </Button>
          </form>
        </Card>

        {/* Policy + history */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rotation policy</CardTitle>
              <CardDescription>
                Rotation switches the served key to the least-used active one.
                Every key stays valid.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="rotate-high-risk">
                    Rotate when risk is High
                  </FieldLabel>
                  <FieldDescription>
                    Checked on every scheduler tick. Risk is measured over
                    activity since the last rotation, so it settles once the
                    pool has moved off the suspicious key.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="rotate-high-risk"
                  checked={pool.rotate_on_high_risk}
                  onCheckedChange={(checked) =>
                    savePolicy({ rotate_on_high_risk: checked })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="rotation-interval">
                  Scheduled rotation
                </FieldLabel>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Every</span>
                  <Input
                    id="rotation-interval"
                    type="number"
                    min={1}
                    defaultValue={pool.rotation_interval_days ?? ''}
                    onBlur={(e) =>
                      savePolicy({
                        rotation_interval_days: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    placeholder="—"
                    className="h-9 w-20"
                  />
                  <span className="text-muted-foreground">days</span>
                </div>
                <FieldDescription>
                  Leave blank to turn scheduled rotation off.
                </FieldDescription>
              </Field>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rotation history</CardTitle>
            </CardHeader>
            <CardContent>
              {rotations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No rotations yet.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {rotations.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <Badge variant="secondary" className="font-normal">
                        {r.trigger}
                      </Badge>
                      <span className="text-muted-foreground tabular-nums">
                        {formatDateTime(r.rotated_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
