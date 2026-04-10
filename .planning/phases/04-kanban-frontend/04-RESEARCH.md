# Phase 4: Kanban Frontend - Research

**Researched:** 2026-04-10
**Domain:** Vue 3 SPA with drag-and-drop Kanban board, Chatwoot design system
**Confidence:** HIGH

## Summary

This phase builds a greenfield Vue 3 SPA (`kanban-frontend/`) that consumes the Kanban API (Phase 2) to render a visual drag-and-drop pipeline board. The backend API is fully built with Fastify + Prisma, providing CRUD for stages and cards, JWT auth via Chatwoot token exchange, cursor pagination, and tenant isolation by `account_id`.

The frontend must replicate Chatwoot's "next" design system -- CSS custom properties for colors (`--slate-*`, `--blue-*`, etc.) mapped through Tailwind's `n.*` color namespace, Lucide icons via `@egoist/tailwindcss-icons`, DM Sans/Inter fonts, and `darkMode: 'class'`. The SPA is standalone (not embedded in Chatwoot -- that is Phase 5) and uses Composition API with `<script setup>` exclusively, Tailwind-only styling (zero custom/scoped/inline CSS), and i18n for all user-facing copy.

For drag-and-drop, `vue-draggable-plus` (0.6.1) is the recommended library. It wraps SortableJS with native Vue 3 Composition API support, provides a `useDraggable` composable, and handles the cross-column card movement pattern needed for Kanban boards. State management uses Pinia with per-store optimistic updates and rollback on API failure.

**Primary recommendation:** Scaffold a Vite + Vue 3 + TypeScript project with Pinia, vue-router, vue-i18n, axios, and vue-draggable-plus. Mirror Chatwoot's `_next-colors.scss` CSS vars and `theme/colors.js` `n.*` Tailwind config subset for visual consistency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Cards compactos como default (nome do contato + canal + tempo relativo), com configuracao de campos visiveis estilo Notion
- **D-02:** Configuracao de campos visiveis via menu no header do board (toggles por campo)
- **D-03:** Click no card abre painel lateral (slide-in pela direita), com opcao de expandir para modal
- **D-04:** Drag-and-drop fluido com animacoes: card levanta com sombra ao arrastar, colunas mostram zona de drop com highlight, cards existentes abrem espaco suavemente
- **D-05:** Sem confirmacao ao mover card -- drop imediato com chamada API automatica, optimistic update com rollback
- **D-06:** Desktop-first -- scroll horizontal basico em mobile
- **D-07:** Gestao inline no board: clicar no titulo da coluna para renomear, botao '+' no final para adicionar, menu '...' para deletar/reordenar
- **D-08:** Ao deletar estagio com cards, pede para escolher coluna destino antes de efetivar
- **D-09:** Barra de filtros no topo com multiplos criterios: Agente, Canal, Data. Atalho "Atribuidos a mim"
- **D-10:** Empty state com mensagem central, botao criar card, texto sobre automacao (sem mencionar n8n)
- **D-11:** Criacao manual de card via '+' no header de cada coluna E botao global "Novo card"
- **D-12:** Cores sutis e configuraveis por estagio -- borda colorida fina no topo de cada coluna, admin configura via color picker
- **D-13:** Design system Chatwoot: cores CSS vars `n.`, dark mode `class`, fontes DM Sans/Inter
- **D-14:** Icones Lucide via classes `i-lucide-*`
- **D-15:** Nao mencionar "n8n" em nenhum texto user-facing

