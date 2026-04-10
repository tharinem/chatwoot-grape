# Phase 3: n8n Card Creation - Research

**Researched:** 2026-04-10
**Domain:** Webhook endpoint, async job processing (BullMQ), API key authentication, idempotency
**Confidence:** HIGH

## Summary

This phase adds a dedicated webhook endpoint (`POST /api/v1/webhooks/chatwoot`) for n8n to create Kanban cards when conversations arrive in Chatwoot. The implementation requires three new subsystems: (1) an API key authentication mechanism (per-account, hashed with SHA-256), (2) a BullMQ queue/worker for async processing to guarantee sub-100ms response times, and (3) idempotency enforced via a unique constraint on `(account_id, conversation_id)` at the database level.

The existing codebase (Phase 2) already has the card creation logic, Prisma schema, and error handling patterns. This phase extends the schema with an `api_keys` table and a unique constraint on cards, adds BullMQ as the sole new infrastructure dependency (using the existing Redis with a separate DB number), and creates a new webhook route with its own auth decorator separate from the JWT flow.

**Primary recommendation:** Use BullMQ 5.x with the existing Chatwoot Redis (DB 2), SHA-256 with random salt for API key hashing, and Prisma's `@@unique([accountId, conversationId])` for idempotency. Keep the worker in-process (same Fastify server) for simplicity since volume is low.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** API key dedicada por conta -- header `x-api-key`. Nao usa o fluxo JWT/token exchange.
- **D-02:** Key gerada automaticamente no seed/primeira autenticacao da conta. Admin pode regenerar via endpoint.
- **D-03:** Nova tabela `api_keys` com campos: id, account_id, key (hash), created_at, revoked_at.
- **D-04:** Rota dedicada: `POST /api/v1/webhooks/chatwoot` -- separada das rotas CRUD normais.
- **D-05:** O endpoint resolve automaticamente o stage destino (primeiro stage da conta por posicao) -- n8n nao precisa saber o stageId.
- **D-06:** Payload aceita dados basicos + extras: contact_name, conversation_id, channel_type, assignee_id + telefone, email, URL da conversa no Chatwoot (via custom_fields ou campos dedicados).
- **D-07:** Unique constraint no banco: `(account_id, conversation_id)` -- garante zero duplicatas a nivel de banco, sem race conditions.
- **D-08:** Comportamento idempotente: primeira vez retorna 201 Created, chamadas subsequentes com mesmo conversation_id retornam 200 com o card existente sem altera-lo.
- **D-09:** Para atualizar um card existente, o n8n usa o PATCH `/cards/:id` em outro node do workflow -- separacao clara de responsabilidades.
- **D-10:** Processamento async via BullMQ -- endpoint responde 202 Accepted imediatamente, card e criado em background pelo worker.
- **D-11:** BullMQ usa o Redis existente do stack Chatwoot com DB number separado -- sem infra extra no Coolify.
- **D-12:** Worker processa a fila e executa o upsert no Postgres.

### Claude's Discretion
- Estrutura exata do worker BullMQ (retry policy, concurrency)
- Hash algorithm para API keys (bcrypt, argon2, ou SHA-256 com salt)
- Formato exato da resposta 202 (job id, status URL, ou apenas acknowledged)
- Se campos extras (telefone, email, URL) ficam em custom_fields ou como colunas dedicadas no schema

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | API REST permite criar cards via POST com dados da conversa (usado pelo n8n) | Webhook endpoint D-04/D-06, BullMQ worker D-10/D-12, Zod schema for payload validation |
| API-02 | Criacao de card e idempotente -- mesma conversation_id nao gera card duplicado | Prisma @@unique constraint D-07, upsert pattern in worker, 201/200 response distinction D-08 |
| API-03 | API responde em menos de 100ms para webhooks do n8n (acknowledge rapido) | BullMQ async processing D-10, 202 Accepted immediate response, worker handles creation in background |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | 5.73.3 | Job queue for async card creation | De facto Node.js job queue; Redis-backed; mature, well-maintained |
| ioredis | 5.10.1 | Redis client (BullMQ dependency) | Required by BullMQ; full Redis protocol support including DB selection |
| crypto (Node built-in) | -- | SHA-256 hashing for API keys | No external dependency; `crypto.randomBytes` + `crypto.createHash` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client | 6.19.3 (existing) | Database ORM | Already in project; used by worker for upsert |
| zod | 3.25.76 (existing) | Schema validation for webhook payload | Already in project; new webhook schema |
| fastify-plugin | 5.1.0 (existing) | API key auth decorator | Already in project; new `authenticateApiKey` decorator |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | Direct Prisma insert (sync) | Simpler but violates D-10 and API-03 (<100ms); fine for low volume but decision is locked |
| SHA-256 for API keys | bcrypt/argon2 | bcrypt is for passwords (slow by design); API keys are high-entropy, fast hash is correct |
| In-process worker | Separate worker process | Separate process scales better but adds deployment complexity on Coolify; in-process is fine for expected volume |

