import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const dispatch = vi.fn()
vi.mock('@/lib/notify', () => ({
  dispatch: (...args: unknown[]) => dispatch(...args),
}))

import { rotatePool } from '@/lib/poolRotation'

const TWO_ACTIVE_KEYS = [
  { id: 'a', active: true, usage_count: 100, created_at: '2026-01-01T00:00:00Z' },
  { id: 'b', active: true, usage_count: 5, created_at: '2026-01-02T00:00:00Z' },
]
// A pool with nothing to rotate to: one active key, one retired.
const ONE_ACTIVE_KEY = [
  { id: 'a', active: true, usage_count: 100, created_at: '2026-01-01T00:00:00Z' },
  { id: 'b', active: false, usage_count: 5, created_at: '2026-01-02T00:00:00Z' },
]

function makeService(keys = TWO_ACTIVE_KEYS) {
  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      insert: () => Promise.resolve({ error: null }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({
          data: table === 'pool_keys' ? keys : [],
          error: null,
        }).then(resolve),
    }
    return b
  }
  return { from: builder } as unknown as SupabaseClient
}

const pool = {
  id: 'pool-1',
  project_id: 'proj-1',
  name: 'OPENAI_API_KEY',
  current_key_id: 'a',
}

beforeEach(() => {
  vi.clearAllMocks()
  dispatch.mockResolvedValue([])
})

describe('rotatePool notifications', () => {
  it('notifies on a manual rotation, not just scheduled ones', async () => {
    // Previously only the cron path notified, so a human-triggered rotation was
    // invisible to a project's webhook/email subscribers.
    await rotatePool(makeService(), pool, 'manual', { reason: 'manual rotation' })

    expect(dispatch).toHaveBeenCalledTimes(1)
    const [, opts] = dispatch.mock.calls[0]
    expect(opts).toMatchObject({ projectId: 'proj-1', event: 'rotation' })
    expect(opts.subject).toContain('OPENAI_API_KEY')
  })

  it('routes a risk-driven rotation to the high_risk event', async () => {
    await rotatePool(makeService(), pool, 'risk', { reason: 'risk score 82' })

    expect(dispatch.mock.calls[0][1]).toMatchObject({ event: 'high_risk' })
  })

  it('stays silent when nothing rotated', async () => {
    // A no-op tick must not page anyone. With the scheduler ticking hourly,
    // notifying on every check would be constant noise.
    const res = await rotatePool(makeService(ONE_ACTIVE_KEY), pool, 'scheduled')

    expect(res.rotated).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('carries the rotation detail in the payload', async () => {
    await rotatePool(makeService(), pool, 'scheduled', { reason: 'interval elapsed' })

    const [, opts] = dispatch.mock.calls[0]
    expect(opts.data).toMatchObject({
      pool_id: 'pool-1',
      trigger: 'scheduled',
      from_key_id: 'a',
      to_key_id: 'b',
    })
    expect(opts.message).toContain('interval elapsed')
  })
})
