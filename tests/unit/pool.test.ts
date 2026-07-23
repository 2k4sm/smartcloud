import { describe, it, expect } from 'vitest'
import {
  selectNextActiveKey,
  isScheduleDue,
  shouldRotate,
  type PoolKeyInfo,
  type RotationPolicy,
} from '@/lib/pool'

const key = (
  id: string,
  usage: number,
  active = true,
  created = '2026-01-01T00:00:00Z'
): PoolKeyInfo => ({ id, usage_count: usage, active, created_at: created })

const NOW = new Date('2026-07-23T12:00:00Z')

describe('selectNextActiveKey', () => {
  it('picks the least-used active key, excluding the current one', () => {
    const keys = [key('a', 100), key('b', 5), key('c', 20)]
    expect(selectNextActiveKey(keys, 'a')).toBe('b')
  })

  it('never returns the current key when another active key exists', () => {
    const keys = [key('a', 1), key('b', 50)]
    // even though 'a' is least-used, it's current → pick the other
    expect(selectNextActiveKey(keys, 'a')).toBe('b')
  })

  it('skips inactive keys', () => {
    const keys = [key('a', 100), key('b', 1, false), key('c', 30)]
    expect(selectNextActiveKey(keys, 'a')).toBe('c')
  })

  it('breaks usage ties by oldest created', () => {
    const keys = [
      key('a', 100),
      key('b', 10, true, '2026-05-01T00:00:00Z'),
      key('c', 10, true, '2026-02-01T00:00:00Z'),
    ]
    expect(selectNextActiveKey(keys, 'a')).toBe('c')
  })

  it('keeps the current key if it is the only active one', () => {
    const keys = [key('a', 100), key('b', 1, false)]
    expect(selectNextActiveKey(keys, 'a')).toBe('a')
  })

  it('falls back to any active key when current is inactive', () => {
    const keys = [key('a', 100, false), key('b', 3)]
    expect(selectNextActiveKey(keys, 'a')).toBe('b')
  })

  it('returns null when no active keys remain', () => {
    const keys = [key('a', 1, false), key('b', 2, false)]
    expect(selectNextActiveKey(keys, 'a')).toBeNull()
  })

  it('picks least-used when there is no current yet', () => {
    const keys = [key('a', 9), key('b', 2), key('c', 5)]
    expect(selectNextActiveKey(keys, null)).toBe('b')
  })
})

describe('isScheduleDue', () => {
  const base: RotationPolicy = {
    rotation_interval_days: 7,
    last_rotated_at: null,
    rotate_on_high_risk: false,
    risk_threshold: 67,
  }

  it('is due when never rotated and an interval is set', () => {
    expect(isScheduleDue(base, NOW)).toBe(true)
  })

  it('is not due when interval is unset', () => {
    expect(isScheduleDue({ ...base, rotation_interval_days: null }, NOW)).toBe(false)
  })

  it('is due once the interval has elapsed', () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 86_400_000).toISOString()
    expect(isScheduleDue({ ...base, last_rotated_at: eightDaysAgo }, NOW)).toBe(true)
  })

  it('is not due before the interval elapses', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 86_400_000).toISOString()
    expect(isScheduleDue({ ...base, last_rotated_at: twoDaysAgo }, NOW)).toBe(false)
  })
})

describe('shouldRotate', () => {
  const policy: RotationPolicy = {
    rotation_interval_days: 30,
    last_rotated_at: new Date(NOW.getTime() - 1 * 86_400_000).toISOString(), // 1d ago
    rotate_on_high_risk: true,
    risk_threshold: 67,
  }

  it('rotates on high risk (risk takes priority)', () => {
    expect(shouldRotate(policy, 80, NOW)).toEqual({ rotate: true, trigger: 'risk' })
  })

  it('does not rotate on low risk before schedule is due', () => {
    expect(shouldRotate(policy, 20, NOW)).toEqual({ rotate: false, trigger: null })
  })

  it('rotates on schedule when interval elapsed and risk is low', () => {
    const due = { ...policy, last_rotated_at: new Date(NOW.getTime() - 31 * 86_400_000).toISOString() }
    expect(shouldRotate(due, 10, NOW)).toEqual({ rotate: true, trigger: 'scheduled' })
  })

  it('ignores risk when rotate_on_high_risk is off', () => {
    expect(shouldRotate({ ...policy, rotate_on_high_risk: false }, 90, NOW)).toEqual({
      rotate: false,
      trigger: null,
    })
  })
})