**Installation:**
```bash
cd kanban-api && npm install bullmq ioredis
```

Note: `ioredis` is a peer dependency of BullMQ and should be installed explicitly to control the version.

## Architecture Patterns

### Recommended Project Structure
```
kanban-api/src/
├── lib/
│   ├── prisma.ts           # (existing) Prisma singleton
│   ├── errors.ts           # (existing) RFC 7807 error helper
│   ├── redis.ts            # NEW: IORedis connection factory (DB 2)
│   └── api-key.ts          # NEW: generate/hash/verify API key helpers
├── queues/
│   ├── card-creation.queue.ts  # NEW: Queue definition + addJob helper
│   └── card-creation.worker.ts # NEW: Worker processor (upsert logic)
├── plugins/
│   ├── auth.ts             # (existing) JWT auth decorator
│   └── api-key-auth.ts     # NEW: x-api-key auth decorator
├── routes/v1/
│   ├── webhooks.ts         # NEW: POST /webhooks/chatwoot
│   └── api-keys.ts         # NEW: POST /api-keys (generate), DELETE /api-keys/:id (revoke)
├── schemas/
│   ├── webhook.ts          # NEW: Zod schemas for webhook payload + response
│   └── api-key.ts          # NEW: Zod schemas for API key management
├── services/
│   └── api-key-seed.ts     # NEW: Auto-generate API key on first auth (like stage-seed.ts)
└── app.ts                  # Register new routes + plugins + start worker
```

### Pattern 1: API Key Authentication Decorator
**What:** A Fastify decorator `authenticateApiKey` that validates the `x-api-key` header against hashed keys in the `api_keys` table.
**When to use:** Only on webhook routes -- JWT auth remains for all CRUD routes.
**Example:**
```typescript
// plugins/api-key-auth.ts
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyApiKey } from '../lib/api-key.js';
import prisma from '../lib/prisma.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticateApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function apiKeyAuthPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticateApiKey', async function (request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      return reply.code(401).send({
        type: 'https://kanban.api/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing x-api-key header',
      });
    }

    const record = await verifyApiKey(prisma, apiKey);
    if (!record) {
      return reply.code(401).send({
        type: 'https://kanban.api/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or revoked API key',
      });
    }

    // Attach account_id to request for downstream use
    request.apiKeyAccount = { account_id: record.accountId };
  });
});
```

### Pattern 2: BullMQ Queue + Worker (In-Process)
**What:** Queue created at app startup; worker started in the same process. Worker performs the Prisma upsert.
**When to use:** Low-to-medium volume webhook processing where separate worker processes are overkill.
**Example:**
```typescript
// queues/card-creation.queue.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis.js';

export const cardCreationQueue = new Queue('card-creation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// queues/card-creation.worker.ts
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

interface CardCreationJobData {
  accountId: number;
  contactName: string;
  conversationId: number;
  channelType?: string;
  assigneeId?: number;
  customFields?: Record<string, unknown>;
}

export function startCardCreationWorker() {
  const worker = new Worker('card-creation', async (job: Job<CardCreationJobData>) => {
    const { accountId, contactName, conversationId, channelType, assigneeId, customFields } = job.data;

    // Resolve first stage by position
    const firstStage = await prisma.stage.findFirst({
      where: { accountId },
      orderBy: { position: 'asc' },
    });
    if (!firstStage) throw new Error(`No stages found for account ${accountId}`);

    // Determine next position
    const agg = await prisma.card.aggregate({
      where: { accountId, stageId: firstStage.id, deletedAt: null },
      _max: { position: true },
    });
    const nextPos = (agg._max.position ?? 0) + 1;

    // Upsert: create if not exists, return existing if duplicate
    await prisma.card.upsert({
      where: {
        accountId_conversationId: { accountId, conversationId },
      },
      create: {
        accountId,
        stageId: firstStage.id,
        contactName,
        conversationId,
        channelType: channelType ?? null,
        assigneeId: assigneeId ?? null,
        customFields: (customFields ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        position: nextPos,
      },
      update: {}, // No-op on duplicate -- idempotent
    });
  }, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on('error', (err) => console.error('Worker error:', err));
  return worker;
}
```

