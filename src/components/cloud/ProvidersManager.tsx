'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CloudProviderSummary } from '@/lib/types'

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
  const [error, setError] = useState<string | null>(null)
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
    setError(null)
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
        setError(data.error ?? 'Failed to connect provider')
        return
      }
      setName('')
      setValues({})
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Disconnect this provider?')) return
    await fetch(`/api/projects/${projectId}/providers/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={connect} className="glass-card p-5">
        <h2 className="text-white font-medium mb-3 text-sm">Connect a cloud provider</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind)
              setValues({})
            }}
            className="glass-input"
          >
            <option value="aws">AWS Secrets Manager</option>
            <option value="azure">Azure Key Vault</option>
            <option value="gcp">GCP Secret Manager</option>
          </select>
          <input
            required
            placeholder="Label (e.g. Production AWS)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input"
          />
        </div>
        <div className="space-y-2">
          {FIELDS[kind].config.map((f) => (
            <input
              key={f.key}
              required
              placeholder={f.label}
              value={field(f.key)}
              onChange={(e) => setField(f.key, e.target.value)}
              className="glass-input w-full"
            />
          ))}
          {FIELDS[kind].creds.map((f) =>
            f.secret && f.key === 'privateKey' ? (
              <textarea
                key={f.key}
                required
                placeholder={f.label}
                value={field(f.key)}
                onChange={(e) => setField(f.key, e.target.value)}
                rows={3}
                className="glass-input w-full font-mono text-xs"
              />
            ) : (
              <input
                key={f.key}
                required
                type={f.secret ? 'password' : 'text'}
                placeholder={f.label}
                value={field(f.key)}
                onChange={(e) => setField(f.key, e.target.value)}
                className="glass-input w-full"
              />
            )
          )}
        </div>
        {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}
        <div className="mt-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <span className="spinner" /> : 'Connect'}
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          Credentials are encrypted with AES-256-GCM before storage and never
          returned to the browser.
        </p>
      </form>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="py-6 text-center text-gray-500">
            <span className="spinner" />
          </div>
        ) : providers.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            No providers connected yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-gray-200">{p.name}</div>
                    <div className="text-gray-500 text-xs">
                      {PROVIDER_LABEL[p.provider]} ·{' '}
                      {Object.values(p.config)[0] ?? ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(p.id)}
                      className="text-rose-400/70 hover:text-rose-300 hover:bg-rose-400/10 text-xs px-2 py-1 rounded-lg transition-colors"
                    >
                      disconnect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
