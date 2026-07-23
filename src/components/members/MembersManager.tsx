'use client'

import { useEffect, useState, useCallback } from 'react'
import { Eye, Loader2, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectMember, ProjectRole } from '@/lib/types'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MidTruncate } from '@/components/ui/mid-truncate'
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

  const stats = [
    { label: 'Members', value: members.length, icon: Users },
    { label: 'Admins', value: adminCount, icon: ShieldCheck },
    { label: 'Viewers', value: viewerCount, icon: Eye },
  ]

  const inviteDialog = (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={invite}>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              The person must already have a SmartCloud account. Viewers can read
              secrets; admins can also add and edit them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                required
                autoFocus
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                <SelectTrigger id="member-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer — read secrets</SelectItem>
                  <SelectItem value="admin">Admin — read &amp; write</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
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

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-semibold tabular-nums leading-none">
                  {loading ? '—' : s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </Card>
      ) : teammates.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Just you so far</p>
            <p className="text-sm text-muted-foreground">
              Invite a teammate to collaborate on this project.
            </p>
          </div>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" />
            Invite member
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead className="w-40">Role</TableHead>
                <TableHead className="w-48">Access</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const label = m.email ?? m.user_id
                const isOwner = m.role === 'owner'
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {initialOf(label)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <MidTruncate text={label} className="flex w-full font-medium" />
                          {isOwner && (
                            <div className="text-xs text-muted-foreground">
                              Project owner
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Badge variant="secondary">Owner</Badge>
                      ) : (
                        <Select
                          value={m.role}
                          onValueChange={(v) => changeRole(m.id, v as ProjectRole)}
                        >
                          <SelectTrigger size="sm" className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.role === 'admin' || isOwner
                        ? 'Read & write'
                        : 'Read secrets'}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isOwner && (
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
                              <AlertDialogTitle>Remove this member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {label} will lose access to this project.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => remove(m.id)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
