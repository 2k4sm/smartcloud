import { describe, it, expect } from 'vitest'
import { assessRisk, type RiskLogEntry } from '@/lib/risk'

const NOW = new Date('2026-06-01T12:00:00Z') // midday UTC = 17:30 IST (business hours)

// Helper: build a READ log entry `hoursAgo` before NOW from a given IP.
function read(hoursAgo: number, ip: string | null = '10.0.0.1'): RiskLogEntry {
  return {
    action: 'READ',
    ip_address: ip,
    accessed_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  }
}

describe('rule-based risk scorer', () => {
  it('returns LOW with zero score for no activity', () => {
    const r = assessRisk([], { now: NOW })
    expect(r.score).toBe(0)
    expect(r.level).toBe('LOW')
    expect(r.sample_size).toBe(0)
    expect(r.factors).toHaveLength(3)
  })

  it('stays LOW for light, in-hours, single-IP usage', () => {
    // 3 reads spread over the last few hours, same IP, business hours
    const logs = [read(1), read(2), read(3)]
    const r = assessRisk(logs, { now: NOW })
    expect(r.level).toBe('LOW')
    expect(r.score).toBeLessThan(34)
  })

  it('frequency rule: sustained high read volume raises the score', () => {
    const logs = Array.from({ length: 45 }, (_, i) => read((i % 24) * 0.5))
    const r = assessRisk(logs, { now: NOW })
    const freq = r.factors.find((f) => f.key === 'frequency')!
    expect(freq.points).toBe(freq.max) // >= freqHigh reads -> maxed
  })

  it('frequency rule ignores non-READ actions', () => {
    const writes: RiskLogEntry[] = Array.from({ length: 30 }, (_, i) => ({
      action: 'UPDATE',
      ip_address: '10.0.0.1',
      accessed_at: new Date(NOW.getTime() - i * 3_600_000).toISOString(),
    }))
    const r = assessRisk(writes, { now: NOW })
    const freq = r.factors.find((f) => f.key === 'frequency')!
    expect(freq.points).toBe(0)
  })

  it('off-hours rule: night-time accesses raise the score', () => {
    // 02:00 IST == 20:30 UTC previous day; build several off-hours reads
    const offHours: RiskLogEntry[] = Array.from({ length: 6 }, (_, i) => ({
      action: 'READ',
      ip_address: '10.0.0.1',
      // 21:00 UTC ~ 02:30 IST (outside 08:00–20:00)
      accessed_at: new Date(
        Date.UTC(2026, 4, 30 - (i % 3), 21, 0, 0)
      ).toISOString(),
    }))
    const r = assessRisk(offHours, { now: NOW })
    const off = r.factors.find((f) => f.key === 'off_hours')!
    expect(off.points).toBeGreaterThan(0)
  })

  it('off-hours rule needs a minimum sample (single 2am read is not maxed)', () => {
    const logs = [
      { action: 'READ', ip_address: '10.0.0.1', accessed_at: new Date(Date.UTC(2026, 4, 31, 21, 0, 0)).toISOString() } as RiskLogEntry,
    ]
    const r = assessRisk(logs, { now: NOW })
    const off = r.factors.find((f) => f.key === 'off_hours')!
    expect(off.points).toBe(0)
  })

  it('new-IP rule: many distinct sources raise the score', () => {
    const logs = [
      read(1, '1.1.1.1'),
      read(2, '2.2.2.2'),
      read(3, '3.3.3.3'),
      read(4, '4.4.4.4'),
    ]
    const r = assessRisk(logs, { now: NOW })
    const ip = r.factors.find((f) => f.key === 'new_ip')!
    expect(ip.points).toBeGreaterThan(0)
  })

  it('new-IP rule ignores "unknown" and null IPs', () => {
    const logs = [read(1, 'unknown'), read(2, null), read(3, 'unknown')]
    const r = assessRisk(logs, { now: NOW })
    const ip = r.factors.find((f) => f.key === 'new_ip')!
    expect(ip.points).toBe(0)
  })

  it('escalates to HIGH under combined abuse (volume + off-hours + many IPs)', () => {
    const logs: RiskLogEntry[] = []
    for (let i = 0; i < 45; i++) {
      logs.push({
        action: 'READ',
        ip_address: `10.0.0.${i % 8}`,
        accessed_at: new Date(Date.UTC(2026, 5, 1, 2, i % 60, 0)).toISOString(), // 02:xx UTC ~ 07:30 IST border/off
      })
    }
    const r = assessRisk(logs, { now: NOW })
    expect(r.score).toBeGreaterThanOrEqual(67)
    expect(r.level).toBe('HIGH')
  })

  it('score is clamped to 0–100 and level thresholds are consistent', () => {
    const r = assessRisk([read(1)], { now: NOW })
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    const sum = r.factors.reduce((a, f) => a + f.points, 0)
    expect(r.score).toBe(Math.min(100, sum))
  })

  it('ignores future-dated logs relative to now', () => {
    const future: RiskLogEntry = {
      action: 'READ',
      ip_address: '9.9.9.9',
      accessed_at: new Date(NOW.getTime() + 3_600_000).toISOString(),
    }
    const r = assessRisk([future, read(1)], { now: NOW })
    expect(r.sample_size).toBe(1)
  })
})
