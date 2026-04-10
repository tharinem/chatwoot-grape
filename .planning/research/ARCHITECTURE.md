# Architecture Research

**Domain:** Chatwoot fork with external microservice modules (Kanban CRM + n8n automation)
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH (Chatwoot internals well documented; auth-sharing patterns partly community-derived)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Agent)                               │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Chatwoot Dashboard (Vue.js)                   │   │
│  │                                                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │   │
│  │  │Conversations│ │Contacts │  │ Reports  │  │  [Kanban Tab]  │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────┬────────┘  │   │
│  │                                                     │           │   │
│  │                                             ┌───────▼────────┐  │   │
│  │                                             │  iframe embed  │  │   │
│  │                                             │  (Dashboard    │  │   │
│  │                                             │   App API)     │  │   │
│  │                                             └───────┬────────┘  │   │
│  └─────────────────────────────────────────────────────┼──────────┘   │
└────────────────────────────────────────────────────────┼───────────────┘
                                                         │ HTTPS
         ┌───────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────────────────────┐
│                        COOLIFY HOST (Docker)                           │
│                                                                        │
│  ┌─────────────────────────────┐   ┌──────────────────────────────┐   │
│  │    Chatwoot Stack           │   │     Kanban Stack             │   │
│  │                             │   │                              │   │
│  │  ┌───────┐  ┌──────────┐   │   │  ┌──────────┐  ┌─────────┐  │   │
│  │  │ Rails │  │ Sidekiq  │   │   │  │  Node.js │  │Postgres │  │   │
│  │  │(Puma) │  │          │   │   │  │  API     │  │(kanban) │  │   │
│  │  └───┬───┘  └────┬─────┘   │   │  └────┬─────┘  └────┬────┘  │   │
│  │      │           │         │   │       │              │        │   │
│  │  ┌───▼───────────▼─────┐   │   │  ┌────▼──────────────▼────┐  │   │
│  │  │   Postgres (CW)     │   │   │  │  Internal Docker Net   │  │   │
│  │  │   Redis             │   │   │  └────────────────────────┘  │   │
│  │  └─────────────────────┘   │   └──────────────────────────────┘   │
│  └─────────────────────────────┘                                      │
│                                                                        │
│  ┌─────────────────────────────┐                                       │
│  │        n8n Stack            │                                       │
│  │  ┌──────────┐               │                                       │
│  │  │   n8n    │               │                                       │
│  │  │(webhook  │               │                                       │
│  │  │ runner)  │               │                                       │
│  │  └──────────┘               │                                       │
│  └─────────────────────────────┘                                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Chatwoot (Rails fork) | Core chat, contacts, inboxes, agent auth | Rails 7 + Vue.js 3 — minimal fork changes |
| Chatwoot Sidekiq | Background jobs, email delivery, webhook dispatch | Same Docker image as Rails, separate process |
| Chatwoot Postgres | Primary CW data store (accounts, conversations, contacts) | Postgres 16+ — unchanged from stock Chatwoot |
| Chatwoot Redis | Job queue, pub/sub, ActionCable real-time | Redis 5+ — unchanged |
| Kanban API | CRM pipeline CRUD, card management, multi-tenant isolation | Node.js (Express/Fastify) or Rails API-only |
| Kanban Postgres | Kanban-specific data (cards, columns, pipelines per account_id) | Separate Postgres instance — no schema entanglement with CW |
| n8n | Automation: detect new Chatwoot conversation → POST to Kanban API | Existing n8n instance, HTTP Request node |
| Kanban Frontend | Kanban board UI (drag-and-drop, card management) | Vue.js 3 SPA or Nuxt — served standalone |

---

## Chatwoot Sidebar Embedding — How It Actually Works

### The Official Mechanism: Dashboard Apps

Chatwoot has a first-party feature called **Dashboard Apps** (Settings → Integrations → Dashboard Apps). This is the correct integration point — not a sidebar icon, but a **tab within the conversation panel**.

**How it works:**
1. Admin registers a Dashboard App with a name and URL in Chatwoot settings
2. A new tab appears in the conversation right-panel for all agents
3. The tab renders an iframe pointing to the registered URL
4. Chatwoot sends conversation + contact context to the iframe via `window.postMessage`

