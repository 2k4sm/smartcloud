'use client'

import { useEffect, useState, useCallback } from 'react'
import { BellPlus, Bell, Mail, Plus, Send, Trash2, Webhook } from 'lucide-react'
import { toast } from 'sonner'

import type { NotificationChannel } from '@/lib/types'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { CopyButton } from '@/components/ui/copy-button'
import { MidTruncate } from '@/components/ui/mid-truncate'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
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
  {
    key: 'rotation',
    label: 'Rotations',
    hint: 'Every time a pool serves a different key.',
  },
  {
    key: 'high_risk',
    label: 'High-risk alerts',
    hint: 'When a recompute lands a secret in HIGH.',
  },
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
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key],
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
      if (data.signing_secret) setNewSecret(data.signing_secret)
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
    await fetch(`/api/projects/${projectId}/channels/${id}`, {
      method: 'DELETE',
    })
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

  const addChannelDialog = (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <BellPlus className="size-4" />
          Add channel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add a channel</DialogTitle>
            <DialogDescription>
              Route rotation and high-risk alerts to an email inbox or an
              HMAC-signed webhook your systems can verify.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="channel-type">Type</FieldLabel>
              <Select
                value={type}
                onValueChange={(v) => setType(v as 'email' | 'webhook')}
              >
                <SelectTrigger id="channel-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="channel-target">Destination</FieldLabel>
              <Input
                id="channel-target"
                required
                type={type === 'email' ? 'email' : 'url'}
                placeholder={
                  type === 'email'
                    ? 'alerts@example.com'
                    : 'https://hooks.example.com/…'
                }
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>

            {/* Checkboxes, not switches: these are form values submitted
                with the rest of the dialog, not settings that take effect
                the instant they're flipped. */}
            <Field>
              <FieldLabel asChild>
                <span>Events</span>
              </FieldLabel>
              <div className="space-y-3">
                {EVENTS.map((ev) => (
                  <Field key={ev.key} orientation="horizontal">
                    <Checkbox
                      id={`event-${ev.key}`}
                      checked={events.includes(ev.key)}
                      onCheckedChange={() => toggleEvent(ev.key)}
                    />
                    <FieldContentInline
                      htmlFor={`event-${ev.key}`}
                      title={ev.label}
                      hint={ev.hint}
                    />
                  </Field>
                ))}
              </div>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !target.trim()}>
              {busy ? <Spinner /> : <Plus className="size-4" />}
              Add channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          projectName
            ? `Alerts for rotations and high-risk events in ${projectName}, sent to email or an HMAC-signed webhook.`
            : 'Route rotation and high-risk alerts to email or a webhook.'
        }
      >
        {channels.length > 0 && addChannelDialog}
      </PageHeader>

      {/* Signing secret is shown once, right after creation — kept out of the
          dialog so it survives the dialog closing. */}
      {newSecret && (
        <Alert variant="warning">
          <Webhook />
          <AlertTitle>Webhook signing secret — shown once</AlertTitle>
          <AlertDescription className="w-full">
            <code className="block w-full font-mono text-xs break-all text-foreground">
              {newSecret}
            </code>
            <p>
              Verify the{' '}
              <code className="font-mono">X-SmartCloud-Signature</code>{' '}
              HMAC-SHA256 header with this secret.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <CopyButton
                value={newSecret}
                variant="outline"
                size="sm"
                showLabel
                label="Copy secret"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewSecret(null)}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bell />
            </EmptyMedia>
            <EmptyTitle>No channels yet</EmptyTitle>
            <EmptyDescription>
              Add a channel to start receiving alerts when a key rotates or a
              secret turns high-risk.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{addChannelDialog}</EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {channels.map((c) => {
            const isWebhook = c.type === 'webhook'
            return (
              <Card key={c.id} className="gap-0 py-0">
                <CardHeader className="flex flex-row items-start gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    {isWebhook ? (
                      <Webhook className="size-5" />
                    ) : (
                      <Mail className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isWebhook ? (
                      <MidTruncate
                        text={c.target}
                        className="flex w-full font-mono text-sm font-medium"
                      />
                    ) : (
                      <div
                        className="truncate text-sm font-medium"
                        title={c.target}
                      >
                        {c.target}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground capitalize">
                      {c.type}
                    </span>
                  </div>
                  <Switch
                    checked={c.active}
                    onCheckedChange={() => toggleActive(c)}
                    aria-label={`${c.active ? 'Pause' : 'Resume'} alerts to ${c.target}`}
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
                        <Badge
                          key={e}
                          variant="secondary"
                          className="font-normal"
                        >
                          {EVENT_LABEL.get(e) ?? e}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>

                <CardFooter className="mt-auto justify-between gap-2 border-t p-2 pl-4">
                  <span
                    className={
                      c.active
                        ? 'text-xs font-medium text-success'
                        : 'text-xs text-muted-foreground'
                    }
                  >
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
                        <Spinner />
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
                          aria-label={`Delete channel ${c.target}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete this channel?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Alerts will no longer be sent to{' '}
                            <span className="font-medium break-all">
                              {c.target}
                            </span>
                            .
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => remove(c.id)}
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

/** Label + hint beside a checkbox, kept clickable via htmlFor. */
function FieldContentInline({
  htmlFor,
  title,
  hint,
}: {
  htmlFor: string
  title: string
  hint: string
}) {
  return (
    <div className="grid gap-0.5">
      <FieldLabel htmlFor={htmlFor}>
        <FieldTitle>{title}</FieldTitle>
      </FieldLabel>
      <FieldDescription className="text-xs">{hint}</FieldDescription>
    </div>
  )
}
