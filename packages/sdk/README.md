# smartcloud-sdk

TypeScript SDK for SmartCloud Secrets Manager. Zero runtime dependencies — uses native `fetch` (Node 18+).

## Installation

```bash
npm install smartcloud-sdk
```

## Usage

### With access token (recommended for CI/CD)

```typescript
import { SmartCloudClient } from 'smartcloud-sdk'

const client = new SmartCloudClient({
  baseUrl: 'https://your-smartcloud-instance.com',
  accessToken: process.env.SMARTCLOUD_TOKEN,
})

// Fetch a single secret
const dbPassword = await client.getSecret('project-id', 'DB_PASSWORD')

// Fetch all secrets as key-value map
const secrets = await client.getSecrets('project-id')
// { DB_PASSWORD: "...", API_KEY: "...", ... }

// List projects
const projects = await client.listProjects()
```

### With email/password (auto-login)

```typescript
const client = new SmartCloudClient({
  baseUrl: 'https://your-smartcloud-instance.com',
  email: 'user@example.com',
  password: 'your-password',
})

// Automatically logs in on first API call
const secret = await client.getSecret('project-id', 'API_KEY')
```

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `getSecret(projectId, keyName)` | `string` | Fetch a single secret's plaintext value |
| `getSecretWithMetadata(projectId, keyName)` | `SecretValue` | Fetch a secret with full metadata |
| `getSecrets(projectId)` | `Record<string, string>` | Fetch all secrets as a key-value map |
| `listProjects()` | `Project[]` | List all projects for the authenticated user |
| `login()` | `string` | Manually trigger login (returns access token) |

## Error Handling

```typescript
import { SecretNotFoundError, AuthenticationError } from 'smartcloud-sdk'

try {
  await client.getSecret('project-id', 'MISSING_KEY')
} catch (err) {
  if (err instanceof SecretNotFoundError) {
    console.log('Secret does not exist')
  } else if (err instanceof AuthenticationError) {
    console.log('Invalid credentials or expired token')
  }
}
```
