import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { encrypt } from '@/lib/encryption'

// Mock auth and service client
vi.mock('@/lib/auth', () => ({
  resolveAuth: vi.fn(),
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

import { POST } from '@/app/api/secrets/fetch-all/route'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

function makeRequest(body: object, token?: string): NextRequest {
  return new NextRequest('http://localhost/api/secrets/fetch-all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

function mockServiceClient() {
  // access_logs insert + projectRole lookup (returns no project → pool merge skipped,
  // keeping these tests focused on static secrets).
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  })
}

function mockAuth(fromMock?: () => unknown) {
  const supabaseMock: Record<string, unknown> = {}
  if (fromMock) supabaseMock.from = fromMock
  ;(resolveAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: 'user-1',
    supabase: supabaseMock,
    requiresUserFilter: false,
  })
}

describe('POST /api/secrets/fetch-all', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServiceClient()
  })

  it('returns 401 when user is not authenticated', async () => {
    ;(resolveAuth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await POST(makeRequest({ project_id: 'proj-1' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when project_id is missing', async () => {
    mockAuth()

    const res = await POST(makeRequest({}, 'valid-token'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('project_id')
  })

  it('returns empty array when project has no secrets', async () => {
    mockAuth(() => ({
      select: () => ({
        eq: () => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }))

    const res = await POST(makeRequest({ project_id: 'proj-1' }, 'token'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.secrets).toEqual([])
    expect(body.project_id).toBe('proj-1')
    expect(body.fetched_at).toBeTruthy()
  })

  it('decrypts and returns all secrets for a project', async () => {
    const secret1 = encrypt('password-123')
    const secret2 = encrypt('api-key-456')

    mockAuth(() => ({
      select: () => ({
        eq: () => ({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 's1', key_name: 'DB_PASSWORD', ...secret1, project_id: 'proj-1' },
              { id: 's2', key_name: 'API_KEY', ...secret2, project_id: 'proj-1' },
            ],
            error: null,
          }),
        }),
      }),
    }))

    const res = await POST(makeRequest({ project_id: 'proj-1' }, 'token'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.secrets).toHaveLength(2)
    expect(body.secrets[0]).toEqual({ key_name: 'DB_PASSWORD', value: 'password-123' })
    expect(body.secrets[1]).toEqual({ key_name: 'API_KEY', value: 'api-key-456' })
    expect(body.project_id).toBe('proj-1')
  })

  it('skips secrets that fail decryption instead of failing the batch', async () => {
    const goodSecret = encrypt('good-value')
    const tamperedSecret = encrypt('original')
    tamperedSecret.auth_tag = Buffer.alloc(16, 0).toString('base64') // tampered

    mockAuth(() => ({
      select: () => ({
        eq: () => ({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 's1', key_name: 'GOOD_KEY', ...goodSecret, project_id: 'proj-1' },
              { id: 's2', key_name: 'BAD_KEY', ...tamperedSecret, project_id: 'proj-1' },
            ],
            error: null,
          }),
        }),
      }),
    }))

    const res = await POST(makeRequest({ project_id: 'proj-1' }, 'token'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.secrets).toHaveLength(1)
    expect(body.secrets[0]).toEqual({ key_name: 'GOOD_KEY', value: 'good-value' })
  })

  it('never returns encrypted fields in response', async () => {
    const encrypted = encrypt('my-secret')

    mockAuth(() => ({
      select: () => ({
        eq: () => ({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 's1', key_name: 'SECRET', ...encrypted, project_id: 'proj-1' }],
            error: null,
          }),
        }),
      }),
    }))

    const res = await POST(makeRequest({ project_id: 'proj-1' }, 'token'))
    const body = await res.json()

    expect(body.secrets[0].encrypted_value).toBeUndefined()
    expect(body.secrets[0].iv).toBeUndefined()
    expect(body.secrets[0].auth_tag).toBeUndefined()
    expect(body.secrets[0].value).toBe('my-secret')
  })
})
