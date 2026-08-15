import { SecretClient } from '@azure/keyvault-secrets'
import { ClientSecretCredential } from '@azure/identity'
import type {
  CloudProviderAdapter,
  CloudSyncResult,
  AzureConfig,
  AzureCredentials,
} from './types'
import { toRemoteName, AZURE_NAME_RULES } from './names'

// Azure Key Vault adapter. Vault secret names allow only [0-9a-zA-Z-], so
// SmartCloud's underscore-style key names are mapped by `toRemoteName`, which
// also disambiguates the mapping (MY_KEY and MY-KEY must not collide).
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

  remoteName(name: string): string {
    return toRemoteName(name, AZURE_NAME_RULES)
  }

  async upsertSecret(name: string, value: string): Promise<CloudSyncResult> {
    const id = this.remoteName(name)
    const secret = await this.client.setSecret(id, value)
    return { remoteId: secret.properties.id ?? id }
  }

  async getSecret(name: string): Promise<string> {
    const secret = await this.client.getSecret(this.remoteName(name))
    return secret.value ?? ''
  }

  async deleteSecret(name: string): Promise<void> {
    try {
      const poller = await this.client.beginDeleteSecret(this.remoteName(name))
      await poller.pollUntilDone()
    } catch (err) {
      // Already absent is the desired end state, not a failure.
      if ((err as { statusCode?: number })?.statusCode !== 404) throw err
    }
  }

  // Pull a single page of the secret listing: proves the tenant/client/secret
  // triple authenticates and that the vault URL is reachable, without writing.
  async testConnection(): Promise<void> {
    const page = this.client
      .listPropertiesOfSecrets()
      .byPage({ maxPageSize: 1 })
    await page.next()
  }
}
