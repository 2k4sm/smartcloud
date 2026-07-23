'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAppUrl } from '@/lib/appUrl'

// "Continue with GitHub" — kicks off Supabase's GitHub OAuth flow from the
// browser. The SSR browser client stores the PKCE verifier in a cookie so the
// server callback (/auth/callback) can complete the exchange.
export default function GithubButton({ label = 'Continue with GitHub' }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Surface a failed callback redirect (?auth_error=github) without pulling in
  // useSearchParams (which would force a Suspense boundary at build time).
  // Reading a browser-only value once after mount is the intended use of an
  // effect here; the query param can't be known during SSR/prerender.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('auth_error') === 'github') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from window.location after mount
      setError('GitHub sign-in failed. Please try again.')
    }
  }, [])

  async function signIn() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${getAppUrl()}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success the browser is redirected to GitHub — no further work here.
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="w-full py-3 inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-white font-medium text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <span className="spinner" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 007.86 10.92c.575.106.785-.25.785-.556 0-.274-.01-1-.015-1.965-3.196.695-3.87-1.54-3.87-1.54-.523-1.33-1.277-1.684-1.277-1.684-1.044-.714.08-.699.08-.699 1.154.081 1.762 1.185 1.762 1.185 1.026 1.758 2.692 1.25 3.348.956.104-.743.401-1.25.73-1.538-2.552-.29-5.236-1.276-5.236-5.68 0-1.255.448-2.28 1.183-3.084-.119-.29-.513-1.459.112-3.043 0 0 .965-.309 3.163 1.178a10.98 10.98 0 015.76 0c2.196-1.487 3.16-1.178 3.16-1.178.626 1.584.232 2.753.114 3.043.737.804 1.182 1.829 1.182 3.084 0 4.415-2.688 5.387-5.248 5.671.413.356.78 1.057.78 2.131 0 1.539-.014 2.78-.014 3.158 0 .309.207.668.79.555A11.5 11.5 0 0023.5 12C23.5 5.73 18.27.5 12 .5z" />
          </svg>
        )}
        {label}
      </button>
      {error && <p className="text-rose-400 text-sm mt-2 text-center">{error}</p>}
    </div>
  )
}
