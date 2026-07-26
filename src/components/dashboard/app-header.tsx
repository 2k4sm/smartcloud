'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  CommandPalette,
  CommandPaletteTrigger,
} from '@/components/dashboard/command-palette'
import type { ProjectSummary } from '@/components/dashboard/nav-config'

interface Crumb {
  label: string
  href?: string
}

const SECTION_LABELS: Record<string, string> = {
  'api-keys': 'API keys',
  pools: 'Key pools',
  members: 'Team',
  providers: 'Cloud',
  notifications: 'Notifications',
  report: 'Report',
  secrets: 'Secret',
}

/**
 * Builds the trail from the URL. Ids are never shown — a project resolves
 * to its name, and a trailing id (a pool or a secret) is folded into its
 * section label, since the page's own header already names the record.
 */
function buildCrumbs(pathname: string, projects: ProjectSummary[]): Crumb[] {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'dashboard') return []

  const crumbs: Crumb[] = [{ label: 'Projects', href: '/dashboard' }]

  if (parts.length === 1) return [{ label: 'Projects' }]

  if (parts[1] !== 'projects') {
    crumbs.push({ label: SECTION_LABELS[parts[1]] ?? parts[1] })
    return crumbs
  }

  const projectId = parts[2]
  if (!projectId) return crumbs

  const project = projects.find((p) => p.id === projectId)
  const projectHref = `/dashboard/projects/${projectId}`
  const section = parts[3]

  crumbs.push({
    label: project?.name ?? 'Project',
    href: section ? projectHref : undefined,
  })

  if (section) {
    const label = SECTION_LABELS[section] ?? section
    // A detail id below a section (…/pools/:id) keeps the section as a link.
    if (parts[4]) {
      crumbs.push({ label, href: `${projectHref}/${section}` })
      crumbs.push({ label: 'Detail' })
    } else {
      crumbs.push({ label })
    }
  }

  return crumbs
}

export function AppHeader({ projects }: { projects: ProjectSummary[] }) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const crumbs = buildCrumbs(pathname, projects)
  const lastIndex = crumbs.length - 1

  return (
    <>
      <header
        data-app-header
        className="chrome-blur sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4"
      >
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />

        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, i) => (
              <React.Fragment key={`${crumb.label}-${i}`}>
                {i > 0 && (
                  // Intermediate levels collapse on phones; the current
                  // page always stays visible.
                  <BreadcrumbSeparator
                    className={i < lastIndex ? 'hidden sm:block' : ''}
                  />
                )}
                <BreadcrumbItem
                  className={cnCrumb(i, lastIndex)}
                >
                  {i === lastIndex || !crumb.href ? (
                    <BreadcrumbPage className="truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href} className="truncate">
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
          <ThemeToggle />
        </div>
      </header>

      <CommandPalette
        projects={projects}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </>
  )
}

function cnCrumb(index: number, lastIndex: number) {
  return index < lastIndex ? 'hidden min-w-0 sm:flex' : 'min-w-0'
}
