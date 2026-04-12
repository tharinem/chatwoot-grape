# Chatwoot Custom (Fork)

## What This Is

Fork do Chatwoot open-source hospedado no Coolify, com módulos personalizados integrados ao menu lateral. O objetivo é oferecer como produto SaaS para outros negócios — cada cliente usa a plataforma com os módulos extras que o Chatwoot original não oferece. O primeiro módulo é um Kanban de CRM (pipeline de leads) acessível direto do Chatwoot.

## Core Value

Clientes devem conseguir gerenciar leads em um pipeline Kanban visual, com cards criados automaticamente via n8n quando conversas chegam no Chatwoot — sem precisar alternar de ferramenta.

## Requirements

### Validated

- [x] API REST própria para criação e gestão de cards (usada pelo n8n) — Validated in Phase 02: kanban-api-auth
- [x] Autenticação compartilhada — usuário logado no Chatwoot acessa os módulos sem novo login — Validated in Phase 02: kanban-api-auth (token exchange flow)
- [x] Colunas/estágios do pipeline configuráveis por conta — Validated in Phase 02: kanban-api-auth (stages CRUD with tenant isolation)
- [x] Endpoint para criação de card via n8n quando nova conversa chega no Chatwoot — Validated in Phase 03: n8n-card-creation (webhook + BullMQ worker)
- [x] Idempotência na criação de cards (mesmo conversation_id não duplica) — Validated in Phase 03: n8n-card-creation (upsert com unique constraint)
- [x] Resposta rápida ao webhook (<100ms) com processamento assíncrono — Validated in Phase 03: n8n-card-creation (202 Accepted + BullMQ)

### Active

#### Fork e Deploy
- [x] Fork do Chatwoot no GitHub com Dockerfile customizado para build próprio — Validated in Phase 01: GitHub Actions CI/CD builds from custom branch and pushes to GHCR
- [x] Deploy via Coolify apontando para o repositório fork (não a imagem oficial) — Validated in Phase 01: Coolify compose uses ghcr.io/tharinem/chatwoot-grape:custom
- [x] Coolify configura variáveis de ambiente idênticas ao setup atual — Validated in Phase 01: same env vars preserved in compose

#### Módulo Kanban (CRM Pipeline)
- [ ] Aplicação separada (próprio domínio/serviço) acessível a partir do menu lateral do Chatwoot
- [ ] API REST própria para criação e gestão de cards (usada pelo n8n)
- [ ] Endpoint para criação de card via n8n quando nova conversa chega no Chatwoot
- [ ] Colunas/estágios do pipeline configuráveis por conta (ex: Prospecção → Qualificado → Proposta → Fechado)
- [ ] Usuário pode mover cards entre colunas (drag-and-drop)
- [ ] Card exibe: nome do contato, canal de origem, data de entrada, agente responsável
- [ ] Link de volta para a conversa original no Chatwoot

#### Integração Chatwoot ↔ Módulos
- [x] Item no menu lateral do Chatwoot que abre o Kanban (iframe ou redirect) — Validated in Phase 05: sidebar menu item + iframe embedding at /accounts/:id/kanban
- [ ] Autenticação compartilhada — usuário logado no Chatwoot acessa os módulos sem novo login

### Out of Scope

- Substituir o Chatwoot por sistema próprio de conversas — o core de atendimento permanece o Chatwoot original
- Sincronização bidirecional automática de status entre conversa e card Kanban — feita via n8n, não hard-coded
- App mobile — foco em web first

## Context

- **Stack atual**: Chatwoot (Rails + Vue.js) rodando no Coolify via Docker Compose com Postgres, Redis e Sidekiq
- **Docker Compose fornecido**: inclui serviços `chatwoot`, `sidekiq`, `postgres`, `redis` — base para o deploy customizado
- **Automação**: n8n já está no stack do usuário e será usado para criar cards no Kanban via webhook/API quando conversas chegarem
- **Repositório upstream**: https://github.com/chatwoot/chatwoot
- **Módulos futuros planejados**: Relatórios personalizados, Agenda/calendário, Base de conhecimento
- **Usuários finais**: Clientes SaaS (outras empresas) — multi-tenant por design

## Constraints

- **Deploy**: Coolify — todos os serviços devem ser gerenciáveis via Coolify (Docker Compose ou Dockerfile)
- **Fork strategy**: Mínimo de divergência do upstream Chatwoot para facilitar merges futuros
- **Autenticação**: Usar o sistema de auth do Chatwoot (não criar um segundo sistema de login)
- **Multi-tenant**: Kanban e módulos futuros devem ser isolados por `account_id` do Chatwoot

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Módulos como apps separados com iframe no Chatwoot | Permite deploy independente, minimiza mudanças no fork, facilita sync com upstream | — Pending |
| n8n cria cards via API (não integração nativa) | Flexibilidade sem tight-coupling — o usuário já usa n8n e conhece a ferramenta | — Pending |
| Fork mínimo do Chatwoot (só adicionar menu items) | Menos conflitos ao puxar updates do upstream; módulos vivem fora do core | — Pending |

## Evolution

Este documento evolui a cada transição de fase e marco de milestone.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after Phase 01 and Phase 05 (partial) completion*
