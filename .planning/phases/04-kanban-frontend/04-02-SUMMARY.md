---
phase: 04-kanban-frontend
plan: 02
subsystem: ui
tags: [vue3, pinia, axios, jwt, i18n, typescript, vue-router]

requires:
  - phase: 02-kanban-api-auth
    provides: "REST API with JWT auth, stages CRUD, cards CRUD with cursor pagination"
  - phase: 04-kanban-frontend plan 01
    provides: "Vue 3 project scaffold with Vite, Tailwind, dependencies installed"
provides:
  - "TypeScript types mirroring backend card/stage/auth schemas"
  - "Axios API client with JWT interceptor and 401 silent re-auth"
  - "API endpoint wrappers for auth, stages, and cards"
  - "Pinia stores: auth (JWT lifecycle), board (stages+cards CRUD with optimistic updates), ui (filters, field visibility, slide panel)"
  - "useToast composable for success/error notifications"
  - "Vue Router with auth guard"
  - "vue-i18n with complete pt-BR translations from UI-SPEC"
affects: [04-kanban-frontend plan 03, 04-kanban-frontend plan 04]

tech-stack:
  added: []
  patterns:
    - "API client with 401 interceptor using dynamic import to avoid circular deps"
    - "Optimistic update with snapshot rollback for card moves"
    - "JWT decode via base64 atob (no external library)"
    - "useLocalStorage from @vueuse/core for persisted UI preferences"

key-files:
  created:
    - kanban-frontend/src/types/card.ts
    - kanban-frontend/src/types/stage.ts
    - kanban-frontend/src/types/auth.ts
    - kanban-frontend/src/api/client.ts
    - kanban-frontend/src/api/auth.ts
    - kanban-frontend/src/api/stages.ts
    - kanban-frontend/src/api/cards.ts
    - kanban-frontend/src/stores/auth.ts
    - kanban-frontend/src/stores/board.ts
    - kanban-frontend/src/stores/ui.ts
    - kanban-frontend/src/composables/useToast.ts
    - kanban-frontend/src/views/BoardView.vue
    - kanban-frontend/src/views/LoginView.vue
    - kanban-frontend/src/i18n/index.ts
  modified:
    - kanban-frontend/src/router/index.ts
    - kanban-frontend/src/i18n/pt-BR.json

key-decisions:
  - "Used dynamic import for auth store in 401 interceptor to avoid circular dependency between client.ts and stores/auth.ts"
  - "StageWithCount interface extends Stage with optional _count for list endpoint compatibility"
  - "Restructured i18n keys from Plan 01 accessibility section into separate aria/tooltip sections per UI-SPEC"

patterns-established:
  - "API request types use snake_case (matching backend), response types use camelCase"
  - "Stores use Pinia setup syntax (composition API style) for consistency with Vue components"
  - "Toast composable uses module-level state for singleton behavior across components"

requirements-completed: [KANB-01, KANB-04, KANB-05, KANB-06, KANB-08]

duration: 6min
completed: 2026-04-10
---

# Phase 04 Plan 02: Types, API, Stores, Router, i18n Summary

**TypeScript types mirroring backend schemas, Axios API client with JWT 401 re-auth, Pinia stores with optimistic card moves, vue-router with auth guard, and complete pt-BR i18n translations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-10T07:26:40Z
- **Completed:** 2026-04-10T07:32:53Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- TypeScript types exactly mirror backend Zod schemas for cards, stages, and auth
- API client with JWT interceptor handles 401 silently via token refresh, all endpoint wrappers cover stages CRUD+reorder and cards CRUD with cursor pagination
- Board store implements optimistic moveCard with snapshot-based rollback on API failure
- Complete pt-BR translations covering all UI-SPEC copywriting contract entries
- Auth guard on router redirects to login when no JWT present

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TypeScript types and API client layer with JWT auth** - `1043eccb0` (feat)
2. **Task 2: Create Pinia stores, composables, router, and i18n translations** - `e51aa707d` (feat)

