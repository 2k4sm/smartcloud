'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GithubButton from '@/components/auth/GithubButton'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="glass-card p-8">
      <h2 className="text-xl font-semibold text-white mb-6">Sign in</h2>

      <GithubButton />

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
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-rose-400 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? <span className="inline-flex items-center gap-2"><span className="spinner" /> Signing in...</span> : 'Sign in'}
        </button>
      </form>

      <p className="text-gray-500 text-sm text-center mt-6">
        No account?{' '}
        <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 transition-colors">
          Create one
        </Link>
      </p>
    </div>
  )
}