### Claude's Discretion
- Escolha de biblioteca de drag-and-drop
- Estrutura de pastas do projeto Vue 3
- Estrategia de state management (Pinia, composables, etc.)
- Formato exato do formulario de criacao de card

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KANB-01 | Visualizar pipeline como board Kanban com colunas por estagio | KanbanBoard + KanbanColumn components, GET /stages + GET /stages/:id/cards APIs |
| KANB-02 | Mover cards entre colunas via drag-and-drop | vue-draggable-plus with cross-column drag, PATCH /cards/:id with stage_id |
| KANB-03 | Admin pode criar, renomear, reordenar e deletar estagios | Inline stage editing, POST/PATCH/DELETE /stages, PATCH /stages/reorder, role check from JWT |
| KANB-04 | Card exibe nome do contato, canal, data de entrada, agente | KanbanCard with configurable visibleFields, data from card API response |
| KANB-05 | Card contem link direto para conversa no Chatwoot | Chatwoot URL constructed from conversation_id, rendered as clickable icon in card |
| KANB-06 | Filtrar cards por agente atribuido | Client-side filtering via FilterBar, "Atribuidos a mim" quick-filter using JWT user_id |
| KANB-07 | Empty state claro quando nao ha cards | EmptyBoard component with CTA and guidance copy |
| KANB-08 | Criar card manualmente no board | CardForm component, POST /stages/:id/cards, two entry points (column + global) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | 3.5.32 | UI framework | Project standard, Composition API required |
| vite | 8.0.8 | Build tool / dev server | Standard Vue 3 scaffolding, fast HMR |
| typescript | 5.x | Type safety | Project uses TS throughout (kanban-api is TS) |
| pinia | 3.0.4 | State management | Official Vue state management, Composition API native |
| vue-router | 5.0.4 | Client routing | Needed for future route expansion (card detail, settings) |
| vue-i18n | 11.3.2 | Internationalization | CLAUDE.md mandates i18n for all user-facing strings |
| axios | 1.15.0 | HTTP client | Standard REST client, interceptor support for JWT refresh |
| vue-draggable-plus | 0.6.1 | Drag-and-drop | Vue 3 native, Composition API composable, SortableJS-based |
| tailwindcss | 3.x | Utility CSS | CLAUDE.md mandates Tailwind-only styling |
| @egoist/tailwindcss-icons | latest | Lucide icon classes | D-14: `i-lucide-*` classes for icons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vueuse/core | latest | Composition utilities | useLocalStorage (field visibility), useEventListener, onClickOutside |
| date-fns | latest | Date formatting | Relative time display ("ha 2 dias"), date filter presets |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vue-draggable-plus | @atlaskit/pragmatic-drag-and-drop | More powerful but no Vue-specific bindings; requires manual integration; 1.7.10 is React-focused |
| vue-draggable-plus | Native HTML5 DnD API | Full control but enormous boilerplate for cross-column drag, animations, ghost elements |
| Pinia | Composables only | Works for small apps but Pinia gives devtools, persistence plugins, SSR support |
| axios | fetch + wrapper | axios has interceptor pattern ideal for JWT refresh; fetch requires more manual work |

**Installation:**
```bash
npm create vite@latest kanban-frontend -- --template vue-ts
cd kanban-frontend
npm install vue-router pinia vue-i18n axios vue-draggable-plus @vueuse/core date-fns
npm install -D tailwindcss @tailwindcss/vite @egoist/tailwindcss-icons @iconify-json/lucide
```

## Architecture Patterns

