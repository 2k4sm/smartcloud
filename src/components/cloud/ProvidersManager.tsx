'use client'

import { useEffect, useState, useCallback } from 'react'
import { Cloud, CloudCog, Plug, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import type { CloudProviderSummary } from '@/lib/types'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { MidTruncate } from '@/components/ui/mid-truncate'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
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

type Kind = 'aws' | 'azure' | 'gcp'

const PROVIDER_LABEL: Record<Kind, string> = {
  aws: 'AWS Secrets Manager',
  azure: 'Azure Key Vault',
  gcp: 'GCP Secret Manager',
}

// The config field each provider is identified by, so a card can say
// which vault/region/project it actually points at.
const PRIMARY_CONFIG_LABEL: Record<Kind, string> = {
  aws: 'Region',
  azure: 'Vault',
  gcp: 'Project',
}

// Field definitions per provider: which go into `config` vs `credentials`.
const FIELDS: Record<
  Kind,
  {
    config: { key: string; label: string; placeholder: string }[]
    creds: {
      key: string
      label: string
      placeholder?: string
      secret?: boolean
      multiline?: boolean
    }[]
  }
> = {
  aws: {
    config: [{ key: 'region', label: 'Region', placeholder: 'us-east-1' }],
    creds: [
      { key: 'accessKeyId', label: 'Access key ID', placeholder: 'AKIA…' },
      { key: 'secretAccessKey', label: 'Secret access key', secret: true },
    ],
  },
  azure: {
    config: [
      {
        key: 'vaultUrl',
        label: 'Vault URL',
        placeholder: 'https://my-vault.vault.azure.net',
      },
    ],
    creds: [
      { key: 'tenantId', label: 'Tenant ID' },
      { key: 'clientId', label: 'Client ID' },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
  },
  gcp: {
    config: [
      { key: 'projectId', label: 'GCP project ID', placeholder: 'my-project' },
    ],
    creds: [
      {
        key: 'clientEmail',
        label: 'Service account email',
        placeholder: 'svc@my-project.iam.gserviceaccount.com',
      },
      {
        key: 'privateKey',
        label: 'Private key',
        secret: true,
        multiline: true,
        placeholder: '-----BEGIN PRIVATE KEY-----',
      },
    ],
  },
}

export default function ProvidersManager({
  projectId,
  projectName,
}: {
  projectId: string
  projectName?: string
}) {
  const [providers, setProviders] = useState<CloudProviderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('aws')
  const [name, setName] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/providers`)
    if (res.ok) setProviders((await res.json()).providers)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  function field(key: string) {
    return values[key] ?? ''
  }
  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  // Reset the form whenever the dialog closes so it opens clean next time.
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setKind('aws')
      setName('')
      setValues({})
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const config: Record<string, string> = {}
      const credentials: Record<string, string> = {}
      for (const f of FIELDS[kind].config) config[f.key] = field(f.key)
      for (const f of FIELDS[kind].creds) credentials[f.key] = field(f.key)

      const res = await fetch(`/api/projects/${projectId}/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: kind, name, config, credentials }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to connect provider')
        return
      }
      toast.success('Provider connected')
      onOpenChange(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/projects/${projectId}/providers/${id}`, {
      method: 'DELETE',
    })
    toast.success('Provider disconnected')
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloud providers"
        description={
          projectName
            ? `Push ${projectName}'s secrets out to AWS, Azure or GCP.`
            : 'Push secrets out to AWS, Azure or GCP.'
        }
      >
        {providers.length > 0 && (
          <Button onClick={() => setOpen(true)}>
            <CloudCog className="size-4" />
            Connect provider
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Cloud />
            </EmptyMedia>
            <EmptyTitle>No providers connected</EmptyTitle>
            <EmptyDescription>
              Connect AWS, Azure or GCP to mirror this project&apos;s secrets
              into a cloud secret store.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)}>
              <CloudCog className="size-4" />
              Connect provider
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {providers.map((p) => (
            <Card key={p.id} className="gap-4">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <Cloud className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" title={p.name}>
                      {p.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {PROVIDER_LABEL[p.provider]}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {PRIMARY_CONFIG_LABEL[p.provider]}
                </div>
                <div className="mt-1 rounded-md border bg-muted/50 px-2 py-1">
                  <MidTruncate
                    text={String(Object.values(p.config)[0] ?? '—')}
                    className="flex w-full font-mono text-xs"
                  />
                </div>
              </CardContent>
              <CardFooter className="mt-auto border-t pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Disconnect this provider?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {p.name} will be removed and secrets will no longer sync
                        to it. Secrets already written to the cloud store stay
                        there.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => remove(p.id)}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={connect} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Connect a cloud provider</DialogTitle>
              <DialogDescription>
                Credentials are encrypted with AES-256-GCM before storage and
                are never returned to the browser.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="provider-kind">Provider</FieldLabel>
                  <Select
                    value={kind}
                    onValueChange={(v) => {
                      setKind(v as Kind)
                      setValues({})
                    }}
                  >
                    <SelectTrigger id="provider-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">AWS Secrets Manager</SelectItem>
                      <SelectItem value="azure">Azure Key Vault</SelectItem>
                      <SelectItem value="gcp">GCP Secret Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="provider-name">Label</FieldLabel>
                  <Input
                    id="provider-name"
                    required
                    placeholder="e.g. Production AWS"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
              </div>

              {/* Every credential now carries a real label instead of a
                  placeholder that vanishes the moment you start typing. */}
              {FIELDS[kind].config.map((f) => (
                <Field key={f.key}>
                  <FieldLabel htmlFor={`cfg-${f.key}`}>{f.label}</FieldLabel>
                  <Input
                    id={`cfg-${f.key}`}
                    required
                    placeholder={f.placeholder}
                    value={field(f.key)}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </Field>
              ))}

              {FIELDS[kind].creds.map((f) => (
                <Field key={f.key}>
                  <FieldLabel htmlFor={`cred-${f.key}`}>{f.label}</FieldLabel>
                  {f.multiline ? (
                    <Textarea
                      id={`cred-${f.key}`}
                      required
                      placeholder={f.placeholder}
                      value={field(f.key)}
                      onChange={(e) => setField(f.key, e.target.value)}
                      rows={3}
                      className="resize-none font-mono text-xs"
                    />
                  ) : (
                    <Input
                      id={`cred-${f.key}`}
                      required
                      type={f.secret ? 'password' : 'text'}
                      placeholder={f.placeholder}
                      value={field(f.key)}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}
                  {f.secret && (
                    <FieldDescription>
                      Encrypted at rest; write-only from here on.
                    </FieldDescription>
                  )}
                </Field>
              ))}
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
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner /> : <Plug className="size-4" />}
                Connect
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
