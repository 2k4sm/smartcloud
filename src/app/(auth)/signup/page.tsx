'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GithubButton from '@/components/auth/GithubButton'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setMessage('Account created! Check your email to confirm, then sign in.')
    setLoading(false)
  }

  return (
    <div className="glass-card p-8">
      <h2 className="text-xl font-semibold text-white mb-6">Create account</h2>

      {message ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-300 text-sm">
          {message}
          <div className="mt-3">
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 underline transition-colors">
              Go to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
        <GithubButton label="Sign up with GitHub" />

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-gray-500 text-xs">or with email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="glass-input w-full"
              placeholder="you@example.com"
            />
          </div>

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

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? <span className="inline-flex items-center gap-2"><span className="spinner" /> Creating account...</span> : 'Create account'}
          </button>
        </form>
        </>
      )}

      <p className="text-gray-500 text-sm text-center mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
