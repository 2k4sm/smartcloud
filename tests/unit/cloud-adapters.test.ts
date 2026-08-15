import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── AWS SDK mock ─────────────────────────────────────────────────────
// Commands are recorded as { type, input } so assertions can check which call
// the adapter made and with what, without a live AWS account.
const awsSend = vi.fn()
vi.mock('@aws-sdk/client-secrets-manager', () => {
  const cmd = (type: string) =>
    class {
      type = type
      constructor(public input: Record<string, unknown>) {}
    }
  return {
    SecretsManagerClient: class {
      send = awsSend
    },
    CreateSecretCommand: cmd('Create'),
    PutSecretValueCommand: cmd('Put'),
    GetSecretValueCommand: cmd('Get'),
    DeleteSecretCommand: cmd('Delete'),
    RestoreSecretCommand: cmd('Restore'),
    ListSecretsCommand: cmd('List'),
  }
})

// ── Azure SDK mock ───────────────────────────────────────────────────
const azSetSecret = vi.fn()
const azGetSecret = vi.fn()
const azBeginDelete = vi.fn()
const azListPages = vi.fn()
vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: class {
    setSecret = azSetSecret
    getSecret = azGetSecret
    beginDeleteSecret = azBeginDelete
    listPropertiesOfSecrets = () => ({ byPage: () => ({ next: azListPages }) })
  },
}))
vi.mock('@azure/identity', () => ({
  ClientSecretCredential: class {},
}))

// ── GCP SDK mock ─────────────────────────────────────────────────────
const gcpCreateSecret = vi.fn()
const gcpAddVersion = vi.fn()
const gcpAccessVersion = vi.fn()
const gcpDeleteSecret = vi.fn()
const gcpListSecrets = vi.fn()
vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: class {
    createSecret = gcpCreateSecret
    addSecretVersion = gcpAddVersion
    accessSecretVersion = gcpAccessVersion
    deleteSecret = gcpDeleteSecret
    listSecrets = gcpListSecrets
  },
}))

import { AwsSecretsAdapter } from '@/lib/cloud/aws'
import { AzureKeyVaultAdapter } from '@/lib/cloud/azure'
import { GcpSecretManagerAdapter } from '@/lib/cloud/gcp'
import { status as grpcStatus } from '@grpc/grpc-js'

function awsError(name: string) {
  const err = new Error(name)
  err.name = name
  return err
}

function grpcError(code: number) {
  return Object.assign(new Error(`grpc ${code}`), { code })
}

beforeEach(() => vi.clearAllMocks())

describe('AwsSecretsAdapter', () => {
  const adapter = () =>
    new AwsSecretsAdapter(
      { region: 'us-east-1' },
      { accessKeyId: 'AKIA', secretAccessKey: 'shh' }
    )

  it('creates a secret that does not exist yet', async () => {
    awsSend.mockResolvedValueOnce({ ARN: 'arn:aws:secret:MY_KEY' })
    const res = await adapter().upsertSecret('MY_KEY', 'v1')

    expect(awsSend.mock.calls[0][0].type).toBe('Create')
    expect(awsSend.mock.calls[0][0].input).toMatchObject({
      Name: 'MY_KEY',
      SecretString: 'v1',
    })
    expect(res.remoteId).toBe('arn:aws:secret:MY_KEY')
  })

  it('falls back to writing a new value when the secret already exists', async () => {
    awsSend.mockRejectedValueOnce(awsError('ResourceExistsException'))
    awsSend.mockResolvedValueOnce({ ARN: 'arn:v2' })

    const res = await adapter().upsertSecret('MY_KEY', 'v2')

    expect(awsSend.mock.calls[1][0].type).toBe('Put')
    expect(res.remoteId).toBe('arn:v2')
  })

  it('restores a secret pending deletion before writing to it', async () => {
    // A secret scheduled for deletion rejects PutSecretValue and stays
    // unwritable for the whole recovery window (up to 30 days), so re-adding a
    // previously deleted key would otherwise be broken for a month.
    awsSend.mockRejectedValueOnce(awsError('ResourceExistsException'))
    awsSend.mockRejectedValueOnce(awsError('InvalidRequestException'))
    awsSend.mockResolvedValueOnce({}) // Restore
    awsSend.mockResolvedValueOnce({ ARN: 'arn:restored' })

    const res = await adapter().upsertSecret('MY_KEY', 'v3')

    expect(awsSend.mock.calls.map((c) => c[0].type)).toEqual([
      'Create',
      'Put',
      'Restore',
      'Put',
    ])
    expect(res.remoteId).toBe('arn:restored')
  })

  it('propagates an unexpected create error instead of masking it', async () => {
    awsSend.mockRejectedValueOnce(awsError('AccessDeniedException'))
    await expect(adapter().upsertSecret('MY_KEY', 'v')).rejects.toThrow(
      'AccessDeniedException'
    )
  })

  it('treats deleting an already-absent secret as success', async () => {
    awsSend.mockRejectedValueOnce(awsError('ResourceNotFoundException'))
    await expect(adapter().deleteSecret('GONE')).resolves.toBeUndefined()
  })

  it('tests the connection with a list call that writes nothing', async () => {
    awsSend.mockResolvedValueOnce({ SecretList: [] })
    await adapter().testConnection()
    expect(awsSend.mock.calls[0][0].type).toBe('List')
  })

  it('surfaces a failed connection test as a throw', async () => {
    awsSend.mockRejectedValueOnce(awsError('UnrecognizedClientException'))
    await expect(adapter().testConnection()).rejects.toThrow(
      'UnrecognizedClientException'
    )
  })
})

