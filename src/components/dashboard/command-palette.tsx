'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, Moon, Search, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  PLATFORM_NAV,
  projectIdFromPath,
  projectNav,
  type ProjectSummary,
} from '@/components/dashboard/nav-config'
import { cn } from '@/lib/utils'

/**
 * Cmd/Ctrl+K navigation. Once a workspace has more than a handful of
 * projects, hunting through the sidebar is the slowest part of the app;
 * this jumps straight to any project or any page inside the current one.
 */
export function CommandPalette({
  projects,
  open,
  onOpenChange,
}: {
  projects: ProjectSummary[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const activeProjectId = projectIdFromPath(pathname)

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const run = React.useCallback(
    (action: () => void) => {
      onOpenChange(false)
      action()
    },
    [onOpenChange],
  )

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search SmartCloud"
      description="Jump to a project or a page, or switch the theme."
    >
      <CommandInput placeholder="Search projects and pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Go to">
          {PLATFORM_NAV.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
              onSelect={() => run(() => router.push(item.href))}
            >
              <item.icon />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {activeProject && (
          <>
            <CommandSeparator />
            <CommandGroup heading={activeProject.name}>
              {projectNav(activeProject.id).map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${activeProject.name} ${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => run(() => router.push(item.href))}
                >
                  <item.icon />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`project ${project.name}`}
                  onSelect={() =>
                    run(() => router.push(`/dashboard/projects/${project.id}`))
                  }
                >
                  <LayoutGrid />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem
            value="theme light mode"
            onSelect={() => run(() => setTheme('light'))}
          >
            <Sun />
            Light
          </CommandItem>
          <CommandItem
            value="theme dark mode"
            onSelect={() => run(() => setTheme('dark'))}
          >
            <Moon />
            Dark
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/**
 * The header affordance that opens the palette. Reads as a search field
 * on desktop (where there's room to advertise the shortcut) and collapses
 * to an icon button on phones.
 */
export function CommandPaletteTrigger({
  onOpen,
  className,
}: {
  onOpen: () => void
  className?: string
}) {
  return (
    <>
      <Button
        variant="outline"
        onClick={onOpen}
        className={cn(
          'hidden h-9 w-56 justify-start gap-2 px-3 text-muted-foreground font-normal md:inline-flex lg:w-72',
          className,
        )}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>⌘K</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpen}
        className="md:hidden"
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>
    </>
  )
}
