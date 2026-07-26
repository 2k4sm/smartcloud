import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

export type StatTone = 'default' | 'success' | 'warning' | 'danger'

const TONE_ICON: Record<StatTone, string> = {
  default: 'bg-brand-subtle text-brand',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
}

const TONE_VALUE: Record<StatTone, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

/**
 * A single KPI tile: icon chip, value, label. One component so every
 * stat row in the app shares a baseline, and so the tone (a high-risk
 * count turning red, say) is a token choice rather than ad-hoc classes.
 *
 * The value is the headline, so it takes proportional figures; only
 * columns that must align vertically use tabular-nums.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  tone?: StatTone
  hint?: string
  className?: string
}) {
  return (
    <Card className={cn('gap-0 p-4 sm:p-5', className)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            TONE_ICON[tone],
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              'text-2xl leading-none font-semibold',
              TONE_VALUE[tone],
            )}
          >
            {value}
          </div>
          <div className="mt-1.5 truncate text-xs text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
      {hint && (
        <p className="mt-3 text-xs text-muted-foreground/80">{hint}</p>
      )}
    </Card>
  )
}

/**
 * Responsive wrapper for a row of StatCards. Phones get a single
 * column (two hard-to-read columns was the old behaviour), tablets
 * two, desktops the natural count.
 */
export function StatGrid({
  children,
  columns = 3,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4',
        columns === 3 && 'lg:grid-cols-3',
        columns === 4 && 'lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
