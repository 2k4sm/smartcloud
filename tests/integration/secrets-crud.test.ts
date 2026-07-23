import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

import { POST } from '@/app/api/secrets/route'
import { DELETE, PUT } from '@/app/api/secrets/[secretId]/route'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/encryption'

function mockServiceClient() {
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  })
}

// POST /api/secrets now authorizes + writes via the service-role client, so tests
// drive the DB through this table-aware service mock.
function mockServiceForCreate(opts: {
  onInsert?: (payload: Record<string, string>) => void
  insertError?: { code: string; message: string }
}) {
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: (table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'p1', user_id: 'user-1' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'secrets') {
        return {
          insert: (payload: Record<string, string>) => {
            opts.onInsert?.(payload)
            return {
              select: () => ({
                single: vi.fn().mockResolvedValue(
                  opts.insertError
                    ? { data: null, error: opts.insertError }
                    : {
                        data: {
                          id: 'secret-1',
                          project_id: 'p1',
                          key_name: payload.key_name,
                          description: null,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        },
                        error: null,
                      }
                ),
              }),
            }
          },
        }
      }
      // access_logs
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    },
  })
}

// Auth-only cookie client (identity check); DB goes through the service mock.
function mockAuthedUser(id: string | null) {
  ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: id ? { id } : null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  })
}

function makePostRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/secrets (create)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServiceClient()
  })

  it('returns 401 if not authenticated', async () => {
    mockAuthedUser(null)

    const res = await POST(makePostRequest({ project_id: 'p1', key_name: 'KEY', value: 'val' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if value is missing', async () => {
    mockAuthedUser('user-1')

    const res = await POST(makePostRequest({ project_id: 'p1', key_name: 'KEY' }))
    expect(res.status).toBe(400)
  })

  it('stores secret encrypted and returns metadata only (no plaintext)', async () => {
    let storedPayload: Record<string, string> = {}

    mockAuthedUser('user-1')
    mockServiceForCreate({ onInsert: (p) => { storedPayload = p } })

    const res = await POST(makePostRequest({ project_id: 'p1', key_name: 'db_pass', value: 'hunter2' }))
    expect(res.status).toBe(201)

    const body = await res.json()

    // Response must not contain the plaintext value or encrypted fields
    expect(body.secret.encrypted_value).toBeUndefined()
    expect(body.secret.iv).toBeUndefined()
    expect(body.secret.auth_tag).toBeUndefined()
    expect(body.secret.id).toBe('secret-1')

    // The stored payload must be encrypted — decrypting it should give back original value
    expect(storedPayload.encrypted_value).toBeTruthy()
    expect(storedPayload.iv).toBeTruthy()
    expect(storedPayload.auth_tag).toBeTruthy()
    const decrypted = decrypt({
      encrypted_value: storedPayload.encrypted_value,
      iv: storedPayload.iv,
      auth_tag: storedPayload.auth_tag,
    })
    expect(decrypted).toBe('hunter2')
  })

  it('key_name is uppercased automatically', async () => {
    let storedKeyName = ''

    mockAuthedUser('user-1')
    mockServiceForCreate({ onInsert: (p) => { storedKeyName = p.key_name } })

    await POST(makePostRequest({ project_id: 'p1', key_name: 'my_secret_key', value: 'val' }))
    expect(storedKeyName).toBe('MY_SECRET_KEY')
  })

  it('returns 409 on duplicate key_name in same project', async () => {
    mockAuthedUser('user-1')
    mockServiceForCreate({ insertError: { code: '23505', message: 'unique violation' } })

    const res = await POST(makePostRequest({ project_id: 'p1', key_name: 'EXISTING_KEY', value: 'val' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('already exists')
  })
})

describe('DELETE /api/secrets/[secretId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServiceClient()
  })

  it('returns 204 on successful delete', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'secret-1', project_id: 'p1', key_name: 'MY_KEY' },
              error: null,
            }),
          }),
        }),
        delete: () => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    })

    const req = new NextRequest('http://localhost/api/secrets/secret-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ secretId: 'secret-1' }) })
    expect(res.status).toBe(204)
  })

  it('returns 401 if not authenticated', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    })

    const req = new NextRequest('http://localhost/api/secrets/secret-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ secretId: 'secret-1' }) })
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/secrets/[secretId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServiceClient()
  })

  it('re-encrypts the secret when value is updated', async () => {
    let updatedPayload: Record<string, string> = {}

    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
      from: () => ({
        update: (payload: Record<string, string>) => {
          updatedPayload = payload
          return {
            eq: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'secret-1', project_id: 'p1', key_name: 'MY_KEY', description: null, created_at: '', updated_at: '' },
                  error: null,
                }),
              }),
            }),
          }
        },
      }),
    })

    const req = new NextRequest('http://localhost/api/secrets/secret-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'new-secret-value' }),
    })
    const res = await PUT(req, { params: Promise.resolve({ secretId: 'secret-1' }) })
    expect(res.status).toBe(200)

    // The stored update should be encrypted
    expect(updatedPayload.encrypted_value).toBeTruthy()
    const decrypted = decrypt({
      encrypted_value: updatedPayload.encrypted_value,
      iv: updatedPayload.iv,
      auth_tag: updatedPayload.auth_tag,
    })
    expect(decrypted).toBe('new-secret-value')
  })
})