**postMessage payload structure:**
```javascript
// Chatwoot → iframe (on conversation open)
{
  "event": "appContext",
  "data": {
    "conversation": {
      "id": 123,
      "inbox_id": 1,
      "meta": { "hmac_verified": true, ... },
      "custom_attributes": {},
      // ...full conversation object
    },
    "contact": {
      "id": 456,
      "name": "Lead Name",
      "email": "lead@example.com",
      "additional_attributes": { "company": "...", ... }
    },
    "currentAgent": {
      "id": 789,
      "name": "Agent Name",
      "email": "agent@example.com"
    }
  }
}
```

**Iframe requests context on demand:**
```javascript
window.parent.postMessage('chatwoot-dashboard-app:fetch-info', '*')
```

**Limitation:** Dashboard Apps appear in the conversation context panel — useful for showing the Kanban card linked to the current conversation. For a global Kanban board (not tied to a specific conversation), this requires either:
- A fork-side navigation item in the main sidebar (requires code change in Vue sidebar component), or
- A separate browser tab / Chatwoot-adjacent URL

### Sidebar Navigation Item (Fork Change)

For a standalone Kanban view accessible from the main sidebar nav (not tied to a conversation), the fork must modify Chatwoot's sidebar navigation. Chatwoot sidebar is built in Vue.js and controlled by:

- Route definitions in `app/javascript/dashboard/routes/`
- Feature flag checks via `featureHelper.js` and `useAccount()` composable
- `config/features.yml` for backend feature declarations

**Minimal fork change to add a sidebar item:**
1. Add a feature flag entry in `config/features.yml`
2. Add a route entry pointing to a wrapper Vue component
3. The wrapper component renders an iframe to the Kanban app URL
4. Enable the feature flag per account via Chatwoot's super-admin console

This is a small, contained change (3–4 files) that localizes the diff and survives upstream merges with low conflict probability.

### Recommendation

Use **both** mechanisms:
- Dashboard App (zero fork changes) for the **conversation-linked Kanban card** view (agent sees the card for the current conversation)
- Fork sidebar item for the **full Kanban board** view (accessible from main nav, renders Kanban app in full-page iframe)

---

## Auth Sharing Strategy

### The Problem

Chatwoot uses its own token-based session system. The Kanban app is a separate service. Users logged into Chatwoot should not need to log in again to access Kanban.

### Recommended Approach: Chatwoot API Token via postMessage

**For iframe-embedded views (Dashboard App):**

The postMessage payload contains `currentAgent.id` and `currentAgent.email`. The Kanban app can use these to identify the agent, but this alone is not authenticated — any page could send those values.

**Practical solution for self-hosted SaaS:**

1. On Kanban app load (inside iframe), it receives `currentAgent.id` via postMessage
2. The Kanban app calls its own backend with `{ chatwoot_agent_id, account_id }` as a lookup key
3. Kanban backend validates by calling Chatwoot's API (`GET /api/v1/profile`) using a stored service-level API token to confirm the agent exists
4. Kanban backend issues its own short-lived JWT session token for the agent
5. Subsequent Kanban API calls use this JWT

**For the sidebar full-page iframe view:**

Since Chatwoot doesn't automatically pass the user token to the iframe URL, the fork needs one small addition: when rendering the Kanban sidebar iframe, append the Chatwoot `user_access_token` as a query param or via postMessage.

The Kanban backend can then call `GET /api/v1/profile` with that token to verify the user identity and establish a session.

**Auth flow diagram:**
```
Agent opens Kanban sidebar
        ↓
Chatwoot (fork) passes user_access_token to iframe URL param
        ↓
Kanban frontend → Kanban API: POST /auth/chatwoot-token { token }
        ↓
Kanban API → Chatwoot API: GET /api/v1/profile (Authorization: token)
        ↓
Chatwoot returns { id, account_id, name, email }
        ↓
Kanban API creates/updates local user record scoped to account_id
        ↓
Kanban API returns JWT (short-lived, e.g. 1h)
        ↓
Kanban frontend stores JWT in memory, uses for all Kanban API calls
```

**What NOT to do:** Do not build a separate login form. Do not use shared database sessions. Do not store Chatwoot's user_access_token long-term in Kanban DB (it doesn't expire but should not be replicated).

### Multi-Tenant Isolation

Chatwoot's `account_id` is the tenant boundary. Every Kanban record (board, column, card) must be scoped to `account_id`. The Kanban API should:
- Validate that the authenticated agent belongs to the claimed `account_id`
- Reject any cross-account data access
- Never expose data without `account_id` filter

---

## Data Flow

### Flow 1: New Lead Arrives (n8n Automation)

