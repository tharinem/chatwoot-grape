# Phase 2: Kanban API & Auth - Research

**Researched:** 2026-04-10
**Domain:** Fastify 5 REST API with JWT auth, Prisma ORM, multi-tenant isolation
**Confidence:** HIGH

## Summary

This phase builds a standalone Fastify 5 microservice that authenticates users via Chatwoot's `/api/v1/profile` endpoint, issues scoped JWTs, and exposes CRUD endpoints for pipeline stages and cards with strict multi-tenant isolation by `account_id`. The Chatwoot source code was inspected directly to verify the profile endpoint response format -- it returns `id`, `account_id`, `role`, `email`, `name`, and a full `accounts` array with per-account roles. The authentication header is `api_access_token` (not `Authorization: Bearer`).

The stack is locked by prior research (STACK.md): Fastify 5, Prisma 6, TypeScript 5, Node 22 LTS, PostgreSQL 15. All package versions have been verified against npm registry. The key integration pattern is: receive Chatwoot `user_access_token` -> validate server-side via HTTP call to Chatwoot `/api/v1/profile` -> extract user/account/role -> sign a short-lived Kanban JWT (1h) -> use that JWT for all subsequent requests. Prisma 6.x (not 7.x) is the correct choice -- Prisma 7 introduced breaking ESM-only requirements and driver adapter mandates that add unnecessary complexity for a greenfield project.

**Primary recommendation:** Use `fastify-type-provider-zod` as the bridge between Zod schemas, Fastify route validation, and OpenAPI doc generation -- a single schema definition drives type safety, runtime validation, and Swagger docs simultaneously.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Soft delete para cards -- campo `deleted_at` nullable. Cards deletados ficam ocultos mas recuperaveis.
- **D-02:** Unico campo obrigatorio para criar card: `contact_name`. Card vai automaticamente para o primeiro estagio da conta.
- **D-03:** Campo `conversation_id` (Chatwoot) e opcional no card -- preenchido pelo n8n, nao obrigatorio para criacao manual.
- **D-04:** Duas tabelas principais: `stages` (colunas do pipeline) e `cards` (leads/deals). Ambas isoladas por `account_id`.
- **D-05:** JWT inclui: `user_id`, `account_id`, `role` (admin/agent). Role extraida do Chatwoot no momento da autenticacao via `/api/v1/profile`.
- **D-06:** JWT tem duracao de 1h. Quando expira, o frontend re-autentica silenciosamente usando o token do Chatwoot que ainda esta valido -- usuario nao percebe.
- **D-07:** Sem refresh token -- re-autenticacao silenciosa via token Chatwoot substitui esse mecanismo.
- **D-08:** Rotas aninhadas: `/api/v1/stages/:id/cards`. Stages e cards sob mesmo prefixo versionado.
- **D-09:** Versionamento no path: `/api/v1/...`. Permite evolucao sem quebrar integracoes (n8n).
- **D-10:** Paginacao por cursor: `?cursor=abc&limit=50`. Mais eficiente que offset quando cards sao movidos entre paginas.
- **D-11:** Novas contas recebem stages default automaticamente na primeira autenticacao (ou via seed).
- **D-12:** Pipeline de vendas classico: Prospeccao -> Qualificado -> Proposta -> Negociacao -> Fechado Ganho -> Perdido. Admin pode personalizar depois.

