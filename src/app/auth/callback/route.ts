import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// OAuth (and magic-link) callback. Supabase redirects the browser here with a
// `code` after the user authorizes on GitHub. We exchange it for a session,
// then decide where to send them:
//   - first-time OAuth users with no password yet  -> /set-password (onboarding)
//   - everyone else                                -> `next` (default /dashboard)
//
// Session cookies are collected during the exchange and written onto the final
// redirect response, so the Set-Cookie headers ride along with the 3xx (the
// pattern that avoids dropped OAuth sessions in route handlers).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only allow same-origin relative redirects to prevent open-redirect abuse.
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?auth_error=github`)
  }

  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(
            ...cookiesToSet.map((c) => ({
              name: c.name,
              value: c.value,
              options: (c.options ?? {}) as Record<string, unknown>,
            }))
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?auth_error=github`)
  }

  // Does this account already have an email/password credential, or has the
  // user already been through onboarding (set or skipped)?
  const hasPassword =
    data.user.identities?.some((i) => i.provider === 'email') ?? false
  const onboarded = data.user.user_metadata?.oauth_onboarded === true
  const dest = hasPassword || onboarded ? next : '/set-password'

  const response = NextResponse.redirect(`${origin}${dest}`)
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  )
  return response
}
