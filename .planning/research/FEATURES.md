# Feature Research

**Domain:** CRM Kanban Pipeline module — embedded in Chatwoot, automated via n8n
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH (competitive landscape HIGH, Chatwoot-specific integration MEDIUM)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any CRM Kanban tool. Missing these makes the product feel broken or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop card movement between columns | Every kanban tool from Trello to Jira does this; it is the core UX metaphor | MEDIUM | Use @dnd-kit or react-beautiful-dnd; optimistic updates required to feel snappy |
| Configurable pipeline stages per account | Sales teams have different terminology (Prospecting, Qualified, Proposal, Closed vs Won, Lost); hard-coded stages = rejection | MEDIUM | Stages stored per `account_id`; order matters; must support rename/reorder/add/delete |
| Card with contact name, channel, entry date, assignee | Minimum viable card content; users can't operate without this data at-a-glance | LOW | Channel = WhatsApp, email, Instagram etc. from Chatwoot conversation metadata |
| Link from card back to original Chatwoot conversation | Core integration value; without it, the Kanban is an island | LOW | Store `conversation_id`; deep link to `chatwoot.domain/app/accounts/{id}/conversations/{conv_id}` |
| Create card via API (n8n endpoint) | Automation is the core value proposition — manual card creation defeats the purpose | MEDIUM | REST POST endpoint; must be authenticated; must be idempotent to prevent duplicate cards on n8n retries |
| Multi-tenant isolation by account_id | SaaS requirement; data leakage between tenants is catastrophic | MEDIUM | Every DB query must filter by account_id; enforce at ORM/middleware level, not just application logic |
| Basic filtering on board (by assignee, by stage) | Boards with 20+ cards become unusable without filters | LOW | Client-side filter is sufficient for v1; no need for server-side search initially |
| Shared auth with Chatwoot (no second login) | Users will not tolerate logging in twice; SSO/token sharing is expected in embedded tools | HIGH | See Architecture notes — Chatwoot passes `access_token` via postMessage; kanban reads it to call its own API |
| Responsive board layout | Agents use varying screen sizes; a fixed-width board that breaks at 1280px is a dealbreaker | LOW | CSS flexbox/grid; columns scroll horizontally on narrower screens |
| Empty state with clear CTA | New accounts see a blank board; they need to know what to do next | LOW | "No cards yet. Connect your n8n workflow to start auto-creating cards." |

### Differentiators (Competitive Advantage)

Features that set this product apart from generic kanban tools like Trello or standalone CRMs. Aligned with the core value: "manage leads without switching tools."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conversation context panel in card detail | Instead of just a link, show a summary of the Chatwoot conversation (last message, channel, contact email/phone) pulled via Chatwoot API — no context-switching needed | MEDIUM | Chatwoot API is public; call `/api/v1/accounts/{id}/conversations/{conv_id}` from kanban backend; cache aggressively |
| Deal aging / staleness indicator | Cards sitting in a stage beyond a threshold visually change (amber border at 3 days, red at 7 days); Pipedrive calls this "deal rotting" and users find it unexpectedly valuable | LOW | CSS class toggled based on `updated_at` diff; threshold configurable per stage in v2 |
| Card creation idempotency key | n8n retries webhooks on failure; passing `conversation_id` as idempotency key prevents duplicate cards being created — this is a reliability differentiator vs naive implementations | LOW | Unique constraint on `(account_id, conversation_id)`; upsert semantics on POST |
| Chatwoot Dashboard App placement | Kanban accessible directly inside the Chatwoot conversation panel as a Dashboard App tab — not just a sidebar link — means agents see it in context while handling a conversation | HIGH | Chatwoot Dashboard Apps pass conversation/contact context via postMessage; kanban can auto-scroll to the relevant card |
| Per-stage card count and value aggregates | Column headers show card count; if a deal value field is present, show total pipeline value per stage — gives managers a quick signal without leaving the board | LOW | Computed client-side from loaded cards; no extra API call needed |
| Activity log on card | Record when card was created, moved between stages, reassigned — lightweight audit trail that customers of support CRMs expect | MEDIUM | Append-only `card_events` table; displayed as timeline in card detail view |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem obvious to request but create disproportionate complexity or scope creep for a v1 module.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Bidirectional sync between Chatwoot conversation status and card stage | "When I close a conversation, the card should auto-move to Closed" | Hard-coded sync creates tight coupling to Chatwoot internals; Chatwoot's webhook events are not designed for this; any Chatwoot update breaks it | Let n8n handle this via Chatwoot webhook → n8n → Kanban API; decoupled, user-configurable |
| Native Chatwoot auth code changes (modifying auth system) | "Just use the same JWT" | Modifying Chatwoot's authentication module creates a merge conflict on every upstream update; high maintenance cost forever | Use Chatwoot's existing API token (`access_token` from user profile); kanban validates it against Chatwoot's `/auth/sign_in` endpoint or stores it on first use |
| Real-time board updates via WebSockets | "The board should update live when someone else moves a card" | Adds infrastructure complexity (ActionCable or socket.io server) before core value is validated; most CRM kanban boards just do page refresh or poll | Polling every 30s or manual refresh; add WebSockets in v2 after adoption |
| Mobile app / PWA | "I want to check my pipeline on my phone" | Out of scope per PROJECT.md; web-first is the right call; mobile adds testing/platform overhead | Ensure responsive web layout works acceptably on tablet for emergencies |
| Email notifications and digest | "Notify me when a card moves" | Notification system is a product in itself; requires email templates, preferences, unsubscribes | Let n8n send notifications via Chatwoot conversation or email node — user already controls n8n |
| Advanced reporting and analytics dashboard | "Show me conversion rates by stage, by agent, by month" | Premature analytics before there's enough data; builds the wrong product before validating core usage | Export cards as CSV; v2 adds basic charts after data exists |
| Custom fields on cards | "I need to track deal value, company size, etc." | Every custom field type (date, number, select, multi-select) is its own mini-feature; multiplies frontend and validation complexity | Expose a single free-text `notes` field on card; structure emerges from usage; build custom fields in v2 with known field types |
| Multiple pipeline boards per account | "Sales has a different pipeline than Customer Success" | Multiplies UI complexity; before validating single-board usage it is premature | Single pipeline per account in v1; architecture should allow multiple (account_id → pipelines table) but only expose one in UI |
| Kanban WIP limits (max cards per column) | "Prevent too many deals in Qualification" | Sophisticated process feature; most SMB users don't know what WIP limits are; adds enforcement logic and edge cases | Document the pattern; implement in v2 if users ask for it |
| Bulk actions (move 10 cards at once) | "I want to reassign all cards in a column" | Rare operation that adds significant UI complexity; drag-and-drop for individual cards covers 95% of use | Address in v2; for v1, cards can be individually edited |

