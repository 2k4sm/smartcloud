import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The one page header. Title + optional description on the left, an
 * actions slot on the right, and an optional "back" link above both.
 *
 * The title wraps rather than truncating — a project called
 * `payments-service-production` used to lose its distinguishing tail on
 * a phone — and the actions row wraps under the title on narrow screens
 * instead of squeezing the heading into a sliver.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  backHref?: string
  backLabel?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" />
          {backLabel ?? 'Back'}
        </Link>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="text-xl font-semibold break-words sm:text-2xl">
            {title}
          </h1>
          {description && (
            <div className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </div>
          )}
        </div>

        {children && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
