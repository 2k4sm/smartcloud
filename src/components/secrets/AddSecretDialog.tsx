'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Plus } from 'lucide-react'
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
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

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setKeyName('')
      setValue('')
      setDescription('')
    }
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
    handleOpenChange(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Add secret
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add secret</DialogTitle>
            <DialogDescription>
              Stored encrypted with AES-256-GCM. The value is never returned to
              the browser after saving.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="secret-key">Key name</FieldLabel>
              <Input
                id="secret-key"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value.toUpperCase())}
                required
                autoFocus
                className="font-mono"
                placeholder="DATABASE_PASSWORD"
              />
              <FieldDescription>
                Keys are automatically uppercased.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="secret-value">Secret value</FieldLabel>
              <Textarea
                id="secret-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                rows={4}
                className="resize-none font-mono text-sm"
                placeholder="Enter the secret value…"
              />
              <FieldDescription className="inline-flex items-center gap-1.5">
                <Lock className="size-3" aria-hidden />
                Encrypted with AES-256-GCM before storage.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="secret-description">
                Description (optional)
              </FieldLabel>
              <Input
                id="secret-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this secret for?"
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !keyName.trim() || !value}
            >
              {loading && <Spinner />}
              {loading ? 'Saving…' : 'Save secret'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
