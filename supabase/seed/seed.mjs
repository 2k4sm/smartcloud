#!/usr/bin/env node
//
// SmartCloud demo seeder — populates every table the dashboard reads with
// realistic, self-consistent data for a single user.
//
//   node supabase/seed/seed.mjs --dry-run     # build + print, touch nothing
//   node supabase/seed/seed.mjs               # insert (refuses if data exists)
//   node supabase/seed/seed.mjs --reset       # delete this user's data, reseed
//
// What is seeded: projects, secrets (really encrypted), access_logs,
// risk_scores (really scored from those logs), key_pools + pool_keys +
// pool_rotations + pool_access_logs, cloud_providers + cloud_syncs,
// notification_channels, api_keys.
//
// What is NOT seeded, and why: project_members needs additional auth users
// (this seeds one user by design), and nothing here talks to AWS/Azure/GCP or
// any mail/webhook endpoint — provider credentials and sync history are
// plausible fakes, so "Test connection" and a live sync will fail against them.
// See README.md in this directory.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import {
  assessRisk,
  between,
  days,
  encrypt,
  generateApiKey,
  hashApiKey,
  hours,
  insertChunked,
  iso,
  makeRng,
  pick,
} from './lib.mjs'
import { API_KEYS, AI_SUMMARIES, OWNER_EMAIL, OWNER_NAME, PROJECTS } from './data.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.resolve(here, '../../.env'), quiet: true })

const DRY_RUN = process.argv.includes('--dry-run')
const RESET = process.argv.includes('--reset')

const WINDOW_DAYS = 14 // the report page charts a 14-day access timeline
const IST_OFFSET_MIN = 330 // risk scoring treats business hours as IST

const NOW = Date.now()
const rng = makeRng(20260815)

// ── Access-log generation ────────────────────────────────────────────

// UTC timestamp for a given local-IST hour on the day `dayIndex` days before now.
function atLocalHour(dayIndex, hour, minuteJitter) {
  const dayStart = Math.floor((NOW - days(dayIndex)) / days(1)) * days(1)
  return dayStart + hours(hour) - IST_OFFSET_MIN * 60_000 + minuteJitter * 60_000
}

function hourFor(offHours) {
  // Off-hours = outside 08:00–20:00 IST, which is what the scorer penalises.
  if (rng() < offHours) return pick(rng, [0, 1, 2, 3, 4, 5, 6, 21, 22, 23])
  return between(rng, 8, 19)
}

/**
 * Build a realistic access history for one secret or pool.
 * Returns rows ordered oldest → newest, all within [createdAt, now].
 */
function generateAccesses(profile, createdAtMs) {
  const {
    readsPerDay = 2,
    burst24h = 0,
    offHours = 0.15,
    ips = ['103.21.244.12'],
    writes = 0,
    newIpAtEnd = false,
  } = profile

  const rows = []
  const push = (ts, action, ip) => {
    if (ts < createdAtMs || ts > NOW) return
    rows.push({ action, ip_address: ip, accessed_at: iso(ts) })
  }

  // Baseline traffic across the reporting window. It starts a day EARLIER than
  // the window: off-hours accesses shift backwards when converted from IST, so
  // generating from day 13 would leave the chart's leftmost bar half-empty.
  for (let d = WINDOW_DAYS + 1; d >= 1; d--) {
    // Weekends are quieter — makes the timeline chart look like real traffic.
    const dow = new Date(NOW - days(d)).getUTCDay()
    const weekend = dow === 0 || dow === 6
    const count = Math.max(
      0,
      between(rng, readsPerDay - 1, readsPerDay + 2) - (weekend ? readsPerDay - 1 : 0)
    )
    for (let i = 0; i < count; i++) {
      push(atLocalHour(d, hourFor(offHours), between(rng, 0, 59)), 'READ', pick(rng, ips))
    }
  }

  // Last 24h: baseline + whatever burst this profile calls for. The frequency
  // rule only looks at this window, so `burst24h` is what moves a score to HIGH.
  const recentCount = between(rng, readsPerDay - 1, readsPerDay + 1) + burst24h
  for (let i = 0; i < recentCount; i++) {
    const ts = NOW - Math.floor(rng() * hours(23)) - hours(0.2)
    push(ts, 'READ', pick(rng, ips))
  }

  // A few writes, so the audit trail is not read-only.
  for (let i = 0; i < writes; i++) {
    const d = between(rng, 1, WINDOW_DAYS - 1)
    push(
      atLocalHour(d, between(rng, 10, 18), between(rng, 0, 59)),
      pick(rng, ['UPDATE', 'UPDATE', 'READ']),
      pick(rng, ips)
    )
  }

  // The creation event itself.
  push(createdAtMs + hours(0.05), 'CREATE', ips[0])

  rows.sort((a, b) => a.accessed_at.localeCompare(b.accessed_at))

  // A brand-new source as the most recent access — the scorer's "fresh source"
  // signal (+10) fires only when that IP appears exactly once in the window.
  if (newIpAtEnd) {
    rows.push({
      action: 'READ',
      ip_address: '196.240.54.201',
      accessed_at: iso(NOW - hours(0.1)),
    })
  }

  return rows
}

