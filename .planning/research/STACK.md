# Stack Research

**Domain:** Chatwoot fork with custom CRM Kanban modules — SaaS multi-tenant
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH (fork strategy is community-derived; all tech versions verified from official sources)

---

## Overview of System Components

This project has three distinct technical layers, each with different stack decisions:

1. **Chatwoot Fork** — the Rails 7 + Vue 3 monolith, minimally modified
2. **Kanban CRM Microservice** — a separate Node.js service with its own DB and REST API
3. **Coolify Deployment** — both services deployed from a single Docker Compose file

---

## Recommended Stack

### Layer 1: Chatwoot Fork

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Ruby | 3.4.4 | Runtime for Rails app | This is what Chatwoot's `.ruby-version` pins — matching upstream avoids all gem native extension issues during merges |
| Rails | ~7.1 (currently 7.2.x on develop) | Web framework | Locked to upstream Chatwoot's Gemfile version. Do not upgrade independently. |
| Vue | 3.5.12 | Frontend framework | Chatwoot has completed its Vue 3 migration. All new sidebar code must be Vue 3 Composition API — Options API still exists in legacy files but avoid for new code. |
| Vite | ~5.4 | Frontend bundler | Chatwoot replaced Webpacker with Vite. Custom routes/components hook into this build pipeline. |
| Pinia | ^3.0 | State management | Chatwoot uses both Pinia and legacy Vuex 4. Use Pinia for any new module state — Vuex is being phased out. |
| PostgreSQL | 14+ (same as upstream recommendation) | Primary database | Shared with Chatwoot's instance. The Kanban service gets its own separate database. |
| Redis | 6+ | Sidekiq queue + Action Cable | Shared service; do not run a second Redis for the fork itself. |
| Sidekiq | >=7.3.1 | Background job processing | Upstream version requirement. Do not pin lower. |
| Node | 24.x | Frontend build tooling | Chatwoot's `package.json` engines field requires Node 24. This is what the Dockerfile must use. |
| pnpm | 10.x | Package manager | Required by Chatwoot's packageManager field. Do not use npm or yarn in the fork. |

**What the fork changes:** Only two things should be added to Chatwoot's source:
1. A new route + Vue component that renders the Kanban iframe
2. A new sidebar navigation entry pointing to that route

No backend changes to Chatwoot are needed. The Kanban service authenticates users independently using Chatwoot's API.

### Layer 2: Kanban CRM Microservice (New Service)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | Fastify 5 supports Node 20 and 22 — use 22 LTS (April 2025 LTS release) for production stability. Node 24 is too new for LTS guarantees on the microservice. |
| Fastify | 5.8.x | HTTP framework | 2-3x faster than Express under load; built-in JSON schema validation generates Swagger docs automatically; plugin encapsulation is ideal for a multi-tenant API. MEDIUM confidence (performance claims from community benchmarks; Fastify docs confirm LTS through TBD). |
| TypeScript | 5.x | Language | Fastify 5 was built TypeScript-first. Prisma schema generates TypeScript types. Catches multi-tenant bugs (wrong account_id) at compile time. |
| Prisma | 6.x | ORM | Best TypeScript-native ORM for PostgreSQL in 2025; auto-generates migrations; `@prisma/adapter-pg` available for better connection pool control. HIGH confidence (official docs verified). |
| PostgreSQL | 15 | Database | Dedicated database for Kanban service — do NOT share with Chatwoot's DB. Separate connection string, separate schema. Avoids cross-service schema coupling. |
| Vue 3 | 3.5.x | Kanban frontend UI | The Kanban app is served as a standalone SPA embedded via iframe in Chatwoot. Use Vue 3 to match Chatwoot's existing frontend team knowledge — no context switch. |
| vue-dnd-kit | latest (0.x, active) | Drag-and-drop Kanban | The Vue 3 equivalent of dnd-kit for React. Zero dependencies, supports Kanban out of the box, keyboard navigation, animations. LOW-MEDIUM confidence (new library, API not yet at 1.0, but actively maintained and feature-complete for this use case). |
| Vite | 5.x | Frontend bundler | Same toolchain as Chatwoot frontend — consistent build patterns across the project. |

