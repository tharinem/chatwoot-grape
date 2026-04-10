# Roadmap: Chatwoot Custom (Fork)

## Overview

This roadmap delivers a Chatwoot fork with an embedded CRM Kanban module. We start by establishing the fork infrastructure on Coolify, then build the Kanban API backend with authentication and tenant isolation, wire up n8n for automatic card creation, build the drag-and-drop board frontend, and finally embed everything into the Chatwoot interface via Dashboard App and sidebar navigation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fork Infrastructure** - Chatwoot fork deployed on Coolify with minimal divergence and upstream sync procedure
- [x] **Phase 2: Kanban API & Auth** - Backend service with REST endpoints, Chatwoot token auth, JWT exchange, and multi-tenant isolation (completed 2026-04-10)
- [x] **Phase 3: n8n Card Creation** - Webhook-driven card creation with idempotency and fast acknowledgment for n8n (completed 2026-04-10)
- [ ] **Phase 4: Kanban Frontend** - Vue 3 drag-and-drop board with pipeline management, filtering, and manual card creation
- [ ] **Phase 5: Chatwoot Embedding** - Kanban accessible inside Chatwoot via Dashboard App, sidebar nav item, and standalone URL

## Phase Details

### Phase 1: Fork Infrastructure
**Goal**: Chatwoot fork is running on Coolify identically to the current setup, with a documented strategy for staying in sync with upstream
**Depends on**: Nothing (first phase)
**Requirements**: FORK-01, FORK-02, FORK-03, FORK-04
**Success Criteria** (what must be TRUE):
  1. Chatwoot fork is deployed on Coolify and serves the same functionality as the current official-image setup
  2. The fork repository has a custom Dockerfile that builds successfully from source
  3. Only 3-4 files differ from upstream Chatwoot, documented in UPSTREAM_DIFF.md
  4. A developer can follow the documented procedure to pull upstream changes and merge without breaking customizations
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md -- Fork repo setup, docker-compose build-from-source, upstream diff documentation
- [ ] 01-02-PLAN.md -- Deploy fork on Coolify and verify functional parity

### Phase 2: Kanban API & Auth
**Goal**: A standalone Fastify API exists that authenticates users via Chatwoot tokens, issues scoped JWTs, and enforces multi-tenant data isolation on all endpoints
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, TENANT-01, TENANT-02, TENANT-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. A user logged into Chatwoot can obtain a Kanban JWT without entering credentials -- the Chatwoot access_token is validated server-side via /api/v1/profile
  2. Every Kanban API response only contains data belonging to the authenticated user's account_id -- a token from account A cannot retrieve account B's data
  3. An admin can create, rename, reorder, and delete pipeline stages via the API, and stages are isolated per account
  4. API documentation is auto-generated (OpenAPI/Swagger) and accessible in a browser
  5. Cards can be listed, updated, and moved between stages via REST endpoints
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md -- Project scaffold, Prisma schema, Chatwoot token exchange auth flow with JWT and tenant middleware
- [x] 02-02-PLAN.md -- Stages CRUD with admin guards, reorder, and Swagger documentation
- [x] 02-03-PLAN.md -- Cards CRUD with cursor pagination, soft delete, and stage movement

### Phase 3: n8n Card Creation
**Goal**: n8n can automatically create Kanban cards when new conversations arrive in Chatwoot, with guaranteed idempotency and fast webhook response
**Depends on**: Phase 2
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. An n8n workflow can POST conversation data to the Kanban API and a card appears on the board
  2. Sending the same conversation_id twice does not create a duplicate card
  3. The API responds to webhook POSTs in under 100ms (immediate acknowledgment, async processing if needed)
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md -- Schema extensions (ApiKey model, Card idempotency constraint), BullMQ/ioredis install, Redis config, API key helpers, Zod schemas
- [x] 03-02-PLAN.md -- API key auth plugin, BullMQ queue/worker, webhook endpoint, API key management routes, app wiring

### Phase 4: Kanban Frontend
**Goal**: Users can visually manage their lead pipeline through a drag-and-drop Kanban board with filtering and manual card creation
**Depends on**: Phase 2
**Requirements**: KANB-01, KANB-02, KANB-03, KANB-04, KANB-05, KANB-06, KANB-07, KANB-08
**Success Criteria** (what must be TRUE):
  1. User sees a Kanban board with columns representing pipeline stages, and can drag cards between columns to change their stage
  2. Each card displays contact name, channel of origin, entry date, assigned agent, and a clickable link to the original Chatwoot conversation
  3. Admin can create, rename, reorder, and delete pipeline stages directly from the board UI
  4. User can filter the board to show only cards assigned to a specific agent (e.g., "assigned to me")
  5. User can manually create a new card on the board without relying on n8n, and an empty board shows a clear next-step message
**Plans:** 2/4 plans executed
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md -- Project scaffold: Vite + Vue 3 + TypeScript, Tailwind with Chatwoot design tokens, app shell
- [x] 04-02-PLAN.md -- Types, API client with JWT auth, Pinia stores, composables, router, i18n translations
- [x] 04-03-PLAN.md -- Board layout, KanbanBoard/Column/Card components with drag-and-drop, empty states, toast system
- [ ] 04-04-PLAN.md -- Stage management UI, filter bar, card creation form, slide panel, field visibility, wiring + human verification

### Phase 5: Chatwoot Embedding
**Goal**: The Kanban board is seamlessly accessible from within Chatwoot -- both as a conversation-linked panel and as a full board via sidebar navigation
**Depends on**: Phase 1, Phase 4
**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04
**Success Criteria** (what must be TRUE):
  1. A Dashboard App in Chatwoot's conversation panel shows the Kanban card linked to the current conversation, receiving context via postMessage
  2. A sidebar menu item in Chatwoot opens the full Kanban board (fork change, minimal file modifications)
  3. The Kanban board is also accessible directly via its own URL outside of Chatwoot
  4. Auth flows seamlessly -- a user already logged into Chatwoot accesses the embedded Kanban without a second login prompt
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fork Infrastructure | 0/2 | Planned | - |
| 2. Kanban API & Auth | 3/3 | Complete   | 2026-04-10 |
| 3. n8n Card Creation | 2/2 | Complete | 2026-04-10 |
| 4. Kanban Frontend | 2/4 | In Progress|  |
| 5. Chatwoot Embedding | 0/2 | Not started | - |
