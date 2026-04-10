# Upstream Diff

**Fork base:** chatwoot/chatwoot v4.12.1
**Last upstream sync:** 2026-04-09
**Upstream version synced to:** v4.12.1

## Divergent Files

| File | Type | Purpose | Merge Risk |
|------|------|---------|------------|
| `docker-compose.production.yaml` | Modified | Build from source instead of pulling pre-built image | LOW -- only `build:` vs `image:` differs |
| `UPSTREAM_DIFF.md` | New | Documents fork divergence | NONE -- does not exist upstream |

## Sync Procedure

1. `git fetch upstream --tags`
2. `git checkout custom`
3. `git merge vX.X.X` (replace X.X.X with new release tag)
4. Resolve conflicts in files listed in Divergent Files table
5. `docker compose -f docker-compose.production.yaml build` (test build)
6. Test locally or in staging
7. Push to trigger Coolify redeploy

## What NOT to Change

These files must never be modified in the fork -- upstream manages them:

- `docker/Dockerfile` -- use upstream as-is
- `Gemfile` / `Gemfile.lock` -- upstream manages dependencies
- `package.json` / `pnpm-lock.yaml` -- upstream manages frontend deps
- `db/schema.rb` -- upstream manages database schema
- `app/` source code -- until absolutely necessary (Phase 5 sidebar may add 1-2 files)

## Cadence

Chatwoot releases on the 15th of each month. Plan syncs for the week after a new release.
