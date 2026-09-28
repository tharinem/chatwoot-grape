# Pitfalls Research

**Domain:** Chatwoot fork with external CRM microservice (SaaS, multi-tenant)
**Researched:** 2026-04-09
**Confidence:** MEDIUM-HIGH (most pitfalls confirmed across multiple community/GitHub sources; fork-specific patterns require validation against your exact Chatwoot version)

---

## Critical Pitfalls

### Pitfall 1: Fork Divergence That Makes Upstream Merges Painful

**What goes wrong:**
Custom changes land inside Chatwoot's core Vue components (e.g., `Sidebar.vue`, `app/javascript/dashboard/`) and Rails controllers rather than being isolated to their own files. When upstream ships a new sidebar redesign (which happened in PR #10291 and again in PR #10572 in 2024), every merge becomes a multi-day conflict resolution effort. Teams that did this have effectively abandoned upstream tracking within 3–6 months.

**Why it happens:**
The fastest way to add a nav item is to edit `Sidebar.vue` directly. Developers do it, it works, and the problem only surfaces months later during an upstream merge with breaking schema changes (Chatwoot v3.x → v4.2 migration failures are well-documented across at least 5 separate GitHub issues).

**How to avoid:**
- Add sidebar nav items only in a single, clearly marked fork-owned file (e.g., `app/javascript/dashboard/fork-overrides/ForkNavItems.vue`) imported at one point in Sidebar.vue.
- Keep the diff between your fork and upstream to **one commit per concern**: (1) sidebar nav entry, (2) CSP header relaxation, (3) any ENV additions. Never mix concerns in a commit.
- Maintain a `UPSTREAM_DIFF.md` file in the repo root that documents every file modified from upstream and why. This forces reviewers to notice when the list grows.
- Use `git log --oneline upstream/main..HEAD` regularly to audit divergence.
- Before any upstream merge, run `git diff upstream/main HEAD -- app/javascript/dashboard/components-next/sidebar/Sidebar.vue` to assess conflict scope early.

**Warning signs:**
- The number of files in `git diff upstream/main HEAD` is growing sprint over sprint.
- Developers start saying "we'll sync with upstream later" — this is the beginning of permanent fork drift.
- Merge conflicts appear in `package.json`, `Gemfile.lock`, or migration files during sync.

**Phase to address:** Fork Setup phase (Phase 1). Establish the isolation discipline before writing any code; retroactively enforcing it is extremely costly.

---

### Pitfall 2: iframe Auth Blindspot — Dashboard Apps Have No Native Auth

**What goes wrong:**
The Chatwoot Dashboard Apps (iframe) feature passes `account_id` and `conversation_id` via query parameters and postMessage, but there is **no native mechanism** for the embedded app to verify the caller is actually a logged-in Chatwoot agent. Anyone who knows the URL can hit the Kanban API directly. In multi-tenant SaaS mode this is a serious data leakage vector: one tenant's agent could enumerate another tenant's cards if the Kanban API does not enforce `account_id` ownership.

**Why it happens:**
Developers see the `{{account_id}}` and `{{user_id}}` template variables in the Dashboard App URL config and assume that means authentication is handled. It is not — those values are injected as plain query parameters. The browser's third-party cookie restrictions also prevent the embedded iframe from reading Chatwoot's session cookie. Discussion #5878 confirms this has been an open gap since 2021, with no resolution by 2025.

**How to avoid:**
- Implement a short-lived signed token endpoint in your Kanban service. When the iframe loads, it receives `account_id` + `user_id` via postMessage (`chatwoot-dashboard-app:fetch-info`), then calls `POST /api/auth/chatwoot-token` on your service with those values. Your service validates them against the Chatwoot API (check that user belongs to that account) and returns a short-lived JWT (15-minute TTL).
- Treat the `account_id` and `user_id` from the URL/postMessage as **untrusted hints**, not authentication proof. Always validate ownership server-side against Chatwoot's API.
- All Kanban API endpoints must require this JWT and enforce `account_id` in every query — never accept an `account_id` that doesn't match the token's claim.

**Warning signs:**
- Kanban API accepts `account_id` as a query param without verifying the caller owns that account.
- The iframe URL contains auth credentials or tokens as plain query parameters (logged in server access logs).
- No auth on `GET /api/kanban/cards?account_id=X` — any browser tab can call it.

**Phase to address:** Kanban Microservice phase (Phase 2). Auth architecture must be decided before any API endpoints are built; retrofitting auth is a full rewrite.

