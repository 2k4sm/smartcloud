import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import SetPasswordForm from '@/components/auth/SetPasswordForm'

// Onboarding / "add a password" step. Requires an authenticated session
// (reached right after GitHub OAuth). Middleware doesn't protect this path, so
// we guard it here.
export default async function SetPasswordPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const hasPassword =
    user.identities?.some((i) => i.provider === 'email') ?? false

  return <SetPasswordForm hasPassword={hasPassword} email={user.email ?? ''} />
}
