import type { SupabaseClient } from '@supabase/supabase-js'
import { adapterFromRow, type CloudProviderRow } from './store'

// Shared push/purge path for every cloud write in the app, so the `cloud_syncs`
// audit trail is written identically no matter what triggered it.

export interface CloudOpResult {
  provider_id: string
  provider: string
  name: string
  status: 'success' | 'failed'
  remote_id: string | null
  remote_name: string | null
  detail: string | null
}

export interface CloudOpSummary {
  synced: number
  failed: number
  results: CloudOpResult[]
}

interface Subject {
  projectId: string
  /** SmartCloud key name — mapped to a provider-legal name per adapter. */
  name: string
  secretId: string
}

const PROVIDER_COLUMNS =
  'id, provider, name, config, encrypted_credentials, iv, auth_tag'

/** Load a project's providers, optionally narrowed to one. */
export async function loadProviders(
  service: SupabaseClient,
  projectId: string,
  providerId?: string
): Promise<CloudProviderRow[]> {
  let query = service
    .from('cloud_providers')
    .select(PROVIDER_COLUMNS)
    .eq('project_id', projectId)
  if (providerId) query = query.eq('id', providerId)
  const { data } = await query
  return (data ?? []) as CloudProviderRow[]
}

async function runAcross(
  service: SupabaseClient,
  subject: Subject,
  providers: CloudProviderRow[],
  op: (row: CloudProviderRow) => Promise<{ remoteId: string | null; remoteName: string }>,
  { record }: { record: boolean }
): Promise<CloudOpSummary> {
  const results: CloudOpResult[] = []

  for (const row of providers) {
    let status: 'success' | 'failed' = 'success'
    let remoteId: string | null = null
    let remoteName: string | null = null
    let detail: string | null = null
    try {
      const res = await op(row)
      remoteId = res.remoteId
      remoteName = res.remoteName
    } catch (err) {
      status = 'failed'
      detail = err instanceof Error ? err.message : String(err)
    }

    if (record) {
      await service.from('cloud_syncs').insert({
        provider_id: row.id,
        secret_id: subject.secretId,
        project_id: subject.projectId,
        status,
        remote_id: remoteId,
        detail,
      })
    }

    results.push({
      provider_id: row.id,
      provider: row.provider,
      name: row.name,
      status,
      remote_id: remoteId,
      remote_name: remoteName,
      detail,
    })
  }

  return {
    synced: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  }
}

/**
 * Push a value to a project's cloud providers and record each attempt in
 * `cloud_syncs`. Never throws: a provider that fails is reported, not fatal.
 */
export async function pushToProviders(
  service: SupabaseClient,
  subject: Subject,
  value: string,
  opts: { providerId?: string } = {}
): Promise<CloudOpSummary> {
  const providers = await loadProviders(service, subject.projectId, opts.providerId)
  return runAcross(
    service,
    subject,
    providers,
    async (row) => {
      const adapter = adapterFromRow(row)
      const res = await adapter.upsertSecret(subject.name, value)
      return { remoteId: res.remoteId, remoteName: adapter.remoteName(subject.name) }
    },
    { record: true }
  )
}

/**
 * Remove a value from a project's cloud providers. Used when a secret is
 * deleted so a credential SmartCloud no longer knows about doesn't outlive it
 * in someone's vault. Sync rows are NOT recorded — the secret row is on its way
 * out and `cloud_syncs` cascades with it.
 */
export async function purgeFromProviders(
  service: SupabaseClient,
  subject: Subject
): Promise<CloudOpSummary> {
  const providers = await loadProviders(service, subject.projectId)
  return runAcross(
    service,
    subject,
    providers,
    async (row) => {
      const adapter = adapterFromRow(row)
      await adapter.deleteSecret(subject.name)
      return { remoteId: null, remoteName: adapter.remoteName(subject.name) }
    },
    { record: false }
  )
}
