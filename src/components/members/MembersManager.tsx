'use client'

import { useEffect, useState, useCallback } from 'react'
import { Eye, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'

import type { ProjectMember, ProjectRole } from '@/lib/types'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MidTruncate } from '@/components/ui/mid-truncate'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

function initialOf(value: string) {
  return (value.trim().charAt(0) || '?').toUpperCase()
}

export default function MembersManager({
  projectId,
  projectName,
}: {
  projectId: string
  projectName?: string
}) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectRole>('viewer')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/members`)
    const data = await res.json()
    if (res.ok) setMembers(data.members)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  // Reset the invite form whenever the dialog closes.
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setEmail('')
      setRole('viewer')
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add member')
        return
      }
      toast.success('Member added')
      onOpenChange(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(memberId: string, newRole: ProjectRole) {
    await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    toast.success('Role updated')
    await load()
  }

  async function remove(memberId: string) {
    await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
    })
    toast.success('Member removed')
    await load()
  }

  const teammates = members.filter((m) => m.role !== 'owner')
  const adminCount = members.filter((m) => m.role === 'admin').length
  const viewerCount = members.filter((m) => m.role === 'viewer').length

  const inviteDialog = (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={invite} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              The person must already have a SmartCloud account. Viewers can
              read secrets; admins can also add and edit them.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="member-email">Email</FieldLabel>
              <Input
                id="member-email"
                type="email"
                required
                autoFocus
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="member-role">Role</FieldLabel>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as ProjectRole)}
              >
                <SelectTrigger id="member-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer — read secrets</SelectItem>
                  <SelectItem value="admin">Admin — read &amp; write</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? <Spinner /> : <UserPlus className="size-4" />}
              Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description={
          projectName ? (
            <>
              People with access to{' '}
              <span className="text-foreground">{projectName}</span>.
            </>
          ) : (
            'Manage who can access this project.'
          )
        }
      >
        {inviteDialog}
      </PageHeader>

      {loading ? (
        <div className="space-y-4">
          <StatGrid>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[86px] rounded-xl" />
            ))}
          </StatGrid>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : (
        <>
          <StatGrid>
            <StatCard label="Members" value={members.length} icon={Users} />
            <StatCard label="Admins" value={adminCount} icon={ShieldCheck} />
            <StatCard label="Viewers" value={viewerCount} icon={Eye} />
          </StatGrid>

          {teammates.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>Just you so far</EmptyTitle>
                <EmptyDescription>
                  Invite a teammate to collaborate on this project.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => setOpen(true)}>
                  <UserPlus className="size-4" />
                  Invite member
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            // A member row is naturally list-shaped: identity, role control,
            // one destructive action. It reads the same at 360px and 1600px,
            // so there's no separate mobile treatment to keep in sync.
            <Card className="gap-0 overflow-hidden py-0">
              <ItemGroup>
                {members.map((m, i) => {
                  const label = m.email ?? m.user_id
                  const isOwner = m.role === 'owner'
                  return (
                    <div key={m.id}>
                      {i > 0 && <ItemSeparator />}
                      <Item className="gap-x-4 gap-y-3">
                        <ItemMedia>
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-brand-subtle text-xs font-semibold text-brand">
                              {initialOf(label)}
                            </AvatarFallback>
                          </Avatar>
                        </ItemMedia>

                        <ItemContent className="min-w-40">
                          <ItemTitle className="w-full">
                            <MidTruncate text={label} className="flex w-full" />
                          </ItemTitle>
                          <ItemDescription>
                            {isOwner
                              ? 'Project owner · read & write'
                              : m.role === 'admin'
                                ? 'Read & write'
                                : 'Read secrets'}
                          </ItemDescription>
                        </ItemContent>

                        <ItemActions className="ml-auto">
                          {isOwner ? (
                            <Badge variant="secondary">Owner</Badge>
                          ) : (
                            <>
                              <Select
                                value={m.role}
                                onValueChange={(v) =>
                                  changeRole(m.id, v as ProjectRole)
                                }
                              >
                                <SelectTrigger
                                  size="sm"
                                  className="w-32"
                                  aria-label={`Role for ${label}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>

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
                                    <AlertDialogTitle>
                                      Remove this member?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      <span className="break-all">{label}</span>{' '}
                                      will lose access to this project.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      variant="destructive"
                                      onClick={() => remove(m.id)}
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </ItemActions>
                      </Item>
                    </div>
                  )
                })}
              </ItemGroup>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
