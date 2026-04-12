# Roadmap: Chatwoot Custom (Fork)

## Overview

This roadmap delivers a Chatwoot fork with an embedded CRM Kanban module. We start by establishing the fork infrastructure on Coolify, then build the Kanban API backend with authentication and tenant isolation, wire up n8n for automatic card creation, build the drag-and-drop board frontend, and finally embed everything into the Chatwoot interface via Dashboard App and sidebar navigation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fork Infrastructure** - Chatwoot fork deployed on Coolify with custom branding, GitHub Actions CI/CD, and GHCR image (completed 2026-04-12)
- [x] **Phase 2: Kanban API & Auth** - Backend service with REST endpoints, Chatwoot token auth, JWT exchange, and multi-tenant isolation (completed 2026-04-10)
- [x] **Phase 3: n8n Card Creation** - Webhook-driven card creation with idempotency and fast acknowledgment for n8n (completed 2026-04-10)
- [ ] **Phase 4: Kanban Frontend** - React drag-and-drop board with pipeline management, filtering, and manual card creation
- [x] **Phase 5: Chatwoot Embedding** - Kanban accessible inside Chatwoot via sidebar nav item and iframe embedding (completed 2026-04-12)

## Phase Details

### Phase 1: Fork Infrastructure
**Goal**: Chatwoot fork is running on Coolify with custom branding, automated Docker builds, and a clear deployment workflow
**Depends on**: Nothing (first phase)
**Requirements**: FORK-01, FORK-02, FORK-03, FORK-04
**Success Criteria** (what must be TRUE):
  1. ✅ Chatwoot fork is deployed on Coolify using custom Docker image from GHCR
  2. ✅ GitHub Actions builds and pushes image to ghcr.io/tharinem/chatwoot-grape:custom on every push
  3. ✅ Custom branding applied: Grape Ai name, logos, purple color scheme (#7B5EA7)
  4. ✅ Branding configured via InstallationConfig database entries and source code changes
**Plans:** 2 plans — completed outside GSD flow
**Completed**: 2026-04-12

Plans:
- [x] 01-01-PLAN.md -- Fork repo setup, custom Dockerfile, GitHub Actions CI/CD to GHCR
- [x] 01-02-PLAN.md -- Branding customization (name, logos, colors, login text) and Coolify deployment

### Phase 2: Kanban API & Auth
**Goal**: A standalone Fastify API exists that authenticates users via Chatwoot tokens, issues scoped JWTs, and enforces multi-tenant data isolation on all endpoints
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, TENANT-01, TENANT-02, TENANT-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. ✅ A user logged into Chatwoot can obtain a Kanban JWT without entering credentials
  2. ✅ Every Kanban API response only contains data belonging to the authenticated user's account_id
  3. ✅ An admin can create, rename, reorder, and delete pipeline stages via the API
  4. ✅ API documentation is auto-generated (OpenAPI/Swagger)
  5. ✅ Cards can be listed, updated, and moved between stages via REST endpoints
**Plans:** 3/3 plans complete
**Completed**: 2026-04-10

Plans:
- [x] 02-01-PLAN.md -- Project scaffold, Prisma schema, Chatwoot token exchange auth flow with JWT and tenant middleware
- [x] 02-02-PLAN.md -- Stages CRUD with admin guards, reorder, and Swagger documentation
- [x] 02-03-PLAN.md -- Cards CRUD with cursor pagination, soft delete, and stage movement

### Phase 3: n8n Card Creation
**Goal**: n8n can automatically create Kanban cards when new conversations arrive in Chatwoot, with guaranteed idempotency and fast webhook response
**Depends on**: Phase 2
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. ✅ An n8n workflow can POST conversation data to the Kanban API and a card appears on the board
  2. ✅ Sending the same conversation_id twice does not create a duplicate card
  3. ✅ The API responds to webhook POSTs in under 100ms
**Plans:** 2/2 plans complete
**Completed**: 2026-04-10

Plans:
- [x] 03-01-PLAN.md -- Schema extensions, BullMQ/ioredis, Redis config, API key helpers, Zod schemas
- [x] 03-02-PLAN.md -- API key auth plugin, BullMQ queue/worker, webhook endpoint, API key management routes

### Phase 4: Kanban Frontend
**Goal**: Users can visually manage their lead pipeline through a drag-and-drop Kanban board with filtering and manual card creation
**Depends on**: Phase 2
**Requirements**: KANB-01, KANB-02, KANB-03, KANB-04, KANB-05, KANB-06, KANB-07, KANB-08
**Success Criteria** (what must be TRUE):
  1. ✅ User sees a Kanban board with columns representing pipeline stages, and can drag cards between columns
  2. ✅ Each card displays contact name, channel of origin, entry date, assigned agent
  3. ⬜ Admin can create, rename, reorder, and delete pipeline stages from the board UI
  4. ⬜ User can filter the board to show only cards assigned to a specific agent
  5. ⬜ User can manually create a new card on the board
**Plans:** 3/4 plans executed
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md -- Project scaffold: Vite + React + TypeScript, Tailwind with design tokens, app shell
- [x] 04-02-PLAN.md -- Types, API client with JWT auth, stores, composables, router, i18n
- [x] 04-03-PLAN.md -- Board layout, KanbanBoard/Column/Card components with drag-and-drop, empty states
- [ ] 04-04-PLAN.md -- Stage management UI, filter bar, card creation form, slide panel, field visibility

### Phase 5: Chatwoot Embedding
**Goal**: The Kanban board is seamlessly accessible from within Chatwoot via sidebar navigation and iframe embedding
**Depends on**: Phase 1, Phase 4
**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04
**Success Criteria** (what must be TRUE):
  1. ⬜ A Dashboard App in Chatwoot's conversation panel shows the Kanban card linked to the current conversation
  2. ✅ A sidebar menu item in Chatwoot opens the full Kanban board (iframe embedding)
  3. ✅ The Kanban board is accessible directly via its own URL (kanban.reengenhariadigital.com.br)
  4. ⬜ Auth flows seamlessly -- user logged into Chatwoot accesses Kanban without second login
**Plans:** 1/2 complete (sidebar embedding done outside GSD)
**Completed partially**: 2026-04-12

Plans:
- [x] 05-01-PLAN.md -- Sidebar nav item + iframe component embedding kanban frontend
- [ ] 05-02-PLAN.md -- Dashboard App for conversation-linked card view + seamless auth flow

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fork Infrastructure | 2/2 | Complete | 2026-04-12 |
| 2. Kanban API & Auth | 3/3 | Complete | 2026-04-10 |
| 3. n8n Card Creation | 2/2 | Complete | 2026-04-10 |
| 4. Kanban Frontend | 3/4 | In Progress | - |
| 5. Chatwoot Embedding | 1/2 | Partial | 2026-04-12 |
