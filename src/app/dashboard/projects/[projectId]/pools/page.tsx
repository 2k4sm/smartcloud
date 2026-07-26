import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Boxes } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { PageHeader } from '@/components/dashboard/page-header'
import { NewPoolDialog } from '@/components/pools/NewPoolDialog'

type Props = { params: Promise<{ projectId: string }> }

export default async function PoolsPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createServerSupabaseClient()

  const [{ data: project }, { data: pools }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', projectId).single(),
    supabase
      .from('key_pools')
      .select('id, name, description')
      .eq('project_id', projectId)
      .order('name', { ascending: true }),
  ])

  if (!project) notFound()

  const keyPools = (pools ?? []) as {
    id: string
    name: string
    description: string | null
  }[]

  return (
    <div data-full-width className="space-y-6">
      <PageHeader
        title="Key pools"
        description="A pool holds several interchangeable keys. One is served at a time; rotation switches to the least-used active key, on a schedule or when risk turns high."
      >
        {keyPools.length > 0 && <NewPoolDialog projectId={projectId} />}
      </PageHeader>

      {keyPools.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Boxes />
            </EmptyMedia>
            <EmptyTitle>No key pools yet</EmptyTitle>
            <EmptyDescription>
              Create a pool, then add several interchangeable keys to rotate
              between without any downtime.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewPoolDialog projectId={projectId} />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {keyPools.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${projectId}/pools/${p.id}`}
              className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full gap-3 transition-shadow duration-200 group-hover:border-brand/40 group-hover:shadow-[var(--shadow-e2)]">
                <CardHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                      <Boxes className="size-4" />
                    </div>
                    <div
                      className="min-w-0 truncate font-mono font-semibold text-brand"
                      title={p.name}
                    >
                      {p.name}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {p.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic">
                      No description
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