### Claude's Discretion
- Formato de resposta de erro (RFC 7807 ou formato customizado)
- Estrutura exata do schema Prisma (tipos de campo, indices, constraints)
- Middleware de rate limiting e configuracao
- Estrutura de pastas do projeto Fastify
- Estrategia de testes (unit vs integration)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Usuario logado no Chatwoot acessa o Kanban sem segundo login | Chatwoot `user_access_token` validated via `/api/v1/profile` endpoint; verified response includes user identity + accounts |
| AUTH-02 | Token do Chatwoot validado server-side via `/api/v1/profile` | Chatwoot source inspected: `api_access_token` header, returns `id`, `account_id`, `role`, `accounts[]` |
| AUTH-03 | Kanban API emite JWT proprio de curta duracao (1h) | `@fastify/jwt` v10 handles signing/verification; `sign({ user_id, account_id, role }, { expiresIn: '1h' })` |
| AUTH-04 | Toda requisicao scoped ao account_id do JWT | Fastify `onRequest` hook with `request.jwtVerify()` extracts `account_id` from JWT payload |
| TENANT-01 | Queries filtram por account_id enforced no middleware | Fastify preHandler hook injects `account_id` into request context; all Prisma queries use `where: { accountId }` |
| TENANT-02 | Token de uma conta nao acessa dados de outra | JWT `account_id` is immutable once signed; middleware rejects if resource `account_id` differs |
| TENANT-03 | Estagios configurados por conta independentemente | `stages` table has `account_id` column; default stages seeded per account on first auth |
| API-04 | Documentacao OpenAPI auto-gerada e acessivel | `@fastify/swagger` + `@fastify/swagger-ui` + `fastify-type-provider-zod` generates from route schemas |
| API-05 | Cards podem ser listados, atualizados e movidos via REST | CRUD endpoints under `/api/v1/stages/:stageId/cards` with cursor pagination |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.8.4 | HTTP framework | Built-in JSON schema validation, plugin encapsulation, 2-3x faster than Express |
| @prisma/client | 6.19.3 | ORM / query builder | TypeScript-native, auto-generated types from schema, migration tooling |
| prisma | 6.19.3 | CLI / migration tool | Schema-first migrations, Studio GUI for debugging |
| typescript | 5.x (latest 6.0.2 available, use 5.x for Prisma 6 compat) | Language | End-to-end type safety from DB to API response |
| node | 22 LTS | Runtime | Fastify 5 LTS-supported; stable for production |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/jwt | 10.0.0 | JWT sign/verify | Auth middleware -- sign after Chatwoot validation, verify on every request |
| @fastify/swagger | 9.7.0 | OpenAPI spec generation | Always -- generates spec from route schemas automatically |
| @fastify/swagger-ui | 5.2.5 | Swagger UI serving | Dev/staging -- serves interactive API docs at `/docs` |
| @fastify/cors | 11.2.0 | CORS headers | Always -- iframe origin differs from API origin |
| @fastify/rate-limit | 10.3.0 | Per-IP/account rate limiting | Protect against abuse; configure per-route limits |
| fastify-type-provider-zod | 6.1.0 | Zod-to-JSON-Schema bridge | Unifies runtime validation, TypeScript types, and OpenAPI generation |
| zod | 3.25.x (stay on 3.x) | Schema validation | Define request/response schemas; drives Swagger docs via type provider |
| pino | (bundled with Fastify) | Structured JSON logging | Free -- Fastify uses Pino natively |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma 6.x | Prisma 7.x | Prisma 7 requires ESM-only + driver adapters + new config system -- unnecessary complexity for greenfield; use 6.x |
| Prisma 6.x | Drizzle ORM | Drizzle is lighter but Prisma's migration tooling and Studio are more practical for small team |
| Zod 3.x | Zod 4.x | Zod 4 is newly released; fastify-type-provider-zod may not be fully compatible yet; stay on 3.x |
| @fastify/jwt | custom JWT with jose | @fastify/jwt integrates natively with Fastify decorators and request lifecycle |

**Installation:**
```bash
npm init -y
npm install fastify@5 @fastify/swagger @fastify/swagger-ui @fastify/cors @fastify/jwt @fastify/rate-limit prisma@6 @prisma/client@6 zod@3 fastify-type-provider-zod
npm install -D typescript@5 @types/node tsx
npx prisma init --datasource-provider postgresql
```

## Architecture Patterns

