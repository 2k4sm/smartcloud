'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  Check,
  Clock,
  Copy,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/dashboard/page-header'
import { MidTruncate } from '@/components/ui/mid-truncate'
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

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null)

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/api-keys')
    const data = await res.json()
    if (data.api_keys) setKeys(data.api_keys)
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

  async function handleCopy() {
    if (!newKey) return
    await navigator.clipboard.writeText(newKey)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const usedCount = keys.filter((k) => k.last_used_at).length
  const idleCount = keys.length - usedCount

  const stats = [
    { label: 'Total keys', value: keys.length, icon: KeyRound },
    { label: 'Used', value: usedCount, icon: Activity },
    { label: 'Never used', value: idleCount, icon: Clock },
  ]

  const generateDialog = (
    <Dialog open={genOpen} onOpenChange={onGenOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Generate key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Generate API key</DialogTitle>
            <DialogDescription>
              Give the key a name so you can recognise it later. The token is
              shown once, right after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. CI/CD pipeline, local dev"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onGenOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Creating…' : 'Generate key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title="API keys"
        description="Long-lived tokens for programmatic access via the SDK and CLI."
      >
        {generateDialog}
      </PageHeader>

      {keys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <KeyRound className="mb-4 size-10 text-muted-foreground/50" />
            <p className="mb-1 font-medium">No API keys yet</p>
            <p className="mb-5 text-sm text-muted-foreground">
              Generate a key to authenticate the SDK or CLI against your secrets.
            </p>
            {generateDialog}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-semibold tabular-nums leading-none">
                      {s.value}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden py-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead className="w-44">Key</TableHead>
                  <TableHead className="w-28">Created</TableHead>
                  <TableHead className="w-28">Last used</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="truncate font-medium" title={key.name}>
                      {key.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="max-w-full font-mono font-normal">
                        <MidTruncate text={`${key.key_prefix}…`} tailChars={4} />
                      </Badge>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {new Date(key.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === key.id}
                            aria-label="Key actions"
                          >
                            {deletingId === key.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setKeyToRevoke(key)}
                          >
                            <Trash2 className="size-4" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Show-once new-key dialog */}
      <Dialog open={newKey !== null} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy it now — you won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap">
              {newKey}
            </code>
            <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy} aria-label="Copy key">
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            This is the only time the full key is shown. Store it somewhere safe.
          </div>
          <p className="text-xs text-muted-foreground">
            Use this as <code className="font-mono text-foreground">SMARTCLOUD_TOKEN</code> in
            your project&apos;s <code className="font-mono text-foreground">.env</code> file.
          </p>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={keyToRevoke !== null} onOpenChange={(open) => !open && setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any integrations using{' '}
              <span className="font-medium break-words text-foreground">{keyToRevoke?.name}</span> will stop
              working immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => keyToRevoke && handleDelete(keyToRevoke.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