// Risk history: score the same logs at three points in time, newest last.
// The app's recompute endpoint does exactly this against the live table, so
// these rows are indistinguishable from ones it would have written.
function scoreHistory(logs) {
  const checkpoints = [NOW - days(6), NOW - days(3), NOW]
  return checkpoints.map((t, i) => {
    const a = assessRisk(logs, { now: new Date(t) })
    return {
      ...a,
      computed_at: iso(t),
      // Only the newest score carries an AI note (the UI shows the latest).
      ai_summary: i === checkpoints.length - 1 ? AI_SUMMARIES[a.level] : null,
    }
  })
}

// ── Build the whole dataset in memory (ids and all) ──────────────────

export function buildDataset(userId) {
  const out = {
    projects: [],
    secrets: [],
    access_logs: [],
    risk_scores: [],
    key_pools: [],
    pool_keys: [],
    pool_current: [], // { pool_id, current_key_id, last_rotated_at }
    pool_rotations: [],
    pool_access_logs: [],
    cloud_providers: [],
    cloud_syncs: [],
    notification_channels: [],
    api_keys: [],
    plaintextApiKeys: [],
    summary: [],
  }

  for (const p of PROJECTS) {
    const projectId = randomUUID()
    const projectCreated = NOW - days(p.createdDaysAgo)
    out.projects.push({
      id: projectId,
      user_id: userId,
      name: p.name,
      description: p.description,
      created_at: iso(projectCreated),
      updated_at: iso(NOW - days(between(rng, 1, 5))),
    })

    const secretIdByName = {}
    const levels = { LOW: 0, MEDIUM: 0, HIGH: 0 }

    for (const s of p.secrets) {
      const secretId = randomUUID()
      secretIdByName[s.key_name] = secretId
      const createdAt = NOW - days(s.createdDaysAgo)
      const enc = encrypt(s.value)

      out.secrets.push({
        id: secretId,
        project_id: projectId,
        user_id: userId,
        key_name: s.key_name,
        ...enc,
        description: s.description,
        created_at: iso(createdAt),
        updated_at: iso(Math.min(NOW, createdAt + days(between(rng, 0, 20)))),
      })

      const logs = generateAccesses(s.access ?? {}, createdAt)
      for (const l of logs) {
        out.access_logs.push({
          id: randomUUID(),
          secret_id: secretId,
          user_id: userId,
          project_id: projectId,
          key_name: s.key_name,
          action: l.action,
          ip_address: l.ip_address,
          accessed_at: l.accessed_at,
        })
      }

      const history = scoreHistory(logs)
      for (const h of history) {
        out.risk_scores.push({
          id: randomUUID(),
          secret_id: secretId,
          user_id: userId,
          project_id: projectId,
          score: h.score,
          level: h.level,
          factors: h.factors,
          sample_size: h.sample_size,
          ai_summary: h.ai_summary,
          window_start: h.window_start,
          window_end: h.window_end,
          computed_at: h.computed_at,
        })
      }
      levels[history[history.length - 1].level]++
    }

    // ── Key pools ──────────────────────────────────────────────────
    for (const pool of p.pools ?? []) {
      const poolId = randomUUID()
      const keyIds = pool.keys.map(() => randomUUID())
      const poolCreated = NOW - days(Math.max(...pool.keys.map((k) => k.createdDaysAgo)))

      out.key_pools.push({
        id: poolId,
        project_id: projectId,
        user_id: userId,
        name: pool.name,
        description: pool.description,
        rotation_interval_days: pool.rotation_interval_days,
        rotate_on_high_risk: pool.rotate_on_high_risk,
        risk_threshold: pool.risk_threshold,
        current_key_id: null, // set after pool_keys exist (FK)
        last_rotated_at: null,
        created_at: iso(poolCreated),
        updated_at: iso(NOW - days(pool.lastRotatedDaysAgo)),
      })

      pool.keys.forEach((k, i) => {
        const enc = encrypt(k.value)
        out.pool_keys.push({
          id: keyIds[i],
          pool_id: poolId,
          project_id: projectId,
          user_id: userId,
          label: k.label,
          ...enc,
          active: k.active,
          usage_count: k.usage_count,
          last_used_at: k.active ? iso(NOW - hours(between(rng, 1, 40))) : iso(NOW - days(between(rng, 20, 60))),
          created_at: iso(NOW - days(k.createdDaysAgo)),
        })
      })

      const currentIdx = pool.keys.findIndex((k) => k.current)
      out.pool_current.push({
        pool_id: poolId,
        current_key_id: keyIds[currentIdx === -1 ? 0 : currentIdx],
        last_rotated_at: iso(NOW - days(pool.lastRotatedDaysAgo)),
      })

      for (const r of pool.rotations ?? []) {
        out.pool_rotations.push({
          id: randomUUID(),
          pool_id: poolId,
          project_id: projectId,
          from_key_id: r.from === null || r.from === undefined ? null : keyIds[r.from],
          to_key_id: r.to === null || r.to === undefined ? null : keyIds[r.to],
          trigger: r.trigger,
          reason: r.reason,
          rotated_at: iso(NOW - days(r.daysAgo)),
        })
      }

      // Pool fetches feed the same risk engine as secret reads.
      const activeIds = keyIds.filter((_, i) => pool.keys[i].active)
      for (const l of generateAccesses(pool.access ?? {}, poolCreated)) {
        if (l.action !== 'READ') continue
        out.pool_access_logs.push({
          id: randomUUID(),
          pool_id: poolId,
          pool_key_id: pick(rng, activeIds),
          user_id: userId,
          project_id: projectId,
          action: 'READ',
          ip_address: l.ip_address,
          accessed_at: l.accessed_at,
        })
      }
    }

    // ── Cloud providers + sync history ─────────────────────────────
    for (const prov of p.providers ?? []) {
      const providerId = randomUUID()
      const enc = encrypt(JSON.stringify(prov.credentials))
      out.cloud_providers.push({
        id: providerId,
        user_id: userId,
        project_id: projectId,
        provider: prov.provider,
        name: prov.name,
        config: prov.config,
        encrypted_credentials: enc.encrypted_value,
        iv: enc.iv,
        auth_tag: enc.auth_tag,
        created_at: iso(NOW - days(between(rng, 30, 60))),
        updated_at: iso(NOW - days(between(rng, 1, 20))),
      })

      for (const sync of prov.syncs ?? []) {
        const secretId = secretIdByName[sync.secret]
        if (!secretId) continue
        out.cloud_syncs.push({
          id: randomUUID(),
          provider_id: providerId,
          secret_id: secretId,
          project_id: projectId,
          status: sync.status,
          remote_id:
            sync.status === 'success'
              ? remoteId(prov, sync.secret, sync.remoteSuffix)
              : null,
          detail: sync.detail ?? null,
          synced_at: iso(NOW - days(sync.daysAgo)),
        })
      }
    }

    // ── Notification channels ──────────────────────────────────────
    for (const c of p.channels ?? []) {
      out.notification_channels.push({
        id: randomUUID(),
        user_id: userId,
        project_id: projectId,
        type: c.type,
        target: c.target,
        events: c.events,
        secret: c.secret ?? null,
        active: c.active,
        created_at: iso(NOW - days(c.createdDaysAgo)),
      })
    }

    out.summary.push({ project: p.name, secrets: p.secrets.length, ...levels })
  }

  // ── API keys (plaintext shown once, exactly like the real flow) ────
  for (const k of API_KEYS) {
    const plaintext = generateApiKey()
    out.api_keys.push({
      id: randomUUID(),
      user_id: userId,
      name: k.name,
      key_hash: hashApiKey(plaintext),
      key_prefix: plaintext.substring(0, 16),
      last_used_at: k.lastUsedDaysAgo === null ? null : iso(NOW - days(k.lastUsedDaysAgo)),
      created_at: iso(NOW - days(k.createdDaysAgo)),
    })
    out.plaintextApiKeys.push({ name: k.name, key: plaintext })
  }

  return out
}

