'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, LayoutGrid, Plus } from 'lucide-react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import type { ProjectSummary } from '@/components/dashboard/nav-config'

/**
 * Project switcher in the sidebar. Previously the only way between two
 * projects was back out to the grid and in again; this is one click plus
 * type-ahead, and it stays usable at 40 projects.
 */
export function ProjectSwitcher({
  projects,
  activeProjectId,
  onCreateProject,
}: {
  projects: ProjectSummary[]
  activeProjectId: string | null
  onCreateProject?: () => void
}) {
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()
  const [open, setOpen] = React.useState(false)

  const active = projects.find((p) => p.id === activeProjectId) ?? null

  function go(href: string) {
    setOpen(false)
    if (isMobile) setOpenMobile(false)
    router.push(href)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Switch project"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                <LayoutGrid className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-xs text-muted-foreground">
                  Project
                </span>
                <span className="truncate text-sm font-medium">
                  {active?.name ?? 'All projects'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            </SidebarMenuButton>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={8}
            className="w-(--radix-popover-trigger-width) min-w-64 p-0"
          >
            <Command>
              <CommandInput placeholder="Find a project…" />
              <CommandList>
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all projects"
                    onSelect={() => go('/dashboard')}
                  >
                    <LayoutGrid />
                    All projects
                    {!active && <Check className="ml-auto size-4" />}
                  </CommandItem>
                </CommandGroup>

                {projects.length > 0 && (
                  <CommandGroup heading="Projects">
                    {projects.map((project) => (
                      <CommandItem
                        key={project.id}
                        value={project.name}
                        onSelect={() =>
                          go(`/dashboard/projects/${project.id}`)
                        }
                      >
                        <span className="truncate">{project.name}</span>
                        {project.id === activeProjectId && (
                          <Check className="ml-auto size-4 shrink-0" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {onCreateProject && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="new project create"
                        onSelect={() => {
                          setOpen(false)
                          onCreateProject()
                        }}
                      >
                        <Plus />
                        New project
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
