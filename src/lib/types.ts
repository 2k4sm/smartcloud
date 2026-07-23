export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Secret {
  id: string
  project_id: string
  user_id: string
  key_name: string
  encrypted_value: string
  iv: string
  auth_tag: string
  description: string | null
  created_at: string
  updated_at: string
}

// Returned to clients — never includes encrypted fields
export interface SecretMetadata {
  id: string
  project_id: string
  key_name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface AccessLog {
  id: string
  secret_id: string
  user_id: string
  project_id: string
  key_name: string
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE'
  ip_address: string | null
  accessed_at: string
}

// API request/response shapes
export interface CreateSecretRequest {
  project_id: string
  key_name: string
  value: string
  description?: string
}

export interface UpdateSecretRequest {
  value?: string
  description?: string
}

export interface FetchSecretRequest {
  project_id: string
  key_name: string
}

export interface FetchSecretResponse {
  key_name: string
  value: string
  project_id: string
  secret_id: string
  fetched_at: string
}

export interface FetchAllSecretsRequest {
  project_id: string
}

export interface FetchAllSecretsResponse {
  secrets: { key_name: string; value: string }[]
  project_id: string
  fetched_at: string
}

export interface ApiError {
  error: string
}

// ── RBAC ─────────────────────────────────────────────────────────────
export type ProjectRole = 'owner' | 'admin' | 'viewer'

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
  invited_by: string | null
  created_at: string
  email?: string // resolved server-side for display
}

// ── Notifications (see src/lib/notify.ts) ───────────────────────────
export interface NotificationChannel {
  id: string
  project_id: string
  type: 'email' | 'webhook'
  target: string
  events: string[]
  active: boolean
  created_at: string
}

// ── Multi-cloud (see src/lib/cloud) ─────────────────────────────────
export interface CloudProviderSummary {
  id: string
  project_id: string
  provider: 'aws' | 'azure' | 'gcp'
  name: string
  config: Record<string, string>
  created_at: string
  updated_at: string
}

export interface CloudSync {
  id: string
  provider_id: string
  secret_id: string
  project_id: string
  status: 'success' | 'failed'
  remote_id: string | null
  detail: string | null
  synced_at: string
}

// ── Key pools (see src/lib/pool.ts) ─────────────────────────────────
export interface KeyPool {
  id: string
  project_id: string
  name: string
  description: string | null
  rotation_interval_days: number | null
  rotate_on_high_risk: boolean
  risk_threshold: number
  current_key_id: string | null
  last_rotated_at: string | null
  created_at: string
  updated_at: string
}

// Pool key metadata — the encrypted value is NEVER returned to the client.
export interface PoolKeyMeta {
  id: string
  pool_id: string
  label: string | null
  active: boolean
  usage_count: number
  last_used_at: string | null
  created_at: string
  is_current?: boolean
}

export interface PoolRotation {
  id: string
  pool_id: string
  from_key_id: string | null
  to_key_id: string | null
  trigger: 'manual' | 'scheduled' | 'risk'
  reason: string | null
  rotated_at: string
}

// ── Risk scoring (see src/lib/risk.ts) ──────────────────────────────
export interface RiskScore {
  id: string
  secret_id: string
  user_id: string
  project_id: string
  score: number
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  factors: {
    key: string
    label: string
    points: number
    max: number
    detail: string
  }[]
  sample_size: number
  ai_summary: string | null
  window_start: string | null
  window_end: string | null
  computed_at: string
}