// Provider-shaped remote identifiers, matching what each SDK returns on upsert.
function remoteId(prov, keyName, suffix) {
  if (prov.provider === 'aws') {
    return `arn:aws:secretsmanager:${prov.config.region}:123456789012:secret:${keyName}-${suffix}`
  }
  if (prov.provider === 'azure') {
    const vault = prov.config.vaultUrl.replace(/\/$/, '')
    return `${vault}/secrets/${keyName.replace(/_/g, '-')}/${suffix}${'0'.repeat(26)}`
  }
  return `projects/${prov.config.projectId}/secrets/${keyName}/versions/${suffix}`
}

// ── Database side ────────────────────────────────────────────────────

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env). ' +
        'The seeder writes access_logs / risk_scores, which are service-role-only by RLS.'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function findUser(service, email) {
  // No admin "get by email", so page through until we hit it.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function ensureUser(service) {
  const existing = await findUser(service, OWNER_EMAIL)
  if (existing) {
    console.log(`✓ user ${OWNER_EMAIL} → ${existing.id}`)
    return { user: existing, password: null }
  }

  const password = process.env.SEED_USER_PASSWORD ?? 'SmartCloud!Demo2026'
  const { data, error } = await service.auth.admin.createUser({
    email: OWNER_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { name: OWNER_NAME, full_name: OWNER_NAME },
  })
  if (error) throw new Error(`createUser failed: ${error.message}`)
  console.log(`✓ created user ${OWNER_EMAIL} → ${data.user.id}`)
  return { user: data.user, password }
}

