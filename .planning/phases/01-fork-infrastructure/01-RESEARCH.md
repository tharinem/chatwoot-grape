# Phase 1: Fork Infrastructure - Research

**Researched:** 2026-04-09
**Domain:** Chatwoot fork setup, Docker build from source, Coolify deployment, upstream sync strategy
**Confidence:** HIGH

## Summary

Phase 1 establishes the Chatwoot fork as a self-built Docker image deployed on Coolify, replacing the current setup that uses the official pre-built `chatwoot/chatwoot` image. The core challenge is building Chatwoot from source via a custom Dockerfile while keeping the fork's divergence from upstream to an absolute minimum (3-4 files). The deployment must function identically to the current setup on Coolify.

Chatwoot's existing `docker/Dockerfile` is a multi-stage build (Node 24-alpine + Ruby 3.4.4-alpine) that compiles assets with Vite/pnpm and bundles gems. The fork only needs a production-oriented `docker-compose.production.yaml` that points `build:` at this Dockerfile instead of pulling `chatwoot/chatwoot:latest`. The Coolify Docker Compose build pack handles the rest -- it clones the git repo, runs `docker compose build`, and routes traffic via Traefik.

**Primary recommendation:** Fork the Chatwoot repo on GitHub, create a `custom` branch off a stable release tag (e.g., `v4.12.1`), add a production docker-compose that builds from source, deploy via Coolify's Docker Compose build pack, and document the upstream sync procedure using a traditional merge strategy.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FORK-01 | Repositorio fork do Chatwoot no GitHub com Dockerfile customizado para build proprio | Chatwoot's existing `docker/Dockerfile` builds from source. Fork needs only a `docker-compose.production.yaml` that uses `build:` instead of `image:`. No custom Dockerfile modification required initially. |
| FORK-02 | Deploy do Chatwoot fork no Coolify funcionando identicamente ao setup atual | Coolify Docker Compose build pack clones git repo and builds. Production compose must define all 4 services (rails, sidekiq, postgres, redis) with identical env vars. |
| FORK-03 | Divergencia do upstream limitada a ~3-4 arquivos documentados em UPSTREAM_DIFF.md | Only files that differ: `docker-compose.production.yaml` (modified for build-from-source), possibly `.env.example` tweaks, and `UPSTREAM_DIFF.md` itself. Chatwoot's `docker/Dockerfile` is used as-is. |
| FORK-04 | Procedimento documentado para sincronizar fork com upstream sem quebrar customizacoes | Traditional merge strategy: track upstream remote, merge release tags into custom branch, resolve conflicts in the 3-4 known divergent files. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Deploy**: Coolify -- all services must be manageable via Coolify (Docker Compose or Dockerfile)
- **Fork strategy**: Minimum divergence from upstream Chatwoot for easier future merges
- **Authentication**: Use Chatwoot's auth system (no second login system)
- **Multi-tenant**: Kanban and future modules must be isolated by `account_id`
- **Do NOT modify** Chatwoot's Rails models or database schema (`db/schema.rb`)
- **Do NOT use** `ports:` in docker-compose for Coolify-routed services -- let Traefik handle it

## Standard Stack

### Core (Phase 1 only -- fork infrastructure)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Chatwoot | v4.12.1 (latest stable) | Base application | Latest stable release tag as fork base point |
| Ruby | 3.4.4 | Runtime (in Dockerfile) | Pinned by upstream `.ruby-version` |
| Node | 24.x | Build tooling (in Dockerfile) | Pinned by upstream `package.json` engines |
| pnpm | 10.x | Package manager (in Dockerfile) | Required by upstream `packageManager` field |
| PostgreSQL | 16 (pgvector) | Database | Upstream uses `pgvector/pgvector:pg16` |
| Redis | 7-alpine | Cache/queue | Upstream production compose uses alpine |
| Docker Compose | v2 | Orchestration | Coolify build pack requirement |
| Coolify | 4.x | Deployment platform | Already in use |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Build from source on Coolify | GitHub Actions + GHCR pre-built image | More complex CI pipeline but faster deploys; private GHCR has auth issues on Coolify. Build-on-Coolify is simpler for Phase 1. Revisit if build times exceed 10 min. |
| Docker Compose build pack | Dockerfile build pack (single service) | Dockerfile pack only builds one service. Chatwoot needs rails + sidekiq + postgres + redis = compose is mandatory. |
| Fork off `develop` branch | Fork off release tag | Release tags are stable. `develop` has unreleased changes that may break. Always fork from a tag. |

