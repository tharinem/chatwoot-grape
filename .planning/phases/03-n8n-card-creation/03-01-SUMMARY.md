---
phase: 03-n8n-card-creation
plan: 01
subsystem: api
tags: [bullmq, ioredis, redis, prisma, zod, api-key, sha256, webhook]

requires:
  - phase: 02-kanban-api-auth
    provides: "Fastify server, Prisma schema with Card/Stage models, Zod schema patterns"
provides:
  - "ApiKey Prisma model for n8n authentication"
  - "Card idempotency constraint (accountId + conversationId unique)"
  - "Redis connection config for BullMQ workers"
  - "API key generate/hash/verify utilities with SHA-256"
  - "seedApiKey service for auto-provisioning"
  - "Webhook payload and response Zod schemas"
  - "API key management Zod schemas"
affects: [03-02-n8n-card-creation]

tech-stack:
  added: [bullmq, ioredis]
  patterns: [ConnectionOptions config object for BullMQ, SHA-256 + salt API key hashing, timingSafeEqual verification]

key-files:
  created:
    - kanban-api/src/lib/redis.ts
    - kanban-api/src/lib/api-key.ts
    - kanban-api/src/services/api-key-seed.ts
    - kanban-api/src/schemas/webhook.ts
    - kanban-api/src/schemas/api-key.ts
  modified:
    - kanban-api/package.json
    - kanban-api/prisma/schema.prisma

key-decisions:
  - "Redis config exported as ConnectionOptions object, not IORedis instance — BullMQ manages its own connections"
  - "API key uses SHA-256 with random salt and prefix-based lookup for efficient verification"

patterns-established:
  - "BullMQ Redis config: export ConnectionOptions with maxRetriesPerRequest: null and dedicated DB index"
  - "API key pattern: 64-char hex key, 8-char prefix for fast lookup, SHA-256+salt hash, timingSafeEqual compare"

requirements-completed: [API-01, API-02]

duration: 6min
completed: 2026-04-10
---

# Phase 03 Plan 01: Foundation Summary

**ApiKey Prisma model, Card idempotency constraint, BullMQ/ioredis deps, Redis config, API key SHA-256 helpers, and webhook Zod schemas**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-10T05:40:49Z
- **Completed:** 2026-04-10T05:47:05Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ApiKey model in Prisma with keyHash, salt, prefix, and indexes for efficient lookup
- Card model idempotency via @@unique([accountId, conversationId]) constraint
- BullMQ-compatible Redis connection config on dedicated DB 2
- API key generate/hash/verify with SHA-256 + salt and timing-safe comparison
- Webhook payload Zod schema requiring contact_name and conversation_id
- API key management Zod schemas for CRUD responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, extend Prisma schema, push migration** - `cd2a523` (feat)
2. **Task 2: Create Redis connection, API key helpers, seed service, and Zod schemas** - `a96ee93` (feat)

## Files Created/Modified
- `kanban-api/prisma/schema.prisma` - Added ApiKey model and Card @@unique constraint
- `kanban-api/package.json` - Added bullmq and ioredis dependencies
- `kanban-api/src/lib/redis.ts` - BullMQ Redis ConnectionOptions config
- `kanban-api/src/lib/api-key.ts` - generateApiKey, hashApiKey, verifyApiKey functions
- `kanban-api/src/services/api-key-seed.ts` - Auto-provision API key per account
- `kanban-api/src/schemas/webhook.ts` - webhookPayloadSchema and webhookResponseSchema
- `kanban-api/src/schemas/api-key.ts` - apiKeySchema and createApiKeyResponseSchema

## Decisions Made
- Redis config exported as ConnectionOptions object (not IORedis instance) so BullMQ manages its own connections per research recommendation
- API key uses SHA-256 with random salt and 8-char prefix for efficient prefix-based database lookup before hash comparison

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All foundation modules ready for Plan 02 to wire into Fastify routes, auth plugin, and BullMQ worker
- ApiKey model and helpers ready for API key auth middleware
- Webhook schema ready for POST /api/v1/webhooks/chatwoot endpoint
- Redis config ready for Queue and Worker instantiation

## Self-Check: PASSED

All 7 files verified present. Both commits (cd2a5233a, a96ee9378) verified in git log.

---
*Phase: 03-n8n-card-creation*
*Completed: 2026-04-10*
