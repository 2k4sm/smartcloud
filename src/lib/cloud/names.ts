// Collision-safe remote name mapping.
//
// Each provider restricts which characters a secret name may contain, and the
// restrictions differ. A naive `replace(/[^allowed]/g, sep)` is LOSSY: on Azure
// (where `_` must become `-`) both `MY_KEY` and `MY-KEY` map to `MY-KEY`, so
// syncing the second silently overwrites the first — two distinct production
// credentials collapsing into one is data loss, not cosmetics.
//
// Rule: if normalization changed the name at all, append a short deterministic
// digest of the ORIGINAL. Names that are already valid pass through untouched
// (so GCP — whose charset is a superset of SmartCloud's `A-Z0-9_` convention —
// and AWS keep clean, readable names), and every altered name carries the
// information needed to keep it distinct.

import { createHash } from 'crypto'

export interface RemoteNameRules {
  /** Characters that are NOT allowed, as a global regex. */
  invalid: RegExp
  /** What an invalid character is replaced with. */
  replacement: string
  /** Maximum length of the final remote name. */
  maxLength: number
  /** Human-readable charset, used in error messages. */
  describe: string
}

const SUFFIX_LENGTH = 8

function digest(original: string): string {
  return createHash('sha256').update(original).digest('hex').slice(0, SUFFIX_LENGTH)
}

/**
 * Map a SmartCloud key name onto a provider-legal remote name.
 * Deterministic: the same input always yields the same output.
 */
export function toRemoteName(name: string, rules: RemoteNameRules): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    throw new Error('Secret name is empty')
  }

  const normalized = trimmed.replace(rules.invalid, rules.replacement)
  const unchanged = normalized === trimmed

  // Already legal and short enough — use it verbatim.
  if (unchanged && normalized.length <= rules.maxLength) return normalized

  // Altered (or too long): disambiguate with a digest of the original so two
  // different source names can never land on the same remote name.
  const suffix = `${rules.replacement}${digest(trimmed)}`
  const room = rules.maxLength - suffix.length
  if (room < 1) {
    throw new Error(
      `"${name}" cannot be mapped to a valid ${rules.describe} name (max ${rules.maxLength} chars)`
    )
  }
  return `${normalized.slice(0, room)}${suffix}`
}

// ── Per-provider rule sets ───────────────────────────────────────────
// Azure Key Vault: ^[0-9a-zA-Z-]{1,127}$
export const AZURE_NAME_RULES: RemoteNameRules = {
  invalid: /[^0-9a-zA-Z-]/g,
  replacement: '-',
  maxLength: 127,
  describe: 'Azure Key Vault secret',
}

// GCP Secret Manager: [a-zA-Z0-9_-], up to 255 chars.
export const GCP_NAME_RULES: RemoteNameRules = {
  invalid: /[^a-zA-Z0-9_-]/g,
  replacement: '_',
  maxLength: 255,
  describe: 'GCP Secret Manager secret',
}

// AWS Secrets Manager: [A-Za-z0-9/_+=.@-], up to 512 chars.
export const AWS_NAME_RULES: RemoteNameRules = {
  invalid: /[^A-Za-z0-9/_+=.@-]/g,
  replacement: '_',
  maxLength: 512,
  describe: 'AWS Secrets Manager secret',
}
