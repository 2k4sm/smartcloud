import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatDayLabel,
  EMPTY_DATE,
} from '@/lib/datetime'

// These assert exact strings on purpose. `toLocaleDateString()` with no
// arguments resolves the locale AND time zone from whatever environment it runs
// in — Node on the server, the browser on the client — so the two disagreed and
// React threw a hydration mismatch ("7/23/2026" server vs "23/07/2026" client).
// An exact-match assertion fails the moment the pinning is lost, because the
// output would fall back to the host's own locale/zone.

describe('formatDate', () => {
  it('renders day-first regardless of the host locale', () => {
    expect(formatDate('2026-07-23T10:00:00Z')).toBe('23/07/2026')
  })

  it('renders in the pinned zone, not the host zone', () => {
    // 19:00Z is 00:30 the NEXT day in Asia/Kolkata. Under any zone west of
    // +05:30 (including this repo's typical +04:00 dev host) it is still the
    // 22nd — so this pins the time zone, not just the locale.
    expect(formatDate('2026-07-22T19:00:00Z')).toBe('23/07/2026')
  })

  it('accepts a Date, a timestamp and an ISO string alike', () => {
    const iso = '2026-07-23T10:00:00Z'
    const expected = '23/07/2026'
    expect(formatDate(new Date(iso))).toBe(expected)
    expect(formatDate(new Date(iso).getTime())).toBe(expected)
    expect(formatDate(iso)).toBe(expected)
  })

  it('degrades to a placeholder instead of "Invalid Date"', () => {
    expect(formatDate(null)).toBe(EMPTY_DATE)
    expect(formatDate(undefined)).toBe(EMPTY_DATE)
    expect(formatDate('')).toBe(EMPTY_DATE)
    expect(formatDate('not-a-date')).toBe(EMPTY_DATE)
  })
})

describe('formatDateTime', () => {
  it('renders a 24-hour clock in the pinned zone', () => {
    expect(formatDateTime('2026-07-23T10:00:00Z')).toBe('23/07/2026, 15:30')
  })

  it('is stable across equivalent inputs', () => {
    const iso = '2026-07-23T10:00:00Z'
    expect(formatDateTime(new Date(iso))).toBe(formatDateTime(iso))
  })

  it('degrades to a placeholder', () => {
    expect(formatDateTime(null)).toBe(EMPTY_DATE)
    expect(formatDateTime('nope')).toBe(EMPTY_DATE)
  })
})

describe('formatDayLabel', () => {
  it('keeps UTC buckets on their own day', () => {
    // The access-log timeline buckets by UTC day; rendering in another zone
    // would slide a bar onto a neighbouring day.
    expect(formatDayLabel('2026-07-23T00:00:00Z', 'UTC')).toBe('23 Jul')
  })

  it('uses the pinned zone by default', () => {
    expect(formatDayLabel('2026-07-22T19:00:00Z')).toBe('23 Jul')
  })

  it('degrades to a placeholder', () => {
    expect(formatDayLabel(null)).toBe(EMPTY_DATE)
  })
})

describe('determinism', () => {
  it('produces identical output on repeated calls', () => {
    // The server render and the client render are two separate invocations;
    // if these ever diverge, hydration breaks.
    const iso = '2026-07-23T10:00:00Z'
    expect(formatDate(iso)).toBe(formatDate(iso))
    expect(formatDateTime(iso)).toBe(formatDateTime(iso))
  })

  it('does not depend on the current time', () => {
    const iso = '2020-01-01T00:00:00Z'
    const first = formatDateTime(iso)
    expect(formatDateTime(iso)).toBe(first)
  })
})
