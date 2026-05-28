import type { RiskLevel } from '@/lib/risk'

const STYLES: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  MEDIUM: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  HIGH: 'bg-rose-400/10 text-rose-300 border-rose-400/20',
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
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${pad} ${STYLES[level]}`}
      title={score !== undefined ? `Risk score: ${score}/100` : undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {LABELS[level]}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </span>
  )
}
