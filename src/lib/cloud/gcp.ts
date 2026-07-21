import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { status as grpcStatus } from '@grpc/grpc-js'
import type {
  CloudProviderAdapter,
  CloudSyncResult,
  GcpConfig,
  GcpCredentials,
} from './types'

// GCP Secret Manager adapter. A "secret" is a container; each write adds a new
// version. Secret ids allow [a-zA-Z0-9_-].
export class GcpSecretManagerAdapter implements CloudProviderAdapter {
  readonly kind = 'gcp' as const
  private client: SecretManagerServiceClient
  private projectId: string

  constructor(config: GcpConfig, credentials: GcpCredentials) {
    this.projectId = config.projectId
    this.client = new SecretManagerServiceClient({
      projectId: config.projectId,
      credentials: {
        client_email: credentials.clientEmail,
        // Support keys pasted with escaped newlines.
        private_key: credentials.privateKey.replace(/\\n/g, '\n'),
      },
    })
  }

  private normalize(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  async upsertSecret(name: string, value: string): Promise<CloudSyncResult> {
    const secretId = this.normalize(name)
    const parent = `projects/${this.projectId}`
    // Ensure the secret container exists (ignore AlreadyExists).
    try {
      await this.client.createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } },
      })
    } catch (err) {
      // Re-throw anything that isn't "secret container already exists".
      if ((err as { code?: number }).code !== grpcStatus.ALREADY_EXISTS) throw err
    }
    const [version] = await this.client.addSecretVersion({
      parent: `${parent}/secrets/${secretId}`,
      payload: { data: Buffer.from(value, 'utf8') },
    })
    return { remoteId: version.name ?? secretId }
  }

  async getSecret(name: string): Promise<string> {
    const [res] = await this.client.accessSecretVersion({
      name: `projects/${this.projectId}/secrets/${this.normalize(name)}/versions/latest`,
    })
    const data = res.payload?.data
    return data ? Buffer.from(data).toString('utf8') : ''
  }

  async deleteSecret(name: string): Promise<void> {
    await this.client.deleteSecret({
      name: `projects/${this.projectId}/secrets/${this.normalize(name)}`,
    })
  }
}
