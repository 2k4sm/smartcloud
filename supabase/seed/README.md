# Demo seed data

Populates a Supabase project with realistic, self-consistent demo data for a
single user — `shrinibasmahanta2004@gmail.com` (Shrinibas Mahanta) — so the
whole dashboard can be demoed without clicking anything into existence.

```bash
npm run seed:dry     # build everything in memory and print a summary — no writes
npm run seed         # insert (refuses if that user already has projects)
npm run seed:reset   # delete that user's projects + API keys, then reseed
```

Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`ENCRYPTION_MASTER_KEY` in `.env` — the same master key the app runs with, or
the dashboard will not be able to decrypt the seeded values. Migrations
`001`–`009` must already be applied.

## Files

| File | What it holds |
| --- | --- |
| `data.mjs` | The dataset — projects, secrets, pools, providers, channels, access profiles. Edit this to change *what* is seeded. |
| `seed.mjs` | The generator + inserter — expands access profiles into logs, scores them, writes rows in FK order. |
| `lib.mjs` | Ports of `src/lib/encryption.ts` (AES-256-GCM) and `src/lib/risk.ts` (the rule-based scorer), plus a fixed-seed PRNG. |

## What gets seeded

| Table | Rows | Notes |
| --- | --- | --- |
| `projects` | 4 | Atlas Production / Atlas Staging / Nimbus Mobile / Internal Data Platform |
| `secrets` | 23 | Real AES-256-GCM ciphertext under your master key — they decrypt and copy in the UI |
| `access_logs` | ~1,400 | 15 days of traffic: business-hours bias, quiet weekends, CI vs office vs VPN source IPs, a few writes |
| `risk_scores` | 69 | Three scored checkpoints per secret (6d ago, 3d ago, now) computed by the real scorer over the real logs |
| `key_pools` / `pool_keys` | 4 / 11 | Interchangeable keys, one current per pool, mixed active/retired, non-uniform usage counts |
| `pool_rotations` | 10 | Scheduled, manual and risk-triggered history consistent with each pool's `last_rotated_at` |
| `pool_access_logs` | ~600 | Feeds live pool risk on the pool detail page |
| `cloud_providers` | 3 | One AWS, one Azure, one GCP — config and credential shapes pass `src/lib/cloud/validate.ts` |
| `cloud_syncs` | 13 | Push history with provider-shaped remote ids (ARN / vault URL / version path), including two failures |
| `notification_channels` | 5 | Email + webhook, one deliberately inactive |
| `api_keys` | 4 | SHA-256 hashes; the plaintext is printed once at the end of the run, exactly like the real flow |

Two secrets land **HIGH** risk by construction (`STRIPE_SECRET_KEY` in Atlas
Production, `FIREBASE_SERVER_KEY` in Nimbus) — a 24-hour read burst, mostly
off-hours, from unfamiliar addresses ending in a never-seen-before IP. Roughly
seven more land MEDIUM, the rest LOW. The scores are not hardcoded: the seeder
runs the same rules `POST /api/risk/recompute` runs, over the same logs, so
recomputing from the UI reproduces them.

The run is deterministic (fixed-seed PRNG), so reseeding gives the same access
pattern and the same scores, shifted to the new "now".

## Deliberately not seeded

- **`project_members`** — RBAC rows need additional `auth.users`, and this seeds
  one user by design. Invite a teammate from the Members page to demo sharing.
- **Anything living on an external service.** Cloud credentials are plausible
  fakes, so *Test connection* and a live sync against AWS/Azure/GCP will fail
  with a real provider error — the stored config, the sync history and the UI
  around them are all seeded and demo fine. Same for notifications: channels
  exist, but nothing is delivered unless SMTP/webhook targets are real.
- **`risk_scores.ai_summary`** on historical rows. The latest score per secret
  carries a written summary so the risk card reads fully; normally the AI layer
  (`src/lib/ai.ts`) writes it against a live LiteLLM proxy.