```
New conversation in Chatwoot inbox
        ↓
Chatwoot fires webhook: conversation_created event
        ↓
n8n workflow triggered (Webhook node)
        ↓
n8n HTTP Request node → POST /api/kanban/cards
  { account_id, conversation_id, contact_name, channel, inbox_id, agent_id }
        ↓
Kanban API creates card in "Prospecção" column (first stage)
        ↓
Kanban Postgres: INSERT INTO cards ...
        ↓
Kanban API responds 201 Created
        ↓
(Optional) n8n posts confirmation back to Chatwoot conversation as note
```

### Flow 2: Agent Views Kanban Board

```
Agent clicks Kanban in Chatwoot sidebar
        ↓
Chatwoot fork renders iframe with URL: https://kanban.domain.com?token=<user_access_token>
        ↓
Kanban frontend boots, extracts token from URL
        ↓
POST /auth/chatwoot-token → Kanban API validates with Chatwoot → issues JWT
        ↓
GET /api/boards?account_id=X → Kanban API returns columns + cards
        ↓
Kanban board renders (Vue.js drag-and-drop)
```

### Flow 3: Agent Moves a Card

```
Agent drags card to new column
        ↓
Kanban frontend: PATCH /api/cards/:id { column_id }
        ↓
Kanban API: UPDATE cards SET column_id = ? WHERE id = ? AND account_id = ?
        ↓
(Optional) Kanban API fires webhook to n8n for further automation
        ↓
n8n can update Chatwoot conversation label/status if configured
```

### Flow 4: Agent Clicks "View Conversation" from Card

```
Card displays Chatwoot conversation link:
  https://chatwoot.domain.com/app/accounts/{account_id}/conversations/{conversation_id}
        ↓
Browser navigates to Chatwoot (agent already authenticated)
```

---

## Recommended Project Structure

```
repo-root/
├── chatwoot/                    # Git subtree or submodule of upstream fork
│   ├── app/javascript/
│   │   └── dashboard/
│   │       └── routes/          # +kanban route (minimal fork change)
│   ├── config/
│   │   └── features.yml         # +kanban feature flag
│   └── Dockerfile               # Custom build for Coolify
│
├── kanban-api/                  # Standalone Kanban microservice
│   ├── src/
│   │   ├── routes/              # REST endpoints (cards, columns, auth)
│   │   ├── middleware/          # JWT validation, account_id scoping
│   │   ├── db/                  # Migrations, query layer
│   │   └── services/
│   │       └── chatwoot-auth.ts # Token validation via Chatwoot API
│   ├── Dockerfile
│   └── docker-compose.yml       # Local dev
│
├── kanban-frontend/             # Standalone Vue.js Kanban SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── KanbanBoard.vue  # Drag-and-drop board
│   │   │   ├── KanbanCard.vue   # Card display
│   │   │   └── ColumnView.vue   # Pipeline column
│   │   ├── composables/
│   │   │   └── useAuth.ts       # postMessage token extraction + JWT
│   │   └── stores/              # Pinia state management
│   ├── Dockerfile
│   └── vite.config.ts
│
└── docker-compose.coolify.yml   # Coolify deployment compose (all services)
```

---

## Coolify Multi-Service Deployment Pattern

### Stack Separation Strategy

Deploy as **two separate Coolify stacks** on the same host:

**Stack 1: Chatwoot** (existing Docker Compose)
- Services: `chatwoot`, `sidekiq`, `postgres`, `redis`
- Networks: Coolify auto-creates `chatwoot-<uuid>` network
- Domains: `chatwoot.yourdomain.com`

**Stack 2: Kanban** (new Docker Compose)
- Services: `kanban-api`, `kanban-frontend`, `kanban-postgres`
- Networks: Coolify auto-creates `kanban-<uuid>` network
- Domains: `kanban.yourdomain.com` (api subdomain + frontend subdomain)

### Cross-Stack Communication

The Kanban API calls Chatwoot's API for token validation. This goes over HTTPS (external domains) — no internal network bridging needed. This is intentional: it keeps the stacks fully independent and simplifies networking.

**Do NOT** attempt to bridge Chatwoot's Postgres into the Kanban stack. Kanban gets its own Postgres.

### Environment Variables

```bash
# Kanban API .env
CHATWOOT_BASE_URL=https://chatwoot.yourdomain.com
CHATWOOT_SERVICE_TOKEN=<platform_app_api_token>   # for platform-level queries
DATABASE_URL=postgresql://kanban:pass@kanban-postgres:5432/kanban
JWT_SECRET=<random_256bit>
CORS_ALLOWED_ORIGINS=https://chatwoot.yourdomain.com,https://kanban.yourdomain.com

# Chatwoot fork additional .env
KANBAN_APP_URL=https://kanban.yourdomain.com      # for sidebar iframe src
FEATURE_KANBAN_ENABLED=true
```

