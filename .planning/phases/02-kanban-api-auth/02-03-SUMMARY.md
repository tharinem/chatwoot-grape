---
phase: 02-kanban-api-auth
plan: 03
subsystem: api
tags: [fastify, prisma, zod, cursor-pagination, soft-delete, crud]

# Dependency graph
requires:
  - phase: 02-kanban-api-auth/01
    provides: "Fastify app scaffold, auth plugin, prisma client, error helpers, JWT types"
provides:
  - "Cards CRUD endpoints (list, create, update, soft-delete)"
  - "Cursor-based pagination for card listing"
  - "Card stage movement via PATCH"
  - "Zod validation schemas for all card operations"
affects: [03-kanban-frontend, 04-n8n-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["cursor pagination (take N+1, slice, nextCursor/hasMore)", "snake_case API body to camelCase Prisma field mapping", "Prisma.JsonNull for nullable JSON fields"]

key-files:
  created:
    - kanban-api/src/schemas/card.ts
    - kanban-api/src/routes/v1/cards.ts
  modified:
    - kanban-api/src/app.ts

key-decisions:
  - "Used Prisma.JsonNull cast for nullable JSON fields to satisfy Prisma strict typing"
  - "Snake_case in API request bodies, camelCase in Prisma — manual mapping in route handlers"

patterns-established:
  - "Cursor pagination: fetch limit+1, slice, return data/nextCursor/hasMore"
  - "Soft delete: set deletedAt timestamp, filter deletedAt: null on all reads"
  - "Tenant isolation: every card query includes accountId from JWT payload"

requirements-completed: [API-05]

# Metrics
duration: 8min
completed: 2026-04-10
---

# Phase 02 Plan 03: Cards CRUD Summary

**Cards CRUD endpoints with cursor pagination, soft delete, stage movement, and Zod validation on Fastify**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-10T04:36:18Z
- **Completed:** 2026-04-10T04:44:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Zod schemas for card creation (contact_name only required), update (with stage_id move), and cursor pagination query params
- GET /stages/:stageId/cards with cursor-based pagination returning data/nextCursor/hasMore
- POST /stages/:stageId/cards creating cards with auto-positioned placement
- PATCH /cards/:id supporting field updates and cross-stage movement with target stage ownership verification
- DELETE /cards/:id performing soft delete via deletedAt timestamp
- All queries enforce tenant isolation (accountId) and soft delete filtering (deletedAt: null)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Zod schemas for card endpoints** - `99e081dcc` (feat)
2. **Task 2: Implement cards CRUD routes with cursor pagination, soft delete, and Swagger** - `05719dfe2` (feat)

## Files Created/Modified
- `kanban-api/src/schemas/card.ts` - Zod schemas for card create, update, query, params, and paginated response
- `kanban-api/src/routes/v1/cards.ts` - Cards CRUD route handlers with auth, pagination, soft delete
- `kanban-api/src/app.ts` - Registered cardRoutes under /api/v1 prefix

## Decisions Made
- Used `Prisma.JsonNull` with type cast for nullable JSON `customFields` to satisfy Prisma's strict input typing
- Kept snake_case for API request body fields (matching REST convention) with manual mapping to camelCase Prisma fields in handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma nullable JSON type error**
- **Found during:** Task 2 (cards CRUD routes)
- **Issue:** TypeScript error TS2322 — `null` not assignable to Prisma's `NullableJsonNullValueInput | InputJsonValue`
- **Fix:** Used `Prisma.JsonNull` with `as Prisma.InputJsonValue` cast for customFields null assignments
- **Files modified:** kanban-api/src/routes/v1/cards.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 05719dfe2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the Prisma JSON typing addressed above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cards CRUD API surface complete, ready for frontend Kanban board integration
- n8n integration can now use POST /stages/:stageId/cards to create cards from webhooks

---
*Phase: 02-kanban-api-auth*
*Completed: 2026-04-10*

## Self-Check: PASSED
