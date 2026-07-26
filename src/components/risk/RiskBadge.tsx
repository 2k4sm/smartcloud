import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/lib/risk'

/**
 * Risk level styling, driven entirely by the risk tokens so a level
 * can never drift between screens.
 *
 * Red and green are indistinguishable to deuteranopic readers, so the
 * level is *always* carried by an icon and a word as well as the hue —
 * colour is the third channel here, never the only one.
 */
export const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: 'bg-success-bg text-success border-success-border',
  MEDIUM: 'bg-warning-bg text-warning border-warning-border',
  HIGH: 'bg-danger-bg text-danger border-danger-border',
}

export const RISK_ICONS: Record<RiskLevel, typeof ShieldCheck> = {
  LOW: ShieldCheck,
  MEDIUM: ShieldAlert,
  HIGH: ShieldX,
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

export default function RiskBadge({
  level,
  score,
  size = 'sm',
  className,
}: {
  level: RiskLevel
  score?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const Icon = RISK_ICONS[level]

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 rounded-full font-medium',
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]',
        RISK_STYLES[level],
        className,
      )}
      title={
        score !== undefined
          ? `${RISK_LABELS[level]} risk — score ${score}/100`
          : `${RISK_LABELS[level]} risk`
      }
    >
      <Icon className="size-3" aria-hidden />
      {RISK_LABELS[level]}
      {score !== undefined && (
        <span className="tabular-nums opacity-70">{score}</span>
      )}
      <span className="sr-only">risk</span>
    </Badge>
  )
}
