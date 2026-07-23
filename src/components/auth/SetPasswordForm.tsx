'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Onboarding step shown after a GitHub sign-up: lets the user add a password so
// they can still sign in by email if GitHub is ever unavailable. `updateUser`
// requires no current password (the OAuth session authorizes the change).
export default function SetPasswordForm({
  hasPassword,
  email,
}: {
  hasPassword: boolean
  email: string
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)

  async function setP(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const supabase = createClient()
    // Set the password and mark onboarding done so we don't prompt again.
    const { error } = await supabase.auth.updateUser({
      password,
      data: { oauth_onboarded: true },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function skip() {
    setSkipping(true)
    setError('')
    const supabase = createClient()
    // Remember the choice so the user isn't prompted on every GitHub login.
    const { error } = await supabase.auth.updateUser({
      data: { oauth_onboarded: true },
    })
    if (error) {
      setError(error.message)
      setSkipping(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="glass-card p-8">
      <h2 className="text-xl font-semibold text-white mb-1">Set a password</h2>
      <p className="text-gray-400 text-sm mb-4">
        {hasPassword
          ? 'Update the password on your account.'
          : 'Add a password so you can still sign in with your email if GitHub is unavailable.'}
      </p>
      {email && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
          You&apos;ll sign in with{' '}
          <span className="text-gray-200 font-mono">{email}</span> and this password.
        </div>
      )}

      <form onSubmit={setP} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="glass-input w-full"
            placeholder="Min. 8 characters"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="glass-input w-full"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-rose-400 text-sm">{error}</p>}

        <button type="submit" disabled={loading || skipping} className="btn-primary w-full py-3">
          {loading ? (
            <span className="inline-flex items-center gap-2"><span className="spinner" /> Saving...</span>
          ) : (
            'Save password'
          )}
        </button>
      </form>

      {!hasPassword && (
        <button
          onClick={skip}
          disabled={loading || skipping}
          className="w-full text-center text-gray-500 hover:text-gray-300 text-sm mt-4 transition-colors disabled:opacity-50"
        >
          {skipping ? 'Skipping…' : 'Skip for now'}
        </button>
      )}
    </div>
  )
}
