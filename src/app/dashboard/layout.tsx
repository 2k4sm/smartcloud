import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { AppHeader } from '@/components/dashboard/app-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import type { ProjectSummary } from '@/components/dashboard/nav-config'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetched once here and handed to both the switcher and the command
  // palette. The sidebar used to fetch the current project's name on
  // every navigation just to render one label.
  const { data } = await supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true })

  const projects = (data ?? []) as ProjectSummary[]

  return (
    <SidebarProvider>
      <AppSidebar email={user.email ?? ''} projects={projects} />
      <SidebarInset className="min-w-0">
        <AppHeader projects={projects} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Pages default to a centered reading column; data-dense pages
              opt into the full width with data-full-width. */}
          <div className="mx-auto w-full min-w-0 max-w-6xl has-[[data-full-width]]:max-w-[1600px]">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
