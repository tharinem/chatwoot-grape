---
phase: 3
slug: n8n-card-creation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (new — no test framework exists yet) |
| **Config file** | `kanban-api/vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | API-01 | integration | `npx vitest run src/__tests__/webhook.test.ts -t "creates card"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | API-02 | integration | `npx vitest run src/__tests__/webhook.test.ts -t "idempotent"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | API-03 | unit | `npx vitest run src/__tests__/webhook.test.ts -t "responds 202"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kanban-api/vitest.config.ts` — Vitest configuration
- [ ] `kanban-api/src/__tests__/webhook.test.ts` — webhook endpoint tests (API-01, API-02, API-03)
- [ ] `kanban-api/src/__tests__/api-key.test.ts` — API key generation/verification tests
- [ ] `kanban-api/src/__tests__/card-creation.worker.test.ts` — worker upsert logic tests
- [ ] Framework install: `npm install -D vitest` — no test framework exists

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| n8n workflow POST triggers card creation end-to-end | API-01 | Requires running n8n instance with configured HTTP node | 1. Configure n8n HTTP Request node to POST to webhook endpoint 2. Trigger workflow 3. Verify card appears in Kanban board |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
