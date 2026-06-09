import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/encryption'

export type RotationTrigger = 'manual' | 'scheduled' | 'risk'
export type RotationStrategy = 'random'

export interface RotationResult {
  secret_id: string
  key_name: string
  status: 'success' | 'failed'
  trigger: RotationTrigger
  strategy: RotationStrategy
  detail: string | null
  rotated_at: string | null
  // Only returned to the immediate caller of a manual rotation — never stored.
  new_value?: string
}

/** Generate a fresh, high-entropy secret value (url-safe). */
export function generateSecretValue(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

// The subset of the secrets row rotation needs.
export interface RotatableSecret {
  id: string
  key_name: string
  project_id: string
  user_id: string
}

// Rotate a single secret: regenerate its value, re-encrypt, persist, and record
// a rotation_jobs row (+ an UPDATE access log). Uses a service-role client so it
// works from both request handlers and the cron endpoint. Never throws — the
// outcome (including failure) is captured in the returned RotationResult and the
// rotation_jobs table.
export async function rotateSecret(
  service: SupabaseClient,
  secret: RotatableSecret,
  opts: { trigger: RotationTrigger; strategy?: RotationStrategy; ip?: string }
): Promise<RotationResult> {
  const strategy: RotationStrategy = opts.strategy ?? 'random'
  const now = new Date().toISOString()

  try {
    const newValue = generateSecretValue()
    const payload = encrypt(newValue)

    const { error: updateError } = await service
      .from('secrets')
      .update({
        encrypted_value: payload.encrypted_value,
        iv: payload.iv,
        auth_tag: payload.auth_tag,
        last_rotated_at: now,
        updated_at: now,
      })
      .eq('id', secret.id)

    if (updateError) throw new Error(updateError.message)

    await service.from('rotation_jobs').insert({
      secret_id: secret.id,
      user_id: secret.user_id,
      project_id: secret.project_id,
      status: 'success',
      trigger: opts.trigger,
      strategy,
      rotated_at: now,
    })

    await service.from('access_logs').insert({
      secret_id: secret.id,
      user_id: secret.user_id,
      project_id: secret.project_id,
      key_name: secret.key_name,
      action: 'UPDATE',
      ip_address: opts.ip ?? 'rotation',
    })

    return {
      secret_id: secret.id,
      key_name: secret.key_name,
      status: 'success',
      trigger: opts.trigger,
      strategy,
      detail: null,
      rotated_at: now,
      new_value: newValue,
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    await service.from('rotation_jobs').insert({
      secret_id: secret.id,
      user_id: secret.user_id,
      project_id: secret.project_id,
      status: 'failed',
      trigger: opts.trigger,
      strategy,
      detail,
    })
    return {
      secret_id: secret.id,
      key_name: secret.key_name,
      status: 'failed',
      trigger: opts.trigger,
      strategy,
      detail,
      rotated_at: null,
    }
  }
}
