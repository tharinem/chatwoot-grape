---
phase: 3
slug: n8n-card-creation
status: not-applicable
shadcn_initialized: false
preset: none
created: 2026-04-10
---

# Phase 3 — UI Design Contract

> This phase has **no frontend component**. It is a purely backend/API phase.

---

## Applicability

| Property | Value |
|----------|-------|
| Phase type | Backend API only |
| Frontend code | None |
| UI components | None |
| Styling required | None |

**Rationale:** Phase 3 implements a webhook endpoint (`POST /api/v1/webhooks/chatwoot`), BullMQ async job processing, and API key authentication. All three requirements (API-01, API-02, API-03) are server-side concerns with no user-facing interface.

The frontend for this project is addressed in:
- **Phase 4** (Kanban Frontend) -- drag-and-drop board, card display, stage management UI
- **Phase 5** (Chatwoot Embedding) -- iframe integration, sidebar nav, standalone URL

---

## Design System

Not applicable for this phase.

---

## Spacing Scale

Not applicable for this phase.

---

## Typography

Not applicable for this phase.

---

## Color

Not applicable for this phase.

---

## Copywriting Contract

Not applicable for this phase. API error responses follow the existing RFC 7807 `problemResponse` pattern established in Phase 2.

| Element | Value |
|---------|-------|
| 401 Unauthorized (missing key) | `{ title: "Unauthorized", detail: "Missing x-api-key header" }` |
| 401 Unauthorized (invalid key) | `{ title: "Unauthorized", detail: "Invalid or revoked API key" }` |
| 202 Accepted | `{ status: "accepted", job_id: "{id}" }` |

---

## Registry Safety

Not applicable for this phase. No frontend dependencies.

---

## Checker Sign-Off

Phase 3 is API-only. UI checker dimensions do not apply.

- [x] Not applicable -- backend-only phase

**Approval:** not-applicable 2026-04-10