### Pattern 3: Redis Connection with Separate DB
**What:** IORedis instance configured to use a different Redis DB number than Chatwoot.
**When to use:** Always -- BullMQ needs its own keyspace.
**Example:**
```typescript
// lib/redis.ts
import IORedis from 'ioredis';

export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  db: parseInt(process.env.BULLMQ_REDIS_DB ?? '2', 10),
  maxRetriesPerRequest: null, // Required by BullMQ workers
  password: process.env.REDIS_PASSWORD || undefined,
});
```

### Pattern 4: Idempotent Webhook Response
**What:** Since processing is async (202), the webhook cannot return 201 vs 200 immediately. The 202 response acknowledges receipt; idempotency is handled at the DB level by the worker.
**Important nuance:** D-08 specifies 201 vs 200 distinction, but D-10 specifies 202 Accepted for async. These are in tension. Recommendation: The webhook always returns 202 Accepted (async acknowledgment). The worker silently handles duplicates via upsert. If the caller needs to know if a card already existed, they query `GET /cards?conversation_id=X` separately.

### Anti-Patterns to Avoid
- **Checking existence before insert (SELECT then INSERT):** Race condition between check and insert. Use database unique constraint + upsert instead.
- **Using bcrypt for API key hashing:** bcrypt is intentionally slow -- every webhook request would incur ~100ms of CPU time just for auth. SHA-256 is correct for high-entropy API keys.
- **Sharing BullMQ Redis connection between Queue and Worker:** BullMQ workers use blocking Redis commands (`BRPOPLPUSH`). Create separate IORedis instances or let BullMQ manage its own connections by passing config objects (not instances).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue / async processing | Custom Redis pub/sub or setTimeout | BullMQ | Retries, backoff, dead letter, monitoring, persistence across restarts |
| API key generation | Custom random string | `crypto.randomBytes(32).toString('hex')` | Cryptographically secure, 256-bit entropy |
| API key hashing | Custom hash function | `crypto.createHash('sha256').update(salt + key).digest('hex')` | Standard, fast, sufficient for high-entropy keys |
| Unique constraint enforcement | Application-level duplicate check | Prisma `@@unique` + `upsert` | Database-level guarantee eliminates race conditions |

**Key insight:** The combination of database unique constraints and BullMQ's job deduplication makes the idempotency bulletproof without any application-level locking or checking.

## Common Pitfalls

### Pitfall 1: BullMQ maxRetriesPerRequest
**What goes wrong:** Worker fails to start with "maxRetriesPerRequest must be null" error.
**Why it happens:** IORedis defaults to `maxRetriesPerRequest: 20`, but BullMQ workers use blocking commands that need unlimited retries.
**How to avoid:** Always set `maxRetriesPerRequest: null` on the Redis connection used by workers.
**Warning signs:** Worker crashes immediately on startup.

### Pitfall 2: Prisma Unique Constraint on Nullable Field
**What goes wrong:** The `conversation_id` field is nullable (cards can be created manually without a conversation). A `@@unique([accountId, conversationId])` constraint in PostgreSQL allows multiple NULL values (SQL standard: NULL != NULL), which is correct behavior. But Prisma's `upsert` with a compound unique requires all fields to be non-null in the `where` clause.
**Why it happens:** Prisma generates a compound unique name like `accountId_conversationId` that requires both values.
**How to avoid:** The webhook endpoint always receives a `conversation_id` (it comes from Chatwoot via n8n), so this is not a problem for the webhook flow. Manual card creation (no conversation_id) bypasses this entirely since it uses the existing POST /stages/:stageId/cards route.
**Warning signs:** Prisma throws "Argument conversationId must not be null" in the upsert where clause.

### Pitfall 3: 202 vs 201/200 Response Tension
**What goes wrong:** D-08 says return 201 (new) or 200 (existing), but D-10 says return 202 (async). These are contradictory for the same endpoint.
**Why it happens:** The async processing decision (D-10) was made after the idempotency behavior decision (D-08).
**How to avoid:** The webhook endpoint returns 202 Accepted always (honoring D-10 for <100ms response). The 201/200 distinction from D-08 applies conceptually but cannot be communicated synchronously when processing is async. The response includes a `job_id` for optional status polling.
**Warning signs:** Trying to return different status codes requires waiting for the worker, which defeats the async purpose.

