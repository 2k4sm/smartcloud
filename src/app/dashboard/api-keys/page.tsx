'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  Clock,
  KeyRound,
  MoreHorizontal,
  Plus,
  TriangleAlert,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/dashboard/page-header'
import { MidTruncate } from '@/components/ui/mid-truncate'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Never'
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null)

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/api-keys')
    const data = await res.json()
    if (data.api_keys) setKeys(data.api_keys)
    setLoaded(true)
  }, [])

  useEffect(() => {
    // Initial async data load on mount (not a synchronous render-time setState).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchKeys()
  }, [fetchKeys])

  function onGenOpenChange(next: boolean) {
    setGenOpen(next)
    if (!next) setName('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setNewKey(null)

    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error || 'Failed to create API key')
      return
    }

    // Close the generate dialog, then reveal the key once in its own dialog.
    setGenOpen(false)
    setName('')
    setNewKey(data.api_key.key)
    fetchKeys()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    setKeyToRevoke(null)
    toast.success('API key revoked')
    fetchKeys()
  }

  const usedCount = keys.filter((k) => k.last_used_at).length
  const idleCount = keys.length - usedCount

  const generateDialog = (
    <Dialog open={genOpen} onOpenChange={onGenOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Generate key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleCreate} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Generate API key</DialogTitle>
            <DialogDescription>
              Give the key a name so you can recognise it later. The token is
              shown once, right after creation.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="key-name">Key name</FieldLabel>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. CI/CD pipeline, local dev"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onGenOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Spinner />}
              {loading ? 'Creating…' : 'Generate key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  function actionsMenu(key: ApiKey) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={deletingId === key.id}
            aria-label={`Actions for ${key.name}`}
          >
            {deletingId === key.id ? (
              <Spinner />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setKeyToRevoke(key)}
          >
            <Trash2 className="size-4" />
            Revoke
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title="API keys"
        description="Long-lived tokens for programmatic access through the SDK and CLI."
      >
        {keys.length > 0 && generateDialog}
      </PageHeader>

      {!loaded ? (
        <div className="space-y-4">
          <StatGrid>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[86px] rounded-xl" />
            ))}
          </StatGrid>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : keys.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound />
            </EmptyMedia>
            <EmptyTitle>No API keys yet</EmptyTitle>
            <EmptyDescription>
              Generate a key to authenticate the SDK or CLI against your
              secrets.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{generateDialog}</EmptyContent>
        </Empty>
      ) : (
        <>
          <StatGrid>
            <StatCard label="Total keys" value={keys.length} icon={KeyRound} />
            <StatCard label="Used at least once" value={usedCount} icon={Activity} />
            <StatCard
              label="Never used"
              value={idleCount}
              icon={Clock}
              tone={idleCount > 0 ? 'warning' : 'default'}
            />
          </StatGrid>

          {/* Phones get a card list; the table needs more columns than a
              360px viewport can show without squashing every one of them. */}
          <Card className="gap-0 overflow-hidden py-0 md:hidden">
            <ItemGroup>
              {keys.map((key, i) => (
                <div key={key.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item>
                    <ItemMedia variant="icon">
                      <KeyRound />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="break-all">{key.name}</ItemTitle>
                      <ItemDescription>
                        <Badge
                          variant="secondary"
                          className="max-w-full font-mono font-normal"
                        >
                          <MidTruncate
                            text={`${key.key_prefix}…`}
                            tailChars={4}
                          />
                        </Badge>
                      </ItemDescription>
                      <ItemDescription>
                        Created {formatDate(key.created_at)} · Last used{' '}
                        {formatDate(key.last_used_at)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>{actionsMenu(key)}</ItemActions>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          </Card>

          <Card className="hidden gap-0 overflow-hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead className="w-48">Key</TableHead>
                  <TableHead className="w-32">Created</TableHead>
                  <TableHead className="w-32">Last used</TableHead>
                  <TableHead className="w-14 pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="max-w-0 pl-4 font-medium">
                      <span className="block truncate" title={key.name}>
                        {key.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="max-w-full font-mono font-normal"
                      >
                        <MidTruncate
                          text={`${key.key_prefix}…`}
                          tailChars={4}
                        />
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(key.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {key.last_used_at ? (
                        formatDate(key.last_used_at)
                      ) : (
                        <span className="text-muted-foreground/60">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {actionsMenu(key)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Show-once new-key dialog */}
      <Dialog
        open={newKey !== null}
        onOpenChange={(open) => !open && setNewKey(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy it now — you won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">
              {newKey}
            </code>
            <CopyButton
              value={newKey ?? ''}
              variant="outline"
              size="icon"
              label="Copy API key"
            />
          </div>

          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>This is the only time the key is shown</AlertTitle>
            <AlertDescription>
              Store it somewhere safe, then use it as{' '}
              <code className="font-mono text-foreground">
                SMARTCLOUD_TOKEN
              </code>{' '}
              in your project&apos;s{' '}
              <code className="font-mono text-foreground">.env</code> file.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog
        open={keyToRevoke !== null}
        onOpenChange={(open) => !open && setKeyToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any integration using{' '}
              <span className="font-medium break-words text-foreground">
                {keyToRevoke?.name}
              </span>{' '}
              will stop working immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => keyToRevoke && handleDelete(keyToRevoke.id)}
            >
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
