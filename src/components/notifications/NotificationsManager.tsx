'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { NotificationChannel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

export default function NotificationsManager({ projectId }: { projectId: string }) {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'email' | 'webhook'>('email')
  const [target, setTarget] = useState('')
  const [events, setEvents] = useState<string[]>(['high_risk'])
  const [busy, setBusy] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

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
      if (data.signing_secret) setNewSecret(data.signing_secret)
      toast.success('Channel added')
      setTarget('')
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

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a channel</CardTitle>
          <CardDescription>
            Route rotation and high-risk alerts to email or an HMAC-signed webhook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="space-y-1.5">
                <Label htmlFor="channel-type">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'email' | 'webhook')}>
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
                  placeholder={type === 'email' ? 'alerts@example.com' : 'https://hooks.example.com/…'}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {EVENTS.map((ev) => (
                  <label key={ev.key} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={events.includes(ev.key)}
                      onCheckedChange={() => toggleEvent(ev.key)}
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add channel
            </Button>

            {newSecret && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="mb-1 text-xs font-medium text-foreground">
                  Webhook signing secret (shown once)
                </div>
                <code className="font-mono text-xs break-all text-foreground">{newSecret}</code>
                <p className="mt-1 text-xs text-muted-foreground">
                  Verify the <code>X-SmartCloud-Signature</code> HMAC-SHA256 header with this.
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className={loading || channels.length === 0 ? undefined : 'divide-y divide-border py-0'}>
        {loading ? (
          <CardContent className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto size-4 animate-spin" />
          </CardContent>
        ) : channels.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No channels yet.
          </CardContent>
        ) : (
          channels.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.target}</div>
                <div className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="mr-1.5 font-normal">{c.type}</Badge>
                  {c.events.join(', ')}
                </div>
              </div>
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
                <label className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  {c.active ? 'Active' : 'Paused'}
                </label>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
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
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
