# SmartCloud Secrets Manager

A full-stack secrets management platform with AES-256-GCM encryption, role-based access, audit logging, and programmatic access via SDK and CLI.

Built with Next.js 16, React 19, Supabase (PostgreSQL + Auth + RLS), and TypeScript.

## Features

- **AES-256-GCM Encryption** — Secrets are encrypted server-side before storage. Plaintext is never persisted; encrypted bytes are never sent to the client.
- **Per-Project Secrets** — Organize secrets into projects (e.g., `production-api`, `staging-backend`).
- **AI-Based Risk Analysis** — A rule-based scorer (frequency, off-hours, unfamiliar IPs) grades each secret Low/Medium/High, with a plain-English explanation from Google Gemini via a LiteLLM proxy.
- **Secret Rotation** — Manual, scheduled (Vercel Cron), and risk-driven auto-rotation with re-encryption and full history.
- **Multi-Cloud Sync** — Push secrets out to AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager through one unified adapter interface.
- **RBAC** — Share projects with teammates as owner / admin / viewer, enforced by Supabase RLS.
- **Notifications** — Webhook (HMAC-signed) and email channels for rotation and high-risk events.
- **Reports** — Per-project CSV/print (PDF) security report with an access-activity timeline.
- **Dashboard UI** — Glassmorphism dark-mode UI for managing projects, secrets, risk, rotation, cloud, team, and API keys.
- **Row-Level Security** — Supabase RLS ensures users only access projects they own or are a member of.
- **Audit Logging** — Every secret read/write is logged with user, IP, and timestamp.
- **API Keys** — Generate long-lived `sc_live_*` tokens for programmatic access (SHA-256 hashed, shown once).
- **TypeScript SDK** — Zero-dependency SDK (`@smartcloud/sdk`) for fetching secrets from any Node.js/Next.js project.
- **CLI Tool** — `@smartcloud/cli` for terminal-based secret access, `env` injection, and process wrapping.
- **Three Auth Methods** — Cookie sessions (browser), Supabase JWT (Bearer token), and custom API keys.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Dashboard UI)                                         │
│  React 19 + Tailwind CSS 4 + Glassmorphism                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Cookie session / JWT
┌───────────────────────────▼─────────────────────────────────────┐
│  Next.js 16 App Router (API Routes)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ /auth/*  │  │/projects │  │/secrets  │  │ /api-keys      │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                 │
│  resolveAuth() ── Cookie | JWT | API Key (sc_live_*)            │
│  encrypt()/decrypt() ── AES-256-GCM (Node.js crypto)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Service Role / RLS
┌───────────────────────────▼─────────────────────────────────────┐
│  Supabase                                                       │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ auth.*   │  │ projects │  │ secrets     │  │ api_keys   │  │
│  │ (users)  │  │ (RLS)    │  │ (encrypted) │  │ (hashed)   │  │
│  └──────────┘  └──────────┘  └─────────────┘  └────────────┘  │
│  ┌──────────────┐                                               │
│  │ access_logs  │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│  @smartcloud/sdk     │  │  @smartcloud/cli      │
│  TypeScript SDK      │  │  CLI (Commander)      │
│  Zero dependencies   │  │  Uses SDK internally  │
│  Bearer token auth   │  │  env inject, run      │
└──────────────────────┘  └──────────────────────┘
```

## Project Structure

```
smartcloud/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Auth pages (login, signup, change-password)
│   │   ├── dashboard/           # Dashboard pages (projects, secrets, API keys)
│   │   ├── api/                 # API routes
│   │   │   ├── auth/            # login, signup, logout, change-password
│   │   │   ├── projects/        # CRUD for projects
│   │   │   ├── secrets/         # CRUD + fetch + fetch-all
│   │   │   ├── api-keys/        # Generate/revoke API keys
│   │   │   └── health/          # Health check
│   │   ├── globals.css          # Glassmorphism design system
│   │   └── layout.tsx           # Root layout
│   ├── components/
│   │   ├── dashboard/Sidebar.tsx
│   │   └── secrets/SecretsTable.tsx
│   ├── lib/
│   │   ├── auth.ts              # resolveAuth() — cookie, JWT, API key
│   │   ├── encryption.ts        # AES-256-GCM encrypt/decrypt
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── supabase/
│   │       ├── client.ts        # Browser client
│   │       ├── server.ts        # Server client + token client
│   │       └── service.ts       # Service role client (bypasses RLS)
│   └── proxy.ts                 # Auth middleware (session refresh, route protection)
├── packages/
│   ├── sdk/                     # @smartcloud/sdk — TypeScript SDK
│   └── cli/                     # @smartcloud/cli — CLI tool
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_api_keys.sql
└── tests/
    ├── unit/                    # Encryption unit tests
    └── integration/             # API route integration tests
```

## Getting Started

### Prerequisites

- Node.js >= 18
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone <repo-url>
cd smartcloud
npm install
```

### 2. Set up Supabase

Run every migration file in `supabase/migrations/` in order (001 → 007) in the
Supabase SQL Editor:

1. `001_initial_schema.sql` — `projects`, `secrets`, `access_logs` + RLS
2. `002_api_keys.sql` — `api_keys` table + RLS
3. `003_risk_scores.sql` — risk scoring history
4. `004_rbac.sql` — `project_members`, role-aware RLS
5. `005_rotation.sql` — `rotation_jobs` + auto-rotate columns
6. `006_cloud_providers.sql` — cloud providers + sync history
7. `007_risk_rotation_notifications.sql` — high-risk rotation flag + notification channels

### 3. Configure environment

Create a `.env` file:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENCRYPTION_MASTER_KEY=your-64-char-hex-key
```

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### 5. Build SDK and CLI

```bash
cd packages/sdk && npm run build
cd ../cli && npm run build
```

## API Reference

All endpoints accept/return JSON. Authentication via `Authorization: Bearer <token>` header (JWT or API key) or cookie session.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create a new account |
| POST | `/api/auth/login` | Sign in, returns session with `access_token` |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/change-password` | Update password |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects for the authenticated user |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/:id` | Get project details |
| PUT | `/api/projects/:id` | Update project name/description |
| DELETE | `/api/projects/:id` | Delete project and all its secrets |

### Secrets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/secrets` | Create a new encrypted secret |
| GET | `/api/secrets/:id` | Get secret metadata (no value) |
| PUT | `/api/secrets/:id` | Update secret value or description |
| DELETE | `/api/secrets/:id` | Delete a secret |
| POST | `/api/secrets/fetch` | Fetch and decrypt a single secret by key name |
| POST | `/api/secrets/fetch-all` | Fetch and decrypt all secrets for a project |

**`POST /api/secrets/fetch`** — Request body:
```json
{ "project_id": "uuid", "key_name": "DATABASE_URL" }
```

**`POST /api/secrets/fetch-all`** — Request body:
```json
{ "project_id": "uuid" }
```

### API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/api-keys` | List all API keys (prefix only) |
| POST | `/api/api-keys` | Generate a new API key (plaintext shown once) |
| DELETE | `/api/api-keys/:id` | Revoke an API key |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (`{ status: "ok", timestamp }`) |

## SDK Usage

Install the SDK in your project:

```bash
npm install @smartcloud/sdk
```

Or install from local path during development:

```bash
npm install ../../smartcloud/packages/sdk
```

### Configuration

Add to your project's `.env`:

```env
SMARTCLOUD_URL=http://localhost:3000
SMARTCLOUD_TOKEN=sc_live_your_api_key_here
SMARTCLOUD_PROJECT=your-project-uuid
```

### Fetch all secrets

```typescript
import { SmartCloudClient } from '@smartcloud/sdk'

const client = new SmartCloudClient({
  baseUrl: process.env.SMARTCLOUD_URL!,
  accessToken: process.env.SMARTCLOUD_TOKEN!,
})

// Returns Record<string, string>
const secrets = await client.getSecrets(process.env.SMARTCLOUD_PROJECT!)
console.log(secrets.DATABASE_URL)
```

### Fetch a single secret

```typescript
const value = await client.getSecret(projectId, 'DATABASE_URL')
```

### Fetch with metadata

```typescript
const secret = await client.getSecretWithMetadata(projectId, 'DATABASE_URL')
// { key_name, value, project_id, secret_id, fetched_at }
```

### List projects

```typescript
const projects = await client.listProjects()
```

### Email/password authentication

```typescript
const client = new SmartCloudClient({
  baseUrl: process.env.SMARTCLOUD_URL!,
  email: 'user@example.com',
  password: 'password',
})

// login() is called automatically on first request, or manually:
await client.login()
```

## CLI Usage

Build and link the CLI:

```bash
cd packages/cli
npm run build
npm link
```

### Commands

```bash
# Configure base URL
smartcloud config --base-url http://localhost:3000

# Login (stores JWT in ~/.smartcloud/auth.json)
smartcloud login -e user@example.com

# List projects
smartcloud projects

# Fetch a single secret
smartcloud get-secret -p <project-id> -k DATABASE_URL

# Dump all secrets as .env format
smartcloud env -p <project-id>

# Run a command with secrets injected as env vars
smartcloud run -p <project-id> -- node server.js
```

## Multi-Cloud Sync

Connect a project to AWS, Azure, or GCP (Dashboard → project → **Cloud**) and
push SmartCloud secrets out to the provider's secret store. Credentials are
encrypted with the AES-256-GCM master key before storage and are never returned
to the browser.

### AWS Secrets Manager

Create an IAM user (or role) with `secretsmanager:CreateSecret`,
`PutSecretValue`, `GetSecretValue`, and `DeleteSecret`. Connect with:

- **Region** (e.g. `us-east-1`)
- **Access Key ID** / **Secret Access Key**

### Azure Key Vault

Register an app (service principal) and grant it the *Key Vault Secrets Officer*
role on the vault. Connect with:

- **Vault URL** (`https://<vault>.vault.azure.net`)
- **Tenant ID** / **Client ID** / **Client Secret**

### GCP Secret Manager

Create a service account with the *Secret Manager Admin* role and download a
JSON key. Connect with:

- **Project ID**
- **Service Account Email** / **Private Key** (the `private_key` field)

## Database Schema

### projects
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner (references auth.users) |
| name | TEXT | Project name |
| description | TEXT | Optional description |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

### secrets
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Parent project |
| user_id | UUID | Owner |
| key_name | TEXT | Unique within project, auto-uppercased |
| encrypted_value | TEXT | Base64 AES-256-GCM ciphertext |
| iv | TEXT | Base64, 12-byte random initialization vector |
| auth_tag | TEXT | Base64, 16-byte GCM authentication tag |
| description | TEXT | Optional description |

### api_keys
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Owner |
| name | TEXT | User-friendly label |
| key_hash | TEXT | SHA-256 hash of the plaintext key |
| key_prefix | TEXT | First 16 chars for identification |
| last_used_at | TIMESTAMPTZ | Updated on each API call |

### access_logs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| secret_id | UUID | Which secret was accessed |
| user_id | UUID | Who accessed it |
| project_id | UUID | Project context |
| key_name | TEXT | Secret key name |
| action | TEXT | READ, CREATE, UPDATE, or DELETE |
| ip_address | TEXT | Client IP |
| accessed_at | TIMESTAMPTZ | Timestamp |

## Security

- **Encryption**: AES-256-GCM with 12-byte random IV per encryption. Authentication tag prevents tamper detection. Master key stored as environment variable, never in database.
- **API Keys**: Plaintext shown once at creation. Stored as SHA-256 hash. Prefixed with `sc_live_` for identification.
- **Row-Level Security**: All tables have Supabase RLS policies scoped to `auth.uid() = user_id`. Service role client used only for audit log inserts and API key lookups.
- **Middleware**: Auth middleware (`proxy.ts`) refreshes sessions and protects dashboard routes. API routes are excluded from middleware to prevent session poisoning for Bearer token auth.
- **Response Sanitization**: `encrypted_value`, `iv`, and `auth_tag` are never returned in API responses. Only decrypted plaintext is sent to authorized clients.

## Authentication Flow

1. **Browser (cookie)**: `createServerSupabaseClient()` reads session cookies. Supabase handles JWT refresh automatically.
2. **Supabase JWT (Bearer)**: `createTokenSupabaseClient(token)` creates a client with the token in `Authorization` header. `getUser(token)` validates directly with Supabase Auth.
3. **API Key (Bearer `sc_live_*`)**: Token is SHA-256 hashed, looked up in `api_keys` table via service client. Returns service client with `requiresUserFilter: true` — callers must add `.eq('user_id', userId)` to queries since service client bypasses RLS.

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Tests use Vitest with mocked Supabase clients and real AES-256-GCM encryption (via `@/lib/encryption`).

End-to-end smoke tests use Playwright:

```bash
npx playwright install chromium   # first run only
npm run test:e2e
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + custom API keys |
| Encryption | Node.js crypto (AES-256-GCM) |
| Testing | Vitest |
| SDK | TypeScript, zero dependencies |
| CLI | Commander.js |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Application base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `ENCRYPTION_MASTER_KEY` | Yes | 64-char hex string (32 bytes) for AES-256-GCM |
| `LITELLM_BASE_URL` | No | LiteLLM proxy URL for AI risk analysis (default `http://localhost:4000`) |
| `LITELLM_MASTER_KEY` | No | Master key for the LiteLLM proxy; AI features are disabled when unset |
| `GEMINI_API_KEY` | No | Google Gemini key, consumed by the LiteLLM proxy (see `litellm/config.yaml`) |
| `AI_MODEL` | No | Proxy model name (default `smartcloud-risk`) |
| `AI_MAX_TOKENS` | No | Max tokens per AI response (default `300`) |
| `AI_MAX_CALLS_PER_MIN` | No | Per-process AI rate limit (default `30`) |

### AI risk analysis (LiteLLM + Gemini)

The numeric risk score is rule-based (`src/lib/risk.ts`). The AI layer adds a
plain-English explanation on top, served by Google Gemini behind a
[LiteLLM](https://docs.litellm.ai) proxy:

```bash
pip install 'litellm[proxy]'
export GEMINI_API_KEY=your_free_gemini_key
export LITELLM_MASTER_KEY=sk-smartcloud-local
litellm --config litellm/config.yaml --port 4000
```

Then set `LITELLM_MASTER_KEY` (and optionally `LITELLM_BASE_URL`) in the app's
`.env`. If the proxy is not configured, AI endpoints return `503` and the rest
of the app works unchanged.

## License

MIT
