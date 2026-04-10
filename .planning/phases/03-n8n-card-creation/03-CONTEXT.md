# Phase 3: n8n Card Creation - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Endpoint dedicado de webhook para o n8n criar cards automaticamente quando conversas chegam no Chatwoot. Inclui: autenticação via API key por conta, idempotência por conversation_id (unique constraint), processamento async via BullMQ para resposta <100ms, e payload com dados básicos + extras (telefone, email, URL da conversa).

</domain>

<decisions>
## Implementation Decisions

### Autenticação do Webhook
- **D-01:** API key dedicada por conta — header `x-api-key`. Não usa o fluxo JWT/token exchange.
- **D-02:** Key gerada automaticamente no seed/primeira autenticação da conta. Admin pode regenerar via endpoint.
- **D-03:** Nova tabela `api_keys` com campos: id, account_id, key (hash), created_at, revoked_at.

### Endpoint e Rota
- **D-04:** Rota dedicada: `POST /api/v1/webhooks/chatwoot` — separada das rotas CRUD normais.
- **D-05:** O endpoint resolve automaticamente o stage destino (primeiro stage da conta por posição) — n8n não precisa saber o stageId.
- **D-06:** Payload aceita dados básicos + extras: contact_name, conversation_id, channel_type, assignee_id + telefone, email, URL da conversa no Chatwoot (via custom_fields ou campos dedicados).

### Estratégia de Idempotência
- **D-07:** Unique constraint no banco: `(account_id, conversation_id)` — garante zero duplicatas a nível de banco, sem race conditions.
- **D-08:** Comportamento idempotente: primeira vez retorna 201 Created, chamadas subsequentes com mesmo conversation_id retornam 200 com o card existente sem alterá-lo.
- **D-09:** Para atualizar um card existente, o n8n usa o PATCH `/cards/:id` em outro node do workflow — separação clara de responsabilidades.

### Resposta Rápida (<100ms)
- **D-10:** Processamento async via BullMQ — endpoint responde 202 Accepted imediatamente, card é criado em background pelo worker.
- **D-11:** BullMQ usa o Redis existente do stack Chatwoot com DB number separado — sem infra extra no Coolify.
- **D-12:** Worker processa a fila e executa o upsert no Postgres.

### Claude's Discretion
- Estrutura exata do worker BullMQ (retry policy, concurrency)
- Hash algorithm para API keys (bcrypt, argon2, ou SHA-256 com salt)
- Formato exato da resposta 202 (job id, status URL, ou apenas acknowledged)
- Se campos extras (telefone, email, URL) ficam em custom_fields ou como colunas dedicadas no schema

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack e Arquitetura
- `.planning/phases/02-kanban-api-auth/02-CONTEXT.md` — Decisões da Phase 2 (schema, JWT, rotas, Prisma)
- `.planning/REQUIREMENTS.md` — API-01, API-02, API-03 são os requisitos desta fase

### Código Existente
- `kanban-api/src/routes/v1/cards.ts` — CRUD de cards existente (POST, PATCH, DELETE)
- `kanban-api/src/schemas/card.ts` — Zod schemas para cards (createCardSchema, updateCardSchema)
- `kanban-api/src/plugins/auth.ts` — Plugin de autenticação JWT atual
- `kanban-api/src/middleware/tenant.ts` — JwtPayload interface
- `kanban-api/src/services/stage-seed.ts` — Seed de stages default (referência para seed de API keys)
- `kanban-api/src/lib/prisma.ts` — Prisma client singleton

### Projeto
- `.planning/PROJECT.md` — Constraints: deploy Coolify, multi-tenant por account_id, n8n como camada de automação

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createCardSchema` (Zod) — base para o schema do webhook, pode ser estendido com campos extras
- `prisma` client singleton — reutilizado pelo worker BullMQ
- `stage-seed.ts` — padrão de seed automático que pode ser replicado para API keys
- `problemResponse` — helper de erro RFC 7807 já existente

### Established Patterns
- Snake_case nos request bodies, camelCase no Prisma (mapeamento manual nos handlers)
- Auth via decorador `fastify.authenticate` — webhook terá seu próprio decorador para API key
- Cursor pagination para listagens
- Soft delete com `deletedAt`

### Integration Points
- n8n workflow → POST `/api/v1/webhooks/chatwoot` com header `x-api-key`
- BullMQ worker → Prisma upsert no Postgres
- Redis do stack Chatwoot (DB number separado) → BullMQ connection

</code_context>

<specifics>
## Specific Ideas

- Usuária monta os workflows do n8n manualmente para cada cliente — o node HTTP do n8n faz POST para o endpoint do webhook
- Fluxo no n8n: agente de IA do cliente → node para criar/atualizar CRM no Chatwoot
- Separação clara: um node para criar (POST webhook), outro node para atualizar (PATCH /cards/:id)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-n8n-card-creation*
*Context gathered: 2026-04-10*
