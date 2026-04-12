---
phase: 05-chatwoot-embedding
plan: 01
subsystem: sidebar-iframe
tags: [chatwoot, embedding, iframe, sidebar, kanban]
dependency_graph:
  requires: [chatwoot-fork, kanban-frontend]
  provides: [sidebar-kanban-item, iframe-embedding]
  affects: [05-02]
tech_stack:
  added: []
  patterns: [iframe-embedding, vue-router, i18n]
key_files:
  created:
    - app/javascript/dashboard/routes/dashboard/kanban/kanban.routes.js
    - app/javascript/dashboard/routes/dashboard/kanban/pages/KanbanIndex.vue
  modified:
    - app/javascript/dashboard/routes/dashboard/dashboard.routes.js
    - app/javascript/dashboard/components-next/sidebar/Sidebar.vue
    - app/javascript/dashboard/i18n/locale/en/settings.json
    - app/javascript/dashboard/i18n/locale/pt_BR/settings.json
decisions:
  - Embed kanban via iframe (not Dashboard App) for sidebar full-board view
  - Sidebar item placed between Contacts and Companies using i-lucide-kanban icon
  - iframe URL points to kanban.reengenhariadigital.com.br with account_id param
metrics:
  duration: 5 minutes
  completed: "2026-04-12T16:00:00Z"
  tasks_completed: 4
  tasks_total: 4
requirements:
  - EMBED-02
  - EMBED-03
---

# Phase 05 Plan 01: Sidebar Nav + Iframe Embedding Summary

Added Kanban as a sidebar menu item in the Chatwoot dashboard that opens the kanban frontend in a full-page iframe. Done manually outside GSD flow during branding session.

## One-liner

Sidebar menu item + iframe component embedding kanban.reengenhariadigital.com.br inside Chatwoot dashboard.

## What Was Done

### Task 1: Create KanbanIndex.vue iframe component
Vue 3 component with `<script setup>` that renders the kanban frontend URL in a full-height iframe with loading state.

### Task 2: Create kanban route
Route definition at `/accounts/:accountId/kanban` with permissions for admin and agent roles.

### Task 3: Register route in dashboard
Imported kanban routes in dashboard.routes.js and added to children array.

### Task 4: Add sidebar menu item + i18n
Added "Kanban" item with `i-lucide-kanban` icon in Sidebar.vue menuItems between Contacts and Companies. Added translations in en and pt_BR settings.json.

## Commits

| Task | Hash | Message |
|------|------|---------|
| All | 15c2417ff | feat(kanban): embed kanban board as iframe in Chatwoot sidebar |

## Self-Check: PASSED

- [x] KanbanIndex.vue created with iframe
- [x] kanban.routes.js created with route definition
- [x] dashboard.routes.js imports kanban routes
- [x] Sidebar.vue contains Kanban menu item
- [x] en/settings.json contains KANBAN key
- [x] pt_BR/settings.json contains KANBAN key
