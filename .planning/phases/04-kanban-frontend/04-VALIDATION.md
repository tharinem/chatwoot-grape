---
phase: 4
slug: kanban-frontend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x + @vue/test-utils 2.x |
| **Config file** | `kanban-frontend/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `cd kanban-frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd kanban-frontend && npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd kanban-frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd kanban-frontend && npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | KANB-01 | unit | `vitest run src/stores/__tests__/stages.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | KANB-01 | unit | `vitest run src/composables/__tests__/useAuth.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | KANB-02 | unit | `vitest run src/components/__tests__/KanbanCard.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | KANB-03 | unit | `vitest run src/components/__tests__/KanbanColumn.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | KANB-04 | unit | `vitest run src/components/__tests__/CardDetail.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | KANB-05 | unit | `vitest run src/components/__tests__/StageManagement.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | KANB-06 | unit | `vitest run src/components/__tests__/FilterBar.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 2 | KANB-07 | unit | `vitest run src/components/__tests__/CreateCardForm.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-04 | 03 | 2 | KANB-08 | unit | `vitest run src/components/__tests__/EmptyState.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `kanban-frontend/vitest.config.ts` — vitest config with jsdom environment
- [ ] `kanban-frontend/src/test-utils/setup.ts` — global test setup (happy-dom/jsdom)
- [ ] `kanban-frontend/src/test-utils/mocks.ts` — shared API mocks and fixtures

*Framework installed via `pnpm add -D vitest @vue/test-utils @testing-library/vue jsdom` in project scaffold.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop animation fluidity | KANB-01 | Visual animation quality cannot be asserted programmatically | Drag a card between columns; verify shadow lift, drop zone highlight, smooth reflow |
| Dark mode visual consistency | KANB-02 | CSS custom property rendering requires visual inspection | Toggle dark mode; verify all colors follow Chatwoot n.* palette |
| Mobile horizontal scroll | KANB-01 | Touch interaction and viewport behavior | Resize browser to 375px width; verify horizontal scroll works on board |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
