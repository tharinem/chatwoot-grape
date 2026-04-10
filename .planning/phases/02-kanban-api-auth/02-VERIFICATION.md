---
phase: 02-kanban-api-auth
verified: 2026-04-10T12:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 2: Kanban API & Auth Verification Report

**Phase Goal:** A standalone Fastify API exists that authenticates users via Chatwoot tokens, issues scoped JWTs, and enforces multi-tenant data isolation on all endpoints
**Verified:** 2026-04-10
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user logged into Chatwoot can obtain a Kanban JWT without entering credentials -- the Chatwoot access_token is validated server-side via /api/v1/profile | VERIFIED | `src/routes/v1/auth.ts` calls `validateChatwootToken()` which fetches `CHATWOOT_BASE_URL/api/v1/profile` with `api_access_token` header; checks `profile.accounts` array for membership; signs JWT with `{user_id, account_id, role}` and `expiresIn: '1h'` |
| 2 | Every Kanban API response only contains data belonging to the authenticated user's account_id -- a token from account A cannot retrieve account B's data | VERIFIED | All 5 stage queries in `stages.ts` include `accountId: account_id`; all 7 card queries in `cards.ts` include `accountId: account_id`; auth plugin decorates `fastify.authenticate` which calls `jwtVerify()` and populates `request.user` with `account_id`; auth route validates account membership via `profile.accounts.find()` (not top-level `account_id`) |
| 3 | An admin can create, rename, reorder, and delete pipeline stages via the API, and stages are isolated per account | VERIFIED | `stages.ts` implements GET/POST/PATCH/:id/PATCH/reorder/DELETE; write operations check `requireAdmin(role)` returning 403 if not administrator; reorder uses `prisma.$transaction()`; DELETE checks for active cards (409 Conflict); all queries scoped by `accountId` |
| 4 | API documentation is auto-generated (OpenAPI/Swagger) and accessible in a browser | VERIFIED | `plugins/swagger.ts` registers `@fastify/swagger` with `jsonSchemaTransform` from `fastify-type-provider-zod` and `@fastify/swagger-ui` at `/docs`; all route definitions include `schema` objects with Zod schemas for request/response |
| 5 | Cards can be listed, updated, and moved between stages via REST endpoints | VERIFIED | `cards.ts` implements GET `/stages/:stageId/cards` with cursor pagination (take limit+1, nextCursor, hasMore), POST (contact_name only required), PATCH `/cards/:id` with `stage_id` for stage movement (validates target stage ownership), DELETE (soft delete via `deletedAt: new Date()`) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `kanban-api/package.json` | ESM project with Fastify 5 deps | VERIFIED | `"type": "module"`, fastify@5, @fastify/jwt@10, prisma@6, zod@3 all present |
| `kanban-api/tsconfig.json` | Strict TS config | VERIFIED | `"module": "Node16"`, `"strict": true` |
| `kanban-api/prisma/schema.prisma` | Stage and Card models with tenant isolation | VERIFIED | Both models have `accountId Int @map("account_id")`, proper indexes, Card has `deletedAt DateTime?` for soft delete, `@@unique([accountId, position])` on Stage |
| `kanban-api/src/app.ts` | Fastify app factory | VERIFIED | Exports `buildApp()`, registers all plugins (swagger, cors, rate-limit, auth) and routes (health, auth, stages, cards) with `/api/v1` prefix |
| `kanban-api/src/server.ts` | Server entry point | VERIFIED | Imports `buildApp`, listens on PORT 3001 |
| `kanban-api/src/services/chatwoot-auth.ts` | Chatwoot token validation | VERIFIED | Exports `validateChatwootToken()`, uses `api_access_token` header (not Bearer), returns null on failure |
| `kanban-api/src/plugins/auth.ts` | JWT sign/verify + authenticate decorator | VERIFIED | Registers `@fastify/jwt` with `JWT_SECRET`, decorates `fastify.authenticate`, TypeScript declaration merging for payload types |
| `kanban-api/src/middleware/tenant.ts` | JwtPayload type | VERIFIED | Exports `JwtPayload` interface with `user_id`, `account_id`, `role` |
| `kanban-api/src/routes/v1/auth.ts` | Token exchange endpoint | VERIFIED | POST `/auth/chatwoot-token`, validates token, checks accounts array, seeds stages, signs JWT |
| `kanban-api/src/routes/v1/stages.ts` | Stages CRUD | VERIFIED | 5 endpoints (GET, POST, PATCH/:id, PATCH/reorder, DELETE), admin guards, tenant isolation, $transaction for reorder |
| `kanban-api/src/routes/v1/cards.ts` | Cards CRUD + pagination | VERIFIED | 4 endpoints (GET with cursor pagination, POST, PATCH with stage move, DELETE soft-delete), tenant + soft-delete filtering |
| `kanban-api/src/schemas/auth.ts` | Auth Zod schemas | VERIFIED | Exports `chatwootTokenSchema`, `tokenResponseSchema` |
| `kanban-api/src/schemas/stage.ts` | Stage Zod schemas | VERIFIED | Exports `createStageSchema`, `updateStageSchema`, `reorderStagesSchema`, `stageParamsSchema`, `stageSchema` |
| `kanban-api/src/schemas/card.ts` | Card Zod schemas | VERIFIED | Exports `createCardSchema`, `updateCardSchema`, `cardQuerySchema`, `paginatedCardsSchema`, param schemas |
| `kanban-api/src/services/stage-seed.ts` | Default stage seeding | VERIFIED | 6 default stages (Prospecao through Perdido), `skipDuplicates: true`, checks existing count before seeding |
| `kanban-api/src/lib/prisma.ts` | Prisma client singleton | VERIFIED | Exports PrismaClient instance |
| `kanban-api/src/lib/errors.ts` | RFC 7807 error helper | VERIFIED | Exports `problemResponse()` with `type`, `title`, `status`, `detail` |
| `kanban-api/src/plugins/swagger.ts` | OpenAPI docs | VERIFIED | Registers swagger with `jsonSchemaTransform`, UI at `/docs` |
| `kanban-api/src/plugins/cors.ts` | CORS plugin | VERIFIED | `origin: true`, `credentials: true` |
| `kanban-api/src/plugins/rate-limit.ts` | Rate limiting | VERIFIED | `max: 100`, `timeWindow: '1 minute'` |
| `kanban-api/src/routes/health.ts` | Health check | VERIFIED | GET `/health` returns `{ status: 'ok', timestamp }` |
| `kanban-api/.env.example` | Env template | VERIFIED | Contains DATABASE_URL, JWT_SECRET, CHATWOOT_BASE_URL, PORT |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routes/v1/auth.ts` | `services/chatwoot-auth.ts` | `validateChatwootToken()` call | WIRED | Line 20: `const profile = await validateChatwootToken(chatwoot_token)` |
| `routes/v1/auth.ts` | `plugins/auth.ts` | `fastify.jwt.sign()` | WIRED | Line 34: `fastify.jwt.sign({ user_id, account_id, role }, { expiresIn: '1h' })` |
| `routes/v1/auth.ts` | `services/stage-seed.ts` | `seedDefaultStages()` call | WIRED | Line 32: `await seedDefaultStages(prisma, account_id)` |
| `routes/v1/stages.ts` | `plugins/auth.ts` | `onRequest: [fastify.authenticate]` | WIRED | All 5 route handlers use `onRequest: [fastify.authenticate]` |
| `routes/v1/stages.ts` | `lib/prisma.ts` | `prisma.stage.*` queries | WIRED | 6 prisma.stage calls, all with `accountId: account_id` |
| `routes/v1/stages.ts` | `schemas/stage.ts` | Schema validation in route defs | WIRED | Imports and uses all 5 schemas in route `schema` objects |
| `routes/v1/cards.ts` | `plugins/auth.ts` | `onRequest: [fastify.authenticate]` | WIRED | All 4 route handlers use `onRequest: [fastify.authenticate]` |
| `routes/v1/cards.ts` | `lib/prisma.ts` | `prisma.card.*` queries | WIRED | 7 prisma.card calls, all with `accountId: account_id` AND `deletedAt: null` |
| `routes/v1/cards.ts` | `schemas/card.ts` | Schema validation in route defs | WIRED | Imports and uses all schemas in route `schema` objects |
| `app.ts` | All route modules | `fastify.register()` | WIRED | Registers authRoutes, stageRoutes, cardRoutes with `/api/v1` prefix, healthRoutes at root |
| `plugins/auth.ts` | `@fastify/jwt` | Plugin registration | WIRED | Line 19: `await fastify.register(fastifyJwt, { secret: process.env.JWT_SECRET! })` |
| `plugins/swagger.ts` | `fastify-type-provider-zod` | `jsonSchemaTransform` | WIRED | Line 4: imported, Line 16: used as `transform` option |

### Data-Flow Trace (Level 4)

Not applicable -- this is a backend API phase with no rendering components. Data flow is verified through the key link verification above (DB queries produce real data when connected to a running PostgreSQL instance).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | No errors | PASS |
| All modules importable | Verified via tsc --noEmit (no missing imports) | Clean compilation | PASS |
| Server entry point wired | `server.ts` imports and calls `buildApp()` | Correctly wired | PASS |

Note: Cannot test HTTP endpoints without running PostgreSQL and the server. Runtime behavioral testing requires human verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| AUTH-01 | 02-01 | User logged into Chatwoot accesses Kanban without second login | SATISFIED | Token exchange endpoint accepts Chatwoot token, returns Kanban JWT |
| AUTH-02 | 02-01 | Token validated server-side via /api/v1/profile | SATISFIED | `chatwoot-auth.ts` fetches `/api/v1/profile` with `api_access_token` header |
| AUTH-03 | 02-01 | Kanban API issues short-lived JWT (1h), never persists Chatwoot token | SATISFIED | `auth.ts` signs JWT with `expiresIn: '1h'`; Chatwoot token not stored |
| AUTH-04 | 02-01 | Every request scoped to account_id from JWT | SATISFIED | `authenticate` decorator extracts JWT; all queries use `account_id` from `request.user` |
| TENANT-01 | 02-01 | All queries filter by account_id | SATISFIED | Every prisma query in stages.ts and cards.ts includes `accountId: account_id` |
| TENANT-02 | 02-02 | Token from one account cannot access another's data | SATISFIED | Auth validates account membership in `profile.accounts`; all queries scoped; reorder uses `accountId` in WHERE |
| TENANT-03 | 02-02 | Stages configured per account independently | SATISFIED | Stage model has `accountId`; GET returns only matching account's stages; seed creates per-account |
| API-04 | 02-02 | OpenAPI/Swagger auto-generated and accessible via browser | SATISFIED | Swagger UI at `/docs` with `jsonSchemaTransform`; all routes have Zod schemas |
| API-05 | 02-03 | API allows listing, updating, and moving cards between stages | SATISFIED | GET with pagination, PATCH with `stage_id` for moves, POST, DELETE (soft) |

No orphaned requirements found. REQUIREMENTS.md maps AUTH-01 through AUTH-04, TENANT-01 through TENANT-03, API-04, and API-05 to Phase 2 -- all accounted for in plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | -- | -- | -- |

No TODOs, FIXMEs, placeholders, empty implementations, or stub patterns detected. The two `return null` occurrences in `chatwoot-auth.ts` are intentional error handling (returning null when Chatwoot token validation fails).

### Human Verification Required

### 1. End-to-end token exchange flow

**Test:** Start the Fastify server with a running PostgreSQL and Chatwoot instance. POST to `/api/v1/auth/chatwoot-token` with a valid Chatwoot user_access_token and account_id.
**Expected:** Returns `{ token: "<JWT>" }` where the JWT decodes to `{ user_id, account_id, role }` with 1h expiry. Default stages are seeded for the account.
**Why human:** Requires running PostgreSQL, Chatwoot instance, and network connectivity between services.

### 2. Cross-tenant isolation at runtime

**Test:** Obtain JWTs for two different Chatwoot accounts. Use account A's JWT to request stages/cards. Verify no account B data appears. Attempt to PATCH a stage from account B using account A's JWT.
**Expected:** GET returns only account A's data. PATCH on account B's stage returns 404 (not 403, since the stage is invisible).
**Why human:** Requires two Chatwoot accounts and running services for end-to-end validation.

### 3. Swagger UI renders correctly

**Test:** Open `/docs` in a browser after starting the server.
**Expected:** All endpoints visible with request/response schemas, security scheme shown, and "Try it out" functional.
**Why human:** Visual verification of rendered Swagger UI.

### Gaps Summary

No gaps found. All 5 success criteria are verified at the code level. All 9 requirement IDs (AUTH-01 through AUTH-04, TENANT-01 through TENANT-03, API-04, API-05) are satisfied with concrete implementation evidence. TypeScript compiles cleanly. No anti-patterns or stubs detected. Three items flagged for human verification require running services that cannot be tested statically.

---

_Verified: 2026-04-10_
_Verifier: Claude (gsd-verifier)_
