'use client'

import { useEffect, useState, useCallback } from 'react'
import { Cloud, CloudCog, Loader2, Plug, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CloudProviderSummary } from '@/lib/types'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
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

// Per-provider tint for the icon chip so the three are visually distinct.
const PROVIDER_TINT: Record<Kind, string> = {
  aws: 'bg-chart-3/15 text-chart-3',
  azure: 'bg-primary/15 text-primary',
  gcp: 'bg-chart-2/15 text-chart-2',
}

// Field definitions per provider: which go into `config` vs `credentials`.
const FIELDS: Record<
  Kind,
  { config: { key: string; label: string }[]; creds: { key: string; label: string; secret?: boolean }[] }
> = {
  aws: {
    config: [{ key: 'region', label: 'Region (e.g. us-east-1)' }],
    creds: [
      { key: 'accessKeyId', label: 'Access Key ID' },
      { key: 'secretAccessKey', label: 'Secret Access Key', secret: true },
    ],
  },
  azure: {
    config: [{ key: 'vaultUrl', label: 'Vault URL (https://<vault>.vault.azure.net)' }],
    creds: [
      { key: 'tenantId', label: 'Tenant ID' },
      { key: 'clientId', label: 'Client ID' },
      { key: 'clientSecret', label: 'Client Secret', secret: true },
    ],
  },
  gcp: {
    config: [{ key: 'projectId', label: 'GCP Project ID' }],
    creds: [
      { key: 'clientEmail', label: 'Service Account Email' },
      { key: 'privateKey', label: 'Private Key', secret: true },
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
    await fetch(`/api/projects/${projectId}/providers/${id}`, { method: 'DELETE' })
    toast.success('Provider disconnected')
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloud providers"
        description={
          projectName
            ? `Sync ${projectName}'s secrets out to AWS, Azure, or GCP.`
            : 'Sync secrets out to AWS, Azure, or GCP.'
        }
      >
        <Button onClick={() => setOpen(true)}>
          <CloudCog className="size-4" />
          Connect provider
        </Button>
      </PageHeader>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </CardContent>
        </Card>
      ) : providers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Cloud className="mb-4 size-10 text-muted-foreground/50" />
            <p className="mb-1 font-medium">No providers connected</p>
            <p className="mb-5 text-sm text-muted-foreground">
              Connect AWS, Azure, or GCP to push this project&apos;s secrets to a
              cloud secret store.
            </p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <CloudCog className="size-4" />
              Connect provider
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {providers.map((p) => (
            <Card key={p.id} className="gap-4">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${PROVIDER_TINT[p.provider]}`}
                  >
                    <Cloud className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {PROVIDER_LABEL[p.provider]}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <span className="block truncate rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {Object.values(p.config)[0] ?? '—'}
                </span>
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
                      <AlertDialogTitle>Disconnect this provider?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {p.name} will be removed and secrets will no longer sync to it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => remove(p.id)}
                        className="bg-destructive text-white hover:bg-destructive/90"
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect a cloud provider</DialogTitle>
            <DialogDescription>
              Credentials are encrypted with AES-256-GCM before storage and never
              returned to the browser.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={connect} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="provider-kind">Provider</Label>
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
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provider-name">Label</Label>
                <Input
                  id="provider-name"
                  required
                  placeholder="e.g. Production AWS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {FIELDS[kind].config.map((f) => (
                <Input
                  key={f.key}
                  required
                  placeholder={f.label}
                  value={field(f.key)}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ))}
              {FIELDS[kind].creds.map((f) =>
                f.secret && f.key === 'privateKey' ? (
                  <Textarea
                    key={f.key}
                    required
                    placeholder={f.label}
                    value={field(f.key)}
                    onChange={(e) => setField(f.key, e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                  />
                ) : (
                  <Input
                    key={f.key}
                    required
                    type={f.secret ? 'password' : 'text'}
                    placeholder={f.label}
                    value={field(f.key)}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                Connect
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
