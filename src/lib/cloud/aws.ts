import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  GetSecretValueCommand,
  DeleteSecretCommand,
} from '@aws-sdk/client-secrets-manager'
import type {
  CloudProviderAdapter,
  CloudSyncResult,
  AwsConfig,
  AwsCredentials,
} from './types'

// AWS Secrets Manager adapter. Secret names accept [A-Za-z0-9/_+=.@-].
export class AwsSecretsAdapter implements CloudProviderAdapter {
  readonly kind = 'aws' as const
  private client: SecretsManagerClient

  constructor(config: AwsConfig, credentials: AwsCredentials) {
    this.client = new SecretsManagerClient({
      region: config.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    })
  }

  async upsertSecret(name: string, value: string): Promise<CloudSyncResult> {
    try {
      const res = await this.client.send(
        new CreateSecretCommand({ Name: name, SecretString: value })
      )
      return { remoteId: res.ARN ?? name }
    } catch (err) {
      // Name-based check (not `instanceof`) so it survives duplicate SDK copies
      // that can appear in a bundled server build.
      if ((err as { name?: string })?.name === 'ResourceExistsException') {
        const res = await this.client.send(
          new PutSecretValueCommand({ SecretId: name, SecretString: value })
        )
        return { remoteId: res.ARN ?? name }
      }
      throw err
    }
  }

  async getSecret(name: string): Promise<string> {
    const res = await this.client.send(
      new GetSecretValueCommand({ SecretId: name })
    )
    return res.SecretString ?? ''
  }

  async deleteSecret(name: string): Promise<void> {
    await this.client.send(
      new DeleteSecretCommand({
        SecretId: name,
        ForceDeleteWithoutRecovery: true,
      })
    )
  }
}
