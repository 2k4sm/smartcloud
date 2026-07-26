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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
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

  const projectItems = projectId ? projectNav(projectId) : []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
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
      </SidebarHeader>

      <SidebarContent>
        {/* The selected project and its pages are one block: the switcher
            row, with that project's sections hanging off it. */}
        <SidebarGroup>
          <SidebarMenu>
            <ProjectSwitcher
              projects={projects}
              activeProjectId={projectId}
              onCreateProject={() => {
                closeOnMobile()
                setNewProjectOpen(true)
              }}
            >
              {projectItems.length > 0 && (
                <SidebarMenuSub className="mt-1">
                  {projectItems.map((item) => (
                    <SidebarMenuSubItem key={item.href}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive(pathname, item)}
                      >
                        <Link href={item.href} onClick={closeOnMobile}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </ProjectSwitcher>

            {/* The nested rail is hidden when the sidebar collapses to
                icons, so the same destinations reappear here as icon
                buttons — otherwise they'd be unreachable while collapsed. */}
            {projectItems.map((item) => (
              <SidebarMenuItem
                key={`icon-${item.href}`}
                className="hidden group-data-[collapsible=icon]:block"
              >
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
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {PLATFORM_NAV.map((item) => (
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
        </SidebarGroup>
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
