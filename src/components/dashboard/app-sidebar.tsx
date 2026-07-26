'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

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
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavUser } from '@/components/dashboard/nav-user'
import { ProjectSwitcher } from '@/components/dashboard/project-switcher'
import { NewProjectDialog } from '@/components/projects/NewProjectDialog'
import {
  PLATFORM_NAV,
  projectIdFromPath,
  projectNav,
  type NavEntry,
  type ProjectSummary,
} from '@/components/dashboard/nav-config'

function isActive(pathname: string, item: NavEntry) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

export function AppSidebar({
  email,
  projects,
}: {
  email: string
  projects: ProjectSummary[]
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const projectId = projectIdFromPath(pathname)
  const [newProjectOpen, setNewProjectOpen] = React.useState(false)

  // Tapping a link on a phone should dismiss the sheet, not leave the
  // user staring at the nav they just navigated from.
  const closeOnMobile = React.useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  function renderMenu(items: NavEntry[]) {
    return (
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive(pathname, item)}
              tooltip={item.label}
            >
              <Link href={item.href} onClick={closeOnMobile}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={closeOnMobile}>
                <div className="brand-gradient flex aspect-square size-8 shrink-0 items-center justify-center rounded-md text-white shadow-[var(--shadow-e1)]">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">
                    SmartCloud
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Secrets Manager
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="mx-0 group-data-[collapsible=icon]:hidden" />

        <ProjectSwitcher
          projects={projects}
          activeProjectId={projectId}
          onCreateProject={() => {
            closeOnMobile()
            setNewProjectOpen(true)
          }}
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          {renderMenu(PLATFORM_NAV)}
        </SidebarGroup>

        {projectId && (
          <SidebarGroup>
            <SidebarGroupLabel>Project</SidebarGroupLabel>
            {renderMenu(projectNav(projectId))}
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser email={email} />
      </SidebarFooter>
      <SidebarRail />

      {/* Trigger-less: opened from the switcher's "New project" row. */}
      <NewProjectDialog
        trigger={null}
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
      />
    </Sidebar>
  )
}
