import {
  Bell,
  Boxes,
  Cloud,
  FileBarChart,
  KeyRound,
  KeySquare,
  LayoutGrid,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavEntry {
  href: string
  label: string
  icon: LucideIcon
  /** Only mark active on an exact path match (section landing pages). */
  exact?: boolean
  /** Extra keywords so the command palette finds it by intent. */
  keywords?: string[]
}

/** Workspace-level navigation, always visible. */
export const PLATFORM_NAV: NavEntry[] = [
  {
    href: '/dashboard',
    label: 'Projects',
    icon: LayoutGrid,
    exact: true,
    keywords: ['home', 'workspace', 'overview'],
  },
  {
    href: '/dashboard/api-keys',
    label: 'API keys',
    icon: KeySquare,
    keywords: ['token', 'sdk', 'cli', 'programmatic'],
  },
]

/** Navigation within a single project. */
export function projectNav(projectId: string): NavEntry[] {
  const base = `/dashboard/projects/${projectId}`
  return [
    {
      href: base,
      label: 'Secrets',
      icon: KeyRound,
      exact: true,
      keywords: ['env', 'variables', 'values'],
    },
    {
      href: `${base}/pools`,
      label: 'Key pools',
      icon: Boxes,
      keywords: ['rotation', 'rotate', 'interchangeable'],
    },
    {
      href: `${base}/members`,
      label: 'Team',
      icon: Users,
      keywords: ['members', 'access', 'roles', 'invite'],
    },
    {
      href: `${base}/providers`,
      label: 'Cloud',
      icon: Cloud,
      keywords: ['aws', 'azure', 'gcp', 'sync'],
    },
    {
      href: `${base}/notifications`,
      label: 'Notifications',
      icon: Bell,
      keywords: ['alerts', 'webhook', 'email', 'channel'],
    },
    {
      href: `${base}/report`,
      label: 'Report',
      icon: FileBarChart,
      keywords: ['security', 'audit', 'export', 'csv'],
    },
  ]
}

/** The project id in the current path, or null outside a project. */
export function projectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/projects\/([^/]+)/)
  return match && match[1] !== 'new' ? match[1] : null
}

export interface ProjectSummary {
  id: string
  name: string
}
