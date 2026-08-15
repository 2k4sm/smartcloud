import { createClient } from '@supabase/supabase-js'

// Service role client bypasses RLS. Server-side only — NEVER expose it to the
// browser.
//
// Used broadly by the API routes, not just for audit-log inserts: RLS's
// auth.uid() is not forwarded on Bearer-token / API-key requests, so writes made
// through it would be rejected. Authorization therefore moves into app code —
// every route using this client must first check the caller with
// projectRole()/canWrite() from @/lib/access (the same rules the SQL policies
// encode), and API-key auth additionally sets requiresUserFilter so queries
// carry an explicit .eq('user_id', userId).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
