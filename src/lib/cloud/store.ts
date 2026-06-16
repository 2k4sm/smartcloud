import { encrypt, decrypt } from '@/lib/encryption'
import { createAdapter } from './index'
import type {
  CloudProviderAdapter,
  ProviderConfig,
  ProviderCredentials,
  ProviderKind,
} from './types'

// A cloud_providers row as stored (credentials encrypted at rest).
export interface CloudProviderRow {
  id: string
  provider: ProviderKind
  name: string
  config: ProviderConfig
  encrypted_credentials: string
  iv: string
  auth_tag: string
}

/** Encrypt provider credentials for storage (reuses the AES-256-GCM master key). */
export function encryptCredentials(credentials: ProviderCredentials) {
  return encrypt(JSON.stringify(credentials))
}

/** Decrypt a stored row's credentials back into a typed object. */
export function decryptCredentials(row: CloudProviderRow): ProviderCredentials {
  const json = decrypt({
    encrypted_value: row.encrypted_credentials,
    iv: row.iv,
    auth_tag: row.auth_tag,
  })
  return JSON.parse(json) as ProviderCredentials
}

/** Build a ready-to-use adapter from a stored provider row. */
export function adapterFromRow(row: CloudProviderRow): CloudProviderAdapter {
  return createAdapter(row.provider, row.config, decryptCredentials(row))
}
