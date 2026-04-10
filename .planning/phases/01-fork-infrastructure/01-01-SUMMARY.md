---
phase: 01-fork-infrastructure
plan: 01
subsystem: fork-setup
tags: [fork, docker, coolify, upstream-tracking]
dependency_graph:
  requires: []
  provides: [chatwoot-fork, build-from-source-compose, upstream-sync-procedure]
  affects: [01-02]
tech_stack:
  added: [pgvector/pgvector:pg16, redis:7-alpine]
  patterns: [build-from-source, no-ports-coolify-traefik]
key_files:
  created:
    - UPSTREAM_DIFF.md
  modified:
    - docker-compose.production.yaml
decisions:
  - Use pgvector/pgvector:pg16 instead of plain postgres:16 (matches upstream)
  - Use redis:7-alpine instead of redis:alpine (pin major version)
  - Rename postgres DB to chatwoot_production and user to chatwoot (clearer naming)
  - Remove all ports mappings for Coolify Traefik routing
metrics:
  duration: 7 minutes
  completed: "2026-04-10T01:24:00Z"
  tasks_completed: 3
  tasks_total: 3
requirements:
  - FORK-01
  - FORK-03
  - FORK-04
---

# Phase 01 Plan 01: Fork Setup and Docker Compose Summary

Chatwoot fork created on GitHub with custom branch based on v4.12.1, docker-compose.production.yaml replaced to build from source via docker/Dockerfile, and UPSTREAM_DIFF.md added to track fork divergence with a documented sync procedure.

## One-liner

Build-from-source docker-compose replacing upstream image pull, with 2-file divergence tracking and monthly sync procedure.

## What Was Done

### Task 1: Create GitHub fork and custom branch (checkpoint:human-action)

User manually created the fork at https://github.com/tharinem/chatwoot-grape.git, cloned it, added the upstream remote, and created the `custom` branch based on `v4.12.1`.

**Verification:** Remote `upstream` points to `chatwoot/chatwoot.git`, branch is `custom`, merge base confirmed at v4.12.1.

### Task 2: Create docker-compose.production.yaml (build from source)

Replaced the upstream `docker-compose.production.yaml` which used `image: chatwoot/chatwoot:latest` with a version that uses `build:` targeting `docker/Dockerfile`.

Key changes from upstream:
- `image: chatwoot/chatwoot:latest` replaced with `build: { context: ., dockerfile: docker/Dockerfile }`
- All `ports:` mappings removed (Coolify Traefik handles routing)
- `redis:alpine` pinned to `redis:7-alpine`
- Postgres credentials use `${VAR:?required}` validation syntax
- Database renamed to `chatwoot_production`, user to `chatwoot`
- Added `restart: always` to the base anchor

**Commit:** `601a56045` -- feat(01-01): replace upstream image pull with build-from-source in docker-compose

### Task 3: Create UPSTREAM_DIFF.md

Created fork divergence documentation listing exactly 2 divergent files, a 7-step sync procedure for upstream releases, a list of files that must never be modified in the fork, and a monthly sync cadence note.

**Commit:** `e7f12aa9c` -- docs(01-01): add UPSTREAM_DIFF.md tracking fork divergence and sync procedure

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Pin redis to 7-alpine | Upstream used `redis:alpine` (unpinned major). Pinning to 7 prevents surprise breaking changes. |
| Rename DB to chatwoot_production | Clearer than upstream's `chatwoot` name; distinguishes from dev databases. |
| Rename DB user to chatwoot | Upstream used `postgres` superuser; dedicated user is better practice. |
| Use ${VAR:?required} for passwords | Docker Compose native validation prevents starting with empty passwords. |

## Verification Results

- `docker-compose.production.yaml` contains `build:` with `context: .` and `dockerfile: docker/Dockerfile` -- PASS
- `docker-compose.production.yaml` does NOT contain `image: chatwoot` -- PASS
- `docker-compose.production.yaml` does NOT contain `ports:` -- PASS
- `docker-compose.production.yaml` contains all 4 services (rails, sidekiq, postgres, redis) -- PASS
- `UPSTREAM_DIFF.md` contains v4.12.1, Sync Procedure, Divergent Files, What NOT to Change -- PASS
- Only 2 non-planning files differ from upstream (docker-compose.production.yaml modified, UPSTREAM_DIFF.md new) -- PASS

## Known Stubs

None -- no stubs in this plan (infrastructure files only, no application code).

## Commits

| Task | Hash | Message |
|------|------|---------|
| 2 | 601a56045 | feat(01-01): replace upstream image pull with build-from-source in docker-compose |
| 3 | e7f12aa9c | docs(01-01): add UPSTREAM_DIFF.md tracking fork divergence and sync procedure |

## Self-Check: PASSED

- [x] docker-compose.production.yaml exists
- [x] UPSTREAM_DIFF.md exists
- [x] 01-01-SUMMARY.md exists
- [x] Commit 601a56045 found
- [x] Commit e7f12aa9c found