### Layer 3: Coolify Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Coolify | 4.x | Self-hosted PaaS | Already in use. Docker Compose build pack is the correct deployment mode for multi-service stacks. |
| Docker Compose | v2 | Service orchestration | Single `docker-compose.yml` defining all services: chatwoot, sidekiq, kanban-api, kanban-frontend (or served by kanban-api), postgres-chatwoot, postgres-kanban, redis. |
| Traefik | (managed by Coolify) | Reverse proxy + TLS | Coolify uses Traefik internally. Services expose domains via Coolify's domain assignment — do NOT set `ports:` in docker-compose for services you want domain-routed. |

---

## Supporting Libraries

### Kanban API (Fastify/Node)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/swagger` | ^9.x | Auto-generate OpenAPI docs | Always — n8n will consume the API and needs discoverable endpoints |
| `@fastify/swagger-ui` | ^5.x | Serve Swagger UI | Development and staging; can disable in production |
| `@fastify/cors` | ^10.x | CORS headers | Required — Chatwoot iframe origin will differ from API origin |
| `@fastify/jwt` | ^9.x | JWT validation middleware | Used to validate tokens forwarded from Chatwoot's user_access_token flow |
| `@fastify/rate-limit` | ^10.x | Per-account rate limiting | Protect against runaway n8n webhooks |
| `zod` | ^3.x | Runtime schema validation (alternative/supplement to JSON schema) | Use for complex business rule validation beyond simple JSON schema |
| `pino` | (bundled with Fastify) | Structured JSON logging | Fastify uses Pino natively — logs parse into Coolify's log viewer |

### Kanban Frontend (Vue 3 SPA)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vue-router` | ^4.4 | Client-side routing | If Kanban grows beyond one page (pipeline list, card detail, settings) |
| `pinia` | ^3.x | State management | Card state, column ordering, optimistic drag updates |
| `axios` | ^1.x | HTTP client to Kanban API | Consistent with Chatwoot frontend; familiar pattern |
| `@vueuse/core` | ^11.x | Composable utilities | Window message listener (for Chatwoot appContext event), local storage, etc. |

---

## Installation

### Chatwoot Fork — No new gems needed
Fork the repo, match upstream Gemfile exactly. Only add frontend files.

```bash
# Fork setup — match upstream Ruby exactly
rbenv install 3.4.4
bundle install
pnpm install
```

### Kanban API

```bash
# Initialize Node service
npm init -y
npm install fastify @fastify/swagger @fastify/swagger-ui @fastify/cors @fastify/jwt @fastify/rate-limit prisma @prisma/client zod

# Dev dependencies
npm install -D typescript @types/node ts-node nodemon

# Initialize Prisma with PostgreSQL
npx prisma init --datasource-provider postgresql
```

### Kanban Frontend

