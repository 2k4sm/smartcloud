import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  GetSecretValueCommand,
  DeleteSecretCommand,
  RestoreSecretCommand,
  ListSecretsCommand,
} from '@aws-sdk/client-secrets-manager'
import type {
  CloudProviderAdapter,
  CloudSyncResult,
  AwsConfig,
  AwsCredentials,
} from './types'
import { toRemoteName, AWS_NAME_RULES } from './names'

// Errors are matched by `name` rather than `instanceof`: a bundled server build
// can end up with duplicate copies of the SDK, and `instanceof` fails across
// them while the error's `name` stays stable.
function errName(err: unknown): string {
  return (err as { name?: string })?.name ?? ''
}

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

  remoteName(name: string): string {
    return toRemoteName(name, AWS_NAME_RULES)
  }

  async upsertSecret(name: string, value: string): Promise<CloudSyncResult> {
    const id = this.remoteName(name)
    try {
      const res = await this.client.send(
        new CreateSecretCommand({ Name: id, SecretString: value })
      )
      return { remoteId: res.ARN ?? id }
    } catch (err) {
      if (errName(err) !== 'ResourceExistsException') throw err
      return { remoteId: await this.putValue(id, value) }
    }
  }

  // Write a new value onto an existing secret. A secret that is pending
  // deletion rejects PutSecretValue with InvalidRequestException and stays
  // unwritable for the whole recovery window (up to 30 days), so restore it
  // first — otherwise re-adding a previously deleted key is broken for a month.
  private async putValue(id: string, value: string): Promise<string> {
    try {
      const res = await this.client.send(
        new PutSecretValueCommand({ SecretId: id, SecretString: value })
      )
      return res.ARN ?? id
    } catch (err) {
      if (errName(err) !== 'InvalidRequestException') throw err
      await this.client.send(new RestoreSecretCommand({ SecretId: id }))
      const res = await this.client.send(
        new PutSecretValueCommand({ SecretId: id, SecretString: value })
      )
      return res.ARN ?? id
    }
  }

  async getSecret(name: string): Promise<string> {
    const res = await this.client.send(
      new GetSecretValueCommand({ SecretId: this.remoteName(name) })
    )
    return res.SecretString ?? ''
  }

  async deleteSecret(name: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteSecretCommand({
          SecretId: this.remoteName(name),
          ForceDeleteWithoutRecovery: true,
        })
      )
    } catch (err) {
      // Already gone is the desired end state, not a failure.
      if (errName(err) !== 'ResourceNotFoundException') throw err
    }
  }

  // Cheapest call that exercises credentials, region and IAM policy without
  // creating anything.
  async testConnection(): Promise<void> {
    await this.client.send(new ListSecretsCommand({ MaxResults: 1 }))
  }
}