## Files Created/Modified
- `kanban-frontend/src/types/card.ts` - Card, PaginatedCards, CreateCardInput, UpdateCardInput interfaces
- `kanban-frontend/src/types/stage.ts` - Stage, StageWithCount, CreateStageInput, UpdateStageInput, ReorderStageItem interfaces
- `kanban-frontend/src/types/auth.ts` - TokenExchangeRequest, TokenExchangeResponse, JwtPayload interfaces
- `kanban-frontend/src/api/client.ts` - Axios instance with JWT interceptor and 401 re-auth
- `kanban-frontend/src/api/auth.ts` - Token exchange endpoint (separate client, no JWT)
- `kanban-frontend/src/api/stages.ts` - Stages list, create, update, remove, reorder
- `kanban-frontend/src/api/cards.ts` - Cards listByStage (paginated), create, update, remove
- `kanban-frontend/src/stores/auth.ts` - Auth store with login, refresh, logout, initFromStorage
- `kanban-frontend/src/stores/board.ts` - Board store with fetchBoard, moveCard (optimistic), CRUD
- `kanban-frontend/src/stores/ui.ts` - UI store with visibleFields, slidePanel, activeFilters
- `kanban-frontend/src/composables/useToast.ts` - Toast composable with auto-dismiss
- `kanban-frontend/src/views/BoardView.vue` - Placeholder board view
- `kanban-frontend/src/views/LoginView.vue` - Login form with chatwoot_token + account_id
- `kanban-frontend/src/router/index.ts` - Router with auth guard and login/board routes
- `kanban-frontend/src/i18n/pt-BR.json` - Complete pt-BR translations per UI-SPEC
- `kanban-frontend/src/i18n/index.ts` - vue-i18n configuration module

## Decisions Made
- Used dynamic import for auth store in 401 interceptor to avoid circular dependency between client.ts and stores/auth.ts
- Added StageWithCount interface extending Stage with optional _count field (backend list endpoint returns card count)
- Restructured i18n pt-BR.json from Plan 01's single "accessibility" section into separate "aria" and "tooltip" sections matching plan spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Waited for Plan 01 to complete project scaffold**
- **Found during:** Execution start
- **Issue:** kanban-frontend directory did not exist yet as Plan 01 (Wave 1 dependency) was still executing in parallel
- **Fix:** Polled for directory creation, resumed when Plan 01 completed scaffolding and npm install
- **Verification:** All source files created successfully, TypeScript compiles clean

**2. [Rule 1 - Bug] Updated router to use views/ instead of pages/ for new routes**
- **Found during:** Task 2 (Router update)
- **Issue:** Plan 01 used pages/BoardPage.vue, but plan spec says views/BoardView.vue. Created new views/ directory with BoardView.vue and LoginView.vue per plan, updated router to point there.
- **Fix:** Created views/BoardView.vue and views/LoginView.vue, updated router routes
- **Files modified:** kanban-frontend/src/router/index.ts, kanban-frontend/src/views/
- **Committed in:** e51aa707d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Necessary adaptations for parallel execution and plan compliance. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
- `kanban-frontend/src/views/BoardView.vue` - Placeholder view (just renders "Board" text). Will be replaced by Plan 03/04 with actual board components.
- `kanban-frontend/src/views/LoginView.vue` - Functional login form but intentionally minimal; serves as dev tool for auth testing.

## Next Phase Readiness
- All types, API wrappers, and stores are ready for Wave 2 plans (03, 04) to build UI components
- Board store exposes all actions needed by KanbanBoard, KanbanColumn, KanbanCard components
- i18n translations cover all copy from the UI-SPEC copywriting contract
- Router auth guard ensures unauthenticated users are redirected to login

## Self-Check: PASSED

All 16 files verified present. Both task commits (1043eccb0, e51aa707d) found in git log.

---
*Phase: 04-kanban-frontend*
*Completed: 2026-04-10*
