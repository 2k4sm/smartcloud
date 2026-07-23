'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BellPlus,
  Bell,
  Check,
  Copy,
  Loader2,
  Mail,
  Plus,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react'
import { toast } from 'sonner'
import type { NotificationChannel } from '@/lib/types'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
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

const EVENTS = [
  { key: 'rotation', label: 'Rotations' },
  { key: 'high_risk', label: 'High-risk alerts' },
]

const EVENT_LABEL = new Map(EVENTS.map((e) => [e.key, e.label]))

export default function NotificationsManager({
  projectId,
  projectName,
}: {
  projectId: string
  projectName?: string
}) {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'email' | 'webhook'>('email')
  const [target, setTarget] = useState('')
  const [events, setEvents] = useState<string[]>(['high_risk'])
  const [busy, setBusy] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Reset the form when the dialog closes.
      setType('email')
      setTarget('')
      setEvents(['high_risk'])
    }
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/channels`)
    if (res.ok) setChannels((await res.json()).channels)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  function toggleEvent(key: string) {
    setEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]
    )
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNewSecret(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, target, events }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create channel')
        return
      }
      if (data.signing_secret) {
        setNewSecret(data.signing_secret)
        setCopied(false)
      }
      toast.success('Channel added')
      handleOpenChange(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(ch: NotificationChannel) {
    await fetch(`/api/projects/${projectId}/channels/${ch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !ch.active }),
    })
    await load()
  }

  async function remove(id: string) {
    await fetch(`/api/projects/${projectId}/channels/${id}`, { method: 'DELETE' })
    toast.success('Channel deleted')
    await load()
  }

  async function sendTest(id: string) {
    setTestingId(id)
    try {
      const res = await fetch(`/api/projects/${projectId}/channels/${id}/test`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) toast.success('Test notification sent')
      else toast.error(`Test failed: ${data.error ?? res.status}`)
    } finally {
      setTestingId(null)
    }
  }

  async function copySecret() {
    if (!newSecret) return
    await navigator.clipboard.writeText(newSecret)
    setCopied(true)
    toast.success('Copied')
    setTimeout(() => setCopied(false), 1500)
  }

  const addChannelDialog = (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <BellPlus className="size-4" />
          Add channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a channel</DialogTitle>
          <DialogDescription>
            Route rotation and high-risk alerts to email or an HMAC-signed
            webhook.
          </DialogDescription>
        </DialogHeader>
        <form id="add-channel-form" onSubmit={create} className="space-y-4 py-1">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="space-y-1.5">
              <Label htmlFor="channel-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as 'email' | 'webhook')}
              >
                <SelectTrigger id="channel-type" className="sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="channel-target">Destination</Label>
              <Input
                id="channel-target"
                required
                placeholder={
                  type === 'email'
                    ? 'alerts@example.com'
                    : 'https://hooks.example.com/…'
                }
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {EVENTS.map((ev) => (
                <label
                  key={ev.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Switch
                    checked={events.includes(ev.key)}
                    onCheckedChange={() => toggleEvent(ev.key)}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="add-channel-form" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          projectName
            ? `Alerts for rotations and high-risk events in ${projectName}.`
            : 'Route rotation and high-risk alerts to email or a webhook.'
        }
      >
        {addChannelDialog}
      </PageHeader>

      <p className="-mt-2 text-sm text-muted-foreground">
        Send alerts to an <span className="text-foreground">email</span> inbox
        or an <span className="text-foreground">HMAC-signed webhook</span> your
        systems can verify.
      </p>

      {/* Signing secret is shown once, right after creation — kept out of the
          dialog so it survives the dialog closing. */}
      {newSecret && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              Webhook signing secret{' '}
              <span className="text-muted-foreground">(shown once)</span>
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={copySecret}>
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewSecret(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
          <code className="block font-mono text-xs break-all text-foreground">
            {newSecret}
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            Verify the <code>X-SmartCloud-Signature</code> HMAC-SHA256 header
            with this secret.
          </p>
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center border-dashed py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </Card>
      ) : channels.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <Bell className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No channels yet</p>
            <p className="text-sm text-muted-foreground">
              Add a channel to start receiving alerts.
            </p>
          </div>
          {addChannelDialog}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channels.map((c) => {
            const isWebhook = c.type === 'webhook'
            return (
              <Card key={c.id} className="gap-0 py-0">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-4">
                  <div
                    className={
                      isWebhook
                        ? 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-2/15 text-chart-2'
                        : 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary'
                    }
                  >
                    {isWebhook ? (
                      <Webhook className="size-5" />
                    ) : (
                      <Mail className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        isWebhook
                          ? 'truncate font-mono text-sm font-medium'
                          : 'truncate text-sm font-medium'
                      }
                      title={c.target}
                    >
                      {c.target}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {c.type}
                    </span>
                  </div>
                  <Switch
                    checked={c.active}
                    onCheckedChange={() => toggleActive(c)}
                    aria-label={c.active ? 'Active' : 'Paused'}
                  />
                </CardHeader>

                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.events.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No events subscribed
                      </span>
                    ) : (
                      c.events.map((e) => (
                        <Badge key={e} variant="secondary" className="font-normal">
                          {EVENT_LABEL.get(e) ?? e}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>

                <CardFooter className="justify-between border-t p-2 pl-4">
                  <span className="text-xs text-muted-foreground">
                    {c.active ? 'Active' : 'Paused'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendTest(c.id)}
                      disabled={testingId === c.id}
                    >
                      {testingId === c.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Test
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label="Delete channel"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this channel?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Alerts will no longer be sent to {c.target}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove(c.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
