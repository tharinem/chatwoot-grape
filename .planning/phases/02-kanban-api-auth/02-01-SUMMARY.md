---
phase: 02-kanban-api-auth
plan: 01
subsystem: api, auth
tags: [fastify, prisma, jwt, zod, typescript, multi-tenant]

requires: []
provides:
  - "Fastify 5 project scaffold with ESM, Zod type provider, Swagger UI"
  - "Prisma schema with Stage and Card models isolated by account_id"
  - "Chatwoot token exchange endpoint (POST /api/v1/auth/chatwoot-token)"
  - "JWT auth plugin with authenticate decorator"
  - "Default stage seeding per account on first auth"
  - "JwtPayload type for tenant isolation in downstream routes"
affects: [02-kanban-api-auth, 03-kanban-frontend, 04-chatwoot-iframe]

tech-stack:
  added: [fastify@5, prisma@6, "@prisma/client@6", zod@3, "fastify-type-provider-zod@5", "@fastify/jwt@10", "@fastify/swagger@9", "@fastify/swagger-ui@5", "@fastify/cors@11", "@fastify/rate-limit@10", fastify-plugin@5, typescript@5, tsx]
  patterns: [fastify-plugin wrapping, Zod-driven validation+swagger, RFC 7807 error responses, ESM with Node16 module resolution]

key-files:
  created:
    - kanban-api/package.json
    - kanban-api/tsconfig.json
    - kanban-api/prisma/schema.prisma
    - kanban-api/src/app.ts
    - kanban-api/src/server.ts
    - kanban-api/src/lib/prisma.ts
    - kanban-api/src/lib/errors.ts
    - kanban-api/src/plugins/auth.ts
    - kanban-api/src/plugins/swagger.ts
    - kanban-api/src/plugins/cors.ts
    - kanban-api/src/plugins/rate-limit.ts
    - kanban-api/src/routes/health.ts
    - kanban-api/src/routes/v1/auth.ts
    - kanban-api/src/services/chatwoot-auth.ts
    - kanban-api/src/services/stage-seed.ts
    - kanban-api/src/schemas/auth.ts
    - kanban-api/src/middleware/tenant.ts
    - kanban-api/.env.example
  modified: []

key-decisions:
  - "Used fastify-type-provider-zod@5 instead of @6 because v6 requires Zod 4+; staying on Zod 3 per research recommendation"
  - "Chatwoot token validated via api_access_token header (not Authorization: Bearer) per verified Chatwoot source code"
  - "JWT payload contains user_id, account_id, role with 1h expiry; no refresh token (re-auth via Chatwoot token)"
  - "Default stages seeded with createMany + skipDuplicates for race condition safety"

patterns-established:
  - "Plugin pattern: wrap all Fastify plugins with fastify-plugin for encapsulation"
  - "Auth pattern: onRequest hook with fastify.authenticate decorator for protected routes"
  - "Tenant pattern: account_id extracted from JWT payload, used in all Prisma queries"
  - "Error pattern: RFC 7807 problemResponse helper for consistent error format"
  - "Schema pattern: Zod schemas drive validation, TypeScript types, and OpenAPI docs simultaneously"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, TENANT-01]

duration: 7min
completed: 2026-04-10
---

# Phase 02 Plan 01: Kanban API Scaffold & Auth Summary

**Fastify 5 API scaffold with Prisma Stage/Card models, Chatwoot token exchange for JWT auth, and tenant isolation by account_id**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-10T04:26:49Z
- **Completed:** 2026-04-10T04:33:39Z
- **Tasks:** 2
- **Files created:** 19

## Accomplishments
- Scaffolded kanban-api Fastify 5 ESM project with all dependencies, Swagger UI, CORS, and rate limiting
- Defined Prisma schema with Stage and Card models, both isolated by account_id with proper indexes and soft delete
- Implemented Chatwoot token exchange endpoint that validates via /api/v1/profile and issues scoped JWTs
- Created authenticate decorator and JwtPayload type for protecting routes in subsequent plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold kanban-api project with dependencies and Prisma schema** - `0cf430ad9` (feat)
2. **Task 2: Implement Chatwoot token exchange, JWT auth plugin, and tenant middleware** - `b470646f3` (feat)

## Files Created/Modified
- `kanban-api/package.json` - ESM project with Fastify 5, Prisma 6, Zod 3 dependencies
- `kanban-api/tsconfig.json` - Strict TypeScript config with Node16 module resolution
- `kanban-api/prisma/schema.prisma` - Stage and Card models with account_id isolation, indexes, soft delete
- `kanban-api/src/app.ts` - Fastify app factory with Zod type provider and all plugins registered
- `kanban-api/src/server.ts` - Server entry point listening on PORT 3001
- `kanban-api/src/lib/prisma.ts` - Prisma client singleton
- `kanban-api/src/lib/errors.ts` - RFC 7807 problem response helper
- `kanban-api/src/plugins/auth.ts` - @fastify/jwt registration with authenticate decorator
- `kanban-api/src/plugins/swagger.ts` - OpenAPI spec generation with Zod schema transform
- `kanban-api/src/plugins/cors.ts` - CORS with credentials support
- `kanban-api/src/plugins/rate-limit.ts` - 100 req/min rate limiting
- `kanban-api/src/routes/health.ts` - GET /health endpoint
- `kanban-api/src/routes/v1/auth.ts` - POST /api/v1/auth/chatwoot-token endpoint
- `kanban-api/src/services/chatwoot-auth.ts` - Chatwoot profile validation with api_access_token header
- `kanban-api/src/services/stage-seed.ts` - Default stage seeding with 6 pipeline stages
- `kanban-api/src/schemas/auth.ts` - Zod schemas for auth request/response
- `kanban-api/src/middleware/tenant.ts` - JwtPayload type export for tenant context
- `kanban-api/.env.example` - Environment variable template
- `kanban-api/.gitignore` - Ignore node_modules, dist, .env

## Decisions Made
- Used fastify-type-provider-zod@5 instead of @6 because v6 requires Zod 4+ and research recommends staying on Zod 3.x for compatibility
- Chatwoot token validated via `api_access_token` header (not `Authorization: Bearer`) per verified Chatwoot source code
- JWT payload contains `user_id`, `account_id`, `role` with 1h expiry; no refresh token needed (re-auth via Chatwoot token per D-06/D-07)
- Default stages seeded with `createMany` + `skipDuplicates: true` for race condition safety per Pitfall 4

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fastify-type-provider-zod version downgrade**
- **Found during:** Task 1 (dependency installation)
- **Issue:** fastify-type-provider-zod@6.1.0 requires Zod 4+ as peer dependency, conflicting with Zod 3.x
- **Fix:** Installed fastify-type-provider-zod@5.1.0 which supports Zod 3.25+
- **Files modified:** kanban-api/package.json
- **Verification:** npm install succeeds, TypeScript compiles clean
- **Committed in:** 0cf430ad9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor version adjustment. API surface identical; no functional difference.

## Issues Encountered
None beyond the dependency resolution noted in deviations.

## Known Stubs
None - all code is functional. Database requires PostgreSQL to be running for actual use.

## Next Phase Readiness
- Auth foundation complete: token exchange, JWT signing, authenticate decorator all in place
- Prisma schema ready for Stage and Card CRUD endpoints (Plan 02-02)
- Routes can use `onRequest: [fastify.authenticate]` pattern for protection
- PostgreSQL required for runtime (documented in .env.example)

## Self-Check: PASSED

All 19 files verified present. Both task commits (0cf430ad9, b470646f3) verified in git log.

---
*Phase: 02-kanban-api-auth*
*Completed: 2026-04-10*
