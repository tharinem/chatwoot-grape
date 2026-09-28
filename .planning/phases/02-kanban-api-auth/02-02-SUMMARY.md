---
phase: 02-kanban-api-auth
plan: 02
subsystem: api
tags: [fastify, prisma, zod, crud, tenant-isolation, admin-rbac, swagger]

requires:
  - phase: 02-kanban-api-auth/01
    provides: "Auth plugin, JWT decorator, Prisma client, error helpers, Stage model"
provides:
  - "Stage CRUD endpoints (GET, POST, PATCH, DELETE) at /api/v1/stages"
  - "Stage reorder endpoint with atomic transaction at /api/v1/stages/reorder"
  - "Zod validation schemas for all stage operations"
  - "Admin-only write guard pattern for Fastify routes"
affects: [03-kanban-frontend, 04-chatwoot-integration]

tech-stack:
  added: []
  patterns:
    - "requireAdmin helper for role-based route guards"
    - "Prisma compound where with accountId for tenant isolation"
    - "prisma.$transaction for atomic batch updates"
    - "Zod schemas in route definitions for Swagger auto-generation"

key-files:
  created:
    - kanban-api/src/schemas/stage.ts
    - kanban-api/src/routes/v1/stages.ts
  modified:
    - kanban-api/src/app.ts

key-decisions:
  - "Used Prisma P2025 error code to detect not-found on update/delete instead of separate findFirst"
  - "Reorder endpoint registered before /:id to avoid Fastify route conflict"
  - "DELETE returns 409 Conflict when stage has active (non-deleted) cards"

patterns-established:
  - "Admin guard: requireAdmin(role) helper returns boolean, routes call problemResponse(403) if false"
  - "Tenant isolation: every Prisma query includes accountId: account_id from JWT payload"
  - "Atomic reorder: prisma.$transaction with array of update operations"

requirements-completed: [TENANT-02, TENANT-03, API-04]

duration: 6min
completed: 2026-04-10
---

# Phase 02 Plan 02: Stages CRUD Summary

**Full CRUD + reorder endpoints for pipeline stages with admin-only writes, tenant-scoped queries, and Swagger schema generation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-10T04:36:03Z
- **Completed:** 2026-04-10T04:42:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Zod validation schemas for all stage request/response payloads
- Five stage endpoints (list, create, update, reorder, delete) with tenant isolation on every query
- Admin-only enforcement on all write operations via role check
- Atomic reorder using prisma.$transaction for consistent position updates
- Swagger auto-documentation via Zod schemas in route definitions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Zod schemas for stage endpoints** - `99e081dcc` (feat)
2. **Task 2: Implement stages CRUD routes with admin guards and tenant isolation** - `1cbfc1215` (feat)

## Files Created/Modified
- `kanban-api/src/schemas/stage.ts` - Zod schemas for create, update, reorder, params, and response
- `kanban-api/src/routes/v1/stages.ts` - Stage CRUD + reorder routes with auth, admin guard, tenant isolation
- `kanban-api/src/app.ts` - Registered stageRoutes under /api/v1 prefix

## Decisions Made
- Used Prisma error code P2025 to detect record-not-found on update/delete, avoiding extra findFirst queries
- Registered PATCH /stages/reorder before PATCH /stages/:id to prevent Fastify treating "reorder" as a param
- DELETE endpoint checks for active (non-deleted) cards and returns 409 Conflict to prevent orphaned cards

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Stage endpoints are ready for frontend consumption in Phase 03 (Kanban frontend)
- Card endpoints (Plan 03) can reference stage IDs from these endpoints
- Swagger docs at /docs will show all stage schemas for API consumers

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 02-kanban-api-auth*
*Completed: 2026-04-10*
