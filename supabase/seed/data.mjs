// The demo dataset: what gets seeded, in plain data.
//
// Everything here is fake but shaped like the real thing — secret values look
// like real credentials, access patterns look like real traffic, and the
// risk-relevant ones are tuned so the dashboard shows a believable mix of
// LOW / MEDIUM / HIGH after scoring.
//
// Every credential-shaped value carries a literal DEMO-NOT-A-REAL-KEY marker
// and a broken character run. That is not decoration: without it the strings
// match provider secret-scanning patterns (Stripe, AWS, Google, GitHub…) and
// GitHub's push protection rejects the push outright. Keep the marker when
// adding values here.
//
// `access` drives generated access_logs for a secret:
//   readsPerDay  baseline reads/day across the 14-day window
//   burst24h     extra reads inside the last 24h (drives the frequency rule)
//   offHours     fraction of accesses placed outside 08:00–20:00 IST
//   ips          source IP pool (distinct count drives the new-IP rule)
//   writes       occasional CREATE/UPDATE/DELETE actions
//   newIpAtEnd   ends the window with a never-seen-before IP (+10 risk points)

export const OWNER_EMAIL = 'shrinibasmahanta2004@gmail.com'
export const OWNER_NAME = 'Shrinibas Mahanta'

// Office / CI / VPN ranges that recur across projects.
const OFFICE = ['103.21.244.12', '103.21.244.18']
const CI = ['34.73.12.199', '35.196.44.8']
const VPN = ['49.36.180.77']
const SUSPICIOUS = ['185.220.101.34', '45.147.230.19', '91.219.236.5']

