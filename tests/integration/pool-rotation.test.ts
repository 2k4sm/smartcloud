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

// Thenable Supabase fake: select/eq chains resolve to table data; insert/update record writes.
function makeService(state: { poolKeys?: Row[]; accessLogs?: RiskLogEntry[] }) {
  const inserts: Record<string, Record<string, unknown>[]> = {}
  const updates: Record<string, Record<string, unknown>[]> = {}

  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
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

  return { client: { from: builder } as unknown as SupabaseClient, inserts, updates }
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
})
