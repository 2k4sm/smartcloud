'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectMember, ProjectRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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

export default function MembersManager({ projectId }: { projectId: string }) {
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

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-muted-foreground" />
          Members
          {!loading && (
            <span className="text-muted-foreground">({members.length})</span>
          )}
        </div>

        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="size-4" />
              Invite member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={invite}>
              <DialogHeader>
                <DialogTitle>Invite a teammate</DialogTitle>
                <DialogDescription>
                  The person must already have a SmartCloud account. Viewers can
                  read secrets; admins can also add and edit them.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="member-email">Email</Label>
                  <Input
                    id="member-email"
                    type="email"
                    required
                    placeholder="teammate@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="member-role">Role</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as ProjectRole)}
                  >
                    <SelectTrigger id="member-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Invite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </Card>
      ) : teammates.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Just you so far</p>
            <p className="text-sm text-muted-foreground">
              Invite a teammate to collaborate on this project.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" />
            Invite member
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.email ?? m.user_id}
                  </TableCell>
                  <TableCell>
                    {m.role === 'owner' ? (
                      <Badge variant="secondary">Owner</Badge>
                    ) : (
                      <Select
                        value={m.role}
                        onValueChange={(v) => changeRole(m.id, v as ProjectRole)}
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.role !== 'owner' && (
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
                              {m.email ?? m.user_id} will lose access to this
                              project.
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
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
