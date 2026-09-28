---
phase: 2
slug: kanban-api-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `kanban-api/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AUTH-01 | integration | `npx vitest run src/routes/v1/__tests__/auth.test.ts -t "token exchange"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AUTH-02 | integration | `npx vitest run src/routes/v1/__tests__/auth.test.ts -t "invalid token"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | AUTH-03 | unit | `npx vitest run src/services/__tests__/jwt.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | AUTH-04 | integration | `npx vitest run src/middleware/__tests__/tenant.test.ts -t "no jwt"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | TENANT-01 | unit | `npx vitest run src/routes/v1/__tests__/stages.test.ts -t "tenant isolation"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | TENANT-02 | integration | `npx vitest run src/routes/v1/__tests__/tenant-isolation.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | TENANT-03 | integration | `npx vitest run src/routes/v1/__tests__/stages.test.ts -t "independent stages"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | API-04 | smoke | `curl -s http://localhost:3001/docs/json \| jq '.paths \| keys'` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | API-05 | integration | `npx vitest run src/routes/v1/__tests__/cards.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kanban-api/vitest.config.ts` — vitest configuration
- [ ] `kanban-api/src/routes/v1/__tests__/auth.test.ts` — auth endpoint tests
- [ ] `kanban-api/src/routes/v1/__tests__/stages.test.ts` — stages CRUD + tenant isolation
- [ ] `kanban-api/src/routes/v1/__tests__/cards.test.ts` — cards CRUD + pagination
- [ ] `kanban-api/src/routes/v1/__tests__/tenant-isolation.test.ts` — cross-tenant rejection
- [ ] `kanban-api/src/middleware/__tests__/tenant.test.ts` — middleware unit tests
- [ ] Framework install: `npm install -D vitest`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swagger UI accessible in browser | API-04 | Visual verification of rendered docs | Navigate to `http://localhost:3001/docs` and verify all endpoints listed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