async function wipe(service, userId) {
  // projects cascade to secrets, logs, risk scores, pools, providers, channels.
  const { error: pErr } = await service.from('projects').delete().eq('user_id', userId)
  if (pErr) throw new Error(`wipe projects failed: ${pErr.message}`)
  const { error: kErr } = await service.from('api_keys').delete().eq('user_id', userId)
  if (kErr) throw new Error(`wipe api_keys failed: ${kErr.message}`)
  console.log('✓ cleared existing projects and API keys for this user')
}

async function insertAll(service, d) {
  const step = async (table, rows) => {
    if (!rows.length) return
    await insertChunked(service, table, rows)
    console.log(`  ${String(rows.length).padStart(5)}  ${table}`)
  }

  console.log('\nInserting:')
  await step('projects', d.projects)
  await step('secrets', d.secrets)
  await step('access_logs', d.access_logs)
  await step('risk_scores', d.risk_scores)
  await step('key_pools', d.key_pools)
  await step('pool_keys', d.pool_keys)

  // current_key_id is a FK onto pool_keys, so it is set only now.
  for (const c of d.pool_current) {
    const { error } = await service
      .from('key_pools')
      .update({ current_key_id: c.current_key_id, last_rotated_at: c.last_rotated_at })
      .eq('id', c.pool_id)
    if (error) throw new Error(`set current key failed: ${error.message}`)
  }
  if (d.pool_current.length) console.log(`  ${String(d.pool_current.length).padStart(5)}  key_pools.current_key_id`)

  await step('pool_rotations', d.pool_rotations)
  await step('pool_access_logs', d.pool_access_logs)
  await step('cloud_providers', d.cloud_providers)
  await step('cloud_syncs', d.cloud_syncs)
  await step('notification_channels', d.notification_channels)
  await step('api_keys', d.api_keys)
}

function printSummary(d) {
  console.log('\nRisk mix (latest score per secret):')
  for (const s of d.summary) {
    console.log(
      `  ${s.project.padEnd(30)} ${String(s.secrets).padStart(2)} secrets` +
        `   LOW ${s.LOW}  MEDIUM ${s.MEDIUM}  HIGH ${s.HIGH}`
    )
  }
}

async function main() {
  console.log(`SmartCloud seed — ${OWNER_NAME} <${OWNER_EMAIL}>`)

  if (DRY_RUN) {
    const d = buildDataset('00000000-0000-0000-0000-000000000000')
    console.log('\n(dry run — nothing written)')
    console.log(
      `\nRows: projects ${d.projects.length}, secrets ${d.secrets.length}, ` +
        `access_logs ${d.access_logs.length}, risk_scores ${d.risk_scores.length}, ` +
        `key_pools ${d.key_pools.length}, pool_keys ${d.pool_keys.length}, ` +
        `pool_rotations ${d.pool_rotations.length}, pool_access_logs ${d.pool_access_logs.length}, ` +
        `cloud_providers ${d.cloud_providers.length}, cloud_syncs ${d.cloud_syncs.length}, ` +
        `channels ${d.notification_channels.length}, api_keys ${d.api_keys.length}`
    )
    printSummary(d)
    return
  }

  const service = serviceClient()
  const { user, password } = await ensureUser(service)

  const { count } = await service
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count && !RESET) {
    console.error(
      `\n✗ ${user.email} already has ${count} project(s).\n` +
        '  Re-run with --reset to delete them (and everything under them) and reseed.'
    )
    process.exitCode = 1
    return
  }
  if (RESET) await wipe(service, user.id)

  const d = buildDataset(user.id)
  await insertAll(service, d)
  printSummary(d)

  console.log('\nAPI keys (plaintext is shown once — copy now if you need it):')
  for (const k of d.plaintextApiKeys) console.log(`  ${k.name.padEnd(36)} ${k.key}`)
  if (password) console.log(`\nLogin password for ${OWNER_EMAIL}: ${password}`)

  console.log('\nDone. Open /dashboard and sign in as', OWNER_EMAIL)
}

// Only seed when run as a script — importing this file (e.g. to inspect the
// generated dataset) must not touch the database.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('\n✗', err.message)
    process.exitCode = 1
  })
}
