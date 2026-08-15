'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Eye,
  EyeOff,
  KeyRound,
  MoreHorizontal,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import type { SecretMetadata } from '@/lib/types'
import type { RiskLevel } from '@/lib/risk'
import RiskBadge from '@/components/risk/RiskBadge'
import { AddSecretDialog } from '@/components/secrets/AddSecretDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { Spinner } from '@/components/ui/spinner'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/datetime'

export interface SecretRisk {
  score: number
  level: RiskLevel
}

interface SecretsTableProps {
  secrets: SecretMetadata[]
  projectId: string
  risk?: Record<string, SecretRisk>
}

export default function SecretsTable({
  secrets,
  projectId,
  risk,
}: SecretsTableProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SecretMetadata | null>(null)
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>(
    {},
  )
  const [fetchingId, setFetchingId] = useState<string | null>(null)

  // Filtering client-side: the whole project's metadata is already here,
  // and a round trip per keystroke would be slower than a substring match.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return secrets
    return secrets.filter(
      (s) =>
        s.key_name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    )
  }, [secrets, query])

  async function handleReveal(secret: SecretMetadata) {
    setFetchingId(secret.id)
    const res = await fetch('/api/secrets/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, key_name: secret.key_name }),
    })
    const data = await res.json()
    if (res.ok) {
      setRevealedValues((prev) => ({ ...prev, [secret.id]: data.value }))
    } else {
      toast.error(data.error ?? 'Failed to reveal secret')
    }
    setFetchingId(null)
  }

  function handleHide(secretId: string) {
    setRevealedValues((prev) => {
      const next = { ...prev }
      delete next[secretId]
      return next
    })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeletingId(id)
    setDeleteTarget(null)

    const res = await fetch(`/api/secrets/${id}`, { method: 'DELETE' })

    setDeletingId(null)
    if (res.ok) {
      toast.success('Secret deleted')
      router.refresh()
    } else {
      toast.error('Failed to delete secret')
    }
  }

  function SecretValue({ secret }: { secret: SecretMetadata }) {
    const value = revealedValues[secret.id]

    if (value) {
      return (
        <div className="flex min-w-0 items-center gap-1">
          <span
            className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2 py-1 font-mono text-xs"
            title={value}
          >
            {value}
          </span>
          <CopyButton value={value} label="Copy value" size="icon-xs" />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => handleHide(secret.id)}
            aria-label="Hide value"
          >
            <EyeOff className="size-3.5" />
          </Button>
        </div>
      )
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 font-mono text-muted-foreground"
        onClick={() => handleReveal(secret)}
        disabled={fetchingId === secret.id}
      >
        {fetchingId === secret.id ? (
          <Spinner className="size-3.5" />
        ) : (
          <Eye className="size-3.5" />
        )}
        ••••••••
      </Button>
    )
  }

  function ActionsMenu({ secret }: { secret: SecretMetadata }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={deletingId === secret.id}
            aria-label={`Actions for ${secret.key_name}`}
          >
            {deletingId === secret.id ? (
              <Spinner />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/projects/${projectId}/secrets/${secret.id}`}>
              <Eye className="size-4" />
              View risk detail
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteTarget(secret)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (!secrets.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRound />
          </EmptyMedia>
          <EmptyTitle>No secrets yet</EmptyTitle>
          <EmptyDescription>
            Add your first encrypted secret to this project, then read it back
            from the SDK or CLI.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <AddSecretDialog projectId={projectId} />
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search earns its place once a project passes a screenful of
            keys, which is the normal case rather than the exception. */}
        {secrets.length > 5 && (
          <InputGroup className="sm:max-w-xs">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter secrets…"
              aria-label="Filter secrets"
            />
          </InputGroup>
        )}

        {filtered.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>No matches</EmptyTitle>
              <EmptyDescription>
                Nothing in this project matches “{query}”.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => setQuery('')}>
                Clear filter
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {/* Card list on phones — six columns can't survive a 360px
                viewport, and a secret key is the last thing to truncate. */}
            <Card className="gap-0 overflow-hidden py-0 lg:hidden">
              <ItemGroup>
                {filtered.map((secret, i) => (
                  <div key={secret.id}>
                    {i > 0 && <ItemSeparator />}
                    <Item className="flex-col items-start gap-3">
                      <div className="flex w-full items-start justify-between gap-2">
                        <ItemContent className="gap-1.5">
                          <ItemTitle className="font-mono break-all text-brand">
                            {secret.key_name}
                          </ItemTitle>
                          {risk?.[secret.id] && (
                            <Link
                              href={`/dashboard/projects/${projectId}/secrets/${secret.id}`}
                              className="w-fit"
                            >
                              <RiskBadge
                                level={risk[secret.id].level}
                                score={risk[secret.id].score}
                              />
                            </Link>
                          )}
                          {secret.description && (
                            <ItemDescription>
                              {secret.description}
                            </ItemDescription>
                          )}
                        </ItemContent>
                        <ItemActions>
                          <ActionsMenu secret={secret} />
                        </ItemActions>
                      </div>
                      <div className="w-full min-w-0">
                        <SecretValue secret={secret} />
                      </div>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            </Card>

            <Card className="hidden gap-0 overflow-hidden py-0 lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[22%] pl-4">Key</TableHead>
                    <TableHead className="w-[26%]">Value</TableHead>
                    <TableHead className="w-32">Risk</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-28">Updated</TableHead>
                    <TableHead className="w-14 pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell className="max-w-0 pl-4">
                        <span
                          className="block truncate font-mono font-medium text-brand"
                          title={secret.key_name}
                        >
                          {secret.key_name}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <SecretValue secret={secret} />
                      </TableCell>
                      <TableCell>
                        {risk?.[secret.id] ? (
                          <Link
                            href={`/dashboard/projects/${projectId}/secrets/${secret.id}`}
                            className="transition-opacity hover:opacity-80"
                          >
                            <RiskBadge
                              level={risk[secret.id].level}
                              score={risk[secret.id].score}
                            />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not scored
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-0 text-muted-foreground">
                        <span
                          className="block truncate"
                          title={secret.description ?? undefined}
                        >
                          {secret.description ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDate(secret.updated_at)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <ActionsMenu secret={secret} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this secret?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono break-all text-foreground">
                {deleteTarget?.key_name}
              </span>{' '}
              will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