describe('AzureKeyVaultAdapter', () => {
  const adapter = () =>
    new AzureKeyVaultAdapter(
      { vaultUrl: 'https://v.vault.azure.net' },
      { tenantId: 't', clientId: 'c', clientSecret: 's' }
    )

  it('maps an underscore name to a legal, collision-free vault name', async () => {
    azSetSecret.mockResolvedValue({ properties: { id: 'https://v/secrets/x' } })
    await adapter().upsertSecret('MY_KEY', 'v1')

    const [name, value] = azSetSecret.mock.calls[0]
    expect(name).toMatch(/^[0-9a-zA-Z-]+$/)
    expect(name).not.toBe('MY-KEY') // disambiguated away from the literal MY-KEY
    expect(value).toBe('v1')
  })

  it('uses the identical remote name for read, write and delete', async () => {
    azSetSecret.mockResolvedValue({ properties: { id: 'id' } })
    azGetSecret.mockResolvedValue({ value: 'v' })
    azBeginDelete.mockResolvedValue({ pollUntilDone: vi.fn().mockResolvedValue({}) })

    const a = adapter()
    await a.upsertSecret('MY_KEY', 'v')
    await a.getSecret('MY_KEY')
    await a.deleteSecret('MY_KEY')

    expect(azGetSecret.mock.calls[0][0]).toBe(azSetSecret.mock.calls[0][0])
    expect(azBeginDelete.mock.calls[0][0]).toBe(azSetSecret.mock.calls[0][0])
  })

  it('treats deleting an already-absent secret as success', async () => {
    azBeginDelete.mockRejectedValueOnce(Object.assign(new Error('nope'), { statusCode: 404 }))
    await expect(adapter().deleteSecret('GONE')).resolves.toBeUndefined()
  })

  it('propagates a non-404 delete failure', async () => {
    azBeginDelete.mockRejectedValueOnce(Object.assign(new Error('denied'), { statusCode: 403 }))
    await expect(adapter().deleteSecret('X')).rejects.toThrow('denied')
  })

  it('tests the connection by pulling one page of the listing', async () => {
    azListPages.mockResolvedValueOnce({ done: true })
    await adapter().testConnection()
    expect(azListPages).toHaveBeenCalled()
  })
})

describe('GcpSecretManagerAdapter', () => {
  const adapter = () =>
    new GcpSecretManagerAdapter(
      { projectId: 'proj' },
      {
        clientEmail: 'svc@proj.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
      }
    )

  it('creates the container then adds a version', async () => {
    gcpCreateSecret.mockResolvedValueOnce([{}])
    gcpAddVersion.mockResolvedValueOnce([{ name: 'projects/proj/secrets/MY_KEY/versions/1' }])

    const res = await adapter().upsertSecret('MY_KEY', 'v1')

    expect(gcpCreateSecret.mock.calls[0][0]).toMatchObject({
      parent: 'projects/proj',
      secretId: 'MY_KEY',
      secret: { replication: { automatic: {} } },
    })
    expect(res.remoteId).toBe('projects/proj/secrets/MY_KEY/versions/1')
  })

  it('adds a version when the container already exists', async () => {
    gcpCreateSecret.mockRejectedValueOnce(grpcError(grpcStatus.ALREADY_EXISTS))
    gcpAddVersion.mockResolvedValueOnce([{ name: 'versions/2' }])

    const res = await adapter().upsertSecret('MY_KEY', 'v2')
    expect(res.remoteId).toBe('versions/2')
  })

  it('propagates a create failure that is not ALREADY_EXISTS', async () => {
    gcpCreateSecret.mockRejectedValueOnce(grpcError(grpcStatus.PERMISSION_DENIED))
    await expect(adapter().upsertSecret('MY_KEY', 'v')).rejects.toThrow()
    expect(gcpAddVersion).not.toHaveBeenCalled()
  })

  it('decodes the payload on read', async () => {
    gcpAccessVersion.mockResolvedValueOnce([{ payload: { data: Buffer.from('secret-v') } }])
    await expect(adapter().getSecret('MY_KEY')).resolves.toBe('secret-v')
  })

  it('treats deleting an already-absent secret as success', async () => {
    gcpDeleteSecret.mockRejectedValueOnce(grpcError(grpcStatus.NOT_FOUND))
    await expect(adapter().deleteSecret('GONE')).resolves.toBeUndefined()
  })

  it('tests the connection with a one-item list', async () => {
    gcpListSecrets.mockResolvedValueOnce([[]])
    await adapter().testConnection()
    expect(gcpListSecrets.mock.calls[0][0]).toMatchObject({
      parent: 'projects/proj',
      pageSize: 1,
    })
  })
})
