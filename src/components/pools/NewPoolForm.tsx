'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function NewPoolForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name, description }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create pool')
        return
      }
      router.push(`/dashboard/projects/${projectId}/pools/${data.pool.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-lg">
      <form onSubmit={submit}>
        <CardHeader>
          <CardTitle>Pool details</CardTitle>
          <CardDescription>
            After creating the pool, add several real, interchangeable keys. One is
            served at a time; rotation switches to the least-used active key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pool-name">Pool name</Label>
            <Input
              id="pool-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. OPENAI_API_KEY"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-description">Description (optional)</Label>
            <Textarea
              id="pool-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
              placeholder="A pool of interchangeable OpenAI keys"
            />
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Create pool
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
