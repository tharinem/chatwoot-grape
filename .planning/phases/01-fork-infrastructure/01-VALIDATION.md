---
phase: 1
slug: fork-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash scripts + docker compose |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `docker compose -f docker-compose.production.yaml config --quiet` |
| **Full suite command** | `docker compose -f docker-compose.production.yaml build && docker compose -f docker-compose.production.yaml up -d --wait` |
| **Estimated runtime** | ~300 seconds (first build), ~60 seconds (cached) |

---

## Sampling Rate

- **After every task commit:** Run `docker compose -f docker-compose.production.yaml config --quiet`
- **After every plan wave:** Run full build + deploy
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds (config validation), 300 seconds (full build)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FORK-01 | integration | `docker compose config --quiet` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | FORK-02 | integration | `docker compose build --dry-run` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | FORK-03 | file check | `test -f UPSTREAM_DIFF.md` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | FORK-04 | doc check | `grep -q "merge" UPSTREAM_SYNC.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docker-compose.production.yaml` — fork's compose file with build-from-source
- [ ] Coolify deployment validated on target server

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coolify deploys fork successfully | FORK-01 | Requires Coolify UI interaction | Deploy via Coolify, verify service is healthy in dashboard |
| Fork serves same functionality as official image | FORK-01 | Requires browser verification | Navigate to Chatwoot URL, verify login and basic features work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
