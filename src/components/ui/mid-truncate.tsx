import { cn } from '@/lib/utils'

/**
 * Middle ellipsis. The start truncates with "…" while the last `tailChars`
 * characters stay pinned and visible — ideal for UUIDs, API tokens, and keys
 * where the tail is the distinctive part. Pure CSS/flex, so it adapts to the
 * available width and always fits its container (never overflows or scrolls).
 *
 * e.g. "8c57f3c1-…-e22cce3d"  → head ellipsizes, "e22cce3d" always shown.
 */
export function MidTruncate({
  text,
  tailChars = 6,
  className,
}: {
  text: string
  tailChars?: number
  className?: string
}) {
  const value = text ?? ''
  if (value.length <= tailChars + 1) {
    return (
      <span className={cn('truncate', className)} title={value}>
        {value}
      </span>
    )
  }
  const head = value.slice(0, -tailChars)
  const tail = value.slice(-tailChars)
  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center align-bottom', className)}
      title={value}
    >
      <span className="truncate">{head}</span>
      <span className="shrink-0">{tail}</span>
    </span>
  )
}
