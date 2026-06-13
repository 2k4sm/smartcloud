# SmartCloud — Build Checklist

Living tracker for the Phase 3+ build-out, mirrored from the master plan.
**Status:** ✅ Done · 🟡 In Progress · ⬜ Not Started

> Baseline (pre-plan, committed 2026-03-03): auth (cookie/JWT/API-key), projects &
> secrets CRUD, AES-256-GCM encryption, RLS, audit logging, API keys, `@smartcloud/sdk`,
> `@smartcloud/cli`. Everything below is the W2→W10 feature build-out.

---

## Master milestones

| Date | Milestone | Status |
| --- | --- | --- |
| 2026-07-20 | 90% complete (tag v0.9.0) | ⬜ |
| 2026-07-20 → 07-31 | UAT | ⬜ |
| 2026-08-01 → 08-15 | Fix UAT gaps · fine-tune to 100% | ⬜ |
| 2026-08-15 → 08-31 | Documentation · demo video · sign-off | ⬜ |

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
| `rotation_jobs` table migration | Shrinibas | ✅ |
| Cron scheduler wiring | Shrinibas | ✅ |
| Manual "Rotate now" button + endpoint | Shrinibas | ✅ |
| Rotation history view | Prem | ✅ |

## W6 · Jun 15 → 21 — AWS adapter

| Task | Owner | Status |
| --- | --- | --- |
| Cloud provider config table + UI | Shrinibas + Prem | ⬜ |
| AWS Secrets Manager adapter (read/write/rotate) | Shrinibas | ⬜ |
| AWS IAM credential setup UX | Nymish | ⬜ |
| Push secret to AWS + audit log | Shrinibas | ⬜ |

## W7 · Jun 22 → 28 — Azure + GCP

| Task | Owner | Status |
| --- | --- | --- |
| Unified `CloudProvider` interface refactor | Shrinibas | ⬜ |
| Azure Key Vault adapter | Shrinibas | ⬜ |
| GCP Secret Manager adapter | Shrinibas | ⬜ |
| Multi-cloud sync UI | Prem | ⬜ |

## W8 · Jun 29 → Jul 5 — Risk-driven auto-rotation

| Task | Owner | Status |
| --- | --- | --- |
| Trigger rotation on high-risk threshold | Shrinibas + Abhinav | ⬜ |
| Email/webhook notification on rotation | Prem | ⬜ |
| E2E test: high-risk → rotate → log | All | ⬜ |

## W9 · Jul 6 → 12 — Reports + alerts

| Task | Owner | Status |
| --- | --- | --- |
| CSV/PDF report export | Prem | ⬜ |
| Access-log timeline visualization | Prem | ⬜ |
| Webhook subscription model + UI | Nymish | ⬜ |
| Email alerts on high-risk events | Abhinav | ⬜ |

## W10 · Jul 13 → 19 — Polish + go-live

| Task | Owner | Status |
| --- | --- | --- |
| UI/UX polish pass | Prem | ⬜ |
| Publish `@smartcloud/sdk` to npm | Nymish | ⬜ |
| Publish `@smartcloud/cli` to npm | Nymish | ⬜ |
| Custom domain go-live | Nymish | ⬜ |
| Playwright e2e suite (golden paths) | All | ⬜ |
| **Tag v0.9.0 — 90% milestone** | Nymish | ⬜ |
