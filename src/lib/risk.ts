// Rule-based risk scorer (v0) for the AI-Based Risk Analysis module.
//
// Pure, deterministic, and explainable — it takes a secret's access-log
// history and produces a 0–100 score plus a per-rule breakdown. The AI layer
// (W4) layers a natural-language summary on top of this; the numeric score
// stays rule-based so it is auditable and testable without a model.
//
// Three rules, matching the plan (frequency, off-hours, new-IP):
//   1. Access frequency   — sustained high read volume in the trailing 24h
//   2. Off-hours access   — accesses outside configured business hours
//   3. Unfamiliar IPs     — many distinct source IPs / a brand-new source IP
//
// Improve iteratively: thresholds live in DEFAULT_RISK_OPTIONS.

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RiskLogEntry {
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE'
  ip_address: string | null
  accessed_at: string // ISO timestamp
}

export interface RiskFactor {
  key: 'frequency' | 'off_hours' | 'new_ip'
  label: string
  points: number // contribution to the total score (already clamped)
  max: number
  detail: string
}

export interface RiskAssessment {
  score: number // 0–100
  level: RiskLevel
  factors: RiskFactor[]
  sample_size: number
  window_start: string | null
  window_end: string | null
}

export interface RiskOptions {
  now: Date
  // Business hours are [start, end) in the configured timezone offset (minutes).
  businessStartHour: number
  businessEndHour: number
  tzOffsetMinutes: number
  // Frequency rule: reads/24h below `freqSafe` score 0; at/above `freqHigh` score max.
  freqSafe: number
  freqHigh: number
  // Lookback windows
  freqWindowHours: number
  ipWindowDays: number
}

export const DEFAULT_RISK_OPTIONS: Omit<RiskOptions, 'now'> = {
  businessStartHour: 8,
  businessEndHour: 20,
  tzOffsetMinutes: 330, // IST (+05:30) — the team's timezone
  freqSafe: 10,
  freqHigh: 40,
  freqWindowHours: 24,
  ipWindowDays: 7,
}

const MAX_FREQUENCY = 40
const MAX_OFF_HOURS = 30
const MAX_NEW_IP = 30

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function levelFor(score: number): RiskLevel {
  if (score >= 67) return 'HIGH'
  if (score >= 34) return 'MEDIUM'
  return 'LOW'
}

// Local hour (0–23) of a timestamp under a fixed tz offset, no DST handling.
function localHour(iso: string, tzOffsetMinutes: number): number {
  const ms = new Date(iso).getTime() + tzOffsetMinutes * 60_000
  return new Date(ms).getUTCHours()
}

export function assessRisk(
  logs: RiskLogEntry[],
  opts: Partial<RiskOptions> & { now: Date }
): RiskAssessment {
  const o: RiskOptions = { ...DEFAULT_RISK_OPTIONS, ...opts }
  const nowMs = o.now.getTime()

  const freqCutoff = nowMs - o.freqWindowHours * 3_600_000
  const ipCutoff = nowMs - o.ipWindowDays * 86_400_000

  // Consider only real activity up to "now" (ignore future-dated noise).
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

  // ── Rule 1: access frequency (any action in the trailing window) ─────
  // Counts reads AND writes (UPDATE/DELETE/CREATE): a rapid burst of
  // destructive actions is at least as dangerous as a read flood.
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

  // ── Rule 2: off-hours access ─────────────────────────────────────────
  const recent = considered.filter(
    (l) => new Date(l.accessed_at).getTime() >= ipCutoff
  )
  const offHoursCount = recent.filter((l) => {
    const h = localHour(l.accessed_at, o.tzOffsetMinutes)
    return h < o.businessStartHour || h >= o.businessEndHour
  }).length
  // Needs a minimum sample so a single 2am access on a quiet secret isn't max risk.
  const offHoursRatio = recent.length >= 3 ? offHoursCount / recent.length : 0
  const offHoursPoints = Math.round(offHoursRatio * MAX_OFF_HOURS)

  // ── Rule 3: unfamiliar IPs ───────────────────────────────────────────
  const knownIps = new Set<string>()
  for (const l of recent) {
    if (l.ip_address && l.ip_address !== 'unknown') knownIps.add(l.ip_address)
  }
  const distinct = knownIps.size
  // Each additional distinct IP beyond the first adds risk.
  let newIpPoints = clamp((distinct - 1) * 6, 0, 20)
  // A most-recent access from an IP seen only once is a fresh source.
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

  const factors: RiskFactor[] = [
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
  ]

  return {
    score,
    level: levelFor(score),
    factors,
    sample_size: considered.length,
    window_start: windowStart,
    window_end: windowEnd,
  }
}
