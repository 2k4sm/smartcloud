// Validation for provider config + credentials at the API boundary.
//
// Without this, a mistyped payload (e.g. an AWS `region` posted against an
// `azure` provider) is stored happily and only fails much later, at first sync,
// as a raw SDK error surfaced into `cloud_syncs.detail`. Validating on write
// keeps the failure where the user can act on it.

import type { ProviderConfig, ProviderCredentials, ProviderKind } from './types'

export const PROVIDER_KINDS: ProviderKind[] = ['aws', 'azure', 'gcp']

// Required non-secret config fields, per provider.
const CONFIG_FIELDS: Record<ProviderKind, string[]> = {
  aws: ['region'],
  azure: ['vaultUrl'],
  gcp: ['projectId'],
}

// Required credential fields, per provider.
const CREDENTIAL_REQUIRED: Record<ProviderKind, string[]> = {
  aws: ['accessKeyId', 'secretAccessKey'],
  azure: ['tenantId', 'clientId', 'clientSecret'],
  gcp: ['clientEmail', 'privateKey'],
}

export interface ValidationError {
  error: string
}

function missingFields(
  obj: Record<string, unknown>,
  required: string[]
): string[] {
  return required.filter((f) => {
    const v = obj[f]
    return typeof v !== 'string' || v.trim().length === 0
  })
}

function unknownFields(
  obj: Record<string, unknown>,
  allowed: string[]
): string[] {
  return Object.keys(obj).filter((k) => !allowed.includes(k))
}

/**
 * Validate a provider's non-secret config. Returns null when valid, otherwise a
 * message safe to return to the client.
 */
export function validateConfig(
  kind: ProviderKind,
  config: unknown
): string | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return 'config must be an object'
  }
  const obj = config as Record<string, unknown>
  const required = CONFIG_FIELDS[kind]

  const missing = missingFields(obj, required)
  if (missing.length > 0) {
    return `config for "${kind}" requires: ${missing.join(', ')}`
  }
  const extra = unknownFields(obj, required)
  if (extra.length > 0) {
    return `config for "${kind}" does not accept: ${extra.join(', ')}`
  }

  // Provider-specific shape checks beyond "is a non-empty string".
  if (kind === 'azure') {
    const url = String(obj.vaultUrl)
    if (!/^https:\/\/[a-zA-Z0-9-]+\.vault\.azure\.net\/?$/.test(url)) {
      return 'vaultUrl must look like https://<vault-name>.vault.azure.net'
    }
  }
  if (kind === 'aws') {
    const region = String(obj.region)
    if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)) {
      return 'region must be an AWS region id, e.g. us-east-1'
    }
  }

  return null
}

/**
 * Validate a provider's credentials. Returns null when valid, otherwise a
 * message safe to return to the client — it names missing fields only, and
 * never echoes a credential value.
 */
export function validateCredentials(
  kind: ProviderKind,
  credentials: unknown
): string | null {
  if (
    !credentials ||
    typeof credentials !== 'object' ||
    Array.isArray(credentials)
  ) {
    return 'credentials must be an object'
  }
  const obj = credentials as Record<string, unknown>
  const required = CREDENTIAL_REQUIRED[kind]

  const missing = missingFields(obj, required)
  if (missing.length > 0) {
    return `credentials for "${kind}" require: ${missing.join(', ')}`
  }
  const extra = unknownFields(obj, required)
  if (extra.length > 0) {
    return `credentials for "${kind}" do not accept: ${extra.join(', ')}`
  }

  if (kind === 'gcp') {
    const key = String(obj.privateKey)
    if (!key.includes('BEGIN') || !key.includes('PRIVATE KEY')) {
      return 'privateKey must be a PEM private key (-----BEGIN PRIVATE KEY-----)'
    }
    const email = String(obj.clientEmail)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return 'clientEmail must be a service-account email address'
    }
  }

  return null
}

/** Validate both halves. Returns null when the whole payload is usable. */
export function validateProviderPayload(
  kind: ProviderKind,
  config: ProviderConfig | undefined,
  credentials: ProviderCredentials | undefined
): string | null {
  if (config !== undefined) {
    const err = validateConfig(kind, config)
    if (err) return err
  }
  if (credentials !== undefined) {
    const err = validateCredentials(kind, credentials)
    if (err) return err
  }
  return null
}