export const PROJECTS = [
  {
    key: 'atlas-prod',
    name: 'Atlas Payments — Production',
    description:
      'Live payment processing stack. Cardholder-adjacent credentials; every read is audited.',
    createdDaysAgo: 240,
    secrets: [
      {
        key_name: 'STRIPE_SECRET_KEY',
        value: 'sk_live_DEMO-NOT-A-REAL-KEY-51QmT8x.KfHq2ZnVbA9YwRcLpE7',
        description: 'Stripe live secret key — charges, refunds, payouts.',
        createdDaysAgo: 238,
        // Tuned to land HIGH: heavy 24h burst, mostly off-hours, many sources.
        access: {
          readsPerDay: 6,
          burst24h: 58,
          offHours: 0.62,
          ips: [...OFFICE, ...CI, ...SUSPICIOUS],
          writes: 2,
          newIpAtEnd: true,
        },
      },
      {
        key_name: 'DATABASE_URL',
        value:
          'postgresql://atlas_app:Xq7%24rT1pLm9@db.atlas-prod.internal:5432/atlas?sslmode=require',
        description: 'Primary Postgres connection string (read/write role).',
        createdDaysAgo: 238,
        access: {
          readsPerDay: 8,
          burst24h: 16,
          offHours: 0.3,
          ips: [...OFFICE, ...CI, ...VPN],
          writes: 1,
        },
      },
      {
        key_name: 'JWT_SIGNING_SECRET',
        value: 'hs256_9f4c2b7ae15d83006c1ba9e77d24f0b3519ae8cd6740fb2e',
        description: 'HS256 signing secret for customer session tokens.',
        createdDaysAgo: 231,
        access: {
          readsPerDay: 5,
          burst24h: 10,
          offHours: 0.35,
          ips: [...OFFICE, ...CI],
          writes: 1,
        },
      },
      {
        key_name: 'REDIS_URL',
        value: 'rediss://default:Tt8vQe2mZk4L@cache.atlas-prod.internal:6380/0',
        description: 'Session + idempotency-key cache.',
        createdDaysAgo: 231,
        access: { readsPerDay: 3, burst24h: 2, offHours: 0.1, ips: OFFICE },
      },
      {
        key_name: 'WEBHOOK_SIGNING_SECRET',
        value: 'whsec_DEMO-NOT-A-REAL-KEY-4dF7pQ2x.R9tK1mB6nZ3',
        description: 'Verifies inbound Stripe webhook signatures.',
        createdDaysAgo: 226,
        access: { readsPerDay: 2, burst24h: 1, offHours: 0.15, ips: [...OFFICE, ...CI] },
      },
      {
        key_name: 'SENDGRID_API_KEY',
        value: 'SG.DEMO-NOT-A-REAL-KEY.rN8kQ2vTSuiP4wLmXc7.p1D6yFhE0sKtW9nJvR3',
        description: 'Transactional email (receipts, chargeback notices).',
        createdDaysAgo: 210,
        access: { readsPerDay: 2, burst24h: 0, offHours: 0.1, ips: OFFICE },
      },
      {
        key_name: 'DATADOG_API_KEY',
        value: 'dd_8a1f5c7e93b64d20af6e1c0b7d94e5f3',
        description: 'Metrics + APM ingestion for the payments cluster.',
        createdDaysAgo: 198,
        access: { readsPerDay: 1, burst24h: 0, offHours: 0.2, ips: [...CI] },
      },
      {
        key_name: 'S3_ARCHIVE_CREDENTIALS',
        value:
          '{"accessKeyId":"AKIA-DEMO-NOT-A-REAL-KEY-2MDEMOAB","secretAccessKey":"DEMO-NOT-A-REAL-KEY-jK8v+2Qx1LmN7pR4dTz9Ye0"}',
        description: 'Write-only IAM pair for the settlement-report archive.',
        createdDaysAgo: 150,
        access: { readsPerDay: 1, burst24h: 0, offHours: 0.05, ips: CI },
      },
    ],
    pools: [
      {
        name: 'OPENAI_API_KEY',
        description:
          'Fraud-narrative summariser. Three interchangeable keys; rotation spreads spend and moves off a hot key.',
        rotation_interval_days: 30,
        rotate_on_high_risk: true,
        risk_threshold: 67,
        lastRotatedDaysAgo: 4,
        keys: [
          {
            label: 'openai-prod-a',
            value: 'sk-proj-DEMO-NOT-A-REAL-KEY-A9fK2mQ7.xTvB1nLr4wZc8',
            active: true,
            usage_count: 4812,
            createdDaysAgo: 180,
          },
          {
            label: 'openai-prod-b',
            value: 'sk-proj-DEMO-NOT-A-REAL-KEY-B3nR8vLp.1QwK6mZx2YtC9',
            active: true,
            usage_count: 1290,
            createdDaysAgo: 120,
            current: true,
          },
          {
            label: 'openai-prod-c',
            value: 'sk-proj-DEMO-NOT-A-REAL-KEY-C7mT4qXz.9WvN2pLk6YbR1',
            active: true,
            usage_count: 1188,
            createdDaysAgo: 45,
          },
        ],
        rotations: [
          { daysAgo: 64, trigger: 'scheduled', from: 0, to: 2, reason: 'scheduled rotation (30d interval)' },
          { daysAgo: 34, trigger: 'scheduled', from: 2, to: 0, reason: 'scheduled rotation (30d interval)' },
          { daysAgo: 4, trigger: 'risk', from: 0, to: 1, reason: 'risk score 74 crossed threshold 67' },
        ],
        access: { readsPerDay: 22, burst24h: 18, offHours: 0.28, ips: [...OFFICE, ...CI, ...VPN] },
      },
      {
        name: 'STRIPE_RESTRICTED_KEY',
        description:
          'Read-only restricted keys used by the reconciliation worker.',
        rotation_interval_days: 90,
        rotate_on_high_risk: false,
        risk_threshold: 67,
        lastRotatedDaysAgo: 27,
        keys: [
          {
            label: 'rk-reconciler-1',
            value: 'rk_live_DEMO-NOT-A-REAL-KEY-A2bC3dE4.fG5hJ6kL7',
            active: true,
            usage_count: 932,
            createdDaysAgo: 150,
            current: true,
          },
          {
            label: 'rk-reconciler-2',
            value: 'rk_live_DEMO-NOT-A-REAL-KEY-Z9yX8wV7.uT6sR5qP4',
            active: true,
            usage_count: 940,
            createdDaysAgo: 96,
          },
          {
            label: 'rk-reconciler-legacy',
            value: 'rk_live_DEMO-NOT-A-REAL-KEY-legacy.AaBbCcDdEeFf',
            active: false,
            usage_count: 5104,
            createdDaysAgo: 320,
          },
        ],
        rotations: [
          { daysAgo: 117, trigger: 'scheduled', from: 2, to: 1, reason: 'scheduled rotation (90d interval)' },
          { daysAgo: 27, trigger: 'manual', from: 1, to: 0, reason: 'manual switch during the Q3 audit' },
        ],
        access: { readsPerDay: 6, burst24h: 3, offHours: 0.12, ips: CI },
      },
    ],
    providers: [
      {
        provider: 'aws',
        name: 'AWS Secrets Manager (us-east-1)',
        config: { region: 'us-east-1' },
        credentials: {
          accessKeyId: 'AKIA-DEMO-NOT-A-REAL-KEY-2MDEMOAB',
          secretAccessKey: 'DEMO-NOT-A-REAL-KEY-jK8v+2Qx1LmN7pR4dTz9Ye0',
        },
        // Sync history: which secrets landed where, newest last.
        syncs: [
          { secret: 'STRIPE_SECRET_KEY', status: 'success', daysAgo: 9, remoteSuffix: 'AbCd12' },
          { secret: 'DATABASE_URL', status: 'success', daysAgo: 9, remoteSuffix: 'Ef34Gh' },
          { secret: 'JWT_SIGNING_SECRET', status: 'success', daysAgo: 6, remoteSuffix: 'Ij56Kl' },
          {
            secret: 'S3_ARCHIVE_CREDENTIALS',
            status: 'failed',
            daysAgo: 6,
            detail:
              'AccessDeniedException: User is not authorized to perform secretsmanager:CreateSecret',
          },
          { secret: 'STRIPE_SECRET_KEY', status: 'success', daysAgo: 2, remoteSuffix: 'AbCd12' },
          { secret: 'WEBHOOK_SIGNING_SECRET', status: 'success', daysAgo: 1, remoteSuffix: 'Mn78Op' },
        ],
      },
    ],
    channels: [
      {
        type: 'email',
        target: OWNER_EMAIL,
        events: ['rotation', 'high_risk'],
        active: true,
        createdDaysAgo: 200,
      },
      {
        type: 'webhook',
        target: 'https://hooks.atlas.example.com/smartcloud/payments',
        events: ['high_risk'],
        secret: 'whsec_DEMO-NOT-A-REAL-KEY-3f9a2c71.b8d4e60592ab',
        active: true,
        createdDaysAgo: 120,
      },
    ],
  },

  {
    key: 'atlas-staging',
    name: 'Atlas Payments — Staging',
    description:
      'Pre-production mirror. Test credentials only; used by the nightly end-to-end suite.',
    createdDaysAgo: 235,
    secrets: [
      {
        key_name: 'DATABASE_URL',
        value:
          'postgresql://atlas_app:staging_pw_2f9a@db.atlas-staging.internal:5432/atlas?sslmode=require',
        description: 'Staging Postgres — reset nightly.',
        createdDaysAgo: 234,
        access: { readsPerDay: 9, burst24h: 6, offHours: 0.45, ips: CI, writes: 2 },
      },
      {
        key_name: 'STRIPE_TEST_KEY',
        value: 'sk_test_DEMO-NOT-A-REAL-KEY-staging.0aB1cD2eF3gH4',
        description: 'Stripe test-mode key for the checkout suite.',
        createdDaysAgo: 234,
        access: { readsPerDay: 7, burst24h: 8, offHours: 0.5, ips: [...CI, ...OFFICE] },
      },
      {
        key_name: 'JWT_SIGNING_SECRET',
        value: 'hs256_staging_1a2b3c4d5e6f708192a3b4c5d6e7f809',
        description: 'Session signing secret for the staging API.',
        createdDaysAgo: 230,
        access: { readsPerDay: 4, burst24h: 3, offHours: 0.4, ips: CI },
      },
      {
        key_name: 'REDIS_URL',
        value: 'redis://default:staging@cache.atlas-staging.internal:6379/0',
        description: 'Staging cache.',
        createdDaysAgo: 230,
        access: { readsPerDay: 2, burst24h: 1, offHours: 0.3, ips: CI },
      },
      {
        key_name: 'FEATURE_FLAG_TOKEN',
        value: 'ff_stg_7Kd2Rm9Qx4Lp1Zn8Bv3Ct6Yw',
        description: 'LaunchDarkly SDK token (staging environment).',
        createdDaysAgo: 190,
        access: { readsPerDay: 1, burst24h: 0, offHours: 0.2, ips: CI },
      },
    ],
    pools: [],
    providers: [],
    channels: [
      {
        type: 'email',
        target: OWNER_EMAIL,
        events: ['rotation'],
        active: false,
        createdDaysAgo: 150,
      },
    ],
  },

  {
    key: 'nimbus-mobile',
    name: 'Nimbus Mobile Backend',
    description:
      'API and push infrastructure for the Nimbus iOS/Android apps.',
    createdDaysAgo: 160,
    secrets: [
      {
        key_name: 'FIREBASE_SERVER_KEY',
        value: 'AAAA-DEMO-NOT-A-REAL-KEY:APA91b.H7kLmNq4Zx2Yc8Wd1Rf6Tg0Jv5',
        description: 'FCM server key for Android push.',
        createdDaysAgo: 158,
        access: {
          readsPerDay: 5,
          burst24h: 26,
          offHours: 0.55,
          ips: [...OFFICE, ...VPN, ...SUSPICIOUS.slice(0, 2)],
          newIpAtEnd: true,
        },
      },
      {
        key_name: 'APNS_AUTH_KEY',
        value:
          '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgDEMOkeyDEMOkeyDEMO\nkeyDEMOkeyDEMOkeyDEMOkeyDEMO0000oUQDQgAEDEMOnotarealkeyDEMOnotarea\nlkeyDEMOnotarealkeyDEMOnotarealkeyDEMOnotarealkeyDEMOnotarealkey==\n-----END PRIVATE KEY-----',
        description: 'APNs .p8 signing key (team ABCD1234EF, key ID NIMBUS01).',
        createdDaysAgo: 158,
        access: { readsPerDay: 2, burst24h: 2, offHours: 0.3, ips: [...OFFICE, ...VPN] },
      },
      {
        key_name: 'DATABASE_URL',
        value:
          'postgresql://nimbus:9Lk%40pQ2zR7@db.nimbus.internal:5432/nimbus?sslmode=require',
        description: 'Primary Postgres for the mobile API.',
        createdDaysAgo: 155,
        access: { readsPerDay: 6, burst24h: 9, offHours: 0.35, ips: [...OFFICE, ...CI], writes: 1 },
      },
      {
        key_name: 'TWILIO_AUTH_TOKEN',
        value: 'DEMO-NOT-A-REAL-KEY-a7f3c92e5b18d406',
        description: 'SMS OTP delivery for phone-number sign-in.',
        createdDaysAgo: 140,
        access: { readsPerDay: 3, burst24h: 4, offHours: 0.25, ips: OFFICE },
      },
      {
        key_name: 'MAPBOX_ACCESS_TOKEN',
        value: 'pk.DEMO-NOT-A-REAL-KEY.eyJ1Ijoibmltc3VzZGVtbyJ9.Q2x1c3RlckRlbW9LZXk',
        description: 'Map tiles for the in-app delivery tracker.',
        createdDaysAgo: 130,
        access: { readsPerDay: 2, burst24h: 1, offHours: 0.15, ips: OFFICE },
      },
      {
        key_name: 'SENTRY_DSN',
        value: 'https://DEMO-NOT-A-REAL-KEY-4f2a9c7e@o4507.ingest.sentry.io/4507219',
        description: 'Crash reporting endpoint for both apps.',
        createdDaysAgo: 120,
        access: { readsPerDay: 1, burst24h: 0, offHours: 0.1, ips: CI },
      },
    ],
    pools: [
      {
        name: 'GOOGLE_MAPS_API_KEY',
        description:
          'Geocoding keys spread across three billing projects to stay inside per-key quota.',
        rotation_interval_days: 14,
        rotate_on_high_risk: false,
        risk_threshold: 67,
        lastRotatedDaysAgo: 11,
        keys: [
          {
            label: 'maps-billing-a',
            value: 'AIza-DEMO-NOT-A-REAL-KEY-a1B2c3D4e5F6g7H8',
            active: true,
            usage_count: 2140,
            createdDaysAgo: 150,
          },
          {
            label: 'maps-billing-b',
            value: 'AIza-DEMO-NOT-A-REAL-KEY-b2C3d4E5f6G7h8I9',
            active: true,
            usage_count: 1975,
            createdDaysAgo: 100,
            current: true,
          },
          {
            label: 'maps-billing-c',
            value: 'AIza-DEMO-NOT-A-REAL-KEY-c3D4e5F6g7H8i9J0',
            active: false,
            usage_count: 3310,
            createdDaysAgo: 60,
          },
        ],
        rotations: [
          { daysAgo: 39, trigger: 'scheduled', from: 2, to: 0, reason: 'scheduled rotation (14d interval)' },
          { daysAgo: 25, trigger: 'scheduled', from: 0, to: 1, reason: 'scheduled rotation (14d interval)' },
          { daysAgo: 11, trigger: 'manual', from: 1, to: 1, reason: 'quota alert on billing project C — key deactivated' },
        ],
        access: { readsPerDay: 14, burst24h: 11, offHours: 0.2, ips: [...OFFICE, ...CI] },
      },
    ],
    providers: [
      {
        provider: 'azure',
        name: 'Azure Key Vault (nimbus-kv)',
        config: { vaultUrl: 'https://nimbus-demo-kv.vault.azure.net' },
        credentials: {
          tenantId: '8f2c1a70-4d63-4b19-9a52-1e7d0c3b5a44',
          clientId: 'c41b7e29-6a80-4f13-b7d2-95e0a1c6f382',
          clientSecret: 'Az~DEMO-NOT-A-REAL-KEY~1nR4vTzL9pKmXc2',
        },
        syncs: [
          { secret: 'FIREBASE_SERVER_KEY', status: 'success', daysAgo: 7, remoteSuffix: 'a1b2c3' },
          { secret: 'DATABASE_URL', status: 'success', daysAgo: 7, remoteSuffix: 'd4e5f6' },
          {
            secret: 'APNS_AUTH_KEY',
            status: 'failed',
            daysAgo: 5,
            detail: 'Forbidden: the caller does not have secrets/set permission on this vault',
          },
          { secret: 'TWILIO_AUTH_TOKEN', status: 'success', daysAgo: 3, remoteSuffix: 'g7h8i9' },
        ],
      },
    ],
    channels: [
      {
        type: 'email',
        target: OWNER_EMAIL,
        events: ['high_risk'],
        active: true,
        createdDaysAgo: 100,
      },
    ],
  },

  {
    key: 'data-platform',
    name: 'Internal Data Platform',
    description:
      'Warehouse, orchestration and BI credentials for the analytics team.',
    createdDaysAgo: 95,
    secrets: [
      {
        key_name: 'SNOWFLAKE_PASSWORD',
        value: 'Sn0w!Demo#2026$Warehouse',
        description: 'Service account SVC_ETL on the ANALYTICS warehouse.',
        createdDaysAgo: 94,
        access: { readsPerDay: 4, burst24h: 5, offHours: 0.6, ips: [...CI, ...VPN] },
      },
      {
        key_name: 'AIRFLOW_FERNET_KEY',
        value: 'ZmVybmV0X2RlbW9fa2V5XzMyX2J5dGVzX2Jhc2U2NF9wYWQ9',
        description: 'Encrypts connection extras in the Airflow metadata DB.',
        createdDaysAgo: 94,
        access: { readsPerDay: 2, burst24h: 1, offHours: 0.4, ips: CI },
      },
      {
        key_name: 'METABASE_ENCRYPTION_KEY',
        value: 'mb_enc_5d8f2a91c74e6b30af1c9e2d7b48f036',
        description: 'At-rest encryption key for saved Metabase questions.',
        createdDaysAgo: 80,
        access: { readsPerDay: 1, burst24h: 0, offHours: 0.2, ips: OFFICE },
      },
      {
        key_name: 'GITHUB_ACTIONS_PAT',
        value: 'github_pat_DEMO-NOT-A-REAL-KEY-0aBcDeFgHiJkLmNoPqRsTuVwXyZ',
        description: 'Fine-grained PAT used by the dbt deploy workflow.',
        createdDaysAgo: 60,
        access: { readsPerDay: 3, burst24h: 2, offHours: 0.35, ips: CI, writes: 1 },
      },
    ],
    pools: [
      {
        name: 'ANTHROPIC_API_KEY',
        description:
          'Keys for the natural-language query assistant in Metabase.',
        rotation_interval_days: 45,
        rotate_on_high_risk: true,
        risk_threshold: 60,
        lastRotatedDaysAgo: 19,
        keys: [
          {
            label: 'anthropic-analytics-1',
            value: 'sk-ant-api03-DEMO-NOT-A-REAL-KEY-a1B2c3D4e5F6g7H8-AAAAAA',
            active: true,
            usage_count: 640,
            createdDaysAgo: 88,
            current: true,
          },
          {
            label: 'anthropic-analytics-2',
            value: 'sk-ant-api03-DEMO-NOT-A-REAL-KEY-z9Y8x7W6v5U4t3S2-BBBBBB',
            active: true,
            usage_count: 655,
            createdDaysAgo: 52,
          },
        ],
        rotations: [
          { daysAgo: 64, trigger: 'scheduled', from: null, to: 1, reason: 'first scheduled rotation' },
          { daysAgo: 19, trigger: 'scheduled', from: 1, to: 0, reason: 'scheduled rotation (45d interval)' },
        ],
        access: { readsPerDay: 5, burst24h: 4, offHours: 0.3, ips: [...OFFICE, ...CI] },
      },
    ],
    providers: [
      {
        provider: 'gcp',
        name: 'GCP Secret Manager (nimbus-data-prod)',
        config: { projectId: 'nimbus-data-prod' },
        credentials: {
          clientEmail: 'smartcloud-sync@nimbus-data-prod.iam.gserviceaccount.com',
          privateKey:
            '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwDEMOnotarealprivatekeyDEMOnot\narealprivatekeyDEMOnotarealprivatekeyDEMOnotarealprivatekeyDEMOnota\nrealprivatekeyDEMOnotarealprivatekeyDEMOnotarealprivatekey00000000\n-----END PRIVATE KEY-----\n',
        },
        syncs: [
          { secret: 'SNOWFLAKE_PASSWORD', status: 'success', daysAgo: 12, remoteSuffix: '1' },
          { secret: 'AIRFLOW_FERNET_KEY', status: 'success', daysAgo: 12, remoteSuffix: '1' },
          { secret: 'GITHUB_ACTIONS_PAT', status: 'success', daysAgo: 4, remoteSuffix: '2' },
        ],
      },
    ],
    channels: [
      {
        type: 'webhook',
        target: 'https://hooks.slack.example.com/services/T000/B000/dataplatform',
        events: ['rotation', 'high_risk'],
        secret: 'whsec_DEMO-NOT-A-REAL-KEY-9c1d7e40.a2b85f36c9d0',
        active: true,
        createdDaysAgo: 70,
      },
    ],
  },
]

