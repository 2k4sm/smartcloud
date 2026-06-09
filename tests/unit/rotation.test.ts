import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rotateSecret, generateSecretValue, type RotatableSecret } from '@/lib/rotation'
import { decrypt } from '@/lib/encryption'

const secret: RotatableSecret = {
  id: 'sec-1',
  key_name: 'API_TOKEN',
  project_id: 'proj-1',
  user_id: 'user-1',
}

// Minimal fake service client that records writes and lets us force an error.
function makeFakeClient(opts?: { updateError?: string }) {
  const inserts: Record<string, unknown[]> = {}
  let updatedSecret: Record<string, unknown> | null = null

  const client = {
    from(table: string) {
      return {
        update(row: Record<string, unknown>) {
          return {
            eq() {
              if (opts?.updateError) return Promise.resolve({ error: { message: opts.updateError } })
              if (table === 'secrets') updatedSecret = row
              return Promise.resolve({ error: null })
            },
          }
        },
        insert(row: Record<string, unknown>) {
          ;(inserts[table] ??= []).push(row)
          return Promise.resolve({ error: null })
        },
      }
    },
  } as unknown as SupabaseClient

  return { client, inserts, getUpdatedSecret: () => updatedSecret }
}

describe('secret rotation', () => {
  it('generateSecretValue produces distinct, high-entropy values', () => {
    const a = generateSecretValue()
    const b = generateSecretValue()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(24)
  })

  it('success path re-encrypts, records a success job and an UPDATE log', async () => {
    const { client, inserts, getUpdatedSecret } = makeFakeClient()
    const result = await rotateSecret(client, secret, { trigger: 'manual' })

    expect(result.status).toBe('success')
    expect(result.new_value).toBeTruthy()
    expect(result.rotated_at).toBeTruthy()

    // The stored ciphertext must decrypt back to the returned plaintext.
    const stored = getUpdatedSecret()!
    expect(
      decrypt({
        encrypted_value: stored.encrypted_value as string,
        iv: stored.iv as string,
        auth_tag: stored.auth_tag as string,
      })
    ).toBe(result.new_value)

    const job = inserts['rotation_jobs'][0] as { status: string; trigger: string }
    expect(job.status).toBe('success')
    expect(job.trigger).toBe('manual')
    expect(inserts['access_logs'][0]).toMatchObject({ action: 'UPDATE' })
  })

  it('failure path records a failed job and returns no new value', async () => {
    const { client, inserts } = makeFakeClient({ updateError: 'db down' })
    const result = await rotateSecret(client, secret, { trigger: 'scheduled' })

    expect(result.status).toBe('failed')
    expect(result.new_value).toBeUndefined()
    expect(result.detail).toContain('db down')
    const job = inserts['rotation_jobs'][0] as { status: string }
    expect(job.status).toBe('failed')
    // No access log should be written on failure.
    expect(inserts['access_logs']).toBeUndefined()
  })
})
