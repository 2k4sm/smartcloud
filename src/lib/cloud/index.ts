import { AwsSecretsAdapter } from './aws'
import type {
  CloudProviderAdapter,
  ProviderKind,
  ProviderConfig,
  ProviderCredentials,
  AwsConfig,
  AwsCredentials,
} from './types'

export * from './types'

// Factory: build the right adapter for a provider from its stored config +
// decrypted credentials. (AWS today; Azure/GCP added in the W7 refactor.)
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
    default:
      throw new Error(`Provider not yet supported: ${kind}`)
  }
}