### Recommended Project Structure
```
kanban-api/
├── src/
│   ├── app.ts                  # Fastify instance creation + plugin registration
│   ├── server.ts               # Entry point (starts listening)
│   ├── plugins/
│   │   ├── auth.ts             # @fastify/jwt registration + authenticate decorator
│   │   ├── swagger.ts          # @fastify/swagger + swagger-ui setup
│   │   ├── cors.ts             # CORS configuration
│   │   └── rate-limit.ts       # Rate limiting config
│   ├── routes/
│   │   ├── v1/
│   │   │   ├── auth.ts         # POST /api/v1/auth/chatwoot-token
│   │   │   ├── stages.ts       # CRUD /api/v1/stages
│   │   │   └── cards.ts        # CRUD /api/v1/stages/:stageId/cards
│   │   └── health.ts           # GET /health
│   ├── middleware/
│   │   └── tenant.ts           # account_id extraction + injection from JWT
│   ├── services/
│   │   ├── chatwoot-auth.ts    # Validate token via Chatwoot /api/v1/profile
│   │   └── stage-seed.ts       # Default stages creation for new accounts
│   ├── schemas/
│   │   ├── auth.ts             # Zod schemas for auth endpoints
│   │   ├── stage.ts            # Zod schemas for stage endpoints
│   │   └── card.ts             # Zod schemas for card endpoints
│   └── lib/
│       ├── prisma.ts           # Prisma client singleton
│       └── errors.ts           # Error response formatting (RFC 7807)
├── prisma/
│   ├── schema.prisma           # Data model
│   ├── migrations/             # Generated by prisma migrate
│   └── seed.ts                 # Optional DB seeding script
├── tsconfig.json
├── package.json
└── Dockerfile
```

### Pattern 1: Chatwoot Token Exchange (Auth Flow)
**What:** Client sends Chatwoot `user_access_token`, Kanban API validates it against Chatwoot, exchanges for a short-lived Kanban JWT.
**When to use:** Every initial authentication and JWT refresh.
**Example:**
```typescript
// src/routes/v1/auth.ts
import { z } from 'zod';

const chatwootTokenSchema = z.object({
  chatwoot_token: z.string().min(1),
  account_id: z.number().int().positive(),
});

// POST /api/v1/auth/chatwoot-token
async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/chatwoot-token', {
    schema: {
      body: chatwootTokenSchema,
    },
  }, async (request, reply) => {
    const { chatwoot_token, account_id } = request.body;

    // Validate against Chatwoot
    const profile = await validateChatwootToken(chatwoot_token);
    if (!profile) {
      return reply.code(401).send({ error: 'Invalid Chatwoot token' });
    }

    // Verify user belongs to requested account
    const accountMembership = profile.accounts.find(
      (a: any) => a.id === account_id
    );
    if (!accountMembership) {
      return reply.code(403).send({ error: 'Not a member of this account' });
    }

    // Sign Kanban JWT
    const token = fastify.jwt.sign(
      {
        user_id: profile.id,
        account_id: account_id,
        role: accountMembership.role, // 'administrator' or 'agent'
      },
      { expiresIn: '1h' }
    );

    return { token };
  });
}
```

### Pattern 2: Tenant Isolation Middleware
**What:** Every authenticated route extracts `account_id` from JWT and injects it into the request context. All Prisma queries MUST use this value.
**When to use:** Every route except `/auth/*` and `/health`.
**Example:**
```typescript
// src/plugins/auth.ts
import fp from 'fastify-plugin';

export default fp(async function authPlugin(fastify) {
  fastify.register(import('@fastify/jwt'), {
    secret: process.env.JWT_SECRET!,
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});

// Usage in routes:
fastify.get('/stages', {
  onRequest: [fastify.authenticate],
}, async (request) => {
  const { account_id } = request.user as JwtPayload;
  return prisma.stage.findMany({
    where: { accountId: account_id },
    orderBy: { position: 'asc' },
  });
});
```

