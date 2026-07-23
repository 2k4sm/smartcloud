'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function AddSecretDialog({
  projectId,
  trigger,
}: {
  projectId: string
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [keyName, setKeyName] = React.useState('')
  const [value, setValue] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  function reset() {
    setKeyName('')
    setValue('')
    setDescription('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        key_name: keyName,
        value,
        description,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to save secret')
      setLoading(false)
      return
    }

    toast.success('Secret saved')
    setOpen(false)
    setLoading(false)
    reset()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Add secret
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add secret</DialogTitle>
            <DialogDescription>
              Stored encrypted with AES-256-GCM. The value is never shown to the
              browser after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="secret-key">Key name</Label>
              <Input
                id="secret-key"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value.toUpperCase())}
                required
                autoFocus
                className="font-mono"
                placeholder="DATABASE_PASSWORD"
              />
              <p className="text-xs text-muted-foreground">
                Keys are automatically uppercased.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="secret-value">Secret value</Label>
              <Textarea
                id="secret-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                rows={4}
                className="resize-none font-mono"
                placeholder="Enter the secret value…"
              />
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3" />
                Encrypted with AES-256-GCM before storage.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="secret-description">Description (optional)</Label>
              <Input
                id="secret-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this secret for?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Saving…' : 'Save secret'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
