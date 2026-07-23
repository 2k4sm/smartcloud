'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  const [showPassword, setShowPassword] = useState(false)
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
      toast.error(error.message)
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
      toast.error(error.message)
      setSkipping(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Set a password</CardTitle>
        <CardDescription>
          {hasPassword
            ? 'Update the password on your account.'
            : 'Add a password so you can still sign in with your email if GitHub is unavailable.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {email && (
          <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            You&apos;ll sign in with{' '}
            <span className="font-mono break-all text-foreground">{email}</span> and this password.
          </div>
        )}

        <form onSubmit={setP} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="px-9"
                placeholder="Create a password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="pl-9"
                placeholder="Re-enter your password"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading || skipping} className="w-full">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save password'
            )}
          </Button>
        </form>

        {!hasPassword && (
          <Button
            type="button"
            variant="ghost"
            onClick={skip}
            disabled={loading || skipping}
            className="w-full text-muted-foreground"
          >
            {skipping ? 'Skipping…' : 'Skip for now'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
