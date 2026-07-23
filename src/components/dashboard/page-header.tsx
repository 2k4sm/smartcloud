import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Consistent page/section header: a title + optional description on the left,
 * and an actions slot (buttons, dialogs) on the right. Keeps every screen
 * aligned on the same baseline and spacing.
 */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  )
}