```bash
# Create Vue 3 SPA with Vite
pnpm create vite kanban-ui --template vue-ts
cd kanban-ui
pnpm add vue-router@4 pinia axios @vueuse/core vue-dnd-kit
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Kanban backend language | Node.js (Fastify) | Extend Chatwoot Rails with new engine/mountable app | Rails engine approach means every Chatwoot upstream merge potentially breaks the engine. Separate service keeps blast radius contained. |
| Kanban backend language | Node.js (Fastify) | Python (FastAPI) | No meaningful advantage here; team already knows JS from Chatwoot frontend. Two languages is better than three. |
| Kanban ORM | Prisma | Drizzle ORM | Drizzle is lighter and faster, but Prisma's migration tooling and Studio GUI are more practical for a solo/small team managing schema changes. Revisit at scale. |
| Kanban frontend framework | Vue 3 | React | React would require a separate mental model from the Chatwoot fork work. Vue 3 reuses the same component patterns the team already works in when touching the fork. |
| Kanban DnD library | vue-dnd-kit | Sortable.js (via vue.draggable.next) | vue.draggable.next is Vue 2-era and poorly maintained for Vue 3. vue-dnd-kit is built natively for Vue 3 with a Kanban example in its own docs. |
| Chatwoot sidebar integration | Dashboard Apps (iframe) | Deep fork of navigation source | Dashboard Apps is the official Chatwoot mechanism for embedding external apps — no fork changes needed. Use it instead of modifying sidebar source. |
| Authentication | Token-forwarding via Chatwoot API | Separate auth system | Building a second auth system violates the project constraint and creates two login experiences. Token-forwarding + the `/api/v1/profile` validation endpoint is sufficient. |
| Deployment | Single Docker Compose | Separate Coolify apps per service | Single compose file keeps Chatwoot and Kanban on the same Coolify deployment, sharing secrets management and upgrade cycles. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` or `@hello-pangea/dnd` | React-only — wrong ecosystem for Vue 3 | `vue-dnd-kit` |
| `vue.draggable.next` | Vue 2-era wrapper around Sortable.js; Vue 3 support is incomplete and maintainer is inactive | `vue-dnd-kit` |
| Vuex (for new Kanban UI code) | Chatwoot is actively migrating away from Vuex to Pinia. New code should not extend the Vuex footprint. | Pinia |
| Express.js | Fine for prototypes, but Fastify's built-in schema validation generates the OpenAPI spec n8n needs automatically; no equivalent in Express without bolted-on libraries | Fastify |
| Prisma 7.x | Major release with breaking changes as of mid-2025; ecosystem tooling (adapters, plugins) is still catching up | Prisma 6.x until ecosystem stabilizes |
| Modifying Chatwoot's Rails models or database schema | Any change to `db/schema.rb` in the fork creates guaranteed merge conflicts on every upstream update | Use Chatwoot's REST API from the Kanban service instead |
| Docker `ports:` mapping in Coolify | Coolify's Traefik proxy handles routing — explicit port mappings bypass the proxy and expose containers directly on the host | Use Coolify domain assignment; let Traefik handle ports |
| Sharing the Chatwoot PostgreSQL database for the Kanban service | Creates schema coupling — a Chatwoot migration could break the Kanban service. Violates service isolation. | Separate `postgres-kanban` service in Docker Compose |

---

## Authentication Strategy (Critical Design Decision)

Chatwoot does not expose a token introspection endpoint, but you can validate a user's `user_access_token` by calling:

```
GET /auth/sign_in  (not needed — token is already issued)
GET /api/v1/profile
  Headers: api_access_token: <user_access_token>
```

A 200 response returns the user object including `account_id`, `id`, `email`, and `role`.

**Recommended flow:**
1. Chatwoot's Dashboard Apps iframe embeds the Kanban SPA at `https://kanban.yourdomain.com`
2. The iframe receives the `appContext` window event: `{ conversation, contact, currentAgent }`
3. `currentAgent.access_token` is the Chatwoot user token — forward it to the Kanban API on every request as `Authorization: Bearer <token>`
4. The Kanban API's Fastify auth plugin calls Chatwoot's `/api/v1/profile` endpoint to validate the token and extract `account_id`
5. Cache the validation result in Redis (5-minute TTL) to avoid per-request Chatwoot API calls
6. All Kanban DB queries are scoped to `WHERE account_id = $validated_account_id`

This avoids building SSO, avoids a second login, and ties Kanban access directly to Chatwoot account membership. MEDIUM confidence — the `appContext` event payload includes `currentAgent` based on official Dashboard Apps documentation; the `access_token` field presence in that payload should be verified against actual Chatwoot source before implementing.

---

## Fork Strategy (Critical Design Decision)

**Goal:** Pull Chatwoot upstream updates with near-zero conflict resolution.

**Rules:**
1. Never modify existing Chatwoot files when a new file can achieve the same result
2. The only acceptable modifications to existing files are:
   - `app/javascript/dashboard/router/index.js` — add one import and one route entry
   - `app/javascript/dashboard/components/layout/Sidebar.vue` — add one navigation item entry
   - These two files change infrequently in upstream and conflicts are easy to resolve manually
3. All new code lives in clearly namespaced directories:
   - `app/javascript/dashboard/views/kanban/` for the Vue components
   - `app/javascript/dashboard/routes/kanban/` for route definitions
4. Never add Ruby gems to the Gemfile for custom modules — the Kanban logic lives in its own service
5. Set up a GitHub Actions workflow that auto-syncs the fork with `chatwoot/chatwoot:develop` weekly and opens a PR if there are upstream changes

