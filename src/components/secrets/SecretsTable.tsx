'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SecretMetadata } from '@/lib/types'
import type { RiskLevel } from '@/lib/risk'
import RiskBadge from '@/components/risk/RiskBadge'
import { AddSecretDialog } from '@/components/secrets/AddSecretDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

export interface SecretRisk {
  score: number
  level: RiskLevel
}

interface SecretsTableProps {
  secrets: SecretMetadata[]
  projectId: string
  risk?: Record<string, SecretRisk>
}

export default function SecretsTable({ secrets, projectId, risk }: SecretsTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SecretMetadata | null>(null)
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({})
  const [fetchingId, setFetchingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  async function handleCopy(secretId: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedId(secretId)
    toast.success('Copied')
    setTimeout(() => setCopiedId(null), 2000)
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

  if (!secrets.length) {
    return (
      <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
        <KeyRound className="mb-4 size-10 text-muted-foreground/60" />
        <p className="mb-1 font-medium">No secrets yet</p>
        <p className="mb-5 text-sm text-muted-foreground">
          Add your first encrypted secret to this project.
        </p>
        <AddSecretDialog projectId={projectId} />
      </Card>
    )
  }

  return (
    <>
      <Card className="overflow-hidden py-0">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[24%]">Key</TableHead>
              <TableHead className="w-[24%]">Value</TableHead>
              <TableHead className="w-24">Risk</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28">Updated</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.map((secret) => (
              <TableRow key={secret.id}>
                <TableCell
                  className="truncate font-mono font-medium text-primary"
                  title={secret.key_name}
                >
                  {secret.key_name}
                </TableCell>
                <TableCell>
                  {revealedValues[secret.id] ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2 py-1 font-mono text-xs"
                        title={revealedValues[secret.id]}
                      >
                        {revealedValues[secret.id]}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleCopy(secret.id, revealedValues[secret.id])}
                        title="Copy value"
                      >
                        {copiedId === secret.id ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        <span className="sr-only">Copy value</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleHide(secret.id)}
                        title="Hide value"
                      >
                        <EyeOff className="size-3.5" />
                        <span className="sr-only">Hide value</span>
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 font-mono text-muted-foreground"
                      onClick={() => handleReveal(secret)}
                      disabled={fetchingId === secret.id}
                    >
                      {fetchingId === secret.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      ••••••••
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {risk?.[secret.id] ? (
                    <Link
                      href={`/dashboard/projects/${projectId}/secrets/${secret.id}`}
                      className="transition-opacity hover:opacity-80"
                      title="View risk detail"
                    >
                      <RiskBadge
                        level={risk[secret.id].level}
                        score={risk[secret.id].score}
                      />
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className="truncate text-xs text-muted-foreground"
                  title={secret.description ?? undefined}
                >
                  {secret.description ?? '—'}
                </TableCell>
                <TableCell className="truncate text-xs text-muted-foreground">
                  {new Date(secret.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === secret.id}
                      >
                        {deletingId === secret.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="size-4" />
                        )}
                        <span className="sr-only">Open actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/projects/${projectId}/secrets/${secret.id}`}
                        >
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this secret?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">
                {deleteTarget?.key_name}
              </span>{' '}
              will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
