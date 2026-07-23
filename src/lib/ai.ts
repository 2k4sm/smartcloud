import { createHash } from 'crypto'
import type { RiskLevel, RiskLogEntry } from '@/lib/risk'

// AI layer — talks to a LiteLLM proxy over its OpenAI-compatible API.
// Gemini (free tier) sits behind the proxy; see litellm/config.yaml.
//
// Design goals:
//  - Graceful degradation: if the proxy isn't configured, aiEnabled() is false
//    and callers return a friendly "AI disabled" response instead of crashing.
//  - Cost guardrails: per-process rate limit + bounded max_tokens.
//  - Caching: identical prompts are served from an in-memory TTL cache (on top
//    of the proxy's own cache) so repeated dashboard clicks don't burn quota.

const BASE_URL = process.env.LITELLM_BASE_URL ?? 'http://localhost:4000'
const MASTER_KEY = process.env.LITELLM_MASTER_KEY ?? ''
// Full LiteLLM model string incl. provider prefix (the proxy is a gemini/*
// wildcard gateway, so we request the Gemini model directly).
const MODEL = process.env.LITELLM_MODEL ?? 'gemini/gemini-3.5-flash-lite'
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS ?? 300)
const MAX_CALLS_PER_MIN = Number(process.env.AI_MAX_CALLS_PER_MIN ?? 30)
const CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS ?? 3_600_000)

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    public code: 'disabled' | 'rate_limited' | 'upstream' = 'upstream'
  ) {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

/** True when a LiteLLM proxy + master key are configured. */
export function aiEnabled(): boolean {
  return Boolean(MASTER_KEY)
}

// ── in-memory guardrails (per server process) ────────────────────────
const callTimestamps: number[] = []
const cache = new Map<string, { value: string; expires: number }>()

function checkRateLimit() {
  const now = Date.now()
  const windowStart = now - 60_000
  while (callTimestamps.length && callTimestamps[0] < windowStart) {
    callTimestamps.shift()
  }
  if (callTimestamps.length >= MAX_CALLS_PER_MIN) {
    throw new AiUnavailableError(
      'AI rate limit reached, try again shortly',
      'rate_limited'
    )
  }
  callTimestamps.push(now)
}

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

async function chat(messages: ChatMessage[]): Promise<string> {
  if (!aiEnabled()) {
    throw new AiUnavailableError('AI is not configured', 'disabled')
  }

  const cacheKey = createHash('sha256')
    .update(MODEL + JSON.stringify(messages))
    .digest('hex')
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) return hit.value

  checkRateLimit()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MASTER_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        // Note: `temperature`/`top_p`/`top_k` are deprecated for Gemini 3+ and
        // slated for removal — determinism guidance lives in SYSTEM_PROMPT instead.
      }),
      signal: controller.signal,
    })
  } catch (err) {
    throw new AiUnavailableError(
      `Could not reach the AI proxy: ${err instanceof Error ? err.message : String(err)}`,
      'upstream'
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    // Surface upstream quota/rate limits as rate_limited so clients can back off.
    const code = res.status === 429 ? 'rate_limited' : 'upstream'
    throw new AiUnavailableError(`AI proxy error (${res.status}): ${detail}`, code)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new AiUnavailableError('AI returned an empty response', 'upstream')

  // Bounded cache: evict oldest entries so long-lived processes don't grow forever.
  if (cache.size >= 500) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(cacheKey, { value: content, expires: Date.now() + CACHE_TTL_MS })
  return content
}

// ── domain prompts ───────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are a cloud security analyst for a secrets manager. Explain access risk ' +
  'concisely for a developer audience. Be specific and actionable. Never invent ' +
  'data beyond what you are given. Reply in 2-4 short sentences, no markdown. ' +
  'Answer deterministically and consistently — prefer the most likely, precise ' +
  'wording rather than creative variation.'

/** Plain-English explanation of a single secret's rule-based risk score. */
export async function explainRisk(input: {
  keyName: string
  assessment: {
    score: number
    level: RiskLevel
    sample_size: number
    factors: { label: string; points: number; max: number; detail: string }[]
  }
}): Promise<string> {
  const { keyName, assessment } = input
  const factorLines = assessment.factors
    .map((f) => `- ${f.label}: ${f.points}/${f.max} (${f.detail})`)
    .join('\n')
  const prompt =
    `Secret "${keyName}" scored ${assessment.score}/100 (${assessment.level}) ` +
    `from ${assessment.sample_size} access log(s).\nRule breakdown:\n${factorLines}\n\n` +
    `Explain what is driving this risk level and what the developer should do.`
  return chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ])
}

/** Summary of notable anomalies across a project's recent access logs. */
export async function summarizeAnomalies(input: {
  projectName: string
  logs: RiskLogEntry[]
}): Promise<string> {
  const { projectName, logs } = input
  const sample = logs.slice(0, 100)
  const compact = sample
    .map((l) => `${l.accessed_at} ${l.action} ${l.ip_address ?? 'unknown'}`)
    .join('\n')
  const prompt =
    `Project "${projectName}" recent access logs (up to 100 rows):\n${compact}\n\n` +
    `Identify any suspicious patterns (spikes, off-hours access, new IPs, bursts). ` +
    `If nothing stands out, say so plainly.`
  return chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ])
}
