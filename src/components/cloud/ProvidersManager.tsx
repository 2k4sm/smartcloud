'use client'

import { useEffect, useState, useCallback } from 'react'
import { Cloud, Loader2, Plug, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CloudProviderSummary } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

type Kind = 'aws' | 'azure' | 'gcp'

const PROVIDER_LABEL: Record<Kind, string> = {
  aws: 'AWS Secrets Manager',
  azure: 'Azure Key Vault',
  gcp: 'GCP Secret Manager',
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

export default function ProvidersManager({ projectId }: { projectId: string }) {
  const [providers, setProviders] = useState<CloudProviderSummary[]>([])
  const [loading, setLoading] = useState(true)
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
      setName('')
      setValues({})
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
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect a cloud provider</CardTitle>
          <CardDescription>
            Credentials are encrypted with AES-256-GCM before storage and never
            returned to the browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              Connect
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto size-4 animate-spin" />
          </CardContent>
        </Card>
      ) : providers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Cloud className="size-6 opacity-60" />
            No providers connected yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="divide-y divide-border py-0">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {PROVIDER_LABEL[p.provider]} · {Object.values(p.config)[0] ?? ''}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
