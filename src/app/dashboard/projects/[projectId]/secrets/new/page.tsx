'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function NewSecretPage() {
  const router = useRouter()
  const { projectId } = useParams<{ projectId: string }>()
  const [keyName, setKeyName] = useState('')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        key_name: keyName,
        value,
        description,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to save secret')
      setLoading(false)
      return
    }

    toast.success('Secret saved')
    router.push(`/dashboard/projects/${projectId}`)
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={`/dashboard/projects/${projectId}`}>
            <ArrowLeft className="size-4" />
            Back to project
          </Link>
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Add secret</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Secret details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="key_name">Key name</Label>
              <Input
                id="key_name"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value.toUpperCase())}
                required
                className="font-mono"
                placeholder="DATABASE_PASSWORD"
              />
              <p className="text-xs text-muted-foreground">
                Keys are automatically uppercased.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="value">Secret value</Label>
              <Textarea
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                rows={4}
                className="resize-none font-mono"
                placeholder="Enter the secret value..."
              />
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3" />
                Encrypted with AES-256-GCM before storage.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this secret for?"
              />
            </div>
          </CardContent>
          <CardFooter className="gap-3">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Saving...' : 'Save secret'}
            </Button>
            <Button asChild type="button" variant="ghost">
              <Link href={`/dashboard/projects/${projectId}`}>Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
