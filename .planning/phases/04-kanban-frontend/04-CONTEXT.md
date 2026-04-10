# Phase 4: Kanban Frontend - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

App Vue 3 standalone (SPA) que consome a API Kanban (fases 2-3) para exibir um board Kanban visual com drag-and-drop, gestao de estagios inline, filtragem multi-criterio, e criacao manual de cards. Desktop-first com scroll horizontal basico em mobile. O embedding no Chatwoot e escopo da Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Design dos Cards
- **D-01:** Cards compactos como default (nome do contato + canal + tempo relativo), mas com configuracao de campos visiveis estilo Notion — usuario pode habilitar/desabilitar campos como canal, agente, data, link Chatwoot.
- **D-02:** Configuracao de campos visiveis via menu no header do board (toggles por campo). Aplica para todos os cards do board.
- **D-03:** Click no card abre painel lateral (slide-in pela direita) como default, com opcao de expandir para modal ou pagina completa — estilo Notion.

### Drag-and-Drop e Interacoes
- **D-04:** Drag-and-drop fluido com animacoes: card levanta com sombra ao arrastar, colunas mostram zona de drop com highlight, cards existentes abrem espaco suavemente.
- **D-05:** Sem confirmacao ao mover card — drop imediato com chamada API automatica. Se falhar, card volta a posicao original com toast de erro (optimistic update com rollback).
- **D-06:** Desktop-first — scroll horizontal basico em mobile, sem UX touch elaborada. Alinhado com o padrao do Chatwoot e Out of Scope do projeto (web-first).

### Gestao de Estagios
- **D-07:** Gestao inline no board: clicar no titulo da coluna para renomear, botao '+' no final para adicionar, menu '...' para deletar/reordenar. Tudo direto no board.
- **D-08:** Ao deletar estagio com cards, pede para escolher coluna destino antes de efetivar a delecao. Cards nao se perdem.

### Filtros e Empty States
- **D-09:** Barra de filtros no topo do board com multiplos criterios: Agente, Canal de origem, Data de entrada. Atalho rapido "Atribuidos a mim" como botao destacado.
- **D-10:** Empty state com mensagem central "Nenhum lead ainda", botao "Criar card manualmente", e texto explicando que cards tambem sao criados automaticamente via automacao (nao mencionar n8n — detalhe tecnico interno).
- **D-11:** Criacao manual de card via dois pontos de entrada: botao '+' no header de cada coluna E botao global "Novo card" no header do board.

### Cores e Visual
- **D-12:** Cores sutis e configuraveis por estagio — borda colorida fina no topo de cada coluna. Admin pode configurar a cor via color picker. Resto do board neutro usando paleta `n-slate` do Chatwoot.
- **D-13:** Seguir o design system do Chatwoot: cores via CSS vars com prefixo `n.` (ex: `text-n-slate-12`, `bg-n-brand`), dark mode via classe `dark`, fontes DM Sans/Inter.
- **D-14:** Icones Lucide via classes `i-lucide-*` — mesmo sistema usado pelo Chatwoot moderno. Consistencia total com a plataforma.

### Branding
- **D-15:** Nao mencionar "n8n" em nenhum texto user-facing. Usar "automacao" ou termos genericos. n8n e detalhe de implementacao, nao produto.

### Claude's Discretion
- Escolha de biblioteca de drag-and-drop (vue-draggable, dnd-kit, etc.)
- Estrutura de pastas do projeto Vue 3 (router, stores, composables)
- Estrategia de state management (Pinia, composables, etc.)
- Formato exato do formulario de criacao de card

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack e API
- `.planning/phases/02-kanban-api-auth/02-CONTEXT.md` — Decisoes da API (schema, JWT, rotas, pagination)
- `.planning/phases/03-n8n-card-creation/03-CONTEXT.md` — Decisoes do webhook e API key
- `.planning/REQUIREMENTS.md` — KANB-01..08 sao os requisitos desta fase

### API Endpoints (backend ja construido)
- `kanban-api/src/routes/v1/cards.ts` — CRUD de cards (GET, POST, PATCH, DELETE)
- `kanban-api/src/routes/v1/auth.ts` — Token exchange (Chatwoot token -> JWT)
- `kanban-api/src/schemas/card.ts` — Zod schemas para request/response de cards
- `kanban-api/src/routes/v1/stages.ts` — CRUD de estagios com reorder

### Design System do Chatwoot (referencia visual obrigatoria)
- `tailwind.config.js` — Configuracao Tailwind com plugin de icones e cores `n.`
- `theme/colors.js` — Definicoes de cores do sistema
- `app/javascript/dashboard/components-next/button/Button.vue` — Padrao de componente (variants, props, Tailwind)
- `app/javascript/dashboard/components-next/icon/Icon.vue` — Componente de icone

### Projeto
- `.planning/PROJECT.md` — Constraints: deploy Coolify, multi-tenant por account_id, auth compartilhado
- `.planning/REQUIREMENTS.md` — Out of Scope inclui bulk actions e WIP limits

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum frontend Kanban existe ainda — app Vue 3 greenfield
- Backend API completo com Swagger docs para referencia de endpoints
- Chatwoot `components-next/` como referencia de padroes de componentes (Button, Icon, Dialog, etc.)

### Chatwoot Design System (MUST follow)
- Cores: CSS vars com prefixo `n.` — `n-slate-{1..12}`, `n-brand` (#7B5EA7), `n-blue`, `n-ruby`, `n-amber`, `n-teal`
- Icones: Lucide via `i-lucide-*` classes (plugin `@egoist/tailwindcss-icons`)
- Fontes: DM Sans / Inter / InterDisplay
- Dark mode: `darkMode: 'class'` no Tailwind
- Tailwind only — zero custom CSS, zero scoped CSS, zero inline styles
- Composition API com `<script setup>` em todos componentes

### Established Patterns (do backend, para manter consistencia na API)
- Snake_case nos request bodies da API, camelCase interno
- Cursor pagination: `?cursor=abc&limit=50`
- JWT auth com 1h expiry, re-auth silenciosa via token Chatwoot
- Soft delete com `deletedAt` para cards
- RFC 7807 para respostas de erro

### Integration Points
- `POST /api/v1/auth/token` — troca token Chatwoot por JWT Kanban
- `GET /api/v1/stages` — lista estagios da conta
- `GET /api/v1/stages/:id/cards?cursor=&limit=` — lista cards por estagio
- `POST /api/v1/stages/:id/cards` — cria card (contact_name obrigatorio)
- `PATCH /api/v1/cards/:id` — atualiza card (mover entre estagios)
- `DELETE /api/v1/cards/:id` — soft delete
- `PUT /api/v1/stages/reorder` — reordena estagios
- Swagger UI disponivel para referencia completa de endpoints

</code_context>

<specifics>
## Specific Ideas

- Estilo Notion como referencia principal de UX: cards configuraveis, painel lateral expansivel, gestao inline
- Board deve ser "produto" — sem mencoes a ferramentas tecnicas internas (n8n) nos textos user-facing
- Admin personaliza pipeline; agentes usam o board para gerenciar leads no dia-a-dia
- Empty state deve orientar o usuario sobre proximo passo (criar card manual ou configurar automacao)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-kanban-frontend*
*Context gathered: 2026-04-10*