## Architecture Patterns

### Recommended Repository Structure

```
chatwoot-fork/                    # GitHub fork of chatwoot/chatwoot
├── docker/
│   └── Dockerfile                # UNCHANGED from upstream
├── docker-compose.yaml           # UNCHANGED (dev) from upstream
├── docker-compose.production.yaml # MODIFIED -- build from source instead of image pull
├── .env.example                  # UNCHANGED or minor additions
├── UPSTREAM_DIFF.md              # NEW -- documents all divergent files
└── ... (all upstream files)      # UNCHANGED
```

### Pattern 1: Build-from-Source Docker Compose

**What:** Modify `docker-compose.production.yaml` to use `build:` directive instead of `image: chatwoot/chatwoot:latest`

**When to use:** Always -- this is the core of Phase 1

**Example:**
```yaml
# docker-compose.production.yaml (MODIFIED from upstream)
# Source: https://github.com/chatwoot/chatwoot/blob/develop/docker-compose.production.yaml

x-base: &base
  # CHANGED: build from source instead of pulling pre-built image
  build:
    context: .
    dockerfile: docker/Dockerfile
    args:
      RAILS_ENV: production
      NODE_ENV: production
  # Remove the 'image:' line from upstream
  env_file: .env
  volumes:
    - storage_data:/app/storage
  restart: always

services:
  rails:
    <<: *base
    depends_on:
      - postgres
      - redis
    environment:
      - NODE_ENV=production
      - RAILS_ENV=production
      - INSTALLATION_ENV=docker

  sidekiq:
    <<: *base
    depends_on:
      - postgres
      - redis
    command: ['bundle', 'exec', 'sidekiq', '-C', 'config/sidekiq.yml']

  postgres:
    image: pgvector/pgvector:pg16
    restart: always
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=chatwoot_production
      - POSTGRES_USER=chatwoot
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?required}

  redis:
    image: redis:7-alpine
    restart: always
    command: ['redis-server', '--requirepass', '${REDIS_PASSWORD:?required}']
    volumes:
      - redis_data:/data

volumes:
  storage_data:
  postgres_data:
  redis_data:
```

### Pattern 2: Coolify Domain Assignment (No Ports)

**What:** Let Coolify/Traefik handle external routing. Do NOT expose `ports:` in docker-compose.

**When to use:** Always on Coolify.

**Key detail:** In Coolify, after deploying the Docker Compose stack, assign a domain to the `rails` service through the Coolify UI. Coolify adds Traefik labels automatically. Internal services (postgres, redis, sidekiq) remain private with no domain assignment.

### Pattern 3: Traditional Merge Fork Strategy

**What:** Maintain a `custom` branch with minimal divergence from upstream release tags.

