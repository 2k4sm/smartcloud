import { AwsSecretsAdapter } from './aws'
import { AzureKeyVaultAdapter } from './azure'
import { GcpSecretManagerAdapter } from './gcp'
import type {
  CloudProviderAdapter,
  ProviderKind,
  ProviderConfig,
  ProviderCredentials,
  AwsConfig,
  AwsCredentials,
  AzureConfig,
  AzureCredentials,
  GcpConfig,
  GcpCredentials,
} from './types'

export * from './types'

// Factory: build the right adapter for a provider from its stored config +
// decrypted credentials. Keeps provider-specific casts in one place so the rest
// of the app talks only to the CloudProviderAdapter interface.
export function createAdapter(
  kind: ProviderKind,
  config: ProviderConfig,
  credentials: ProviderCredentials
): CloudProviderAdapter {
  switch (kind) {
    case 'aws':
      return new AwsSecretsAdapter(
        config as AwsConfig,
        credentials as AwsCredentials
      )
    case 'azure':
      return new AzureKeyVaultAdapter(
        config as AzureConfig,
        credentials as AzureCredentials
      )
    case 'gcp':
      return new GcpSecretManagerAdapter(
        config as GcpConfig,
        credentials as GcpCredentials
      )
    default:
      throw new Error(`Unsupported provider: ${kind}`)
  }
}
