// Key-pool selection & rotation policy (pure, DB-agnostic, testable).
//
// A pool holds several real, interchangeable keys. One is "current" and served
// on fetch. Rotation switches `current` to the LEAST-USED active key so load
// spreads across the pool and we move off an over-used/suspicious key. All keys
// stay valid, so rotation never breaks a consumer — it just prefers a different
// working key.

export interface PoolKeyInfo {
  id: string
  active: boolean
  usage_count: number
  created_at: string // ISO; tiebreak for equal usage
}

// Least-used active key, excluding `currentId`. Ties broken by oldest created.
// Falls back to the current key (if still active), then any active key, else null.
export function selectNextActiveKey(
  keys: PoolKeyInfo[],
  currentId: string | null
): string | null {
  const byUsageThenAge = (a: PoolKeyInfo, b: PoolKeyInfo) =>
    a.usage_count - b.usage_count ||
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

  const others = keys.filter((k) => k.active && k.id !== currentId)
  if (others.length > 0) return [...others].sort(byUsageThenAge)[0].id

  // No alternative active key: keep current if still active, else any active.
  if (currentId && keys.some((k) => k.id === currentId && k.active)) return currentId
  const anyActive = keys.filter((k) => k.active).sort(byUsageThenAge)[0]
  return anyActive?.id ?? null
}

export interface RotationPolicy {
  rotation_interval_days: number | null
  last_rotated_at: string | null
  rotate_on_high_risk: boolean
  risk_threshold: number
}

// Is a scheduled rotation due? (interval set and elapsed since last rotation)
export function isScheduleDue(policy: RotationPolicy, now: Date): boolean {
  if (!policy.rotation_interval_days || policy.rotation_interval_days <= 0) return false
  if (!policy.last_rotated_at) return true // never rotated → due
  const next =
    new Date(policy.last_rotated_at).getTime() +
    policy.rotation_interval_days * 86_400_000
  return now.getTime() >= next
}

// Should the pool rotate now given its policy + current risk score?
export function shouldRotate(
  policy: RotationPolicy,
  riskScore: number | null,
  now: Date
): { rotate: boolean; trigger: 'scheduled' | 'risk' | null } {
  if (policy.rotate_on_high_risk && riskScore !== null && riskScore >= policy.risk_threshold) {
    return { rotate: true, trigger: 'risk' }
  }
  if (isScheduleDue(policy, now)) return { rotate: true, trigger: 'scheduled' }
  return { rotate: false, trigger: null }
}