**When to use:** Every upstream sync (monthly, matching Chatwoot's release cadence on the 15th).

**Procedure:**
```bash
# One-time setup
git remote add upstream https://github.com/chatwoot/chatwoot.git
git fetch upstream --tags

# Fork from stable release
git checkout -b custom v4.12.1

# ... make minimal changes (docker-compose.production.yaml, UPSTREAM_DIFF.md) ...

# Monthly sync procedure
git fetch upstream --tags
git checkout custom
git merge v4.XX.X  # merge new release tag

# Conflicts will only appear in the 3-4 known divergent files
# Resolve manually, verify build, push
```

### Anti-Patterns to Avoid

- **Modifying the Dockerfile:** Chatwoot's `docker/Dockerfile` works as-is for building from source. Do not add custom build steps -- this would increase divergence and create merge conflicts.
- **Rebasing the custom branch:** Use merge, not rebase. Rebase rewrites history and makes subsequent merges harder when the team grows. Traditional merge preserves a clear audit trail of what upstream version was integrated.
- **Forking from `develop`:** The `develop` branch has unreleased, potentially unstable code. Always base the `custom` branch on a release tag.
- **Adding `ports:` to production compose on Coolify:** Coolify's Traefik proxy handles routing. Explicit port mappings bypass the proxy and expose containers directly on the host.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Docker image build | Custom Dockerfile from scratch | Chatwoot's existing `docker/Dockerfile` | Multi-stage build handles Ruby gems, Node/pnpm assets, Alpine optimization -- hundreds of lines of battle-tested config |
| Reverse proxy + TLS | Nginx config, Let's Encrypt setup | Coolify's built-in Traefik | Coolify manages TLS certificates and routing automatically |
| Database initialization | Custom init scripts | `docker compose run --rm rails bundle exec rails db:chatwoot_prepare` | Chatwoot's built-in rake task handles migrations and seed data |
| Git SHA tracking | Custom build script | Chatwoot Dockerfile's `git rev-parse HEAD > /app/.git_sha` | Already built into the Dockerfile; works when `.git` is in build context (it is -- not in `.dockerignore`) |

## Common Pitfalls

### Pitfall 1: Coolify Build Context Empty

**What goes wrong:** Coolify Docker Compose build pack may fail with "no such file or directory" on COPY instructions if the build context path is misconfigured.
**Why it happens:** Known Coolify issue (#6002, reported June 2025, still open). The `context:` key in docker-compose must point to the correct path relative to where the compose file lives.
**How to avoid:** Set `context: .` (root of the repo) and `dockerfile: docker/Dockerfile`. Test the build locally first with `docker compose -f docker-compose.production.yaml build` before deploying to Coolify.
**Warning signs:** Build logs show "lstat ... no such file or directory" errors.

### Pitfall 2: Missing .git Directory in Build

**What goes wrong:** The Dockerfile runs `git rev-parse HEAD > /app/.git_sha` which fails if `.git` is not in the Docker build context.
**Why it happens:** If `.dockerignore` excluded `.git` (it does NOT in Chatwoot's case) or if the build context doesn't include the repo root.
**How to avoid:** Verify `.git` is NOT listed in `.dockerignore` (confirmed: it is not). Ensure `context: .` points to the repo root where `.git` exists.
**Warning signs:** Build error "fatal: not a git repository".

### Pitfall 3: Environment Variable Mismatch

**What goes wrong:** Chatwoot fails to start or behaves differently than the current (official image) setup.
**Why it happens:** The current Coolify setup has environment variables configured for the official image. Building from source requires the same variables but some may be set differently (e.g., `SECRET_KEY_BASE`, `FRONTEND_URL`, database credentials).
**How to avoid:** Export all current environment variables from the existing Coolify deployment before switching. Compare against `.env.example` in the repo. Key required vars: `SECRET_KEY_BASE`, `FRONTEND_URL`, `POSTGRES_*`, `REDIS_PASSWORD`, `RAILS_ENV=production`.
**Warning signs:** Rails boot errors, "missing secret_key_base" errors, database connection failures.

### Pitfall 4: First Build Takes Very Long

**What goes wrong:** Initial Docker build on Coolify takes 15-30+ minutes (gem compilation, asset precompilation).
**Why it happens:** No Docker layer cache on first build. Ruby native gems (like `pg`, `nokogiri`) compile from source on Alpine. Vite asset precompilation is CPU-intensive.
**How to avoid:** Accept this for the first build. Subsequent builds use Docker layer cache and are much faster. The Dockerfile's `NODE_OPTIONS="--max-old-space-size=4096"` requires at least 4GB RAM on the build server.
**Warning signs:** Build timeout on Coolify (check Coolify's timeout settings -- may need to increase for first build).

### Pitfall 5: Merge Conflicts on Upstream Sync

**What goes wrong:** Every upstream merge creates conflicts.
**Why it happens:** Too many files diverge from upstream.
**How to avoid:** Keep divergence to exactly 3-4 files. NEVER modify `Gemfile`, `package.json`, `db/schema.rb`, or the Dockerfile. The only modified file should be `docker-compose.production.yaml`. `UPSTREAM_DIFF.md` is new (no conflict). If future phases need sidebar changes (EMBED-02), document those as separate divergent files.
**Warning signs:** More than 4 files listed in `UPSTREAM_DIFF.md`.

## Code Examples

### Database Preparation (First Deploy)

```bash
# Source: https://developers.chatwoot.com/self-hosted/deployment/docker
# Run after first compose build, before starting services

docker compose -f docker-compose.production.yaml \
  run --rm rails bundle exec rails db:chatwoot_prepare
```

### Verifying the Build Locally

```bash
# Build the image
docker compose -f docker-compose.production.yaml build

# Start services
docker compose -f docker-compose.production.yaml up -d

# Verify health
curl -I http://localhost:3000/api  # Should return 200

# Check git SHA was captured
docker compose -f docker-compose.production.yaml exec rails cat /app/.git_sha
```

### UPSTREAM_DIFF.md Template

```markdown
# Upstream Diff

**Fork base:** chatwoot/chatwoot v4.12.1
**Last upstream sync:** YYYY-MM-DD
**Upstream version synced to:** vX.X.X

## Divergent Files

| File | Type | Purpose | Merge Risk |
|------|------|---------|------------|
| `docker-compose.production.yaml` | Modified | Build from source instead of pulling image | LOW -- only `build:` vs `image:` differs |
| `UPSTREAM_DIFF.md` | New | Documents fork divergence | NONE -- does not exist upstream |

## Sync Procedure

1. `git fetch upstream --tags`
2. `git checkout custom`
3. `git merge vX.X.X`
4. Resolve conflicts in files listed above
5. `docker compose -f docker-compose.production.yaml build`
6. Test locally or in staging
7. Push to trigger Coolify redeploy

## What NOT to Change

- `docker/Dockerfile` -- use upstream as-is
- `Gemfile` / `Gemfile.lock` -- upstream manages dependencies
- `package.json` / `pnpm-lock.yaml` -- upstream manages frontend deps
- `db/schema.rb` -- upstream manages database schema
- `app/` source code -- until absolutely necessary (Phase 5 sidebar may add 1-2 files)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Webpacker for assets | Vite 5.x | Chatwoot ~4.x (2024) | Dockerfile already uses Vite. No Webpacker remnants to worry about. |
| `docker-compose` (v1 command) | `docker compose` (v2 plugin) | Docker Compose v2 (2023) | Use `docker compose` (space, not hyphen) in all documentation |
| Ruby 3.3.x | Ruby 3.4.4 | Chatwoot develop branch (2025) | Dockerfile base image is `ruby:3.4.4-alpine3.21` |
| Node 20/22 | Node 24.x | Chatwoot package.json engines (2025-2026) | Build requires Node 24; Dockerfile uses `node:24-alpine` |
| PostgreSQL without vectors | pgvector/pgvector:pg16 | Chatwoot ~4.x | Fork must use pgvector image, not plain postgres |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Git | Fork creation, upstream sync | Yes | 2.50.1 | -- |
| Docker | Local build testing | No | -- | Build on Coolify directly; skip local testing |
| gh CLI | GitHub fork creation | No | -- | Create fork via GitHub web UI |
| Coolify | Production deployment | Yes (remote) | 4.x (assumed) | -- |

**Missing dependencies with no fallback:**
- None -- all critical operations happen on Coolify (remote) or GitHub (web UI)

**Missing dependencies with fallback:**
- Docker not installed locally -- builds happen on Coolify server. Local testing is optional.
- gh CLI not installed -- fork creation and repo management done via GitHub web interface.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual validation (infrastructure phase -- no unit tests) |
| Config file | N/A |
| Quick run command | `curl -I https://<domain>/api` (returns 200) |
| Full suite command | `curl -I https://<domain>/api && curl -s https://<domain>/auth/sign_in` (pages load) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORK-01 | Fork repo exists with build-from-source compose | manual | `git remote -v` shows upstream and origin | N/A |
| FORK-02 | Chatwoot fork deployed and functional on Coolify | smoke | `curl -I https://<domain>/api` returns 200 | N/A |
| FORK-03 | Only 3-4 files differ from upstream | manual | `git diff --stat v4.12.1..custom` shows <=4 files | N/A |
| FORK-04 | Upstream sync procedure works | manual | Follow UPSTREAM_DIFF.md procedure, verify no errors | N/A |

### Sampling Rate

- **Per task commit:** Verify `docker-compose.production.yaml` syntax with `docker compose -f docker-compose.production.yaml config` (if Docker available)
- **Per wave merge:** Full deploy to Coolify, verify Chatwoot loads
- **Phase gate:** Chatwoot accessible via assigned domain, login works, conversations functional

### Wave 0 Gaps

None -- this is an infrastructure phase with manual validation only. No test framework needed.

## Open Questions

1. **Current Coolify environment variables**
   - What we know: Chatwoot on Coolify needs `SECRET_KEY_BASE`, `FRONTEND_URL`, `POSTGRES_*`, `REDIS_PASSWORD`, etc.
   - What's unclear: The exact current configuration in the user's Coolify instance.
   - Recommendation: Export current env vars from Coolify before making any changes. Use them verbatim in the new compose stack.

2. **Coolify build timeout**
   - What we know: First build of Chatwoot from source can take 15-30 min.
   - What's unclear: Coolify's default build timeout and the server's available RAM/CPU.
   - Recommendation: Check Coolify build timeout settings. Ensure build server has at least 4GB RAM (required by `NODE_OPTIONS="--max-old-space-size=4096"`).

3. **Current Chatwoot version in production**
   - What we know: Latest stable is v4.12.1 (March 2026).
   - What's unclear: Which version the user's current Coolify instance runs.
   - Recommendation: Check current version before forking. Fork from the same version to ensure identical behavior, then optionally upgrade later.

## Sources

### Primary (HIGH confidence)
- [Chatwoot Dockerfile](https://github.com/chatwoot/chatwoot/blob/develop/docker/Dockerfile) - Multi-stage build, Ruby 3.4.4, Node 24, pnpm 10.2.0
- [Chatwoot production docker-compose](https://github.com/chatwoot/chatwoot/blob/develop/docker-compose.production.yaml) - 4-service setup (rails, sidekiq, postgres, redis)
- [Chatwoot .dockerignore](https://github.com/chatwoot/chatwoot/blob/develop/.dockerignore) - `.git` NOT excluded (build can access git history)
- [Coolify Docker Compose docs](https://coolify.io/docs/knowledge-base/docker/compose) - Domain assignment, env vars, network config
- [Coolify Docker Compose build pack](https://coolify.io/docs/applications/build-packs/docker-compose) - Git repo source, build context, build args
- [Chatwoot Docker deployment guide](https://developers.chatwoot.com/self-hosted/deployment/docker) - db:chatwoot_prepare, prerequisites
- [Chatwoot releases](https://github.com/chatwoot/chatwoot/releases) - v4.12.1 latest stable (March 2026)

### Secondary (MEDIUM confidence)
- [GitHub fork management strategies](https://github.blog/developer-skills/github/friend-zone-strategies-friendly-fork-management/) - Traditional merge recommended for small teams
- [Chatwoot Coolify template](https://github.com/fullhouseit/chatwoot-coolify-template) - Community compose template with active storage support
- [Coolify Chatwoot service page](https://coolify.io/docs/services/chatwoot) - One-click service exists but is limited

### Tertiary (LOW confidence)
- [Coolify build context issue #6002](https://github.com/coollabsio/coolify/issues/6002) - Open issue about empty build context; may affect builds. Needs validation on actual Coolify version in use.
- [Chatwoot env vars docs](https://developers.chatwoot.com/self-hosted/configuration/environment-variables) - Full list available but not verified against current Coolify setup

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified from upstream Chatwoot source files and Docker Hub
- Architecture: HIGH - Docker Compose build-from-source is well-documented and the Coolify build pack supports it
- Pitfalls: MEDIUM - Coolify build context issue (#6002) is unresolved but may not affect this setup; build time concerns are based on community reports
- Fork strategy: HIGH - Traditional merge is GitHub's recommended approach for small teams managing friendly forks

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days -- Chatwoot releases monthly on the 15th; new release may change recommended base tag)