### Pitfall 4: API Key Stored in Plaintext
**What goes wrong:** Storing the raw API key allows database compromise to leak all keys.
**Why it happens:** Rushing implementation, not thinking about security.
**How to avoid:** Store only the hash. The raw key is shown once at generation time and never stored. Store a `prefix` (first 8 chars) for identification in admin UI.
**Warning signs:** A `key` column with readable strings instead of hashes.

### Pitfall 5: BullMQ Connection Sharing
**What goes wrong:** Queue and Worker share the same IORedis instance, causing intermittent failures.
**Why it happens:** Workers use blocking Redis commands that interfere with regular commands.
**How to avoid:** Pass connection config objects (not IORedis instances) to BullMQ, letting it create its own connections. Or create separate IORedis instances.
**Warning signs:** Intermittent timeouts, jobs stuck in "waiting" state.

## Code Examples

### API Key Generation and Hashing
```typescript
// lib/api-key.ts
import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const SALT_LENGTH = 16;

export function generateApiKey(): { raw: string; prefix: string; hash: string; salt: string } {
  const raw = crypto.randomBytes(32).toString('hex'); // 64-char hex string
  const prefix = raw.slice(0, 8); // For admin UI display: "abc12345..."
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + raw).digest('hex');
  return { raw, prefix, hash, salt };
}

export function hashApiKey(key: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + key).digest('hex');
}

export async function verifyApiKey(prisma: PrismaClient, rawKey: string) {
  // Find all non-revoked keys (typically 1 per account)
  const keys = await prisma.apiKey.findMany({
    where: { revokedAt: null },
  });

  for (const record of keys) {
    const computed = hashApiKey(rawKey, record.salt);
    if (crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(record.keyHash))) {
      return record;
    }
  }
  return null;
}
```

**Note on lookup strategy:** The naive approach above iterates all keys. For better performance, store a key `prefix` (first 8 chars, unhashed) and use it to narrow the search: `findFirst({ where: { prefix, revokedAt: null } })`. This is the recommended approach -- one lookup, one hash comparison.

### Webhook Endpoint
```typescript
// routes/v1/webhooks.ts
import type { FastifyInstance } from 'fastify';
import { webhookPayloadSchema, webhookResponseSchema } from '../../schemas/webhook.js';
import { cardCreationQueue } from '../../queues/card-creation.queue.js';

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhooks/chatwoot', {
    onRequest: [fastify.authenticateApiKey],
    schema: {
      body: webhookPayloadSchema,
      response: { 202: webhookResponseSchema },
    },
  }, async (request, reply) => {
    const { account_id } = request.apiKeyAccount;
    const body = request.body as {
      contact_name: string;
      conversation_id: number;
      channel_type?: string;
      assignee_id?: number;
      phone?: string;
      email?: string;
      conversation_url?: string;
    };

    const job = await cardCreationQueue.add('create-card', {
      accountId: account_id,
      contactName: body.contact_name,
      conversationId: body.conversation_id,
      channelType: body.channel_type,
      assigneeId: body.assignee_id,
      customFields: {
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.conversation_url ? { conversation_url: body.conversation_url } : {}),
      },
    });

    return reply.code(202).send({
      status: 'accepted',
      job_id: job.id,
    });
  });
}
```