---

## Architectural Patterns

### Pattern 1: Minimal Fork / Satellite Services

**What:** Keep the Chatwoot fork as close to upstream as possible. All new business logic lives in satellite services (Kanban API, Kanban frontend). The fork adds only navigation hooks.

**When to use:** When upstream is actively maintained and you need to pull security fixes and features regularly.

**Trade-offs:**
- PRO: Merge conflicts are rare and small
- PRO: Core Chatwoot bugs/security patches are absorbed with minimal effort
- CON: No access to Chatwoot internals from Kanban (must go through API)
- CON: Slightly more network overhead (Kanban API → Chatwoot API for auth)

### Pattern 2: Dashboard App for Conversation Context

**What:** Register the Kanban frontend as a Chatwoot Dashboard App so the conversation-specific Kanban card shows inline as a tab when an agent is viewing a conversation.

**When to use:** For the "view this conversation's Kanban card" use case — zero fork required for this specific feature.

**Trade-offs:**
- PRO: No fork code needed — configurable via Chatwoot admin UI
- PRO: Gets rich conversation/contact context via postMessage
- CON: Only appears in conversation view, not as a standalone board

### Pattern 3: account_id Scoped REST API

**What:** Every Kanban API endpoint is scoped to `account_id`. The account_id is extracted from the JWT (set at auth time via Chatwoot token validation).

**When to use:** Always, for any multi-tenant data.

**Trade-offs:**
- PRO: Simple, predictable isolation
- PRO: Maps directly to Chatwoot's tenant model
- CON: Account_id must be validated on every request (middleware handles this)

---

## Anti-Patterns

### Anti-Pattern 1: Sharing the Chatwoot Database

**What people do:** Add Kanban tables directly to Chatwoot's Postgres instance and access them from the Kanban API.

**Why it's wrong:** Creates tight coupling — any Chatwoot upgrade that changes schema or migrations can break the Kanban data layer. Difficult to deploy Kanban independently. Violates service boundary.

**Do this instead:** Kanban gets its own Postgres instance. Cross-service data (e.g., conversation_id) is stored as a foreign key reference in Kanban but Chatwoot's tables are never joined or accessed directly.

### Anti-Pattern 2: Heavy Chatwoot Fork

**What people do:** Add Kanban models, controllers, and business logic directly inside the Chatwoot Rails app.

**Why it's wrong:** Every upstream Chatwoot release requires merging custom business logic. Chatwoot releases frequently. This leads to merge hell within 2-3 upgrade cycles.

**Do this instead:** The fork adds only navigation/UI hooks (3-4 files). All Kanban logic is in the separate kanban-api service.

### Anti-Pattern 3: Browser-Side Token Exposure

**What people do:** Pass the Chatwoot user_access_token in iframe URL, then use it directly as Kanban auth — storing it, logging it, or sending it to third parties.

**Why it's wrong:** The Chatwoot user_access_token is a permanent credential (it does not expire by default). Leaking it compromises the user's entire Chatwoot account.

**Do this instead:** Use the token only for initial Kanban auth verification (server-side call to Chatwoot API). Immediately exchange it for a short-lived Kanban JWT (1 hour TTL). Never persist the Chatwoot token.

### Anti-Pattern 4: Blocking n8n Webhook Processing

**What people do:** n8n webhook calls Kanban API synchronously; Kanban API does heavy processing before returning.

**Why it's wrong:** n8n has webhook timeout limits. If card creation includes slow operations (image processing, email sends, etc.), timeouts cause duplicate triggers.

