import { describe, it, expect } from 'vitest'
import {
  toRemoteName,
  AWS_NAME_RULES,
  AZURE_NAME_RULES,
  GCP_NAME_RULES,
} from '@/lib/cloud/names'

describe('toRemoteName', () => {
  it('passes an already-legal name through untouched', () => {
    // SmartCloud's A-Z0-9_ convention is legal on AWS and GCP, so those names
    // stay readable in the provider console.
    expect(toRemoteName('OPENAI_API_KEY', AWS_NAME_RULES)).toBe('OPENAI_API_KEY')
    expect(toRemoteName('OPENAI_API_KEY', GCP_NAME_RULES)).toBe('OPENAI_API_KEY')
  })

  it('is deterministic — the same input always maps to the same output', () => {
    const a = toRemoteName('MY_KEY', AZURE_NAME_RULES)
    const b = toRemoteName('MY_KEY', AZURE_NAME_RULES)
    expect(a).toBe(b)
  })

  it('never maps two different names onto the same remote name', () => {
    // The regression this guards: a naive `_ -> -` replace maps both of these
    // to "MY-KEY" on Azure, so syncing the second silently overwrites the
    // first — two distinct credentials collapsing into one.
    const underscore = toRemoteName('MY_KEY', AZURE_NAME_RULES)
    const dash = toRemoteName('MY-KEY', AZURE_NAME_RULES)
    expect(underscore).not.toBe(dash)
    expect(dash).toBe('MY-KEY') // legal already, so untouched
    expect(underscore).toMatch(/^MY-KEY-[0-9a-f]{8}$/)
  })

  it('produces only provider-legal characters', () => {
    const messy = 'my key/with spaces!@#'
    expect(toRemoteName(messy, AZURE_NAME_RULES)).toMatch(/^[0-9a-zA-Z-]+$/)
    expect(toRemoteName(messy, GCP_NAME_RULES)).toMatch(/^[a-zA-Z0-9_-]+$/)
    expect(toRemoteName(messy, AWS_NAME_RULES)).toMatch(/^[A-Za-z0-9/_+=.@-]+$/)
  })

  it('truncates over-long names but keeps them distinct', () => {
    const base = 'A'.repeat(200)
    const one = toRemoteName(`${base}1`, AZURE_NAME_RULES)
    const two = toRemoteName(`${base}2`, AZURE_NAME_RULES)
    expect(one.length).toBeLessThanOrEqual(127)
    expect(two.length).toBeLessThanOrEqual(127)
    expect(one).not.toBe(two)
  })

  it('rejects an empty name rather than sending one to the provider', () => {
    expect(() => toRemoteName('   ', AZURE_NAME_RULES)).toThrow(/empty/i)
  })

  it('rejects a name that cannot fit the provider limit at all', () => {
    const impossible = { ...AZURE_NAME_RULES, maxLength: 4 }
    expect(() => toRemoteName('my key with spaces', impossible)).toThrow(/max 4/)
  })
})
