import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rotateHighRiskSecrets } from '@/lib/autoRotation'
import { decrypt } from '@/lib/encryption'
import type { RiskLogEntry } from '@/lib/risk'

const NOW = new Date('2026-06-30T12:00:00Z')

// Build 45 abusive reads (high volume, off-hours UTC, many distinct IPs) so the
// rule-based scorer returns HIGH.
function highRiskLogs(): RiskLogEntry[] {
  const logs: RiskLogEntry[] = []
  for (let i = 0; i < 45; i++) {
    logs.push({
      action: 'READ',
      ip_address: `10.0.0.${i % 8}`,
      accessed_at: new Date(Date.UTC(2026, 5, 30, 2, i % 60, 0)).toISOString(),
    })
  }
  return logs
}

// Minimal thenable Supabase fake: select/eq chains resolve to table data;
// insert/update record writes.
function makeService(state: { secrets: unknown[]; logs: RiskLogEntry[] }) {
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
          table === 'secrets'
            ? state.secrets
            : table === 'access_logs'
              ? state.logs
              : []
        return Promise.resolve({ data, error: null }).then(resolve)
      },
    }
    return b
  }

  const client = { from: builder } as unknown as SupabaseClient
  return { client, inserts, updates }
}

describe('risk-driven auto-rotation (E2E: high risk → rotate → log)', () => {
  it('recomputes HIGH risk, rotates, records job + UPDATE log', async () => {
    const secret = {
      id: 'sec-1',
      key_name: 'API_TOKEN',
      project_id: 'proj-1',
      user_id: 'user-1',
    }
    const { client, inserts, updates } = makeService({
      secrets: [secret],
      logs: highRiskLogs(),
    })

    const summary = await rotateHighRiskSecrets(client, { now: NOW })

    expect(summary.evaluated).toBe(1)
    expect(summary.rotated).toBe(1)

    // Risk was persisted as HIGH.
    const risk = inserts['risk_scores'][0] as { level: string; score: number }
    expect(risk.level).toBe('HIGH')
    expect(risk.score).toBeGreaterThanOrEqual(67)

    // Rotation job recorded with trigger 'risk'.
    const job = inserts['rotation_jobs'][0] as { trigger: string; status: string }
    expect(job.trigger).toBe('risk')
    expect(job.status).toBe('success')

    // An UPDATE access log was written.
    expect(inserts['access_logs'][0]).toMatchObject({ action: 'UPDATE' })

    // The secret's stored value was replaced with valid ciphertext.
    const upd = updates['secrets'][0] as {
      encrypted_value: string
      iv: string
      auth_tag: string
    }
    expect(() =>
      decrypt({
        encrypted_value: upd.encrypted_value,
        iv: upd.iv,
        auth_tag: upd.auth_tag,
      })
    ).not.toThrow()
  })

  it('does not rotate when risk stays below the threshold', async () => {
    const secret = {
      id: 'sec-2',
      key_name: 'LOW_RISK',
      project_id: 'proj-1',
      user_id: 'user-1',
    }
    const { client, inserts } = makeService({
      secrets: [secret],
      logs: [
        {
          action: 'READ',
          ip_address: '10.0.0.1',
          accessed_at: new Date(NOW.getTime() - 3_600_000).toISOString(),
        },
      ],
    })

    const summary = await rotateHighRiskSecrets(client, { now: NOW })
    expect(summary.rotated).toBe(0)
    expect(inserts['rotation_jobs']).toBeUndefined()
  })
})