---

### Pitfall 3: Cross-Container Secret Exposure in Coolify v4

**What goes wrong:**
Coolify v4 injects **all** project environment variables into every container in a Docker Compose stack via a single shared `.env` file. In a Chatwoot + Postgres + Redis + Sidekiq + Kanban stack, the Redis container can read `POSTGRES_PASSWORD`, the Kanban service can read Chatwoot's `SECRET_KEY_BASE`, and vice versa. GitHub issue #7655 confirms this is unfixed in Coolify v4 with a "Hold" label pending v5.

**Why it happens:**
Coolify generates one `.env` file for the entire compose project. This is convenient but architecturally insecure for multi-secret deployments.

**How to avoid:**
- Deploy the Kanban microservice as a **separate Coolify resource** (separate Docker Compose or separate Dockerfile application), not as an additional service inside the Chatwoot compose stack. Each Coolify resource gets its own environment variable namespace.
- Never put the Kanban service's database credentials or JWT signing keys in the same Coolify resource as Chatwoot.
- Mark all sensitive variables as "Locked" in Coolify UI — this at minimum prevents them from appearing in deployment logs (GitHub issue #7235).
- Accept that the workaround is architectural separation, not a Coolify fix.

**Warning signs:**
- Kanban service and Chatwoot are defined in the same `docker-compose.yml` managed by a single Coolify resource.
- `POSTGRES_PASSWORD` appears in Coolify's deployment debug log output.
- A `printenv` in any container reveals variables from other services.

**Phase to address:** Fork Deploy phase (Phase 1) and Kanban Deploy phase (Phase 2). Separation must be established at infrastructure design, not after deployment.

---

### Pitfall 4: Chatwoot Upstream Upgrade Breaks Database Migrations

**What goes wrong:**
Chatwoot has a well-documented pattern of migration failures when skipping minor versions, particularly in the v3.x → v4.x transition. At least 6 confirmed GitHub issues report `NoMethodError: undefined method 'settings' for an instance of Account` and `PG::UndefinedTable` errors when running `rails db:chatwoot_prepare` on forks. This is especially dangerous for forks because the upstream migration state and the fork's local schema can diverge silently.

**Why it happens:**
Chatwoot's migration files sometimes reference application-level methods (e.g., `Account#settings`) that only exist after a prior migration runs. If a fork's schema is out of sync with the expected migration order (because custom migrations were added or the fork was synced mid-version), the prepare task fails. Also: stable release tags v4.2.0–v4.4.0 had schema inconsistencies with their own application code.

**How to avoid:**
- Before any upstream merge, tag the current working state: `git tag fork-stable-pre-merge-YYYYMMDD`.
- Follow the documented upgrade path: never skip major minor versions. For v3.x → v4.x, go v3.x → v4.1.x → v4.2.x.
- Test migrations against a **copy** of the production database before deploying upstream merges.
- Keep custom migrations in a clearly named range (e.g., `9999_XXXXX`) so they never conflict with upstream migration timestamps.
- Run `rails db:migrate:status` after every upstream sync to detect pending or broken migrations before they reach production.

**Warning signs:**
- `rails db:migrate:status` shows `down` migrations alongside `up` ones after a sync.
- The fork has custom migration files with timestamps in the same range as upstream migrations.
- Deployment logs show `NoMethodError` or `PG::UndefinedTable` during `db:chatwoot_prepare`.

**Phase to address:** Fork Setup phase (Phase 1) and every subsequent upstream sync event. Document the upgrade procedure as part of the project runbook before the first deployment.

---

### Pitfall 5: n8n Webhook Timeout Causing Lost Card Creation Events

**What goes wrong:**
Chatwoot fires a webhook to n8n when a new conversation arrives. n8n processes the workflow and calls the Kanban API to create a card. If the n8n workflow takes more than ~5-10 seconds (e.g., waiting for an AI response, slow HTTP node, Switch node branching), Chatwoot's webhook sender may retry, causing duplicate events. Worse, if n8n's webhook handler exceeds 100 seconds (the hosted n8n hard timeout), the response is never delivered and the card creation is silently dropped. Community reports confirm 5-11 minute message delays caused by this exact mechanism with Chatwoot + n8n AgentBots.

**Why it happens:**
Chatwoot's webhook delivery expects a fast 2xx response. n8n processes synchronously in the webhook execution path by default. When n8n is slow (complex workflows, API calls), the connection stays open, Chatwoot considers the delivery failed, and retries — potentially creating duplicate webhooks that flood the queue.

**How to avoid:**
- Configure n8n to **respond immediately** (HTTP 200) at the start of the webhook workflow, then continue processing asynchronously. Use n8n's "Respond to Webhook" node at position 1, then the actual logic after it.
- Set `N8N_DEFAULT_WEBHOOK_TIMEOUT=300000` in n8n's environment variables to extend the internal timeout, but still use async response pattern.
- Design the Kanban API `POST /cards` endpoint to be **idempotent** using a `source_conversation_id` field — if n8n retries delivery, a second call with the same conversation ID returns the existing card rather than creating a duplicate. Chatwoot itself uses `source_id` for exactly this pattern.
- Add a dead-letter mechanism: log all incoming webhook events to a queue table with status (`received`, `processed`, `failed`), so failed events can be replayed.

**Warning signs:**
- n8n workflow execution logs show "timed out" or "connection reset" errors from Chatwoot webhooks.
- Duplicate cards appearing in Kanban when a single conversation arrives.
- Cards not being created at all, with no error surfaced to the user.
- n8n workflow "Wait" node being used in the webhook execution path.

**Phase to address:** n8n Integration phase (Phase 3). The idempotency design must be in the Kanban API schema from the start. The async webhook response pattern must be in the first n8n workflow template.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Edit `Sidebar.vue` directly instead of isolating fork changes | 30 minutes faster to ship | Every upstream merge breaks the file; sidebar redesigns happen often | Never — add one import point, not inline edits |
| Use Chatwoot's personal access token for Kanban API calls instead of short-lived JWT | No auth service to build | Token never expires; one leaked token compromises all tenants; no revocation mechanism | Never in multi-tenant SaaS |
| Deploy Kanban inside Chatwoot's Compose stack | One Coolify resource to manage | Coolify injects all secrets into all containers; restart of one service restarts all | Never — separate resources solve the secret exposure |
| Skip the idempotency key on the card creation endpoint | Faster to implement | Duplicate cards on n8n retry, extremely hard to de-duplicate after the fact | Only acceptable in single-webhook-guaranteed environments (never with n8n) |
| Hardcode `account_id` in the Kanban service config for single-tenant use | No auth complexity | Blocks multi-tenant expansion; requires code change to add a second customer | Only if you are certain it will never be multi-tenant (contradicts PROJECT.md) |
| Sync upstream only when something breaks | No sync overhead | Accumulates merge debt exponentially; schema migrations become impossible to sequence | Never — schedule periodic sync cadence from day 1 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Chatwoot Dashboard Apps (iframe) | Treating `{{account_id}}` in the URL template as proof of identity | Use as an untrusted hint; validate via Chatwoot API server-side and issue your own JWT |
| Chatwoot → n8n webhook | Relying on n8n processing completing within the open webhook connection | Respond immediately with 200, process asynchronously, use idempotency key |
| Chatwoot X-Frame-Options | The Rails app sets `X-Frame-Options: SAMEORIGIN` by default | Must be patched in fork (config/initializers or middleware) to allow same-parent-domain; NGINX header stripping does not work because Rails sets the header after proxying |
| Coolify environment variables | Putting all services in one Coolify resource | Each logical service boundary (Chatwoot stack, Kanban stack) must be a separate Coolify resource |
| Coolify `$` in env vars | Plain `$` in environment variable values causes variable interpolation silently | Enable "Is Literal?" flag in Coolify for all values containing `$` (e.g., passwords, secret keys) |
| n8n → Kanban API | Using a long-lived static API key for n8n to call Kanban | Use a per-tenant API key with explicit `account_id` binding; rotate on demand |
| Chatwoot webhook retries | Assuming Chatwoot will not retry | Chatwoot retries via Sidekiq with exponential backoff up to 25 times over ~20 days; design for idempotency |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Kanban polling Chatwoot API for card metadata on every page load | Slow Kanban load; Chatwoot API rate limits hit at modest scale | Store denormalized card data (contact name, channel, agent) in Kanban's own DB at creation time; refresh on demand | 50+ concurrent users |
| No Redis memory limit configured on Chatwoot's Sidekiq Redis | Sidekiq jobs silently evicted when Redis OOM; webhook delivery stops without error | Set `maxmemory` and `maxmemory-policy noeviction` (or `allkeys-lru`) in Redis config | When Redis memory grows past host limit (no hard default in Docker) |
| Kanban and Chatwoot sharing the same Postgres instance | Schema migrations from either service can lock tables across services; one slow query affects both | Give Kanban its own Postgres database (can be same Postgres server, different DB) | Any concurrent migration or heavy query from either service |
| Synchronous card creation in the n8n webhook path | n8n waits for Kanban API response before returning 200 to Chatwoot; slow Kanban API causes webhook timeout cascade | Respond to Chatwoot immediately; queue card creation as an async job | Any Kanban API latency spike over 3 seconds |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting `account_id` from iframe URL/postMessage without server-side validation | Tenant A's agent can read or write tenant B's Kanban data by changing the `account_id` parameter | Validate every request: token's `account_id` claim must match the resource being accessed; reject mismatches with 403 |
| Exposing Kanban admin endpoints without account scoping | A valid token from any tenant can manage another tenant's pipeline stages | All endpoints under `/api/kanban/` must be scoped: `Stage.where(account_id: current_account_id)` — never `Stage.find(id)` alone |
| Chatwoot `SECRET_KEY_BASE` in Coolify resource shared with Kanban service | If Kanban container is compromised, attacker has Chatwoot's signing key | Separate Coolify resources; Kanban never needs `SECRET_KEY_BASE` |
| n8n Kanban API key stored in n8n credential manager without rotation plan | Leaked credential grants full Kanban write access indefinitely | Implement key rotation endpoint; document rotation procedure in runbook before launch |
| Dashboard App URL containing auth tokens as plain query parameters | Server access logs on any reverse proxy record the token; token is permanent | Never put long-lived tokens in URLs; use postMessage exchange to obtain short-lived tokens after iframe load |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Kanban opens in full redirect instead of embedded iframe | Context lost — user leaves Chatwoot conversation list to view pipeline | Use Dashboard Apps iframe embedding; keep Chatwoot conversation visible alongside Kanban |
| Card link opens Chatwoot conversation in new tab without preserving agent context | Agent loses current conversation position; disorienting | Deep-link back to `/{account_id}/conversations/{conversation_id}` which Chatwoot navigates to directly |
| Pipeline stages are global (not per-account) | SaaS customer A's stage names appear for customer B | Stages must always be account-scoped; add `account_id` FK to the stages table from day 1 |
| No loading state when iframe Dashboard App initializes | Blank white box while Kanban authenticates via postMessage exchange | Show loading spinner in the iframe app during the postMessage token negotiation (typically 200-500ms) |
| Drag-and-drop card reordering sending one API call per move event | API flooding on fast drags; cards land in wrong order under latency | Debounce position updates; send final position only on drop, not on every drag-over event |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sidebar nav item:** Appears in UI — verify it works when Chatwoot is upgraded to next minor version without merge conflicts (test in a scratch branch against `upstream/main`).
- [ ] **Multi-tenant isolation:** Card creation works for account 1 — verify account 2 cannot read account 1's cards via direct API call with account 2's token.
- [ ] **n8n webhook flow:** Card appears after conversation arrives — verify no duplicate card appears when Chatwoot retries the webhook (simulate by calling the n8n webhook URL twice with the same payload).
- [ ] **Auth flow:** Kanban loads correctly for logged-in agent — verify the iframe shows an error state (not a blank screen) if the postMessage auth exchange fails or times out.
- [ ] **Coolify env vars:** Services deploy successfully — verify sensitive vars from Chatwoot stack are NOT accessible from Kanban container (`docker exec kanban_container printenv | grep SECRET_KEY_BASE` should return nothing).
- [ ] **Database migrations:** Fork builds and migrates — verify `rails db:migrate:status` shows no `down` migrations after syncing upstream.
- [ ] **Idempotency:** Card is created on first call — verify second call with same `source_conversation_id` returns the same card with 200, not a new card or 500.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Fork divergence too large to merge | HIGH | Cherry-pick only your fork-specific commits onto a fresh checkout of upstream; discard accumulated merge noise. Estimated 2-5 days depending on divergence depth. |
| Tenant data leakage via missing account_id scope | HIGH | Audit every DB query across Kanban API; add scoping; run data cleanup script to re-attribute any cross-tenant records. Requires incident communication to affected tenants. |
| Coolify secret cross-exposure discovered in production | MEDIUM | Rotate all credentials immediately; split into separate resources; redeploy. ~4 hours downtime if done carefully. |
| Duplicate Kanban cards from n8n webhook retries | MEDIUM | Write a de-duplication script using `source_conversation_id`; add idempotency constraint to DB; remove duplicates. One-time cleanup + schema migration. |
| Failed Chatwoot upstream migration | MEDIUM | Restore from pre-merge tag; apply upstream migrations one version at a time on a DB copy; identify conflicting custom migration; fix ordering. Plan for 1 day of downtime. |
| n8n cards silently not being created | LOW | Enable webhook event log table; replay missed events from log; investigate n8n execution history for timeout errors. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fork divergence / upstream merge pain | Phase 1 — Fork Setup | `git diff upstream/main HEAD --stat` stays under 10 files at end of phase |
| Chatwoot migration failures on upgrade | Phase 1 — Fork Setup | `rails db:migrate:status` clean after first upstream sync; runbook written |
| Coolify cross-container secret exposure | Phase 1 — Deploy Setup | `docker exec` check confirms Kanban container cannot see `SECRET_KEY_BASE` |
| Coolify env var `$` interpolation | Phase 1 — Deploy Setup | All env vars with special chars have "Is Literal?" checked; test deploy succeeds |
| Dashboard Apps iframe X-Frame-Options blocking | Phase 2 — Kanban + iframe Integration | iframe loads without browser console security errors from same parent domain |
| iframe auth gap — no native Chatwoot auth | Phase 2 — Kanban Microservice | Penetration test: calling Kanban API with fabricated `account_id` returns 403 |
| Multi-tenant account_id isolation | Phase 2 — Kanban Microservice | Automated test: token for account 1 cannot read account 2 resources |
| n8n webhook timeout / duplicate events | Phase 3 — n8n Integration | Load test: 10 simultaneous webhook calls produce exactly 10 unique cards |
| Missing idempotency on card creation | Phase 3 — n8n Integration | Unit test: second POST with same `source_conversation_id` returns existing card |
| Redis OOM causing silent job loss | Phase 1 — Deploy Setup | Redis `maxmemory` set; `INFO memory` checked after first load test |

---

## Sources

- [Chatwoot Dashboard Apps auth discussion #5878](https://github.com/orgs/chatwoot/discussions/5878) — confirmed auth gap with no native solution
- [Chatwoot X-Frame-Options issue #12082](https://github.com/chatwoot/chatwoot/issues/12082) — SAMEORIGIN header blocking iframe on different subdomain
- [Chatwoot migration failure v4.2 #12128](https://github.com/chatwoot/chatwoot/issues/12128) — schema inconsistencies in stable tags
- [Chatwoot migration failure v3→v4.2 #11585](https://github.com/chatwoot/chatwoot/issues/11585) — upgrade path requirement
- [Chatwoot WebhookJob v4.12 #13946](https://github.com/chatwoot/chatwoot/issues/13946) — webhook job argument error breaking n8n
- [n8n + Chatwoot message loss](https://community.n8n.io/t/chatwoot-n8n-se-pierden-algunos-menajes-de-whatsapp/266426) — Meta retry backoff from slow n8n processing
- [n8n webhook timeout 100s hard limit](https://community.n8n.io/t/long-chat-responses-time-out/75675) — confirmed hosted n8n timeout
- [Coolify cross-container secret exposure #7655](https://github.com/coollabsio/coolify/issues/7655) — unfixed in v4, planned for v5
- [Coolify env vars exposed in logs #7235](https://github.com/coollabsio/coolify/issues/7235) — only locked vars redacted
- [Coolify `$` in env var values #1918](https://github.com/coollabsio/coolify/issues/1918) — interpolation bug with special characters
- [Chatwoot SSO Discussion #5878 — postMessage auth workaround](https://github.com/orgs/chatwoot/discussions/5878)
- [Chatwoot multi-tenant overview — restack.io](https://www.restack.io/docs/chatwoot-knowledge-chatwoot-multi-tenant-overview)
- [GitHub Blog: Friendly fork management strategies](https://github.blog/2022-05-02-friend-zone-strategies-friendly-fork-management/)
- [Chatwoot sidebar component location — DeepWiki](https://deepwiki.com/chatwoot/chatwoot/3.2-navigation-and-layout) — `app/javascript/dashboard/components-next/sidebar/Sidebar.vue`

---
*Pitfalls research for: Chatwoot fork with CRM Kanban microservice (SaaS, multi-tenant)*
*Researched: 2026-04-09*