// Long-lived programmatic access tokens. Plaintext is generated at seed time
// and printed once — exactly like the real "shown once at creation" flow.
export const API_KEYS = [
  { name: 'CI/CD pipeline (GitHub Actions)', createdDaysAgo: 120, lastUsedDaysAgo: 0.2 },
  { name: 'Vercel production runtime', createdDaysAgo: 90, lastUsedDaysAgo: 1 },
  { name: 'Local dev laptop', createdDaysAgo: 30, lastUsedDaysAgo: 6 },
  { name: 'Terraform bootstrap (revoked soon)', createdDaysAgo: 210, lastUsedDaysAgo: null },
]

// Natural-language risk notes. Normally written by the AI layer (src/lib/ai.ts)
// against a live LiteLLM proxy; seeded here so the risk cards read fully.
export const AI_SUMMARIES = {
  HIGH:
    'Read volume in the last 24 hours is roughly ten times this secret\'s baseline, and most of it lands well outside working hours. Three of the source addresses have never been seen before on this project. Treat as a likely credential-exfiltration attempt: rotate the upstream credential and review the last day of reads.',
  MEDIUM:
    'Access volume is above this secret\'s usual baseline, with a noticeable share of reads outside working hours. All source addresses are known office or CI ranges, so this most likely reflects a deploy or backfill window rather than misuse — worth confirming against the release calendar.',
  LOW:
    'Access pattern is consistent with the baseline: modest volume, almost entirely within working hours, and from previously seen office and CI addresses. No action needed.',
}
