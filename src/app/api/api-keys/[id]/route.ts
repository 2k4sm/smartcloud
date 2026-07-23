import { NextRequest, NextResponse } from 'next/server'
import { resolveAuth } from '@/lib/auth'

type Props = { params: Promise<{ id: string }> }

// DELETE /api/api-keys/[id] — revoke an API key.
export async function DELETE(request: NextRequest, { params }: Props) {
  const auth = await resolveAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, supabase } = auth
  const { id } = await params

  let query = supabase.from('api_keys').delete().eq('id', id)
  if (auth.requiresUserFilter) query = query.eq('user_id', userId)
  const { error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
