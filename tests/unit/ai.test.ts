import { describe, it, expect } from 'vitest'
import { aiEnabled, explainRisk, AiUnavailableError } from '@/lib/ai'

// These tests exercise the graceful-degradation path: with no LiteLLM proxy
// configured in the test env, the AI layer must fail cleanly rather than crash.
describe('AI layer guardrails', () => {
  it('reports disabled when no proxy key is configured', () => {
    // The test environment does not set LITELLM_MASTER_KEY.
    expect(aiEnabled()).toBe(false)
  })

  it('throws a typed AiUnavailableError (code=disabled) when disabled', async () => {
    if (aiEnabled()) return // skip if a real proxy is configured locally
    await expect(
      explainRisk({
        keyName: 'DATABASE_URL',
        assessment: {
          score: 80,
          level: 'HIGH',
          sample_size: 40,
          factors: [
            { label: 'Access frequency', points: 40, max: 40, detail: '40 reads' },
          ],
        },
      })
    ).rejects.toMatchObject({
      name: 'AiUnavailableError',
      code: 'disabled',
    })
  })

  it('AiUnavailableError carries a machine-readable code', () => {
    const e = new AiUnavailableError('nope', 'rate_limited')
    expect(e.code).toBe('rate_limited')
    expect(e).toBeInstanceOf(Error)
  })
})