### Recommended Project Structure
```
kanban-frontend/
├── public/
├── src/
│   ├── api/                 # API client, interceptors, auth
│   │   ├── client.ts        # Axios instance with JWT interceptor
│   │   ├── auth.ts          # Token exchange, silent re-auth
│   │   ├── stages.ts        # Stage CRUD API calls
│   │   └── cards.ts         # Card CRUD + move API calls
│   ├── components/
│   │   ├── board/           # KanbanBoard, KanbanColumn, KanbanCard
│   │   ├── layout/          # BoardLayout, BoardTopBar, FilterBar
│   │   ├── detail/          # CardSlidePanel, CardForm
│   │   ├── stage/           # ColumnHeader, AddStageButton, StageColorPicker
│   │   └── shared/          # ConfirmDialog, Toast, DropdownMenu, FieldVisibilityMenu
│   ├── composables/         # Reusable composition functions
│   │   ├── useAuth.ts       # JWT management, silent re-auth
│   │   ├── useDragDrop.ts   # Drag-and-drop configuration + optimistic update
│   │   ├── useFilters.ts    # Filter state and logic
│   │   └── useToast.ts      # Toast notification state
│   ├── stores/              # Pinia stores
│   │   ├── board.ts         # Stages + cards state, CRUD actions
│   │   ├── auth.ts          # JWT token, user info, role
│   │   └── ui.ts            # Field visibility, filter state, panel open/close
│   ├── i18n/
│   │   └── pt-BR.json       # Portuguese (BR) translations
│   ├── types/               # TypeScript interfaces
│   │   ├── card.ts          # Card, CreateCardInput, UpdateCardInput
│   │   └── stage.ts         # Stage, CreateStageInput
│   ├── router/
│   │   └── index.ts         # Route definitions
│   ├── styles/
│   │   └── colors.css       # CSS vars from Chatwoot _next-colors.scss
│   ├── App.vue
│   └── main.ts
├── tailwind.config.ts       # Mirrors Chatwoot n.* color subset
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Pattern 1: Optimistic Update with Rollback (D-05)
**What:** When user drops a card on a new column, UI updates immediately. If API call fails, card snaps back to original position and error toast appears.
**When to use:** All card move operations via drag-and-drop.
**Example:**
```typescript
// In board store (Pinia)
async function moveCard(cardId: string, targetStageId: string, position: number) {
  const card = findCard(cardId);
  const snapshot = { stageId: card.stageId, position: card.position };

  // Optimistic: move in local state immediately
  removeCardFromStage(card.stageId, cardId);
  insertCardInStage(targetStageId, cardId, position);

  try {
    await cardsApi.update(cardId, { stage_id: targetStageId, position });
  } catch (error) {
    // Rollback: restore original position
    removeCardFromStage(targetStageId, cardId);
    insertCardInStage(snapshot.stageId, cardId, snapshot.position);
    showToast('error', t('toast.dragFail'));
  }
}
```

### Pattern 2: Silent JWT Re-Auth (D-06 from Phase 2)
**What:** Axios interceptor detects 401, re-authenticates using stored Chatwoot token, retries original request.
**When to use:** All API calls. JWT expires after 1h.
**Example:**
```typescript
// api/client.ts
const apiClient = axios.create({ baseURL: '/api/v1' });

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const authStore = useAuthStore();
      await authStore.refreshToken(); // calls POST /auth/chatwoot-token
      error.config.headers.Authorization = `Bearer ${authStore.jwt}`;
      return apiClient(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Pattern 3: Chatwoot Design Token Replication
**What:** Copy CSS vars from `_next-colors.scss` into standalone `colors.css`, replicate `n.*` Tailwind color config subset.
**When to use:** Project setup (Wave 0).
**Example:**
```css
/* src/styles/colors.css -- copy from Chatwoot _next-colors.scss */
@layer base {
  :root {
    --slate-1: 252 252 253;
    --slate-2: 249 249 251;
    /* ... all vars from _next-colors.scss :root ... */
    --brand: 123 94 167; /* #7B5EA7 */
  }
  .dark {
    --slate-1: 17 17 19;
    /* ... all vars from _next-colors.scss .dark ... */
  }
}
```

```typescript
// tailwind.config.ts -- mirror relevant n.* subset
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        n: {
          slate: {
            1: 'rgb(var(--slate-1) / <alpha-value>)',
            // ... 1 through 12
          },
          blue: { /* ... 1 through 12 */ },
          ruby: { /* ... 1 through 12 */ },
          amber: { /* ... 1 through 12 */ },
          teal: { /* ... 1 through 12 */ },
          brand: '#7B5EA7',
          background: 'rgb(var(--background-color) / <alpha-value>)',
          // ... weak, strong, container, alpha, solid, surface
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'sans-serif'],
      },
    },
  },
};
```

### Anti-Patterns to Avoid
- **Custom CSS or scoped styles:** CLAUDE.md strictly forbids. Use Tailwind utility classes only.
- **Hardcoded strings in templates:** All user-facing copy must go through vue-i18n `t()`. This includes empty states, toasts, form labels, button text.
- **Mentioning "n8n" in UI:** D-15 explicitly forbids. Use "automacao" generically.
- **Nested module/class definitions in any Ruby code:** Not applicable to this phase (Vue-only) but noted from CLAUDE.md.
- **Direct ENV stubbing in tests:** Use `with_modified_env` -- not applicable to this phase but noted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop between columns | Custom HTML5 DnD with event listeners | vue-draggable-plus `useDraggable` | Cross-column drag, animation, ghost element, touch support are extremely complex to build correctly |
| Date formatting / relative time | Custom date formatter | date-fns `formatDistanceToNow` / `format` | Locale support (pt-BR), edge cases with timezone, "ha 2 dias" pattern |
| Click outside detection | Manual document event listeners | @vueuse/core `onClickOutside` | Memory leak prevention, SSR safety, cleanup on unmount |
| Local storage persistence | Manual JSON parse/stringify | @vueuse/core `useLocalStorage` | Reactive, type-safe, handles serialization edge cases |
| Toast notifications | Full toast system from scratch | Simple composable with Teleport | A toast queue composable (useToast) with a Teleport-based renderer is ~40 lines; no need for a library |
| i18n | Manual string maps | vue-i18n | Interpolation, pluralization, missing key detection |

**Key insight:** The drag-and-drop cross-column interaction is the single most complex piece. vue-draggable-plus handles SortableJS configuration, Vue reactivity integration, animation, and ghost elements -- building this from scratch would consume 50%+ of the phase budget.

## Common Pitfalls

### Pitfall 1: SortableJS Cross-Group Configuration
**What goes wrong:** Cards can only be dragged within the same column, not across columns.
**Why it happens:** vue-draggable-plus requires a `group` option with the same name on all column instances to enable cross-column drag.
**How to avoid:** Set `group: 'cards'` on every `useDraggable` instance (one per column). The group name must be identical.
**Warning signs:** Cards lift but cannot be dropped in other columns; drop zones don't highlight.

### Pitfall 2: Optimistic Update Race Conditions
**What goes wrong:** User drags card A to column B, then immediately drags card C to column B. First API call fails, rollback corrupts card C's position.
**Why it happens:** Rollback logic uses stale snapshot when multiple concurrent drags occur.
**How to avoid:** Use a per-card operation lock (prevent dragging a card that has a pending API call) or queue move operations.
**Warning signs:** Cards appearing in wrong positions after fast successive drags.

### Pitfall 3: Snake_case to CamelCase Mismatch
**What goes wrong:** API returns `contactName` (camelCase from Prisma) but expects `contact_name` (snake_case) in request bodies.
**Why it happens:** Phase 2 decision: snake_case request bodies, camelCase responses (Prisma auto-serialization).
**How to avoid:** API client layer maps between cases. Response types use camelCase. Request builders convert to snake_case before sending.
**Warning signs:** 400 errors on POST/PATCH with "required field missing" when the field is actually present but in wrong case.

### Pitfall 4: JWT Expiry During Drag Operation
**What goes wrong:** User authenticates, works for 59 minutes, drags a card. The PATCH call returns 401 but the optimistic update already applied.
**Why it happens:** JWT has 1h expiry. The interceptor retries but the drag animation has already completed.
**How to avoid:** The 401 interceptor must handle retry transparently -- retry the original request after re-auth, then check if it succeeded. If retry also fails, trigger rollback.
**Warning signs:** Cards appearing moved in UI but not persisted to backend.

### Pitfall 5: Chatwoot Token Not Available on Initial Load
**What goes wrong:** SPA loads at standalone URL but has no Chatwoot token to exchange for JWT.
**Why it happens:** In Phase 4 (standalone SPA, pre-embedding), there is no automatic token passing from Chatwoot.
**How to avoid:** Implement a simple login screen that accepts the Chatwoot `user_access_token` and `account_id` -- or accept them as URL params for dev/testing. Phase 5 will handle automatic token passing via postMessage.
**Warning signs:** Blank screen on load, 401 on first API call.

### Pitfall 6: Stage Delete API Returns 409 When Cards Exist
**What goes wrong:** Frontend sends DELETE /stages/:id but API returns 409 Conflict because the stage has active cards.
**Why it happens:** The backend requires cards to be moved before stage deletion. The frontend must first batch-move cards to a chosen destination stage, then delete.
**How to avoid:** Per D-08, show a ConfirmDialog that lets admin pick destination stage, then PATCH each card's stage_id, then DELETE the stage.
**Warning signs:** "Stage has active cards" error toast with no way for user to resolve.

## Code Examples

### vue-draggable-plus Cross-Column Setup
```vue
<!-- KanbanColumn.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useDraggable } from 'vue-draggable-plus';
import type { Card } from '@/types/card';

const props = defineProps<{
  stageId: string;
  cards: Card[];
}>();

const emit = defineEmits<{
  cardMoved: [cardId: string, targetStageId: string, newIndex: number];
}>();

const containerRef = ref<HTMLElement | null>(null);

useDraggable(containerRef, props.cards, {
  group: 'cards',
  animation: 200,
  ghostClass: 'opacity-50',
  dragClass: 'shadow-lg scale-[1.02]',
  onEnd(event) {
    if (event.to !== event.from || event.newIndex !== event.oldIndex) {
      const cardId = props.cards[event.newIndex!]?.id;
      const targetStageId = event.to.dataset.stageId!;
      emit('cardMoved', cardId, targetStageId, event.newIndex!);
    }
  },
});
</script>

<template>
  <div
    ref="containerRef"
    :data-stage-id="stageId"
    class="flex flex-col gap-2 min-h-[100px] p-2"
  >
    <slot />
  </div>
</template>
```

### Axios JWT Interceptor
```typescript
// src/api/client.ts
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('kanban_jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### API Endpoints (from backend)
```typescript
// src/api/stages.ts
import { apiClient } from './client';
import type { Stage } from '@/types/stage';

export const stagesApi = {
  list: () => apiClient.get<(Stage & { _count?: { cards: number } })[]>('/stages'),
  create: (data: { name: string; color?: string }) => apiClient.post<Stage>('/stages', data),
  update: (id: string, data: { name?: string; color?: string | null }) =>
    apiClient.patch<Stage>(`/stages/${id}`, data),
  delete: (id: string) => apiClient.delete(`/stages/${id}`),
  reorder: (stages: { id: string; position: number }[]) =>
    apiClient.patch<Stage[]>('/stages/reorder', { stages }),
};

// src/api/cards.ts
import { apiClient } from './client';
import type { Card, PaginatedCards } from '@/types/card';

export const cardsApi = {
  listByStage: (stageId: string, cursor?: string, limit = 50) =>
    apiClient.get<PaginatedCards>(`/stages/${stageId}/cards`, {
      params: { cursor, limit },
    }),
  create: (stageId: string, data: { contact_name: string; [key: string]: unknown }) =>
    apiClient.post<Card>(`/stages/${stageId}/cards`, data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<Card>(`/cards/${id}`, data),
  delete: (id: string) => apiClient.delete(`/cards/${id}`),
};
```

### TypeScript Types (matching API schemas)
```typescript
// src/types/card.ts
export interface Card {
  id: string;
  accountId: number;
  stageId: string;
  contactName: string;
  conversationId: number | null;
  channelType: string | null;
  assigneeId: number | null;
  position: number;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCards {
  data: Card[];
  nextCursor: string | null;
  hasMore: boolean;
}

// src/types/stage.ts
export interface Stage {
  id: string;
  accountId: number;
  name: string;
  position: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| vuedraggable (Vue 2) | vue-draggable-plus (Vue 2/3 unified) | 2023 | Full Composition API support, `useDraggable` composable |
| Options API | Composition API + `<script setup>` | Vue 3.2+ (2021) | CLAUDE.md mandates this pattern |
| Vuex | Pinia | Vue 3 official (2022) | Lighter API, TS-first, no mutations concept |
| Webpack | Vite | Standard since 2022 | 10x faster HMR, native ESM |
| vue-i18n v8 | vue-i18n v11 | 2024 | Composition API `useI18n()`, message compiler improvements |

## Open Questions

1. **Initial Authentication Flow for Standalone SPA**
   - What we know: Phase 5 handles embedding in Chatwoot (postMessage token passing). Phase 4 is standalone.
   - What's unclear: How does a user authenticate on first load of the standalone URL? There is no login screen designed.
   - Recommendation: Accept `chatwoot_token` and `account_id` as URL query params for dev/testing. Show a minimal login form as fallback. This is temporary scaffolding that Phase 5 replaces.

2. **Chatwoot Base URL for Conversation Links (KANB-05)**
   - What we know: Cards have `conversationId`. The link target is the Chatwoot conversation URL.
   - What's unclear: What is the Chatwoot instance URL? It varies by deployment.
   - Recommendation: Store as env var `VITE_CHATWOOT_URL`. Link format: `${VITE_CHATWOOT_URL}/app/accounts/${accountId}/conversations/${conversationId}`.

3. **Card Move: Stage Deletion with Cards**
   - What we know: Backend returns 409 if stage has cards. D-08 says UI must prompt for destination stage.
   - What's unclear: Should the frontend batch-PATCH all cards to the destination stage first, then DELETE the stage? Or should the backend handle this atomically?
   - Recommendation: Frontend batch-moves cards (multiple PATCH calls or Promise.all), then calls DELETE. Backend already enforces the constraint. A future backend improvement could add a `move_cards_to` param on DELETE.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + dev server | Yes | 24.14.1 | -- |
| npm | Package management | Yes | 11.11.0 | -- |
| pnpm | Package management (preferred) | No | -- | Use npm instead |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- pnpm not installed. Use `npm` for package management instead. All commands in this research use `npm`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, bundled with Vite) + @vue/test-utils |
| Config file | `kanban-frontend/vitest.config.ts` (Wave 0) |
| Quick run command | `cd kanban-frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd kanban-frontend && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KANB-01 | Board renders columns for each stage | unit | `npx vitest run src/components/board/KanbanBoard.spec.ts -t "renders columns"` | Wave 0 |
| KANB-02 | Card move triggers API call with correct stage_id | unit | `npx vitest run src/stores/board.spec.ts -t "moveCard"` | Wave 0 |
| KANB-03 | Stage CRUD operations (create, rename, delete, reorder) | unit | `npx vitest run src/stores/board.spec.ts -t "stage"` | Wave 0 |
| KANB-04 | Card displays contact name, channel, date, agent | unit | `npx vitest run src/components/board/KanbanCard.spec.ts` | Wave 0 |
| KANB-05 | Card renders Chatwoot conversation link | unit | `npx vitest run src/components/board/KanbanCard.spec.ts -t "chatwoot link"` | Wave 0 |
| KANB-06 | Filter by agent filters cards client-side | unit | `npx vitest run src/composables/useFilters.spec.ts` | Wave 0 |
| KANB-07 | Empty state renders when zero cards | unit | `npx vitest run src/components/board/EmptyBoard.spec.ts` | Wave 0 |
| KANB-08 | Card form submits POST to correct stage | unit | `npx vitest run src/components/detail/CardForm.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd kanban-frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd kanban-frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `kanban-frontend/vitest.config.ts` -- Vitest configuration
- [ ] `kanban-frontend/src/test-utils.ts` -- Shared test helpers (mount with Pinia, vue-i18n, router)
- [ ] Framework install: `npm install -D vitest @vue/test-utils jsdom`

## Project Constraints (from CLAUDE.md)

- **Tailwind Only:** No custom CSS, no scoped CSS, no inline styles. All styling via Tailwind utility classes.
- **Composition API:** Always use `<script setup>` at the top of every Vue component.
- **i18n:** No bare strings in templates. All user-facing text through vue-i18n.
- **Vue Components:** PascalCase naming.
- **Events:** camelCase naming.
- **MVP focus:** Least code change, happy-path only. Ship happy path first.
- **No unnecessary defensive programming.**
- **Remove dead/unused code.**
- **Don't write specs unless explicitly asked** (but Nyquist validation requires test infrastructure).
- **Commit messages:** Conventional Commits format (`type(scope): subject`), no Claude references.

## Sources

### Primary (HIGH confidence)
- Chatwoot codebase `theme/colors.js` -- Complete `n.*` color token definitions with CSS var mappings
- Chatwoot codebase `app/javascript/dashboard/assets/scss/_next-colors.scss` -- Light/dark mode CSS var definitions
- Chatwoot codebase `tailwind.config.js` -- Tailwind plugin config, icon collections, dark mode strategy
- Chatwoot codebase `app/javascript/dashboard/components-next/button/Button.vue` -- Reference component pattern (STYLE_CONFIG, variants, sizes)
- `kanban-api/src/schemas/card.ts` -- Card API request/response schemas
- `kanban-api/src/schemas/stage.ts` -- Stage API schemas
- `kanban-api/src/routes/v1/cards.ts` -- Card route implementations
- `kanban-api/src/routes/v1/stages.ts` -- Stage route implementations (including reorder before /:id)
- `kanban-api/src/routes/v1/auth.ts` -- Token exchange endpoint
- npm registry -- Verified package versions via `npm view`

### Secondary (MEDIUM confidence)
- [vue-draggable-plus docs](https://vue-draggable-plus.pages.dev/en/) -- Composition API usage, useDraggable composable
- [vue-draggable-plus npm](https://www.npmjs.com/package/vue-draggable-plus) -- Version 0.6.1, SortableJS wrapper
- [Atlassian pragmatic-drag-and-drop](https://github.com/atlassian/pragmatic-drag-and-drop) -- Evaluated as alternative, React-focused

### Tertiary (LOW confidence)
- None. All findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All packages verified via npm registry, versions confirmed current
- Architecture: HIGH -- Based on established Vue 3 + Pinia + Vite patterns and existing backend API contracts
- Pitfalls: HIGH -- Derived from actual API implementation code (409 on stage delete, snake/camelCase mismatch, JWT 1h expiry)
- Design system: HIGH -- Copied directly from Chatwoot source files

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable ecosystem, 30-day validity)
