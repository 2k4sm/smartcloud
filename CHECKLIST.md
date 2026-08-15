# SmartCloud — Build Checklist

Living tracker for the Phase 3+ build-out, mirrored from the master plan.
**Status:** ✅ Done · 🟡 In Progress · ⬜ Not Started

> Baseline (pre-plan, committed 2026-03-03): auth (cookie/JWT/API-key), projects &
> secrets CRUD, AES-256-GCM encryption, RLS, audit logging, API keys, `smartcloud-sdk`,
> `smartcloud-cli`. Everything below is the W2→W10 feature build-out.

---

## Master milestones

| Date | Milestone | Status |
| --- | --- | --- |
| 2026-07-20 | 90% complete (tag v0.9.0) | ✅ |
| 2026-07-20 → 07-31 | UAT | ✅ |
| 2026-08-01 → 08-15 | Fix UAT gaps · fine-tune to 100% | ✅ |
| 2026-08-15 → 08-31 | Documentation · demo video · sign-off | 🟡 |

---

## W1 · May 11 → 17 — Setup

| Task | Owner | Status |
| --- | --- | --- |
| Notion workspace + share with mentor | Nymish | ✅ |
| ScratchPad + TeamPad | All | ✅ |
| Custom domain | Nymish | ✅ |
| GitHub issues for W2–W10 | Nymish | ✅ |
| Each member ≥1 PR | All | ✅ |
| Repo build checklist (this file) | Nymish | ✅ |

## W2 · May 18 → 24 — Risk schema + scorer v0

| Task | Owner | Status |
| --- | --- | --- |
| `risk_scores` table migration | Abhinav | ✅ |
| Rule-based scorer (frequency, off-hours, new-IP) | Abhinav | ✅ |
| `/api/risk/recompute` endpoint | Abhinav | ✅ |
| Unit tests for scoring rules | Abhinav | ✅ |

## W3 · May 25 → 31 — Risk UI + RBAC

| Task | Owner | Status |
| --- | --- | --- |
| Risk badges (Low/Med/High) on secrets table | Prem | ✅ |
| Risk detail page per secret | Prem | ✅ |
| RBAC migration + RLS (owner/admin/viewer) | Nymish | ✅ |
| Team-invite UI + role assignment | Prem + Nymish | ✅ |

## W4 · Jun 1 → 7 — AI layer

| Task | Owner | Status |
| --- | --- | --- |
| Gemini via LiteLLM (proxy + client + caching) | Abhinav | ✅ |
| Anomaly summary endpoint over `access_logs` | Abhinav | ✅ |
| AI explanation surface in dashboard | Prem | ✅ |
| Rate limit + cost guardrails | Abhinav | ✅ |

## W5 · Jun 8 → 14 — Rotation skeleton

| Task | Owner | Status |
| --- | --- | --- |
| `rotation_jobs` table migration (`005`; later superseded by key pools in `008`) | Shrinibas | ✅ |
| Cron scheduler wiring | Shrinibas | ✅ |
| Manual "Rotate now" button + endpoint | Shrinibas | ✅ |
| Rotation history view | Prem | ✅ |

## W6 · Jun 15 → 21 — AWS adapter

| Task | Owner | Status |
| --- | --- | --- |
| Cloud provider config table + UI | Shrinibas + Prem | ✅ |
| AWS Secrets Manager adapter (read/write/rotate) | Shrinibas | ✅ |
| AWS IAM credential setup UX | Nymish | ✅ |
| Push secret to AWS + audit log | Shrinibas | ✅ |

## W7 · Jun 22 → 28 — Azure + GCP

| Task | Owner | Status |
| --- | --- | --- |
| Unified `CloudProvider` interface refactor | Shrinibas | ✅ |
| Azure Key Vault adapter | Shrinibas | ✅ |
| GCP Secret Manager adapter | Shrinibas | ✅ |
| Multi-cloud sync UI | Prem | ✅ |

## W8 · Jun 29 → Jul 5 — Risk-driven auto-rotation

| Task | Owner | Status |
| --- | --- | --- |
| Trigger rotation on high-risk threshold | Shrinibas + Abhinav | ✅ |
| Email/webhook notification on rotation | Prem | ✅ |
| E2E test: high-risk → rotate → log | All | ✅ |

## W9 · Jul 6 → 12 — Reports + alerts

| Task | Owner | Status |
| --- | --- | --- |
| CSV/PDF report export | Prem | ✅ |
| Access-log timeline visualization | Prem | ✅ |
| Webhook subscription model + UI | Nymish | ✅ |
| Email alerts on high-risk events | Abhinav | ✅ |