---

## Feature Dependencies

```
[Shared Auth (Chatwoot token)]
    └──required by──> [Kanban API access from embedded iframe]
    └──required by──> [Conversation context panel in card detail]

[Configurable Pipeline Stages]
    └──required by──> [Drag-and-drop card movement]
    └──required by──> [Deal aging indicator] (threshold is per-stage)

[Card creation via API (n8n endpoint)]
    └──requires──> [Multi-tenant isolation] (account scoping on create)
    └──enhanced by──> [Idempotency key] (conversation_id uniqueness)

[Chatwoot Dashboard App embed]
    └──requires──> [Shared Auth] (token passed via postMessage)
    └──enhances──> [Conversation context panel] (auto-scroll to card for current conversation)

[Activity log on card]
    └──requires──> [Card existence]
    └──enhances──> [Deal aging / staleness indicator] (can use last activity timestamp)

[Basic filtering]
    └──requires──> [Cards exist with assignee and stage data]
```

### Dependency Notes

- **Shared Auth requires careful Chatwoot integration:** Chatwoot's Dashboard Apps pass `access_token` via `postMessage`; the kanban iframe must listen for this message before making any API calls. If the kanban is accessed via direct URL (not iframe), a fallback login or token-in-URL approach is needed.
- **Configurable stages are a prerequisite for everything:** Without stage configuration, card movement has no destinations. Stage setup must be the first action a new account takes (onboarding flow).
- **Idempotency enhances API reliability significantly:** n8n will retry failed webhook calls. Without a unique constraint on `(account_id, conversation_id)`, a network blip creates duplicate cards. This is a silent failure that erodes trust.
- **Dashboard App embed is a placement decision, not a feature:** Chatwoot's existing Dashboard Apps feature (Settings → Integrations → Dashboard Apps) allows embedding any URL as a tab in the conversation panel. This is the low-fork-divergence approach. A sidebar-level link requires modifying Chatwoot's primary navigation Vue component — higher fork maintenance cost.

---

## MVP Definition

### Launch With (v1)

Minimum viable product to validate that agents will manage leads in a kanban board inside Chatwoot.

- [ ] **Pipeline stages configurable per account** — without this nothing works; first-run experience must prompt stage creation
- [ ] **Kanban board with drag-and-drop** — the core UX; if drag-and-drop is broken or janky, no one uses it
- [ ] **Card with contact name, channel, entry date, assignee, link to conversation** — minimum card data for it to be useful
- [ ] **REST API endpoint for card creation (n8n integration)** — the automation entry point; cards created manually are a red flag
- [ ] **Idempotency on card creation** — prevents silent duplicate card bugs from n8n retries
- [ ] **Shared auth via Chatwoot access_token** — no second login; token passed via postMessage in iframe context
- [ ] **Multi-tenant isolation by account_id** — hard requirement for SaaS; not optional
- [ ] **Chatwoot Dashboard App embed** — the integration surface; makes kanban accessible inside Chatwoot conversation panel
- [ ] **Basic assignee filter** — boards become unusable without at minimum an "assigned to me" filter

### Add After Validation (v1.x)

Add when users are actively using v1 and these gaps surface in feedback.

- [ ] **Deal aging / staleness indicator** — users will ask "why didn't I follow up on this?" after losing a deal; this is the prompt
- [ ] **Activity log on card** — "who moved this and when?" is the first support question after team adoption
- [ ] **Conversation context panel in card detail** — reduces context-switching further; add when users report needing to open Chatwoot separately to see what the conversation is about
- [ ] **Per-stage aggregate counts in column headers** — managers start asking for pipeline visibility once boards have data

