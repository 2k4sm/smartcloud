import { SecretClient } from '@azure/keyvault-secrets'
import { ClientSecretCredential } from '@azure/identity'
import type {
  CloudProviderAdapter,
  CloudSyncResult,
  AzureConfig,
  AzureCredentials,
} from './types'

// Azure Key Vault adapter. Vault secret names allow only [0-9a-zA-Z-], so
// SmartCloud's underscore-style key names are normalized to dashes.
export class AzureKeyVaultAdapter implements CloudProviderAdapter {
  readonly kind = 'azure' as const
  private client: SecretClient

  constructor(config: AzureConfig, credentials: AzureCredentials) {
    const credential = new ClientSecretCredential(
      credentials.tenantId,
      credentials.clientId,
      credentials.clientSecret
    )
    this.client = new SecretClient(config.vaultUrl, credential)
  }

  private normalize(name: string): string {
    return name.replace(/[^0-9a-zA-Z-]/g, '-')
  }

  async upsertSecret(name: string, value: string): Promise<CloudSyncResult> {
    const secret = await this.client.setSecret(this.normalize(name), value)
    return { remoteId: secret.properties.id ?? this.normalize(name) }
  }

  async getSecret(name: string): Promise<string> {
    const secret = await this.client.getSecret(this.normalize(name))
    return secret.value ?? ''
  }

  async deleteSecret(name: string): Promise<void> {
    const poller = await this.client.beginDeleteSecret(this.normalize(name))
    await poller.pollUntilDone()
  }
}