### Pattern 3: Cursor-Based Pagination
**What:** Cards are paginated by cursor (card ID) rather than offset for stable results when cards move between stages.
**When to use:** Any list endpoint that may return many records.
**Example:**
```typescript
// Prisma cursor pagination
const cards = await prisma.card.findMany({
  where: {
    accountId: account_id,
    stageId: stageId,
    deletedAt: null, // soft delete filter
  },
  take: limit + 1, // fetch one extra to detect hasMore
  ...(cursor ? {
    cursor: { id: cursor },
    skip: 1, // skip the cursor itself
  } : {}),
  orderBy: { position: 'asc' },
});

const hasMore = cards.length > limit;
const data = hasMore ? cards.slice(0, -1) : cards;
const nextCursor = hasMore ? data[data.length - 1].id : null;

return { data, nextCursor, hasMore };
```

### Pattern 4: Zod + Swagger Auto-Generation
**What:** Define Zod schemas once; they drive TypeScript types, runtime validation, AND OpenAPI docs.
**When to use:** Every route definition.
**Example:**
```typescript
// src/app.ts
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';

const app = Fastify();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: { title: 'Kanban CRM API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
```

### Anti-Patterns to Avoid
- **Sharing Chatwoot's PostgreSQL database:** Creates schema coupling; use a separate `kanban-postgres` instance.
- **Storing Chatwoot `user_access_token` in Kanban DB:** It is a permanent credential. Exchange for short-lived JWT immediately; never persist.
- **Querying without `account_id` in WHERE clause:** Every Prisma query on tenant data MUST include `accountId` filter. Never rely on application-level checks alone.
- **Using offset pagination for cards:** Cards move between stages frequently; offset pagination produces inconsistent results. Use cursor-based.
- **Using Prisma 7.x:** Breaking ESM-only + driver adapter requirements add unnecessary complexity. Stay on 6.x.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification | Custom crypto with `jsonwebtoken` | `@fastify/jwt` | Integrates with Fastify request lifecycle; handles expiry, claims validation automatically |
| API documentation | Manual OpenAPI YAML | `@fastify/swagger` + `fastify-type-provider-zod` | Zod schemas generate OpenAPI spec automatically; stays in sync with code |
| Request validation | Manual `if (!body.field)` checks | Zod schemas via type provider | Compile-time type safety + runtime validation + error messages |
| CORS handling | Manual header setting | `@fastify/cors` | Handles preflight, credentials, origin whitelisting correctly |
| Rate limiting | Custom counter middleware | `@fastify/rate-limit` | Handles sliding window, per-route config, storage backends |
| Error responses | Ad-hoc JSON structures | RFC 7807 Problem Details format | Standard format; clients can parse predictably |
| Database migrations | Raw SQL files | `prisma migrate dev/deploy` | Schema diffing, rollback tracking, type generation |

## Prisma Schema Design

### Recommended Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Stage {
  id        String   @id @default(cuid())
  accountId Int      @map("account_id")
  name      String
  position  Int
  color     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  cards Card[]

  @@unique([accountId, position])
  @@index([accountId])
  @@map("stages")
}