**Sync workflow:**
```
upstream/develop → fork/upstream-sync branch → review → merge into fork/main
```

Keep git rerere enabled (`git config rerere.enabled true`) so recurring conflicts on the sidebar file are resolved automatically after the first time.

---

## Stack Patterns by Variant

**If the Kanban SPA grows significantly (reports, calendar module):**
- Convert from iframe embed to a proper micro-frontend using `qiankun` or `single-spa`
- Each module stays independently deployable but shares a shell application
- Defer this until iframe approach proves insufficient — premature micro-frontend architecture is a significant complexity jump

**If multi-tenant isolation becomes a compliance requirement:**
- Move from shared PostgreSQL database with `account_id` row-level filtering to schema-per-tenant in PostgreSQL
- Prisma supports this via `prisma.$executeRaw` with `SET search_path`
- Plan the data model with this migration in mind: never put account data in the `public` schema

**If Coolify is replaced or outgrown:**
- The Docker Compose file is portable — it runs on any Docker host with Traefik
- Environment variables are the only Coolify coupling; document all of them

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Ruby 3.4.4 | Rails ~7.1 | Chatwoot-pinned combination. Do not upgrade independently. |
| Fastify 5.x | Node 20, Node 22 | Node 22 LTS is the recommended target. Node 24 not yet in Fastify's official LTS matrix. |
| Prisma 6.x | Node 18+ | Use `@prisma/adapter-pg` for connection pool control in Dockerized environments. |
| vue-dnd-kit | Vue 3.x | Zero external dependencies — only peer dep is Vue 3. |
| Vue 3.5.x | Vite 5.x | Chatwoot already runs this combination. Match versions when building the Kanban SPA. |
| pnpm 10.x | Node 22+ | Chatwoot's packageManager field requires pnpm 10. Use it for both frontend projects for consistency. |

---

## Sources

- `github.com/chatwoot/chatwoot/blob/develop/.ruby-version` — Ruby 3.4.4 confirmed (HIGH confidence)
- `github.com/chatwoot/chatwoot/blob/develop/Gemfile` — Rails ~7.1, Sidekiq >=7.3.1, pg, Redis confirmed (HIGH confidence)
- `github.com/chatwoot/chatwoot/blob/develop/package.json` — Vue 3.5.12, Node 24.x engines, pnpm 10.x, Pinia 3.x, Vite 5.x confirmed (HIGH confidence)
- `fastify.dev/docs/latest/Reference/LTS/` — Fastify 5.8.x, Node 20+22 support confirmed (HIGH confidence)
- `chatwoot.com/hc/user-guide/articles/1677691702-how-to-use-dashboard-apps` — Dashboard Apps iframe mechanism, appContext event confirmed (HIGH confidence)
- `developers.chatwoot.com/api-reference/users/get-user-sso-link` — Platform SSO API confirmed (HIGH confidence)
- `deepwiki.com/chatwoot/chatwoot/4.1-api-endpoints-reference` — Token validation via `/api/v1/profile` approach (MEDIUM confidence — community wiki, not official docs)
- `github.com/orgs/chatwoot/discussions/10136` — Sidebar modification requires direct source changes; no plugin system (MEDIUM confidence — community discussion)
- `github.com/chatwoot/chatwoot/pull/11037` — Rails 7.2.2 upgrade PR confirmed (HIGH confidence)
- `github.com/zizigy/vue-dnd-kit` — vue-dnd-kit Vue 3 library, active maintenance, Kanban example (LOW-MEDIUM confidence — new library, pre-1.0)
- WebSearch: Fastify vs Express 2025 comparison — Fastify recommended for greenfield microservices (MEDIUM confidence — multiple consistent sources)
- WebSearch: Prisma 6.x + Fastify production patterns — well-documented community patterns (MEDIUM confidence)
- `coolify.io/docs/knowledge-base/docker/compose` — Port mapping behavior, domain assignment, shared network (HIGH confidence)

---

*Stack research for: Chatwoot fork + Kanban CRM microservice on Coolify*
*Researched: 2026-04-09*
