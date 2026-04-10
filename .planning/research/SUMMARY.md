# Research Summary

**Domain:** Chatwoot Fork + CRM Kanban Module (SaaS, multi-tenant)
**Synthesized:** 2026-04-09

---

## Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Chatwoot Fork | Rails 7 + Vue 3.5 + Vite 5 | Match upstream exactly — zero divergence on core stack |
| Kanban API | Node.js 22 LTS + Fastify 5 + TypeScript + Prisma 6 | Separate service avoids fork conflicts; Fastify auto-generates OpenAPI docs for n8n |
| Kanban Frontend | Vue 3 + Pinia + vue-dnd-kit + Vite 5 | Same ecosystem as Chatwoot — no context switching |
| Kanban DB | PostgreSQL 15 (separate instance) | Isolated from Chatwoot's schema — no migration entanglement |
| Deployment | Two separate Coolify resources (Chatwoot stack + Kanban stack) | Avoids cross-container secret exposure (Coolify v4 bug #7655) |

## Table Stakes Features (v1)

- Drag-and-drop Kanban board with customizable pipeline stages per account
- Card with contact name, channel, entry date, assignee, link to conversation
- REST API for card creation (n8n integration) with idempotency key
- Shared auth via Chatwoot access_token (postMessage → JWT exchange)
- Multi-tenant isolation by account_id on every query
- Chatwoot Dashboard App embed (iframe) + sidebar nav item (fork change)
- Basic filtering (by assignee)

## Architecture Overview

```
Browser → Chatwoot (Vue.js) → iframe → Kanban SPA (Vue.js)
                                            ↓
                                     Kanban API (Fastify)
                                            ↓
                                     Kanban Postgres

n8n → POST /api/cards → Kanban API → Kanban Postgres
```

**Two integration surfaces:**
1. **Dashboard App** (zero fork changes) — conversation-linked card view in Chatwoot's right panel
2. **Sidebar nav item** (minimal fork change, ~3-4 files) — full Kanban board view

**Auth flow:** Chatwoot token → Kanban API validates via Chatwoot `/api/v1/profile` → issues short-lived JWT → all Kanban calls use JWT

## Critical Pitfalls

| # | Pitfall | Prevention | Phase |
|---|---------|------------|-------|
| 1 | **Fork divergence** — editing Chatwoot core files leads to merge hell | Isolate all fork changes to ~3-4 files; maintain UPSTREAM_DIFF.md | Phase 1 |
| 2 | **iframe auth blindspot** — Dashboard Apps have no native auth | Validate tokens server-side; never trust account_id from URL/postMessage | Phase 2 |
| 3 | **Coolify secret cross-exposure** — all env vars leak to all containers | Deploy Chatwoot and Kanban as separate Coolify resources | Phase 1 |
| 4 | **Chatwoot migration failures** — forks break on upstream version jumps | Tag before merge; never skip versions; test migrations on DB copy | Phase 1 |
| 5 | **n8n webhook timeouts** — slow processing causes duplicate/lost cards | Respond immediately (202); process async; idempotency key on card creation | Phase 3 |

## Build Order

1. **Fork Infrastructure** — Fork repo, Dockerfile, deploy on Coolify
2. **Kanban API** — REST endpoints, Prisma schema, auth middleware, account_id scoping
3. **n8n Integration** — Chatwoot webhook → n8n → Kanban API card creation
4. **Kanban Frontend** — Vue.js board with drag-and-drop
5. **Chatwoot Embedding** — Sidebar nav item + Dashboard App config + auth flow
6. **Multi-Tenant Hardening** — Per-account config, isolation testing, onboarding flow

## Key Decisions Surfaced

| Decision | Recommendation | Confidence |
|----------|---------------|------------|
| Fork strategy | Minimal: only modify ~3-4 files for sidebar nav | HIGH |
| Kanban backend | Separate Node.js microservice (not Rails engine) | HIGH |
| Database | Separate Postgres instance (not shared with Chatwoot) | HIGH |
| Coolify deploy | Two separate Coolify resources | HIGH |
| Auth | Token-forwarding + JWT exchange (not separate login) | MEDIUM-HIGH |
| DnD library | vue-dnd-kit (Vue 3 native, pre-1.0 but feature-complete) | MEDIUM |

---
*Research synthesis for: Chatwoot Fork + CRM Kanban Module*
*Synthesized: 2026-04-09*
