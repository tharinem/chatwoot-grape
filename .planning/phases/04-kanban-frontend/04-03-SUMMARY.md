---
phase: 04-kanban-frontend
plan: 03
subsystem: ui
tags: [vue3, kanban, drag-and-drop, vue-draggable-plus, sortablejs, tailwind, i18n, pinia]

requires:
  - phase: 04-kanban-frontend-01
    provides: Project scaffold, Tailwind config, color CSS vars
  - phase: 04-kanban-frontend-02
    provides: TypeScript types, API client, Pinia stores, composables, router, i18n

provides:
  - KanbanBoard component with horizontal column layout
  - KanbanColumn with cross-column drag-and-drop via vue-draggable-plus
  - KanbanCard with configurable visible fields and Chatwoot conversation link
  - EmptyBoard and EmptyColumn empty state components
  - BoardLayout full-page shell with horizontal scrolling board area
  - BoardTopBar with page title and "Novo card" CTA button
  - BoardView wiring stores to components with loading/error/empty states
  - LoginView with i18n and query param auto-login
  - Toast notification component with success/error variants

affects: [04-kanban-frontend-04, 05-chatwoot-integration]

tech-stack:
  added: [vue-draggable-plus, date-fns/locale/ptBR]
  patterns: [cardMoved event shape contract, optimistic drag-and-drop, configurable card fields via uiStore.visibleFields]

key-files:
  created:
    - kanban-frontend/src/components/board/KanbanBoard.vue
    - kanban-frontend/src/components/board/KanbanColumn.vue
    - kanban-frontend/src/components/board/KanbanCard.vue
    - kanban-frontend/src/components/board/EmptyBoard.vue
    - kanban-frontend/src/components/board/EmptyColumn.vue
    - kanban-frontend/src/components/layout/BoardLayout.vue
    - kanban-frontend/src/components/layout/BoardTopBar.vue
    - kanban-frontend/src/components/shared/Toast.vue
  modified:
    - kanban-frontend/src/views/BoardView.vue
    - kanban-frontend/src/views/LoginView.vue
    - kanban-frontend/src/i18n/pt-BR.json

key-decisions:
  - "Used data-card-id and data-stage-id HTML attributes for drag-and-drop event extraction instead of array index mapping"
  - "KanbanColumn maintains localCards ref synced from props to work with vue-draggable-plus reactive list requirement"
  - "Card click-vs-drag detection uses mousedown/mouseup flags with setTimeout(0) to avoid false positives"

patterns-established:
  - "cardMoved event shape: { cardId, fromStageId, toStageId, newPosition } -- all drag-and-drop consumers must use this exact contract"
  - "Configurable card fields via uiStore.visibleFields array -- checked with v-if includes() in KanbanCard"
  - "Toast via Teleport to #toast-container in App.vue root"

requirements-completed: [KANB-01, KANB-02, KANB-04, KANB-05, KANB-07]

duration: 3min
completed: 2026-04-10
---

# Phase 4 Plan 3: Core Board Components Summary

**Kanban board with draggable cards across stage columns, configurable card fields, Chatwoot conversation links, and layout shell with login/toast/empty states**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-10T07:35:12Z
- **Completed:** 2026-04-10T07:38:12Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Full Kanban board with horizontal columns, each showing stage name, color accent bar, and card count
- Cross-column drag-and-drop via vue-draggable-plus with group:'cards', animation, ghost/drag classes
- KanbanCard with configurable visible fields (channelType, createdAt, assigneeId, conversationId) driven by uiStore
- Chatwoot conversation link constructed from VITE_CHATWOOT_URL env var
- Layout shell with BoardLayout (horizontal scrolling), BoardTopBar (title + CTA), Toast notifications
- LoginView updated with i18n and query param auto-login (?token=X&account_id=Y)
- BoardView wiring all stores with loading skeleton, error state with retry, and empty board fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Build layout shell, login view, board view, and Toast component** - `baf3e7c02` (feat)
2. **Task 2: Build KanbanBoard, KanbanColumn, KanbanCard with drag-and-drop, and EmptyBoard/EmptyColumn** - `f50172976` (feat)

## Files Created/Modified

- `kanban-frontend/src/components/board/KanbanBoard.vue` - Horizontal flex container rendering KanbanColumn per stage, handles cardMoved events
- `kanban-frontend/src/components/board/KanbanColumn.vue` - Single stage column with vue-draggable-plus drag zone, emits cardMoved
- `kanban-frontend/src/components/board/KanbanCard.vue` - Card with configurable fields, Chatwoot link, click-to-open panel
- `kanban-frontend/src/components/board/EmptyBoard.vue` - Centered empty state with CTA when no cards exist
- `kanban-frontend/src/components/board/EmptyColumn.vue` - Subtle empty message inside empty column
- `kanban-frontend/src/components/layout/BoardLayout.vue` - Full-page layout with top bar slot and horizontal scrolling area
- `kanban-frontend/src/components/layout/BoardTopBar.vue` - Page title "Pipeline de Leads" and "Novo card" button
- `kanban-frontend/src/components/shared/Toast.vue` - Toast notifications via Teleport with TransitionGroup
- `kanban-frontend/src/views/BoardView.vue` - Main board page wiring stores with loading/error/empty states
- `kanban-frontend/src/views/LoginView.vue` - Login form with i18n and query param auto-login
- `kanban-frontend/src/i18n/pt-BR.json` - Added login keys and retry CTA key

## Decisions Made

- Used `data-card-id` and `data-stage-id` HTML attributes for extracting drag event context, keeping the SortableJS integration clean without needing array index mapping
- KanbanColumn maintains a `localCards` ref synced via watch from props, since vue-draggable-plus requires a reactive Ref for its list parameter
- Card click-vs-drag detection uses mousedown/mouseup flags with setTimeout(0) to allow the drag event to fire before clearing the flag

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Board components complete, ready for Plan 04 (card creation form, slide panel, filters, stage management)
- All drag-and-drop event contracts established and verified
- EmptyBoard and BoardTopBar emit events ready to be wired to card creation in Plan 04

## Self-Check: PASSED

- All 10 created/modified files verified on disk
- Both task commits verified in git log (baf3e7c02, f50172976)
- vue-tsc --noEmit: passed
- vite build: passed

---
*Phase: 04-kanban-frontend*
*Completed: 2026-04-10*
