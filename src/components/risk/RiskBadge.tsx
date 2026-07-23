import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/lib/risk'

// Colors are tuned to read correctly in both light and dark themes.
const STYLES: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  HIGH: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
}

const LABELS: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export default function RiskBadge({
  level,
  score,
  size = 'sm',
}: {
  level: RiskLevel
  score?: number
  size?: 'sm' | 'md'
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 rounded-full font-medium',
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]',
        STYLES[level],
      )}
      title={score !== undefined ? `Risk score: ${score}/100` : undefined}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {LABELS[level]}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </Badge>
  )
}
