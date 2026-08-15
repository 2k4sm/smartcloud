// Deterministic date/time formatting for anything that gets rendered.
//
// `new Date(x).toLocaleDateString()` with no arguments resolves BOTH the locale
// and the time zone from the environment it runs in. During SSR that's the
// server (Node's ICU default, en-US, container TZ); on the client it's the
// user's browser. The two disagree — "7/23/2026" vs "23/07/2026" — and React
// throws a hydration mismatch, discarding the server HTML and re-rendering the
// tree on the client.
//
// Pinning both the locale and the time zone makes the output identical
// everywhere it is computed, which is also what an audit trail wants: two
// people comparing the same access log should read the same wall-clock time
// rather than each seeing their own.
//
// The zone matches the risk engine's business-hours rule (see
// DEFAULT_RISK_OPTIONS.tzOffsetMinutes in src/lib/risk.ts), so a timestamp that
// reads as off-hours in the UI is the same one the scorer counted as off-hours.

export const DISPLAY_LOCALE = 'en-GB'
export const DISPLAY_TIME_ZONE = 'Asia/Kolkata'

type DateInput = string | number | Date | null | undefined

/** Placeholder for a missing or unparseable timestamp. */
export const EMPTY_DATE = '—'

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Date only — e.g. "23/07/2026". */
export function formatDate(value: DateInput): string {
  const d = toDate(value)
  if (!d) return EMPTY_DATE
  return d.toLocaleDateString(DISPLAY_LOCALE, { timeZone: DISPLAY_TIME_ZONE })
}

/** Date + time — e.g. "23/07/2026, 14:05". */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value)
  if (!d) return EMPTY_DATE
  return d.toLocaleString(DISPLAY_LOCALE, {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Short day label for chart axes — e.g. "23 Jul".
 * Takes an explicit `timeZone` because the access-log buckets are built in UTC,
 * and a bar must not slide to a neighbouring day when it is rendered.
 */
export function formatDayLabel(
  value: DateInput,
  timeZone: string = DISPLAY_TIME_ZONE
): string {
  const d = toDate(value)
  if (!d) return EMPTY_DATE
  return d.toLocaleDateString(DISPLAY_LOCALE, {
    timeZone,
    month: 'short',
    day: 'numeric',
  })
}