model Card {
  id              String    @id @default(cuid())
  accountId       Int       @map("account_id")
  stageId         String    @map("stage_id")
  contactName     String    @map("contact_name")
  conversationId  Int?      @map("conversation_id")
  channelType     String?   @map("channel_type")
  assigneeId      Int?      @map("assignee_id")
  position        Int       @default(0)
  customFields    Json?     @map("custom_fields")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  stage Stage @relation(fields: [stageId], references: [id])

  @@index([accountId, stageId])
  @@index([accountId, conversationId])
  @@index([accountId, deletedAt])
  @@map("cards")
}
```

**Key design decisions:**
- `cuid()` for IDs -- URL-safe, sortable, no sequential enumeration risk
- `position` field on both stages and cards for drag-and-drop ordering
- `@@unique([accountId, position])` on stages prevents position collisions within an account
- `deletedAt` nullable for soft delete (D-01)
- `conversationId` nullable (D-03) -- filled by n8n, not required for manual creation
- `accountId` indexed on every table for tenant query performance
- Snake_case column mapping (`@map`) with camelCase Prisma field names

## Chatwoot `/api/v1/profile` -- Verified Response Format

**Source:** Direct inspection of Chatwoot source code (`app/views/api/v1/models/_user.json.jbuilder`).

**Request:**
```
GET /api/v1/profile
Header: api_access_token: <user_access_token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "account_id": 2,
  "name": "Agent Name",
  "display_name": "Agent",
  "email": "agent@example.com",
  "role": "administrator",
  "available_name": "Agent Name",
  "avatar_url": "...",
  "confirmed": true,
  "access_token": "abc123...",
  "uid": "agent@example.com",
  "provider": "email",
  "pubsub_token": "...",
  "accounts": [
    {
      "id": 2,
      "name": "My Company",
      "status": "active",
      "role": "administrator",
      "permissions": ["..."],
      "availability": "online",
      "availability_status": "online",
      "auto_offline": true
    }
  ]
}
```

**Critical notes:**
- The header is `api_access_token`, NOT `Authorization: Bearer`. This is Chatwoot-specific.
- `account_id` at the top level is the user's ACTIVE account (last viewed). The `accounts` array lists ALL accounts the user belongs to with per-account roles.
- The Kanban auth flow MUST verify the requested `account_id` exists in the `accounts` array, not just trust the top-level `account_id`.
- `role` at top level is for the active account; `accounts[].role` gives role per account.

## Common Pitfalls

### Pitfall 1: Trusting Top-Level `account_id` from Chatwoot Profile
**What goes wrong:** Using the top-level `account_id` from the profile response instead of validating against the `accounts` array.
**Why it happens:** The top-level `account_id` is the user's last active account, which may not match the account they're requesting access to.
**How to avoid:** Always look up the requested `account_id` in the `accounts[]` array. Reject if not found.
**Warning signs:** User gets data from wrong account; account switching doesn't work.

### Pitfall 2: Forgetting `deletedAt` Filter in Queries
**What goes wrong:** Soft-deleted cards appear in API responses.
**Why it happens:** Prisma doesn't have built-in soft delete; every query must manually filter `where: { deletedAt: null }`.
**How to avoid:** Create a Prisma middleware or wrapper function that adds `deletedAt: null` to all card queries by default. Or use a Prisma extension.
**Warning signs:** Deleted cards reappear in board view.

### Pitfall 3: Position Gaps After Reordering
**What goes wrong:** After moving/deleting stages or cards, position numbers have gaps (1, 3, 7) causing display issues.
**Why it happens:** Naive position updates only change the moved item, not adjacent items.
**How to avoid:** On reorder, update positions for all items in the affected stage/account in a single transaction. Use fractional positioning (e.g., 1.0, 1.5, 2.0) to minimize updates, with periodic normalization.
**Warning signs:** New items appear in wrong positions; drag-and-drop produces unexpected order.

### Pitfall 4: Race Condition on Stage Seeding
**What goes wrong:** Multiple simultaneous requests from a new account trigger duplicate default stage creation.
**Why it happens:** First-auth seed logic runs in parallel if two requests arrive before stages exist.
**How to avoid:** Use a database-level unique constraint on `(account_id, position)` and wrap seeding in a transaction with an `INSERT ... ON CONFLICT DO NOTHING` pattern, or use Prisma's `createMany` with `skipDuplicates: true`.
**Warning signs:** Account has duplicate "Prospeccao" stages.

### Pitfall 5: Using `Authorization: Bearer` Header for Chatwoot
**What goes wrong:** Chatwoot token validation fails with 401.
**Why it happens:** Chatwoot expects `api_access_token` header, not standard `Authorization: Bearer` header.
**How to avoid:** In the `chatwoot-auth.ts` service, use `headers: { api_access_token: token }` when calling Chatwoot.
**Warning signs:** Token exchange always returns 401 from Chatwoot.

### Pitfall 6: Not Scoping Nested Routes Properly
**What goes wrong:** A card belonging to account A's stage is accessible if you know the card ID and use account B's token.
**Why it happens:** Card endpoint only checks stage ownership, not card's own `account_id`.
**How to avoid:** ALWAYS filter by `account_id` on the card itself, not just the parent stage. Belt and suspenders.
**Warning signs:** Cross-tenant data leak in security audit.

## Code Examples

### Chatwoot Token Validation Service
```typescript
// src/services/chatwoot-auth.ts
interface ChatwootProfile {
  id: number;
  account_id: number;
  name: string;
  email: string;
  role: string;
  accounts: Array<{
    id: number;
    name: string;
    role: string;
    status: string;
  }>;
}

