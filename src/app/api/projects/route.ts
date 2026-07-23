import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, supabase } = auth

  let query = supabase
    .from('projects')
    .select('id, name, description, created_at, updated_at')
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ projects: data })
}

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = auth

  let body: { name?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, description } = body
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
  }

  // Write with the service-role client and a server-set user_id. resolveAuth has
  // already verified the caller's identity; this avoids depending on the RLS
  // WITH CHECK (auth.uid() = user_id), which fails when the cookie client's token
  // isn't forwarded to PostgREST in a route handler. Same pattern as api_keys.
  const service = createServiceClient()
  const { data, error } = await service
    .from('projects')
    .insert({ name: name.trim(), description: description ?? null, user_id: userId })
    .select('id, name, description, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ project: data }, { status: 201 })
}
