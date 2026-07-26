'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { PasswordField } from '@/components/auth/auth-fields'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

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

  async function submit(e: React.FormEvent) {
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
      <CardContent className="space-y-5">
        {email && (
          <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            You&apos;ll sign in with{' '}
            <span className="mono break-all text-foreground">{email}</span> and
            this password.
          </div>
        )}

        <form onSubmit={submit}>
          <FieldGroup className="gap-5">
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Create a password"
              autoComplete="new-password"
              description="At least 8 characters."
            />
            <PasswordField
              id="confirm-password"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              revealable={false}
            />

            <FieldError>{error}</FieldError>

            <Button
              type="submit"
              disabled={loading || skipping}
              className="w-full"
            >
              {loading && <Spinner />}
              {loading ? 'Saving…' : 'Save password'}
            </Button>
          </FieldGroup>
        </form>

        {!hasPassword && (
          <Button
            type="button"
            variant="ghost"
            onClick={skip}
            disabled={loading || skipping}
            className="w-full text-muted-foreground"
          >
            {skipping && <Spinner />}
            {skipping ? 'Skipping…' : 'Skip for now'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
