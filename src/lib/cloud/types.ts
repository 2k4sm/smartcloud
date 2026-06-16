// Unified multi-cloud abstraction. Each provider adapter implements the same
// small surface so the rest of the app never branches on provider specifics.

export type ProviderKind = 'aws' | 'azure' | 'gcp'

export interface CloudSyncResult {
  remoteId: string // ARN / secret id / version resource name
}

export interface CloudProviderAdapter {
  readonly kind: ProviderKind
  /** Create the secret if absent, otherwise write a new value. */
  upsertSecret(name: string, value: string): Promise<CloudSyncResult>
  /** Read the current value (used for connection tests / verification). */
  getSecret(name: string): Promise<string>
  /** Remove the secret from the provider. */
  deleteSecret(name: string): Promise<void>
}

// ── Per-provider non-secret config (safe to display) ─────────────────
export interface AwsConfig {
  region: string
}
export interface AzureConfig {
  vaultUrl: string // https://<vault>.vault.azure.net
}
export interface GcpConfig {
  projectId: string
}
export type ProviderConfig = AwsConfig | AzureConfig | GcpConfig

// ── Per-provider credentials (stored encrypted) ──────────────────────
export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
}
export interface AzureCredentials {
  tenantId: string
  clientId: string
  clientSecret: string
}
export interface GcpCredentials {
  clientEmail: string
  privateKey: string
}
export type ProviderCredentials =
  | AwsCredentials
  | AzureCredentials
  | GcpCredentials

// Fields that must never be echoed back to the client, per provider. Used to
// redact when returning provider config from the API.
export const CREDENTIAL_FIELDS: Record<ProviderKind, string[]> = {
  aws: ['accessKeyId', 'secretAccessKey'],
  azure: ['tenantId', 'clientId', 'clientSecret'],
  gcp: ['clientEmail', 'privateKey'],
}
