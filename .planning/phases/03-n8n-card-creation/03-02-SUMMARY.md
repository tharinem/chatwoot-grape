---
phase: 03-n8n-card-creation
plan: 02
subsystem: api
tags: [fastify, bullmq, webhook, api-key-auth, upsert, idempotency]

requires:
  - phase: 03-n8n-card-creation
    plan: 01
    provides: "Redis config, API key helpers, seedApiKey service, webhook/api-key Zod schemas, ApiKey Prisma model"
provides:
  - "POST /api/v1/webhooks/chatwoot endpoint with API key auth and 202 response"
  - "BullMQ card-creation queue with exponential backoff"
  - "BullMQ worker with prisma.card.upsert idempotency"
  - "API key auth Fastify plugin (authenticateApiKey decorator)"
  - "POST /api/v1/api-keys and DELETE /api/v1/api-keys/:id admin routes"
  - "API key auto-seed on first Chatwoot token exchange"
affects: [04-kanban-frontend]

tech-stack:
  added: []
  patterns: [Fastify plugin decorator for API key auth, BullMQ queue+worker with upsert idempotency, empty-update upsert pattern]

key-files:
  created:
    - kanban-api/src/plugins/api-key-auth.ts
    - kanban-api/src/queues/card-creation.queue.ts
    - kanban-api/src/queues/card-creation.worker.ts
    - kanban-api/src/routes/v1/webhooks.ts
    - kanban-api/src/routes/v1/api-keys.ts
  modified:
    - kanban-api/src/routes/v1/auth.ts
    - kanban-api/src/app.ts
    - kanban-api/src/schemas/auth.ts

key-decisions:
  - "Worker uses empty update {} in prisma.card.upsert for idempotent no-op on duplicate conversation_id"
  - "Worker auto-resolves first stage by position ascending — no stage config needed for n8n flow"
  - "Auth response schema extended with optional api_key to surface raw key exactly once on first exchange"

requirements-completed: [API-01, API-02, API-03]

duration: 4min
completed: 2026-04-10
---

# Phase 03 Plan 02: Wiring Summary

**Webhook endpoint, BullMQ queue/worker with upsert idempotency, API key auth plugin, API key management routes, and app.ts wiring for complete n8n card creation flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T05:53:00Z
- **Completed:** 2026-04-10T05:57:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- API key auth plugin decorates Fastify with authenticateApiKey reading x-api-key header
- BullMQ card-creation queue with 3 attempts, exponential backoff, and job retention limits
- BullMQ worker performs prisma.card.upsert with empty update for duplicate conversation_id idempotency
- Worker auto-resolves first stage by position ascending with concurrency 5
- POST /api/v1/webhooks/chatwoot accepts n8n payload, returns 202 with job_id immediately
- POST /api/v1/api-keys regenerates key (revokes existing), DELETE /api/v1/api-keys/:id revokes specific key
- API key auto-seeded on first Chatwoot token exchange, raw key returned once in auth response
- All plugins, routes, and worker registered in app.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create API key auth plugin, BullMQ queue, and BullMQ worker** - `a0d9479` (feat)
2. **Task 2: Create webhook route, API key management routes, wire into app.ts, and seed API key on first auth** - `b394320` (feat)

## Files Created/Modified
- `kanban-api/src/plugins/api-key-auth.ts` - Fastify plugin with authenticateApiKey decorator
- `kanban-api/src/queues/card-creation.queue.ts` - BullMQ queue definition with retry config
- `kanban-api/src/queues/card-creation.worker.ts` - Worker with prisma.card.upsert and stage auto-resolve
- `kanban-api/src/routes/v1/webhooks.ts` - POST /webhooks/chatwoot with API key auth
- `kanban-api/src/routes/v1/api-keys.ts` - POST /api-keys and DELETE /api-keys/:id admin routes
- `kanban-api/src/routes/v1/auth.ts` - Added seedApiKey call and api_key in response
- `kanban-api/src/app.ts` - Registered apiKeyAuthPlugin, webhookRoutes, apiKeyRoutes, startCardCreationWorker
- `kanban-api/src/schemas/auth.ts` - Added optional api_key field to tokenResponseSchema

## Decisions Made
- Worker uses empty update `{}` in upsert for idempotent no-op on duplicate conversation_id
- Worker auto-resolves first stage by position ascending so n8n flow needs no stage configuration
- Auth response schema extended with optional api_key to surface raw key exactly once

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Auth response schema missing api_key field**
- **Found during:** Task 2
- **Issue:** tokenResponseSchema only had `token` field; Fastify serializer would strip the new `api_key` field
- **Fix:** Added `api_key: z.string().optional()` to tokenResponseSchema
- **Files modified:** kanban-api/src/schemas/auth.ts
- **Commit:** b394320

## Issues Encountered
None.

## Known Stubs
None - all endpoints are fully wired to real data sources.

## Next Phase Readiness
- Complete n8n card creation flow is operational end-to-end
- Phase 03 success criteria fully met: webhook returns 202, worker creates card with idempotency, API key auto-generated
- Ready for Phase 04 (Kanban Frontend) which depends on Phase 02 APIs (already complete)

## Self-Check: PASSED

All 8 files verified present. Both commits (a0d9479d4, b3943209f) verified in git log.
