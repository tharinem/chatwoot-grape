---
phase: 03-n8n-card-creation
verified: 2026-04-10T06:30:00Z
status: passed
score: 3/3 must-haves verified
gaps: []
---

# Phase 3: n8n Card Creation Verification Report

**Phase Goal:** n8n can automatically create Kanban cards when new conversations arrive in Chatwoot, with guaranteed idempotency and fast webhook response
**Verified:** 2026-04-10T06:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An n8n workflow can POST conversation data to the Kanban API and a card appears on the board | VERIFIED | `POST /webhooks/chatwoot` route exists in `webhooks.ts` with `onRequest: [fastify.authenticateApiKey]`, validates body via `webhookPayloadSchema` (requires `contact_name`, `conversation_id`), enqueues to BullMQ `card-creation` queue, worker performs `prisma.card.upsert` with auto-resolved first stage. Route registered in `app.ts` with `/api/v1` prefix. |
| 2 | Sending the same conversation_id twice does not create a duplicate card | VERIFIED | Prisma schema has `@@unique([accountId, conversationId])` on Card model (line 44 of schema.prisma). Worker uses `prisma.card.upsert` with `where: { accountId_conversationId: { accountId, conversationId } }` and `update: {}` (empty update = no-op on duplicate). |
| 3 | The API responds to webhook POSTs in under 100ms (immediate acknowledgment, async processing if needed) | VERIFIED | Webhook handler only calls `cardCreationQueue.add('create-card', ...)` then returns `reply.code(202).send({ status: 'accepted', job_id: job.id! })`. No DB write in the request path -- all card creation happens asynchronously in the BullMQ worker. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `kanban-api/prisma/schema.prisma` | ApiKey model + Card unique constraint | VERIFIED | ApiKey model with id, accountId, keyHash, salt, prefix, timestamps, indexes. Card has `@@unique([accountId, conversationId])`. |
| `kanban-api/src/lib/redis.ts` | IORedis ConnectionOptions for BullMQ | VERIFIED | Exports `redisConnection` with `maxRetriesPerRequest: null`, DB 2 default, env-configurable host/port/password. 9 lines, substantive. |
| `kanban-api/src/lib/api-key.ts` | API key generation, hashing, verification | VERIFIED | Exports `generateApiKey` (64-char hex, 8-char prefix, SHA-256+salt), `hashApiKey`, `verifyApiKey` (prefix lookup, `timingSafeEqual`). 54 lines. |
| `kanban-api/src/schemas/webhook.ts` | Webhook payload/response Zod schemas | VERIFIED | Exports `webhookPayloadSchema` with required `contact_name` and `conversation_id`, optional fields. Exports `webhookResponseSchema`. |
| `kanban-api/src/schemas/api-key.ts` | API key management Zod schemas | VERIFIED | Exports `apiKeySchema` and `createApiKeyResponseSchema` with proper fields. |
| `kanban-api/src/services/api-key-seed.ts` | Auto-provision API key per account | VERIFIED | Exports `seedApiKey`, checks for existing non-revoked key, generates and creates if missing, returns raw key once. |
| `kanban-api/src/plugins/api-key-auth.ts` | authenticateApiKey Fastify decorator | VERIFIED | Reads `x-api-key` header, calls `verifyApiKey`, sets `request.apiKeyAccount`. Returns 401 on missing/invalid key. |
| `kanban-api/src/queues/card-creation.queue.ts` | BullMQ queue with retry config | VERIFIED | Exports `cardCreationQueue` (name: `card-creation`), `CardCreationJobData` interface. 3 attempts, exponential backoff. |
| `kanban-api/src/queues/card-creation.worker.ts` | BullMQ worker with Prisma upsert | VERIFIED | Exports `startCardCreationWorker`, auto-resolves first stage by position asc, `prisma.card.upsert` with `update: {}`, concurrency 5. |
| `kanban-api/src/routes/v1/webhooks.ts` | POST /webhooks/chatwoot endpoint | VERIFIED | Uses `authenticateApiKey`, maps snake_case to camelCase, enqueues job, returns 202. |
| `kanban-api/src/routes/v1/api-keys.ts` | POST /api-keys and DELETE /api-keys/:id | VERIFIED | Admin-only (role check), revokes existing before regeneration, proper 204 on delete. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `webhooks.ts` | `card-creation.queue.ts` | `cardCreationQueue.add` | WIRED | Line 22: `cardCreationQueue.add('create-card', {...})` |
| `card-creation.worker.ts` | `prisma.ts` | `prisma.card.upsert` | WIRED | Line 28: `prisma.card.upsert({...})` with compound unique where clause |
| `api-key-auth.ts` | `api-key.ts` | `verifyApiKey import` | WIRED | Line 3: `import { verifyApiKey } from '../lib/api-key.js'`, line 28: `verifyApiKey(prisma, apiKey)` |
| `app.ts` | `card-creation.worker.ts` | `startCardCreationWorker call` | WIRED | Line 19: import, line 40: `startCardCreationWorker()` |
| `auth.ts` | `api-key-seed.ts` | `seedApiKey call` | WIRED | Line 5: `import { seedApiKey }`, line 34: `seedApiKey(prisma, account_id)` |
| `app.ts` | `webhooks.ts` | Route registration | WIRED | Line 17: import, line 37: `app.register(webhookRoutes, { prefix: '/api/v1' })` |
| `app.ts` | `api-keys.ts` | Route registration | WIRED | Line 18: import, line 38: `app.register(apiKeyRoutes, { prefix: '/api/v1' })` |
| `app.ts` | `api-key-auth.ts` | Plugin registration | WIRED | Line 12: import, line 31: `app.register(apiKeyAuthPlugin)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `webhooks.ts` | `request.body` (webhook payload) | External POST from n8n | Yes -- passed to BullMQ job | FLOWING |
| `card-creation.worker.ts` | `job.data` | BullMQ queue | Yes -- `prisma.card.upsert` creates real DB record | FLOWING |
| `api-keys.ts` | `generateApiKey()` return | crypto.randomBytes | Yes -- `prisma.apiKey.create` persists to DB | FLOWING |
| `auth.ts` | `apiKeyRaw` | `seedApiKey` call | Yes -- returns raw key from DB creation | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running server with Redis and PostgreSQL connections)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| API-01 | 03-01, 03-02 | API REST permite criar cards via POST com dados da conversa (usado pelo n8n) | SATISFIED | `POST /api/v1/webhooks/chatwoot` accepts conversation data, BullMQ worker creates card via `prisma.card.upsert` |
| API-02 | 03-01, 03-02 | Criacao de card e idempotente -- mesma conversation_id nao gera card duplicado | SATISFIED | `@@unique([accountId, conversationId])` constraint + `prisma.card.upsert` with `update: {}` |
| API-03 | 03-02 | API responde em menos de 100ms para webhooks do n8n (acknowledge rapido) | SATISFIED | Webhook handler only enqueues BullMQ job, returns 202 immediately -- no DB write in request path |

No orphaned requirements found -- REQUIREMENTS.md traceability table maps only API-01, API-02, API-03 to Phase 3, matching the plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | No anti-patterns detected | -- | -- |

No TODOs, FIXMEs, placeholders, or stub patterns found in any phase 03 files. The `return null` values in `api-key.ts` and `api-key-seed.ts` are legitimate control flow (verification failure / already-exists signals), not stubs.

### Human Verification Required

### 1. End-to-end webhook flow with live services

**Test:** Start the Kanban API with Redis and PostgreSQL running. Obtain an API key via token exchange. POST to `/api/v1/webhooks/chatwoot` with a valid payload and `x-api-key` header.
**Expected:** 202 response with `job_id`, card appears in database within seconds.
**Why human:** Requires live Redis (BullMQ) and PostgreSQL (Prisma) services running.

### 2. Idempotency with real duplicate POST

**Test:** POST the same `conversation_id` twice to the webhook endpoint.
**Expected:** Only one card exists in the database. Second POST returns 202 but no duplicate card created.
**Why human:** Requires live database to verify the unique constraint behavior end-to-end.

### 3. Response time under 100ms

**Test:** Measure response time of webhook POST using `curl -w "%{time_total}"`.
**Expected:** Total time under 100ms (excluding network latency).
**Why human:** Requires running server to measure actual response time.

### Gaps Summary

No gaps found. All three observable truths are verified. All 11 artifacts exist, are substantive (no stubs), and are properly wired together through imports and function calls. All three requirements (API-01, API-02, API-03) are satisfied with clear implementation evidence. The webhook flow is fully wired end-to-end: API key auth plugin -> webhook route -> BullMQ queue -> worker with Prisma upsert idempotency. The auth response schema was correctly extended to include the optional `api_key` field for first-time key provisioning.

---

_Verified: 2026-04-10T06:30:00Z_
_Verifier: Claude (gsd-verifier)_
