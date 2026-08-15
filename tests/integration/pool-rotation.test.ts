import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rotatePool, computePoolRisk } from '@/lib/poolRotation'
import type { RiskLogEntry } from '@/lib/risk'

interface Row {
  id: string
  active: boolean
  usage_count: number
  created_at: string
}

// Thenable Supabase fake: select/eq chains resolve to table data; insert/update
// record writes. `gte`/`order`/`limit` are recorded rather than applied — the
// tests assert that the risk query is BOUNDED (which is the point of the
// windowing) while the fake still returns whatever rows the case seeded.
function makeService(state: { poolKeys?: Row[]; accessLogs?: RiskLogEntry[] }) {
  const inserts: Record<string, Record<string, unknown>[]> = {}
  const updates: Record<string, Record<string, unknown>[]> = {}
  const filters: Record<string, { gte?: [string, string]; limit?: number; ordered?: boolean }> = {}

  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      maybeSingle: () => {
        const rows =
          table === 'pool_keys' ? (state.poolKeys ?? []) : []
        return Promise.resolve({ data: rows[0] ?? null, error: null })
      },
      gte: (col: string, val: string) => {
        ;(filters[table] ??= {}).gte = [col, val]
        return b
      },
      order: () => {
        ;(filters[table] ??= {}).ordered = true
        return b
      },
      limit: (n: number) => {
        ;(filters[table] ??= {}).limit = n
        return b
      },
      insert: (row: Record<string, unknown>) => {
        ;(inserts[table] ??= []).push(row)
        return Promise.resolve({ error: null })
      },
      update: (row: Record<string, unknown>) => {
        ;(updates[table] ??= []).push(row)
        return { eq: () => Promise.resolve({ error: null }) }
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => {
        const data =
          table === 'pool_keys'
            ? (state.poolKeys ?? [])
            : table === 'pool_access_logs'
              ? (state.accessLogs ?? [])
              : []
        return Promise.resolve({ data, error: null }).then(resolve)
      },
    }
    return b
  }

  return {
    client: { from: builder } as unknown as SupabaseClient,
    inserts,
    updates,
    filters,
  }
}

const pool = { id: 'p1', project_id: 'proj-1', current_key_id: 'a' }

describe('rotatePool', () => {
  it('switches current to the least-used active key and records it', async () => {
    const { client, inserts, updates } = makeService({
      poolKeys: [
        { id: 'a', active: true, usage_count: 100, created_at: '2026-01-01T00:00:00Z' },
        { id: 'b', active: true, usage_count: 5, created_at: '2026-01-02T00:00:00Z' },
        { id: 'c', active: true, usage_count: 40, created_at: '2026-01-03T00:00:00Z' },
      ],
    })

    const res = await rotatePool(client, pool, 'manual')

    expect(res.rotated).toBe(true)
    expect(res.from_key_id).toBe('a')
    expect(res.to_key_id).toBe('b') // least-used, not the current
    expect(updates['key_pools'][0].current_key_id).toBe('b')
    const rot = inserts['pool_rotations'][0] as { from_key_id: string; to_key_id: string; trigger: string }
    expect(rot).toMatchObject({ from_key_id: 'a', to_key_id: 'b', trigger: 'manual' })
  })

  it('does not rotate when there is no other active key', async () => {
    const { client, inserts, updates } = makeService({
      poolKeys: [
        { id: 'a', active: true, usage_count: 100, created_at: '2026-01-01T00:00:00Z' },
        { id: 'b', active: false, usage_count: 1, created_at: '2026-01-02T00:00:00Z' },
      ],
    })

    const res = await rotatePool(client, pool, 'scheduled')

    expect(res.rotated).toBe(false)
    expect(updates['key_pools']).toBeUndefined()
    expect(inserts['pool_rotations']).toBeUndefined()
  })
})

describe('computePoolRisk', () => {
  it('returns HIGH for abusive access patterns', async () => {
    const now = new Date('2026-07-23T12:00:00Z')
    const logs: RiskLogEntry[] = []
    for (let i = 0; i < 45; i++) {
      logs.push({
        action: 'READ',
        ip_address: `10.0.0.${i % 8}`,
        accessed_at: new Date(Date.UTC(2026, 6, 23, 2, i % 60, 0)).toISOString(),
      })
    }
    const { client } = makeService({ accessLogs: logs })
    const risk = await computePoolRisk(client, 'p1', now)
    expect(risk.level).toBe('HIGH')
    expect(risk.score).toBeGreaterThanOrEqual(67)
  })

  it('returns LOW for light usage', async () => {
    const now = new Date('2026-07-23T12:00:00Z')
    const { client } = makeService({
      accessLogs: [
        { action: 'READ', ip_address: '10.0.0.1', accessed_at: new Date(now.getTime() - 3_600_000).toISOString() },
      ],
    })
    const risk = await computePoolRisk(client, 'p1', now)
    expect(risk.level).toBe('LOW')
  })

  it('bounds the query so PostgREST cannot silently truncate the window', async () => {
    // Regression: the query had no ORDER BY and no LIMIT, so PostgREST capped
    // it at its default 1000 rows and dropped an ARBITRARY subset — which on a
    // busy pool can discard exactly the recent rows the frequency rule needs,
    // making risk-driven rotation under-fire.
    const now = new Date('2026-07-23T12:00:00Z')
    const { client, filters } = makeService({ accessLogs: [] })

    await computePoolRisk(client, 'p1', now)

    const q = filters['pool_access_logs']
    expect(q.ordered).toBe(true)
    expect(q.limit).toBeGreaterThan(0)
    expect(q.gte?.[0]).toBe('accessed_at')
  })

  it('caps the window at 7 days when the pool has never rotated', async () => {
    const now = new Date('2026-07-23T12:00:00Z')
    const { client, filters } = makeService({ accessLogs: [] })

    const risk = await computePoolRisk(client, 'p1', now, { since: null })

    const expected = new Date(now.getTime() - 7 * 86_400_000).toISOString()
    expect(filters['pool_access_logs'].gte?.[1]).toBe(expected)
    expect(risk.window_start).toBe(expected)
  })

  it('restarts the evidence window at the last rotation', async () => {
    // Evidence that already caused a rotation must not cause the next one —
    // this is what makes the score genuinely decay after rotating rather than
    // staying pinned high and re-triggering forever.
    const now = new Date('2026-07-23T12:00:00Z')
    const lastRotated = new Date('2026-07-23T09:00:00Z').toISOString()
    const { client, filters } = makeService({ accessLogs: [] })

    const risk = await computePoolRisk(client, 'p1', now, { since: lastRotated })

    expect(filters['pool_access_logs'].gte?.[1]).toBe(lastRotated)
    expect(risk.window_start).toBe(lastRotated)
  })

  it('never widens the window beyond 7 days, even for an ancient rotation', async () => {
    const now = new Date('2026-07-23T12:00:00Z')
    const { client, filters } = makeService({ accessLogs: [] })

    await computePoolRisk(client, 'p1', now, { since: '2020-01-01T00:00:00Z' })

    expect(filters['pool_access_logs'].gte?.[1]).toBe(
      new Date(now.getTime() - 7 * 86_400_000).toISOString()
    )
  })

  it('ignores an unparseable last-rotation timestamp and falls back to 7 days', async () => {
    const now = new Date('2026-07-23T12:00:00Z')
    const { client, filters } = makeService({ accessLogs: [] })

    await computePoolRisk(client, 'p1', now, { since: 'not-a-date' })

    expect(filters['pool_access_logs'].gte?.[1]).toBe(
      new Date(now.getTime() - 7 * 86_400_000).toISOString()
    )
  })
})
