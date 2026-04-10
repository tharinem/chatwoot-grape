# Phase 2: Kanban API & Auth - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir uma API REST standalone com Fastify que: autentica usuarios via token do Chatwoot, emite JWTs proprios com scope por account_id, e expoe endpoints para gerenciar stages e cards com isolamento multi-tenant completo. Inclui schema Prisma, documentacao OpenAPI auto-gerada, e seed de stages default por conta.

</domain>

<decisions>
## Implementation Decisions

### Modelo de Dados
- **D-01:** Soft delete para cards — campo `deleted_at` nullable. Cards deletados ficam ocultos mas recuperaveis.
- **D-02:** Unico campo obrigatorio para criar card: `contact_name`. Card vai automaticamente para o primeiro estagio da conta.
- **D-03:** Campo `conversation_id` (Chatwoot) e opcional no card — preenchido pelo n8n, nao obrigatorio para criacao manual.
- **D-04:** Duas tabelas principais: `stages` (colunas do pipeline) e `cards` (leads/deals). Ambas isoladas por `account_id`.

### Estrutura do JWT
- **D-05:** JWT inclui: `user_id`, `account_id`, `role` (admin/agent). Role extraida do Chatwoot no momento da autenticacao via `/api/v1/profile`.
- **D-06:** JWT tem duracao de 1h. Quando expira, o frontend re-autentica silenciosamente usando o token do Chatwoot que ainda esta valido — usuario nao percebe.
- **D-07:** Sem refresh token — re-autenticacao silenciosa via token Chatwoot substitui esse mecanismo.

### Design da API REST
- **D-08:** Rotas aninhadas: `/api/v1/stages/:id/cards`. Stages e cards sob mesmo prefixo versionado.
- **D-09:** Versionamento no path: `/api/v1/...`. Permite evolucao sem quebrar integracoes (n8n).
- **D-10:** Paginacao por cursor: `?cursor=abc&limit=50`. Mais eficiente que offset quando cards sao movidos entre paginas.

### Stages Padrao
- **D-11:** Novas contas recebem stages default automaticamente na primeira autenticacao (ou via seed).
- **D-12:** Pipeline de vendas classico: Prospeccao → Qualificado → Proposta → Negociacao → Fechado Ganho → Perdido. Admin pode personalizar depois.

### Claude's Discretion
- Formato de resposta de erro (RFC 7807 ou formato customizado)
- Estrutura exata do schema Prisma (tipos de campo, indices, constraints)
- Middleware de rate limiting e configuracao
- Estrutura de pastas do projeto Fastify
- Estrategia de testes (unit vs integration)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack e Arquitetura
- `.planning/research/STACK.md` — Define Fastify 5, Prisma 6, TypeScript, Node 22 LTS, PostgreSQL separado
- `.planning/research/ARCHITECTURE.md` — Arquitetura geral do sistema e integracao entre servicos

### Requisitos
- `.planning/REQUIREMENTS.md` — AUTH-01..04, TENANT-01..03, API-04..05 sao os requisitos desta fase
- `.planning/PROJECT.md` — Constraints: auth compartilhado, multi-tenant por account_id, deploy via Coolify

### Chatwoot API
- Chatwoot API docs: `/api/v1/profile` endpoint para validacao de token (referencia externa)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum — esta e uma aplicacao greenfield (novo microservico Fastify)

### Established Patterns
- Chatwoot usa `account_id` como chave de isolamento multi-tenant — replicar mesmo padrao no Kanban
- Chatwoot token format: `user_access_token` header — Kanban recebe esse token e valida via API call

### Integration Points
- Chatwoot `/api/v1/profile` — valida token e retorna user_id, account_id, role
- n8n webhook → POST para criar cards com conversation_id
- Frontend Vue 3 (Phase 4) consumira esta API via axios

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Fastify + Prisma project structure.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-kanban-api-auth*
*Context gathered: 2026-04-10*