## W10 · Jul 13 → 19 — Polish + go-live

| Task | Owner | Status |
| --- | --- | --- |
| UI/UX polish pass | Prem | ✅ |
| Publish `smartcloud-sdk` to npm | Nymish | ✅ |
| Publish `smartcloud-cli` to npm | Nymish | ✅ |
| Custom domain go-live | Shrinibas | ✅ |
| Playwright e2e suite (golden paths) | All | ✅ |
| **Tag v0.9.0 — 90% milestone** | Nymish | ✅ |

## Post-v0.9.0 hardening — dependency + docs verification (UAT prep)

Every integration cross-referenced against the latest official docs; findings applied.

| Item | Owner | Status |
| --- | --- | --- |
| RLS: `current_project_role` → plpgsql + pinned `search_path` (fixes SQL-inlining recursion risk; folded into `004`) | Nymish | ✅ |
| LiteLLM: pinned a valid Gemini model, `max_tokens` moved to model params (the proxy now takes a `gemini/*` wildcard and the app picks the model via `LITELLM_MODEL`, default `gemini/gemini-3.5-flash-lite`) | Abhinav | ✅ |
| Cloud adapters: name-based error check (AWS), name length guard (Azure), gRPC status constant (GCP) | Shrinibas | ✅ |
| Bump Next 16.2.11 (security), React 19.2.8, supabase-js 2.110, @supabase/ssr 0.12 | Nymish | ✅ |

## UAT findings — rotation + cloud end-to-end (Aug 2026)

Functional audit of the two modules against the plan; every gap found was closed.

| Item | Owner | Status |
| --- | --- | --- |
| **Scheduler off Vercel** — `vercel.json` crons don't run on Dokploy, so scheduled/risk rotation never fired in production. Added a `scheduler` compose service (hourly, `CRON_SECRET`-authenticated) | Shrinibas | ✅ |
| Cron tick hardened: paginates pools (was silently capped at PostgREST's 1000-row default), skips pools with no policy, isolates per-pool failures | Shrinibas | ✅ |
| **Pool risk query bounded** — was unordered + unlimited, so a busy pool scored off an arbitrary 1000-row slice that could omit the recent rows the frequency rule needs | Abhinav | ✅ |
| Risk-rotation evidence window restarts at `last_rotated_at` (score now decays after rotating instead of staying pinned high); 6h cooldown retained as a floor | Abhinav | ✅ |
| Manual rotation now notifies subscribers, identically to scheduled/risk | Shrinibas | ✅ |
| **Provider connection test** — `POST /providers/:id/test` + UI button; `getSecret`/`deleteSecret` were dead code and bad credentials only surfaced at first sync | Shrinibas + Prem | ✅ |
| **Cloud cleanup on delete** — deleting a secret removes the remote copy; previously the credential outlived it in the vault forever | Shrinibas | ✅ |
| Provider config/credentials validated per kind on connect + update (was: any shape stored, opaque failure at sync time) | Shrinibas | ✅ |
| Collision-safe remote naming — `MY_KEY` and `MY-KEY` both mapped to `MY-KEY` on Azure and silently overwrote each other | Shrinibas | ✅ |
| AWS: restore a secret pending deletion before rewriting it (re-adding a deleted key was broken for the whole 30-day recovery window); tolerate already-absent on delete | Shrinibas | ✅ |
| Cloud adapter + rotation test coverage: 79 → 126 tests (adapters previously had none); suite now at 138 across 14 files | All | ✅ |

## Documentation & sign-off phase (Aug 15 → 31)

| Item | Owner | Status |
| --- | --- | --- |
| UI/UX overhaul: shadcn/ui (new-york) on Tailwind v4, light/dark via next-themes, validated palette, mobile pass | Prem | ✅ |
| App shell: sidebar + project switcher, command palette, modal-based create flows | Prem | ✅ |
| Packages renamed to unscoped npm names (`smartcloud-sdk` / `smartcloud-cli`) | Nymish | ✅ |
| Next 16 `middleware` → `proxy` file-convention migration | Nymish | ✅ |
| Docs audit — README/CHECKLIST/PUBLISHING/package READMEs verified against code; ASCII diagrams → mermaid | Nymish | ✅ |
| Capstone 15-min demo deck | All | 🟡 |
| Demo video · mentor sign-off | All | ⬜ |

> Notes: `smartcloud-sdk` and `smartcloud-cli` are published to npm at `0.9.0`
> (see [PUBLISHING.md](PUBLISHING.md) for the release steps and version-bump
> rule). Custom domain was purchased in W1; production deploy/DNS cut-over is an
> ops step done at go-live.
