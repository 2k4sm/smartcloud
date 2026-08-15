import { describe, it, expect } from 'vitest'
import {
  validateConfig,
  validateCredentials,
  validateProviderPayload,
} from '@/lib/cloud/validate'

const AWS_CREDS = { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'shh' }
const GCP_CREDS = {
  clientEmail: 'svc@my-project.iam.gserviceaccount.com',
  privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
}

describe('validateConfig', () => {
  it('accepts a well-formed config for each provider', () => {
    expect(validateConfig('aws', { region: 'us-east-1' })).toBeNull()
    expect(
      validateConfig('azure', { vaultUrl: 'https://my-vault.vault.azure.net' })
    ).toBeNull()
    expect(validateConfig('gcp', { projectId: 'my-project' })).toBeNull()
  })

  it('rejects a config missing a required field', () => {
    expect(validateConfig('aws', {})).toMatch(/region/)
    expect(validateConfig('azure', {})).toMatch(/vaultUrl/)
  })

  it('rejects fields belonging to a different provider', () => {
    // The real mistake this catches: pasting AWS details into an Azure
    // connection. Previously this stored fine and only blew up at sync time.
    expect(validateConfig('azure', { region: 'us-east-1' })).toMatch(/vaultUrl/)
  })

  it('rejects a malformed vault URL', () => {
    expect(validateConfig('azure', { vaultUrl: 'my-vault' })).toMatch(/vault\.azure\.net/)
    expect(
      validateConfig('azure', { vaultUrl: 'http://my-vault.vault.azure.net' })
    ).toMatch(/vault\.azure\.net/)
  })

  it('rejects a malformed AWS region', () => {
    expect(validateConfig('aws', { region: 'useast1' })).toMatch(/region/)
    expect(validateConfig('aws', { region: 'ap-south-1' })).toBeNull()
  })

  it('rejects a non-object config', () => {
    expect(validateConfig('aws', null)).toMatch(/object/)
    expect(validateConfig('aws', ['us-east-1'])).toMatch(/object/)
  })
})

describe('validateCredentials', () => {
  it('accepts well-formed credentials', () => {
    expect(validateCredentials('aws', AWS_CREDS)).toBeNull()
    expect(validateCredentials('gcp', GCP_CREDS)).toBeNull()
    expect(
      validateCredentials('azure', { tenantId: 't', clientId: 'c', clientSecret: 's' })
    ).toBeNull()
  })

  it('names the missing fields without echoing any value', () => {
    const err = validateCredentials('aws', { accessKeyId: 'AKIA' })
    expect(err).toMatch(/secretAccessKey/)
    expect(err).not.toMatch(/AKIA/)
  })

  it('rejects a blank credential rather than storing it', () => {
    expect(validateCredentials('aws', { accessKeyId: 'AKIA', secretAccessKey: '  ' })).toMatch(
      /secretAccessKey/
    )
  })

  it('rejects a GCP private key that is not PEM', () => {
    expect(
      validateCredentials('gcp', { ...GCP_CREDS, privateKey: 'not-a-key' })
    ).toMatch(/PEM/)
  })

  it('rejects a GCP client email that is not an email', () => {
    expect(validateCredentials('gcp', { ...GCP_CREDS, clientEmail: 'nope' })).toMatch(
      /email/
    )
  })
})

describe('validateProviderPayload', () => {
  it('validates both halves together', () => {
    expect(
      validateProviderPayload('aws', { region: 'us-east-1' }, AWS_CREDS)
    ).toBeNull()
  })

  it('skips whichever half is absent (PATCH updates one at a time)', () => {
    expect(validateProviderPayload('aws', undefined, AWS_CREDS)).toBeNull()
    expect(
      validateProviderPayload('aws', { region: 'us-east-1' }, undefined)
    ).toBeNull()
  })
})
