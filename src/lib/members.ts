import { createServiceClient } from '@/lib/supabase/service'

// Directory helpers backed by Supabase Auth admin API (service role only).
// Kept in one place so the members routes don't each re-implement the scan.

const PAGE_SIZE = 200

/** Find an auth user id by email (case-insensitive). Returns null if none. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const service = createServiceClient()
  const target = email.trim().toLowerCase()
  // Scan a few pages — projects are small in this app.
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    })
    if (error || !data) return null
    const match = data.users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match.id
    if (data.users.length < PAGE_SIZE) break
  }
  return null
}

/** Resolve a set of user ids to their emails. */
export async function resolveEmails(
  ids: string[]
): Promise<Record<string, string>> {
  const service = createServiceClient()
  const map: Record<string, string> = {}
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const { data } = await service.auth.admin.getUserById(id)
      if (data?.user?.email) map[id] = data.user.email
    })
  )
  return map
}