### Future Consideration (v2+)

Defer until product-market fit is established and usage patterns are clear.

- [ ] **Custom fields on cards** — implement after knowing which fields users actually need from their notes/workarounds
- [ ] **Multiple pipelines per account** — add when an account has distinct sales and support workflows
- [ ] **Real-time updates via WebSocket** — add when team collaboration on shared boards becomes a reported pain point
- [ ] **Advanced reporting / analytics** — add after 3+ months of data exists to make charts meaningful
- [ ] **n8n workflow templates** — pre-built n8n workflows for common Chatwoot → Kanban automations; high value, low engineering cost

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Drag-and-drop kanban board | HIGH | MEDIUM | P1 |
| Configurable pipeline stages | HIGH | MEDIUM | P1 |
| Card with core fields + conversation link | HIGH | LOW | P1 |
| n8n REST API for card creation | HIGH | MEDIUM | P1 |
| Idempotency key on card create | HIGH | LOW | P1 |
| Multi-tenant account isolation | HIGH | MEDIUM | P1 |
| Shared auth (Chatwoot token passthrough) | HIGH | HIGH | P1 |
| Chatwoot Dashboard App embed | HIGH | MEDIUM | P1 |
| Basic filtering (assignee) | MEDIUM | LOW | P1 |
| Deal aging indicator | MEDIUM | LOW | P2 |
| Activity log on card | MEDIUM | MEDIUM | P2 |
| Conversation context panel in card | MEDIUM | MEDIUM | P2 |
| Per-stage card count aggregates | LOW | LOW | P2 |
| Custom fields | MEDIUM | HIGH | P3 |
| Multiple pipelines per account | LOW | MEDIUM | P3 |
| Real-time WebSocket updates | LOW | HIGH | P3 |
| Reporting / analytics | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Pipedrive | HubSpot Deals | Trello (generic) | Our Approach |
|---------|-----------|---------------|------------------|--------------|
| Visual kanban board | Core UX — deal-first | Board view (secondary to list view) | Core UX — task-first | Core UX — conversation-first |
| Drag-and-drop | Yes, smooth | Yes | Yes | Yes, using @dnd-kit |
| Configurable stages | Yes, unlimited pipelines | Yes, multiple pipelines | Yes, unlimited lists | Per account, single pipeline v1 |
| Deal rotting / aging | Yes, flagship feature | No native | No | CSS-based staleness indicator v1.x |
| Automation / webhooks | Native automation + Zapier | Native workflows | Zapier/Make only | n8n as explicit integration layer |
| Chat platform integration | Via third-party | Via third-party | Via third-party | Native — built on top of Chatwoot |
| Context from conversation | No (separate tool) | No (separate tool) | No | Yes — core differentiator |
| Open source / self-hosted | No | No | No (Trello cloud only) | Yes — Chatwoot fork on Coolify |
| Multi-tenant SaaS | Vendor-managed | Vendor-managed | Vendor-managed | Account-isolated, self-hosted |

---

## Sources

- [Pipeline CRM Kanban View](https://pipelinecrm.com/features/kanban/) — feature description of kanban for sales
- [Pipedrive vs HubSpot CRM comparison 2025/2026](https://www.capitalsconsulting.com/resources/pipedrive-vs-hubspot) — what users expect from kanban CRM
- [Pipedrive pipeline management](https://www.pipedrive.com/en/features/pipeline-management) — deal rotting and visual pipeline features
- [CRM.io Kanban Board](https://crm.io/kanban-board) — standard kanban CRM feature set
- [Chatwoot Dashboard Apps official guide](https://www.chatwoot.com/hc/user-guide/articles/1677691702-how-to-use-dashboard-apps) — postMessage context, iframe embed mechanism
- [Chatwoot sidebar tab discussion](https://github.com/orgs/chatwoot/discussions/10136) — community approach to adding sidebar items via fork
- [Securing Dashboard Apps discussion](https://github.com/orgs/chatwoot/discussions/5878) — token authentication patterns for dashboard apps
- [Webhook idempotency guide](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) — duplicate card prevention via idempotency keys
- [n8n idempotent webhook retries](https://medium.com/@Modexa/idempotent-webhook-retries-in-n8n-without-duplicates-8380273a95a2) — n8n-specific retry behavior
- [n8n CRM automation](https://n8n.io/supercharge-your-crm/) — n8n webhook + CRM integration patterns
- [Multi-tenant SaaS isolation](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) — account_id isolation strategies and pitfalls
- [SSO in iframes pitfalls](https://learn.microsoft.com/en-us/answers/questions/2284861/implementing-sso-with-entra-external-id-in-embedded) — third-party cookie and iframe auth constraints
- [Onpipeline: Kanban for sales pipeline management](https://www.onpipeline.com/crm-sales/kanban-board-for-sales-pipeline-management-explained/) — kanban table stakes for sales context

---

*Feature research for: CRM Kanban Pipeline module for Chatwoot fork*
*Researched: 2026-04-09*
