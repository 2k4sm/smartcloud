'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import GithubButton from '@/components/auth/GithubButton'
import {
  AuthDivider,
  EmailField,
  PasswordField,
} from '@/components/auth/auth-fields'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error('Invalid email or password')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Access your secrets dashboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <GithubButton />

        <AuthDivider>or continue with email</AuthDivider>

        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-5">
            <EmailField value={email} onChange={setEmail} />
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Spinner />}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </FieldGroup>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link
            href="/signup"
            className="font-medium text-brand hover:underline"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
