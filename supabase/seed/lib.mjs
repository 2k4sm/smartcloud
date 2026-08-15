// Shared helpers for the seed scripts.
//
// The two crypto helpers here are deliberate ports, not new logic:
//   - encrypt()    mirrors src/lib/encryption.ts (AES-256-GCM, 12-byte IV)
//   - assessRisk() mirrors src/lib/risk.ts (rule-based scorer v0)
// Seeded rows therefore look exactly like rows the app itself would have
// written: values decrypt with the running app's ENCRYPTION_MASTER_KEY, and
// seeded risk_scores match what POST /api/risk/recompute would produce from
// the same access logs. Keep them in sync if the originals change.

import { createCipheriv, createHash, randomBytes } from 'node:crypto'

// ── Encryption (port of src/lib/encryption.ts) ───────────────────────

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function masterKey() {
  const keyHex = process.env.ENCRYPTION_MASTER_KEY
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes). ' +
        'Seeded values must be encrypted with the SAME key the app runs with, ' +
        'or the dashboard will fail to decrypt them.'
    )
  }
  return Buffer.from(keyHex, 'hex')
}

/** → { encrypted_value, iv, auth_tag }, all base64, exactly as the app stores. */
export function encrypt(plaintext) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  return {
    encrypted_value: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
  }
}

// ── API keys (port of src/lib/auth.ts) ───────────────────────────────

export function generateApiKey() {
  return `sc_live_${randomBytes(32).toString('hex')}`
}

export function hashApiKey(key) {
  return createHash('sha256').update(key).digest('hex')
}

// ── Risk scorer (port of src/lib/risk.ts) ────────────────────────────

const DEFAULT_RISK_OPTIONS = {
  businessStartHour: 8,
  businessEndHour: 20,
  tzOffsetMinutes: 330, // IST (+05:30)
  freqSafe: 10,
  freqHigh: 40,
  freqWindowHours: 24,
  ipWindowDays: 7,
}

const MAX_FREQUENCY = 40
const MAX_OFF_HOURS = 30
const MAX_NEW_IP = 30

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

function levelFor(score) {
  if (score >= 67) return 'HIGH'
  if (score >= 34) return 'MEDIUM'
  return 'LOW'
}

function localHour(iso, tzOffsetMinutes) {
  const ms = new Date(iso).getTime() + tzOffsetMinutes * 60_000
  return new Date(ms).getUTCHours()
}

/** logs: [{ action, ip_address, accessed_at }], opts: { now: Date } */
export function assessRisk(logs, opts) {
  const o = { ...DEFAULT_RISK_OPTIONS, ...opts }
  const nowMs = o.now.getTime()
  const freqCutoff = nowMs - o.freqWindowHours * 3_600_000
  const ipCutoff = nowMs - o.ipWindowDays * 86_400_000

  const considered = logs.filter((l) => {
    const t = new Date(l.accessed_at).getTime()
    return !Number.isNaN(t) && t <= nowMs
  })

  const times = considered
    .map((l) => new Date(l.accessed_at).getTime())
    .sort((a, b) => a - b)
  const windowStart = times.length ? new Date(times[0]).toISOString() : null
  const windowEnd = times.length
    ? new Date(times[times.length - 1]).toISOString()
    : null

  const accesses24h = considered.filter(
    (l) => new Date(l.accessed_at).getTime() >= freqCutoff
  ).length
  const freqRatio =
    o.freqHigh <= o.freqSafe
      ? accesses24h >= o.freqHigh
        ? 1
        : 0
      : (accesses24h - o.freqSafe) / (o.freqHigh - o.freqSafe)
  const freqPoints = Math.round(clamp(freqRatio, 0, 1) * MAX_FREQUENCY)

  const recent = considered.filter(
    (l) => new Date(l.accessed_at).getTime() >= ipCutoff
  )
  const offHoursCount = recent.filter((l) => {
    const h = localHour(l.accessed_at, o.tzOffsetMinutes)
    return h < o.businessStartHour || h >= o.businessEndHour
  }).length
  const offHoursRatio = recent.length >= 3 ? offHoursCount / recent.length : 0
  const offHoursPoints = Math.round(offHoursRatio * MAX_OFF_HOURS)

  const knownIps = new Set()
  for (const l of recent) {
    if (l.ip_address && l.ip_address !== 'unknown') knownIps.add(l.ip_address)
  }
  const distinct = knownIps.size
  let newIpPoints = clamp((distinct - 1) * 6, 0, 20)
  const lastWithIp = [...recent]
    .reverse()
    .find((l) => l.ip_address && l.ip_address !== 'unknown')
  if (lastWithIp) {
    const occurrences = recent.filter(
      (l) => l.ip_address === lastWithIp.ip_address
    ).length
    if (occurrences === 1 && distinct > 1) newIpPoints += 10
  }
  newIpPoints = Math.round(clamp(newIpPoints, 0, MAX_NEW_IP))

  const score = clamp(freqPoints + offHoursPoints + newIpPoints, 0, 100)

  return {
    score,
    level: levelFor(score),
    factors: [
      {
        key: 'frequency',
        label: 'Access frequency',
        points: freqPoints,
        max: MAX_FREQUENCY,
        detail: `${accesses24h} access(es) in the last ${o.freqWindowHours}h`,
      },
      {
        key: 'off_hours',
        label: 'Off-hours access',
        points: offHoursPoints,
        max: MAX_OFF_HOURS,
        detail: `${offHoursCount}/${recent.length} access(es) outside ${o.businessStartHour}:00–${o.businessEndHour}:00`,
      },
      {
        key: 'new_ip',
        label: 'Unfamiliar sources',
        points: newIpPoints,
        max: MAX_NEW_IP,
        detail: `${distinct} distinct IP(s) in the last ${o.ipWindowDays}d`,
      },
    ],
    sample_size: considered.length,
    window_start: windowStart,
    window_end: windowEnd,
  }
}

// ── Deterministic randomness ─────────────────────────────────────────
// A fixed-seed PRNG keeps every run of the seeder producing the same access
// pattern (and therefore the same risk scores), so a demo is reproducible.

export function makeRng(seed = 0x5ee_d1) {
  let a = seed >>> 0
  return function rng() {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
export const between = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1))

// ── Misc ─────────────────────────────────────────────────────────────

export const iso = (ms) => new Date(ms).toISOString()
export const days = (n) => n * 86_400_000
export const hours = (n) => n * 3_600_000

/** Insert in chunks — access-log batches are far too large for one request. */
export async function insertChunked(service, table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await service.from(table).insert(rows.slice(i, i + size))
    if (error) {
      throw new Error(`insert into ${table} failed: ${error.message}`)
    }
  }
  return rows.length
}