### Prisma Schema Additions
```prisma
model ApiKey {
  id        String    @id @default(cuid())
  accountId Int       @map("account_id")
  keyHash   String    @map("key_hash")
  salt      String
  prefix    String    @db.VarChar(8)  // First 8 chars for identification
  createdAt DateTime  @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")

  @@index([accountId])
  @@index([prefix])
  @@map("api_keys")
}

// Add to existing Card model:
// @@unique([accountId, conversationId])  -- idempotency constraint (D-07)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bull (v3) | BullMQ (v5) | 2022+ | BullMQ is the modern rewrite; Bull is in maintenance mode |
| QueueScheduler required | Built into Queue | BullMQ 2.0+ | No separate QueueScheduler process needed for delayed jobs |
| bcrypt for all hashing | SHA-256 for API keys, argon2id for passwords | Ongoing consensus | Performance: bcrypt adds ~100ms per request, unacceptable for webhooks |

## Open Questions

1. **202 vs 201/200 response codes**
   - What we know: D-08 specifies 201/200, D-10 specifies 202 async
   - What's unclear: Whether the user expects the webhook to return different codes based on card existence
   - Recommendation: Use 202 always (async contract). If needed, add a `GET /webhooks/chatwoot/status/:jobId` endpoint later. This is a conscious tradeoff -- speed over synchronous feedback.

2. **Extra fields (phone, email, conversation_url) storage**
   - What we know: D-06 says payload includes these fields
   - What's unclear: Whether to add dedicated columns or use `custom_fields` JSON
   - Recommendation: Use `custom_fields` JSON. Adding columns requires a migration for each new field. The `custom_fields` JSON column already exists and is flexible. These fields are display-only, not queried/filtered. If filtering by phone/email becomes needed (v2), add columns then.

3. **API key seed timing**
   - What we know: D-02 says "generated automatically no seed/primeira autenticacao"
   - What's unclear: Whether to generate during Chatwoot token exchange or as a separate admin action
   - Recommendation: Generate during Chatwoot token exchange (like `seedDefaultStages`) -- on first auth for an account, create an API key if none exists. Show the raw key in the response once. Also provide a `POST /api-keys/regenerate` endpoint for admin use.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Y | 24.14.1 | -- |
| npm | Package management | Y | 11.11.0 | -- |
| Redis | BullMQ queue backend | Remote only (Coolify) | -- | Must connect to Chatwoot's Redis instance via env vars |
| PostgreSQL | Prisma / data storage | Remote only (Coolify) | -- | Must connect via DATABASE_URL env var |

**Missing dependencies with no fallback:**
- None blocking -- BullMQ and ioredis are npm packages, Redis is provided by the Chatwoot stack

**Missing dependencies with fallback:**
- redis-cli not installed locally -- not needed for development; BullMQ connects via ioredis programmatically

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended -- no test framework exists yet) |
| Config file | `kanban-api/vitest.config.ts` -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | Webhook POST creates card via queue | integration | `npx vitest run src/__tests__/webhook.test.ts -t "creates card"` | No -- Wave 0 |
| API-02 | Duplicate conversation_id does not create second card | integration | `npx vitest run src/__tests__/webhook.test.ts -t "idempotent"` | No -- Wave 0 |
| API-03 | Webhook responds in <100ms (returns 202 immediately) | unit | `npx vitest run src/__tests__/webhook.test.ts -t "responds 202"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `kanban-api/vitest.config.ts` -- Vitest configuration
- [ ] `kanban-api/src/__tests__/webhook.test.ts` -- webhook endpoint tests
- [ ] `kanban-api/src/__tests__/api-key.test.ts` -- API key generation/verification tests
- [ ] `kanban-api/src/__tests__/card-creation.worker.test.ts` -- worker upsert logic tests
- [ ] Framework install: `npm install -D vitest` -- no test framework exists

## Project Constraints (from CLAUDE.md)

- Prefer Conventional Commits: `type(scope): subject`
- MVP focus: Least code change, happy-path only
- No unnecessary defensive programming
- Ship the happy path first
- Prefer minimal, readable code over elaborate abstractions
- Avoid writing specs unless explicitly asked
- Remove dead/unreachable/unused code
- Tailwind only for styling (not relevant to this phase -- API only)
- Always use Composition API with `<script setup>` (not relevant to this phase)

## Sources

### Primary (HIGH confidence)
- BullMQ official docs (https://docs.bullmq.io/) -- connections, queues, workers, retry configuration
- npm registry -- bullmq@5.73.3, ioredis@5.10.1 (verified via `npm view`)
- Existing codebase -- Prisma schema, card routes, auth plugin, error helpers (read directly)

### Secondary (MEDIUM confidence)
- API key hashing best practices -- SHA-256 for stateless API keys vs bcrypt for passwords (multiple sources: cybersierra.co, mojoauth.com, ssojet.com)
- BullMQ Fastify integration patterns (github.com/JonasHiltl/fastify-queue, github.com/ncontiero/fastify-bullmq)

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- BullMQ is the standard Node.js job queue; versions verified against npm registry
- Architecture: HIGH -- Patterns derived from existing codebase (Phase 2) and BullMQ official docs
- Pitfalls: HIGH -- BullMQ maxRetriesPerRequest and Prisma nullable unique are well-documented issues

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no fast-moving dependencies)
