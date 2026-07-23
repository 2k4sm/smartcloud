'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Boxes,
  Cloud,
  FileBarChart,
  KeyRound,
  KeySquare,
  LayoutGrid,
  ShieldCheck,
  Users,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { NavUser } from '@/components/dashboard/nav-user'

const PLATFORM_NAV = [
  { href: '/dashboard', label: 'Projects', icon: LayoutGrid, exact: true },
  { href: '/dashboard/api-keys', label: 'API Keys', icon: KeySquare },
]

function projectNav(id: string) {
  const base = `/dashboard/projects/${id}`
  return [
    { href: base, label: 'Secrets', icon: KeyRound, exact: true },
    { href: `${base}/pools/new`, label: 'Key Pools', icon: Boxes, match: `${base}/pools` },
    { href: `${base}/members`, label: 'Team', icon: Users },
    { href: `${base}/providers`, label: 'Cloud', icon: Cloud },
    { href: `${base}/notifications`, label: 'Notifications', icon: Bell },
    { href: `${base}/report`, label: 'Report', icon: FileBarChart },
  ]
}

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname()

  // Extract the active project id from the path (ignore the "new" route).
  const projectMatch = pathname.match(/^\/dashboard\/projects\/([^/]+)/)
  const projectId =
    projectMatch && projectMatch[1] !== 'new' ? projectMatch[1] : null

  const [projectName, setProjectName] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!projectId) {
      setProjectName(null)
      return
    }
    let active = true
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setProjectName(d?.project?.name ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [projectId])

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="brand-gradient flex aspect-square size-8 items-center justify-center rounded-lg text-white shadow-sm">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">SmartCloud</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Secrets Manager
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {PLATFORM_NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href ||
                  pathname.startsWith('/dashboard/projects')
                : pathname.startsWith(item.href)
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        {projectId && (
          <SidebarGroup>
            <SidebarGroupLabel className="truncate">
              {projectName ?? 'Project'}
            </SidebarGroupLabel>
            <SidebarMenu>
              {projectNav(projectId).map((item) => {
                const matchPath = item.match ?? item.href
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(matchPath)
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser email={email} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
