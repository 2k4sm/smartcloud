import { NextRequest } from 'next/server'
import { createServerSupabaseClient, createTokenSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuthResult {
  userId: string
  supabase: SupabaseClient
  // When true, the caller must add .eq('user_id', userId) to queries
  // because the supabase client is a service-role client (bypasses RLS)
  requiresUserFilter: boolean
}

/**
 * Resolve authentication from a request.
 * Supports three auth methods:
 * 1. Cookie session (browser)
 * 2. Supabase JWT (Bearer token)
 * 3. Custom API key (Bearer token, prefix: sc_live_)
 *
 * Returns null if authentication fails.
 */
export async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null

  // No Bearer token — use cookie-based session
  if (!bearerToken) {
    const cookieClient = await createServerSupabaseClient()
    const { data: { user } } = await cookieClient.auth.getUser()
    if (!user) return null

    // Attach the validated session's JWT explicitly. The plain SSR cookie client
    // can fail to forward the token to PostgREST on writes inside route handlers,
    // leaving auth.uid() null and tripping RLS WITH CHECK (e.g. creating a
    // project/secret). A token client always sends `Authorization: Bearer <jwt>`,
    // exactly like the JWT path, so auth.uid() reliably resolves for RLS.
    const { data: { session } } = await cookieClient.auth.getSession()
    const supabase = session?.access_token
      ? createTokenSupabaseClient(session.access_token)
      : cookieClient
    return { userId: user.id, supabase, requiresUserFilter: false }
  }

  // Check if it's a custom API key (starts with sc_live_)
  if (bearerToken.startsWith('sc_live_')) {
    return resolveApiKey(bearerToken)
  }

  // Otherwise treat as Supabase JWT
  const supabase = createTokenSupabaseClient(bearerToken)
  const { data: { user }, error } = await supabase.auth.getUser(bearerToken)
  if (!user || error) return null
  return { userId: user.id, supabase, requiresUserFilter: false }
}

async function resolveApiKey(apiKey: string): Promise<AuthResult | null> {
  const keyHash = hashApiKey(apiKey)
  const serviceClient = createServiceClient()

  // Look up the API key by its hash
  const { data: keyRecord, error } = await serviceClient
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .single()

  if (error || !keyRecord) return null

  // Update last_used_at
  await serviceClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)

  // Return service client — caller must add user_id filter to queries
  return {
    userId: keyRecord.user_id,
    supabase: serviceClient,
    requiresUserFilter: true,
  }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function generateApiKey(): string {
  return `sc_live_${randomBytes(32).toString('hex')}`
}
