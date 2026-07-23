import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Boxes } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="space-y-6">
      <PageHeader
        title="Key pools"
        description="Pools of interchangeable keys; the active one rotates by least-used, on schedule or risk."
      >
        <NewPoolDialog projectId={projectId} />
      </PageHeader>

      {keyPools.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Boxes className="mb-4 size-10 text-muted-foreground/50" />
            <p className="mb-1 font-medium">No key pools yet</p>
            <p className="mb-5 text-sm text-muted-foreground">
              Create a pool, then add several interchangeable keys to rotate
              between.
            </p>
            <NewPoolDialog projectId={projectId} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {keyPools.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${projectId}/pools/${p.id}`}
              className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-mono text-primary">
                    <Boxes className="size-4 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </CardTitle>
                  {p.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
