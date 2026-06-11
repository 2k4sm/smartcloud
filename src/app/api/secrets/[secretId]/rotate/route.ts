import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { rotateSecret } from '@/lib/rotation'

type Params = { params: Promise<{ secretId: string }> }

// POST /api/secrets/:secretId/rotate — manual rotation (owner/admin).
// Returns the freshly generated value ONCE (never stored in plaintext).
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { secretId } = await params
  const { userId, supabase } = auth

  // Load the secret (scoped to the caller).
  let secretQuery = supabase
    .from('secrets')
    .select('id, key_name, project_id, user_id')
    .eq('id', secretId)
  if (auth.requiresUserFilter) secretQuery = secretQuery.eq('user_id', userId)
  const { data: secret } = await secretQuery.single()
  if (!secret) return NextResponse.json({ error: 'Secret not found' }, { status: 404 })

  // Authorization: owner/admin for browser/JWT; API keys are already owner-scoped.
  if (!auth.requiresUserFilter) {
    const { data: role } = await supabase.rpc('current_project_role', {
      pid: secret.project_id,
    })
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const ip =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'manual'

  const result = await rotateSecret(createServiceClient(), secret, {
    trigger: 'manual',
    ip,
  })

  if (result.status === 'failed') {
    return NextResponse.json(
      { error: `Rotation failed: ${result.detail}` },
      { status: 500 }
    )
  }
  return NextResponse.json(result)
}

// GET /api/secrets/:secretId/rotate — rotation history for the secret.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { secretId } = await params

  let query = supabase
    .from('rotation_jobs')
    .select('id, secret_id, status, trigger, strategy, detail, rotated_at, created_at')
    .eq('secret_id', secretId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }
  return NextResponse.json({ secret_id: secretId, jobs: data ?? [] })
}
