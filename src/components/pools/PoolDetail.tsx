'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, KeyRound, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import RiskBadge from '@/components/risk/RiskBadge'
import { PageHeader } from '@/components/dashboard/page-header'
import type { KeyPool, PoolKeyMeta, PoolRotation } from '@/lib/types'
import type { RiskLevel } from '@/lib/risk'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
        toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to add key')
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
        toast.error((await res.json().catch(() => ({}))).error ?? 'Rotate failed')
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
      router.push(`/dashboard/projects/${data?.pool.project_id ?? projectId ?? ''}`)
      router.refresh()
    }
  }

  if (loading)
    return (
      <Card className="items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </Card>
    )
  if (!data)
    return (
      <Card className="py-8">
        <CardContent className="text-sm text-destructive">
          {error ?? 'Not found'}
        </CardContent>
      </Card>
    )

  const { pool, keys, rotations, risk } = data
  const maxUsage = Math.max(1, ...keys.map((k) => k.usage_count))
  const activeCount = keys.filter((k) => k.active).length
  const backHref = `/dashboard/projects/${pool.project_id ?? projectId ?? ''}/pools`

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Key pools
      </Link>

      <PageHeader
        title={<span className="font-mono">{pool.name}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <RiskBadge level={risk.level} score={risk.score} />
            <span className="text-muted-foreground">
              {activeCount} active key{activeCount === 1 ? '' : 's'} · {keys.length}{' '}
              total
            </span>
            {pool.description && (
              <span className="text-muted-foreground">· {pool.description}</span>
            )}
          </span>
        }
      >
        <Button
          variant="outline"
          onClick={rotate}
          disabled={busy || activeCount < 2}
          title={activeCount < 2 ? 'Need 2+ active keys to rotate' : 'Rotate to least-used key'}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Rotate now
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" />
              <span className="sr-only">Delete pool</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this pool?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the pool and all of its keys. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deletePool}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete pool
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Keys */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4 text-muted-foreground" />
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
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Key</TableHead>
                  <TableHead className="w-1/3">Usage</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{k.label || 'key'}</span>
                        {k.is_current && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 text-primary"
                          >
                            current
                          </Badge>
                        )}
                        {!k.active && (
                          <Badge variant="secondary" className="font-normal">
                            inactive
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-chart-1"
                            style={{ width: `${(k.usage_count / maxUsage) * 100}%` }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                          {k.usage_count} use{k.usage_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(k)}>
                        {k.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            Remove
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
                              onClick={() => removeKey(k.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Separator />
          <form onSubmit={addKey} className="flex flex-col gap-2 p-4 sm:flex-row">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              className="sm:w-40"
            />
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              required
              placeholder="Paste a real key value"
              className="flex-1 font-mono text-xs"
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add key
            </Button>
          </form>
        </Card>

        {/* Policy + history */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rotation policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="rotate-high-risk" className="font-normal">
                  Rotate when risk is High
                </Label>
                <Switch
                  id="rotate-high-risk"
                  checked={pool.rotate_on_high_risk}
                  onCheckedChange={(checked) =>
                    savePolicy({ rotate_on_high_risk: checked })
                  }
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Rotate every</span>
                <Input
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
                  className="h-8 w-20"
                />
                <span className="text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Rotation switches the served key to the least-used active one. All
                keys stay valid; blank interval turns scheduled rotation off.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rotation history</CardTitle>
            </CardHeader>
            <CardContent>
              {rotations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No rotations yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {rotations.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <Badge variant="secondary" className="font-normal">
                        {r.trigger}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(r.rotated_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