**Do this instead:** Kanban API acknowledges the webhook immediately (202 Accepted), queues heavy work asynchronously. Keep the card creation endpoint sub-100ms.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Chatwoot API | REST over HTTPS, `user_access_token` header | Used by Kanban API for auth validation only |
| n8n | Chatwoot fires webhook → n8n → Kanban API via HTTP Request node | n8n community Chatwoot nodes available (`@pixelinfinito/n8n-nodes-chatwoot`) |
| Coolify | Docker Compose stacks per service group | SSL termination + domain routing handled by Coolify proxy |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Chatwoot fork ↔ Kanban frontend | iframe + postMessage (Dashboard App) | For conversation-context view |
| Chatwoot fork ↔ Kanban frontend | iframe src URL with token param | For full sidebar board view (fork change) |
| Kanban frontend ↔ Kanban API | REST/JSON over HTTPS, Kanban JWT | Standard SPA pattern |
| Kanban API ↔ Chatwoot API | REST/JSON over HTTPS, user_access_token | Auth validation only, not data sync |
| n8n ↔ Kanban API | Outbound HTTP POST from n8n to Kanban REST endpoint | One-way push, idempotent card creation |
| n8n ↔ Chatwoot | Chatwoot webhook (outbound) triggers n8n, n8n can call Chatwoot API back | Bidirectional but event-driven |

---

## Build Order (What Must Exist Before What)

```
Phase 1: Chatwoot Fork Infrastructure
  → Fork + Dockerfile + Coolify deploy
  → Must exist before: anything else (this is the platform)

Phase 2: Kanban API (backend first)
  → REST endpoints, Postgres schema, account_id scoping, auth middleware
  → Must exist before: Kanban frontend, n8n integration
  → Depends on: Chatwoot running (for auth validation)

Phase 3: n8n Integration
  → Chatwoot webhook → n8n → Kanban API card creation
  → Must exist before: any automated lead capture
  → Depends on: Kanban API /cards endpoint working

Phase 4: Kanban Frontend
  → Vue.js board with drag-and-drop
  → Must exist before: useful product
  → Depends on: Kanban API fully functional

Phase 5: Chatwoot Sidebar Embedding
  → Fork nav item + iframe render + token passing + Dashboard App config
  → Must exist before: agents can access Kanban without leaving Chatwoot
  → Depends on: Kanban frontend deployed at stable URL

Phase 6: Multi-Tenant Hardening
  → Per-account column configuration, account isolation testing
  → Must exist before: onboarding first external SaaS customer
  → Depends on: full stack working end-to-end
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–10 accounts | Single Coolify host, shared Postgres for Kanban, no queue needed |
| 10–100 accounts | Add read replica for Kanban Postgres if query load increases; add Redis queue for async card creation |
| 100+ accounts | Evaluate Kanban API horizontal scaling; consider per-region Coolify hosts; Chatwoot itself may need separate web/worker servers |

**First bottleneck:** Kanban Postgres under concurrent card updates during high-volume n8n automation bursts. Mitigation: async processing queue in Phase 6.

**Second bottleneck:** Chatwoot auth validation calls (Kanban API calls Chatwoot API per session). Mitigation: cache validated agent sessions in Kanban's Redis/memory (TTL matching JWT lifetime).

---

## Sources

- [Chatwoot Dashboard Apps user guide](https://www.chatwoot.com/hc/user-guide/articles/1677691702-how-to-use-dashboard-apps) — MEDIUM confidence (official docs, Nov 2024)
- [Chatwoot Plugin Architecture Discussion #12531](https://github.com/orgs/chatwoot/discussions/12531) — MEDIUM confidence (proposal, not yet shipped)
- [Securing Dashboard Apps Discussion #5878](https://github.com/orgs/chatwoot/discussions/5878) — MEDIUM confidence (community patterns)
- [Chatwoot Navigation and Layout — DeepWiki](https://deepwiki.com/chatwoot/chatwoot/3.2-navigation-and-layout) — MEDIUM confidence (AI-generated from source, verify file paths against actual repo)
- [Chatwoot Platform APIs — Developer Docs](https://developers.chatwoot.com/contributing-guide/chatwoot-platform-apis) — HIGH confidence (official)
- [Get User SSO Link API](https://developers.chatwoot.com/api-reference/users/get-user-sso-link) — HIGH confidence (official API reference)
- [Chatwoot System Architecture — DeepWiki](https://deepwiki.com/chatwoot/chatwoot/1.2-installation-and-deployment) — MEDIUM confidence
- [Coolify Docker Compose Networking](https://coolify.io/docs/knowledge-base/docker/compose) — HIGH confidence (official Coolify docs)
- [n8n Chatwoot community node](https://github.com/pixelinfinito/n8n-nodes-chatwoot) — LOW confidence (community package, verify maintenance status)
- [Chatwoot Multi-Tenant Overview — Restack](https://www.restack.io/docs/chatwoot-knowledge-chatwoot-multi-tenant-overview) — LOW confidence (third-party summary)

---

*Architecture research for: Chatwoot fork with Kanban CRM module*
*Researched: 2026-04-09*
