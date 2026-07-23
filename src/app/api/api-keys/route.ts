import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth, generateApiKey, hashApiKey } from '@/lib/auth'

// GET /api/api-keys — list the caller's API keys (never the hash/plaintext).
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth

  let query = supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at')
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ api_keys: data })
}

// POST /api/api-keys — generate a new API key (plaintext returned once).
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const plaintext = generateApiKey()
  const keyHash = hashApiKey(plaintext)
  const keyPrefix = plaintext.substring(0, 16) // "sc_live_" + 8 chars

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: userId, name, key_hash: keyHash, key_prefix: keyPrefix })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The plaintext key is shown exactly once.
  return NextResponse.json({ api_key: { ...data, key: plaintext } }, { status: 201 })
}