export async function validateChatwootToken(
  token: string
): Promise<ChatwootProfile | null> {
  try {
    const response = await fetch(
      `${process.env.CHATWOOT_BASE_URL}/api/v1/profile`,
      {
        headers: { api_access_token: token },
      }
    );
    if (!response.ok) return null;
    return response.json() as Promise<ChatwootProfile>;
  } catch {
    return null;
  }
}
```

### Default Stage Seeding
```typescript
// src/services/stage-seed.ts
const DEFAULT_STAGES = [
  { name: 'Prospecção', position: 1, color: '#3B82F6' },
  { name: 'Qualificado', position: 2, color: '#8B5CF6' },
  { name: 'Proposta', position: 3, color: '#F59E0B' },
  { name: 'Negociação', position: 4, color: '#EF4444' },
  { name: 'Fechado Ganho', position: 5, color: '#10B981' },
  { name: 'Perdido', position: 6, color: '#6B7280' },
];

export async function seedDefaultStages(
  prisma: PrismaClient,
  accountId: number
): Promise<void> {
  const existing = await prisma.stage.count({
    where: { accountId },
  });
  if (existing > 0) return;

  await prisma.stage.createMany({
    data: DEFAULT_STAGES.map((s) => ({ ...s, accountId })),
    skipDuplicates: true,
  });
}
```

### RFC 7807 Error Response Format
```typescript
// src/lib/errors.ts
// Recommendation: use RFC 7807 Problem Details for consistent error format
interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export function problemResponse(
  reply: FastifyReply,
  status: number,
  title: string,
  detail?: string
) {
  return reply.code(status).send({
    type: `https://kanban.api/errors/${title.toLowerCase().replace(/\s/g, '-')}`,
    title,
    status,
    detail,
  });
}
```

### Stage Reorder Endpoint
```typescript
// PATCH /api/v1/stages/reorder
// Body: { stages: [{ id: 'abc', position: 1 }, { id: 'def', position: 2 }] }
async function reorderStages(
  prisma: PrismaClient,
  accountId: number,
  stages: Array<{ id: string; position: number }>
) {
  await prisma.$transaction(
    stages.map((s) =>
      prisma.stage.update({
        where: { id: s.id, accountId }, // accountId in WHERE prevents cross-tenant
        data: { position: s.position },
      })
    )
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express + jsonwebtoken + swagger-jsdoc | Fastify 5 + @fastify/jwt + @fastify/swagger | Fastify 5 stable Oct 2024 | Single framework handles validation, auth, docs natively |
| Manual JSON Schema for validation | Zod + fastify-type-provider-zod | fastify-type-provider-zod 4.x+ (2024) | One schema definition drives types, validation, and OpenAPI |
| Prisma with CommonJS | Prisma 6.x CJS / Prisma 7.x ESM-only | Prisma 7 Nov 2025 | Use 6.x to avoid forced ESM migration |
| Offset pagination | Cursor-based pagination | Industry standard since ~2020 | Stable results when records move; better performance at scale |

## REST API Endpoint Design

Based on locked decisions D-08, D-09, D-10:

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/auth/chatwoot-token` | Exchange Chatwoot token for Kanban JWT | None (receives Chatwoot token) |
| GET | `/api/v1/stages` | List all stages for current account | JWT required |
| POST | `/api/v1/stages` | Create a new stage (admin only) | JWT + admin role |
| PATCH | `/api/v1/stages/:id` | Rename or update a stage (admin only) | JWT + admin role |
| DELETE | `/api/v1/stages/:id` | Delete a stage (admin only) | JWT + admin role |
| PATCH | `/api/v1/stages/reorder` | Reorder stages (admin only) | JWT + admin role |
| GET | `/api/v1/stages/:stageId/cards` | List cards in a stage (cursor paginated) | JWT required |
| POST | `/api/v1/stages/:stageId/cards` | Create a card in a stage | JWT required |
| PATCH | `/api/v1/cards/:id` | Update a card (including move to different stage) | JWT required |
| DELETE | `/api/v1/cards/:id` | Soft-delete a card | JWT required |

## Open Questions

1. **Chatwoot token caching**
   - What we know: Validating against Chatwoot on every token exchange adds latency (~100-300ms per call).
   - What's unclear: Whether to cache Chatwoot profile responses in memory (Map with TTL) or skip caching since token exchange only happens once per hour (JWT lifetime).
   - Recommendation: Skip caching for v1. Token exchange happens at most once per hour per user. Optimize only if Chatwoot latency proves problematic.

2. **Card position strategy**
   - What we know: Integer positions require updating multiple rows on reorder. Fractional positioning reduces writes.
   - What's unclear: Whether to use integers (simpler) or fractional strings/decimals (fewer writes).
   - Recommendation: Use integer positions with batch update in a transaction. Simpler to reason about; the card count per stage is unlikely to justify fractional complexity in v1.

3. **TypeScript target and module system**
   - What we know: Prisma 6.x supports both CJS and ESM. Fastify 5 supports both.
   - What's unclear: Whether to use ESM or CJS for the Kanban API project.
   - Recommendation: Use ESM (`"type": "module"` in package.json). It is the direction Node.js is moving; no compatibility issues with Prisma 6 or Fastify 5.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `kanban-api/vitest.config.ts` -- Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Chatwoot token exchange returns Kanban JWT | integration | `npx vitest run src/routes/v1/__tests__/auth.test.ts -t "token exchange"` | Wave 0 |
| AUTH-02 | Invalid Chatwoot token returns 401 | integration | `npx vitest run src/routes/v1/__tests__/auth.test.ts -t "invalid token"` | Wave 0 |
| AUTH-03 | JWT contains user_id, account_id, role with 1h expiry | unit | `npx vitest run src/services/__tests__/jwt.test.ts` | Wave 0 |
| AUTH-04 | Requests without JWT get 401 | integration | `npx vitest run src/middleware/__tests__/tenant.test.ts -t "no jwt"` | Wave 0 |
| TENANT-01 | Queries always include account_id filter | unit | `npx vitest run src/routes/v1/__tests__/stages.test.ts -t "tenant isolation"` | Wave 0 |
| TENANT-02 | Token from account A cannot access account B data | integration | `npx vitest run src/routes/v1/__tests__/tenant-isolation.test.ts` | Wave 0 |
| TENANT-03 | Different accounts have independent stages | integration | `npx vitest run src/routes/v1/__tests__/stages.test.ts -t "independent stages"` | Wave 0 |
| API-04 | Swagger UI accessible and contains all endpoints | smoke | `curl -s http://localhost:3001/docs/json \| jq '.paths \| keys'` | Wave 0 |
| API-05 | Cards CRUD operations work via REST | integration | `npx vitest run src/routes/v1/__tests__/cards.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `kanban-api/vitest.config.ts` -- vitest configuration
- [ ] `kanban-api/src/routes/v1/__tests__/auth.test.ts` -- auth endpoint tests
- [ ] `kanban-api/src/routes/v1/__tests__/stages.test.ts` -- stages CRUD + tenant isolation
- [ ] `kanban-api/src/routes/v1/__tests__/cards.test.ts` -- cards CRUD + pagination
- [ ] `kanban-api/src/routes/v1/__tests__/tenant-isolation.test.ts` -- cross-tenant rejection
- [ ] `kanban-api/src/middleware/__tests__/tenant.test.ts` -- middleware unit tests
- [ ] Framework install: `npm install -D vitest`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Fastify runtime | Yes (v24 installed, need v22 LTS) | 24.14.1 | Use `nvm install 22` or run in Docker with Node 22 |
| PostgreSQL | Prisma data store | Not locally | -- | Run via Docker: `docker run -p 5432:5432 postgres:15` |
| Docker | Containerized deployment | Not detected | -- | Development can proceed without Docker; needed for deployment |

**Missing dependencies with no fallback:**
- PostgreSQL must be available for Prisma migrations and testing. Docker is the simplest path.

**Missing dependencies with fallback:**
- Node 22 LTS: Current machine has Node 24 which should work with Fastify 5, but production target is Node 22 LTS. Use `nvm` or Docker for exact version match.

## Project Constraints (from CLAUDE.md)

- Always use `bundle exec` for Ruby CLI tasks (not relevant to this phase -- Fastify/Node project)
- Prefer Composition API with `<script setup>` for Vue (relevant for Phase 4, not this phase)
- Tailwind only for styling (relevant for Phase 4)
- MVP focus: least code change, happy-path only
- Ship happy path first; limit guards/fallbacks to proven necessities
- Prefer minimal, readable code over elaborate abstractions
- Avoid writing specs unless explicitly asked
- Remove dead/unreachable/unused code
- Conventional Commits for commit messages

## Sources

### Primary (HIGH confidence)
- Chatwoot source code: `app/controllers/api/v1/profiles_controller.rb` -- auth header is `api_access_token`
- Chatwoot source code: `app/views/api/v1/models/_user.json.jbuilder` -- full profile response structure verified
- Chatwoot source code: `app/controllers/api/base_controller.rb` -- `AccessTokenAuthHelper` auth flow
- npm registry: all package versions verified via `npm view` on 2026-04-10
- [Prisma pagination docs](https://docs.prisma.io/docs/v6/orm/prisma-client/queries/pagination) -- cursor-based pagination API

### Secondary (MEDIUM confidence)
- [@fastify/jwt GitHub README](https://github.com/fastify/fastify-jwt) -- plugin registration, sign/verify patterns
- [@fastify/swagger GitHub](https://github.com/fastify/fastify-swagger) -- OpenAPI generation modes
- [fastify-type-provider-zod GitHub](https://github.com/turkerdev/fastify-type-provider-zod) -- Zod + Swagger integration setup
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) -- breaking changes justifying 6.x choice
- `.planning/research/STACK.md` -- pre-existing stack research
- `.planning/research/ARCHITECTURE.md` -- pre-existing architecture research

### Tertiary (LOW confidence)
- [DeepWiki Chatwoot API reference](https://deepwiki.com/chatwoot/chatwoot/4.1-api-endpoints-reference) -- community-generated, cross-verified with source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry; Chatwoot auth format verified from source code
- Architecture: HIGH -- patterns are well-established Fastify + Prisma community standards
- Pitfalls: MEDIUM -- based on general multi-tenant API experience; Chatwoot-specific pitfalls (header name, account array) verified from source

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days -- stable stack, no fast-moving dependencies)
