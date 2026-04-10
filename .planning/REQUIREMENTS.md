# Requirements: Chatwoot Custom (Fork)

**Defined:** 2026-04-09
**Core Value:** Clientes devem conseguir gerenciar leads em um pipeline Kanban visual, com cards criados automaticamente via n8n quando conversas chegam no Chatwoot — sem precisar alternar de ferramenta.

## v1 Requirements

### Fork & Deploy

- [ ] **FORK-01**: Repositório fork do Chatwoot no GitHub com Dockerfile customizado para build próprio
- [ ] **FORK-02**: Deploy do Chatwoot fork no Coolify funcionando identicamente ao setup atual (mesmo Docker Compose, mesmas variáveis)
- [ ] **FORK-03**: Divergência do upstream limitada a ~3-4 arquivos documentados em UPSTREAM_DIFF.md
- [ ] **FORK-04**: Procedimento documentado para sincronizar fork com upstream sem quebrar customizações

### Kanban Board

- [x] **KANB-01**: Usuário pode visualizar pipeline de leads como um board Kanban com colunas representando estágios
- [x] **KANB-02**: Usuário pode mover cards entre colunas via drag-and-drop
- [ ] **KANB-03**: Admin pode criar, renomear, reordenar e deletar estágios do pipeline por conta
- [ ] **KANB-04**: Card exibe nome do contato, canal de origem, data de entrada e agente responsável
- [ ] **KANB-05**: Card contém link direto para a conversa original no Chatwoot
- [ ] **KANB-06**: Usuário pode filtrar cards por agente atribuído (ex: "atribuídos a mim")
- [ ] **KANB-07**: Board exibe empty state claro quando não há cards com orientação de próximo passo
- [ ] **KANB-08**: Usuário pode criar um card manualmente no board (sem depender do n8n)

### API & Integração

- [x] **API-01**: API REST permite criar cards via POST com dados da conversa (usado pelo n8n)
- [x] **API-02**: Criação de card é idempotente — mesma conversation_id não gera card duplicado
- [x] **API-03**: API responde em menos de 100ms para webhooks do n8n (acknowledge rápido)
- [x] **API-04**: Documentação OpenAPI/Swagger auto-gerada e acessível via browser
- [x] **API-05**: API permite listar, atualizar e mover cards entre estágios

### Autenticação

- [x] **AUTH-01**: Usuário logado no Chatwoot acessa o Kanban sem segundo login (auth compartilhado)
- [x] **AUTH-02**: Token do Chatwoot é validado server-side via chamada à API do Chatwoot (/api/v1/profile)
- [x] **AUTH-03**: Kanban API emite JWT próprio de curta duração (1h) após validação — nunca persiste o token do Chatwoot
- [x] **AUTH-04**: Toda requisição à Kanban API é scoped ao account_id extraído do JWT

### Multi-Tenant

- [x] **TENANT-01**: Todas as queries de dados do Kanban filtram por account_id (enforced no middleware, não apenas na aplicação)
- [x] **TENANT-02**: Token de uma conta não pode acessar dados de outra conta (validação cross-tenant)
- [x] **TENANT-03**: Estágios do pipeline são configurados por conta — conta A e conta B têm pipelines independentes

### Embedding no Chatwoot

- [ ] **EMBED-01**: Kanban acessível como Dashboard App (iframe) dentro do painel de conversa do Chatwoot
- [ ] **EMBED-02**: Item no menu lateral do Chatwoot que abre o board Kanban completo (fork change mínimo)
- [ ] **EMBED-03**: Kanban também acessível via URL direta no domínio próprio (fora do Chatwoot)
- [ ] **EMBED-04**: Dashboard App recebe contexto da conversa via postMessage e mostra o card relevante

## v2 Requirements

### Pipeline Avançado

- **KANB-V2-01**: Indicador visual de envelhecimento do deal (card parado em estágio por X dias)
- **KANB-V2-02**: Log de atividades no card (criação, movimentação, reatribuição)
- **KANB-V2-03**: Painel de contexto da conversa no detalhe do card (última mensagem, dados do contato)
- **KANB-V2-04**: Contagem de cards e valor agregado por coluna nos headers
- **KANB-V2-05**: Campos customizados nos cards (valor do deal, empresa, etc.)
- **KANB-V2-06**: Múltiplos pipelines por conta (ex: vendas vs suporte)

### Real-Time & Notificações

- **RT-V2-01**: Atualizações em tempo real do board via WebSocket
- **RT-V2-02**: Notificações quando card é movido (via n8n, não nativo)

### Relatórios

- **REP-V2-01**: Dashboard com métricas de conversão por estágio
- **REP-V2-02**: Export de cards como CSV

## Out of Scope

| Feature | Reason |
|---------|--------|
| Sync bidirecional automática conversa ↔ card | Acoplamento rígido com internals do Chatwoot; n8n é a camada de automação |
| App mobile nativo | Web-first; layout responsivo cobre uso em tablet |
| Modificar schema do banco do Chatwoot | Cria conflitos de migração a cada upgrade do upstream |
| Sistema de login próprio | Usa auth do Chatwoot; dois logins = rejeição do usuário |
| Bulk actions (mover vários cards) | Complexidade UI alta para operação rara; endereçar no v2 |
| WIP limits por coluna | Feature de processo avançado; SMBs não usam; v2 se pedido |
| Kanban dentro do Rails (engine) | Microserviço separado evita fork hell |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FORK-01 | Phase 1 | Pending |
| FORK-02 | Phase 1 | Pending |
| FORK-03 | Phase 1 | Pending |
| FORK-04 | Phase 1 | Pending |
| KANB-01 | Phase 4 | Complete |
| KANB-02 | Phase 4 | Complete |
| KANB-03 | Phase 4 | Pending |
| KANB-04 | Phase 4 | Pending |
| KANB-05 | Phase 4 | Pending |
| KANB-06 | Phase 4 | Pending |
| KANB-07 | Phase 4 | Pending |
| KANB-08 | Phase 4 | Pending |
| API-01 | Phase 3 | Complete |
| API-02 | Phase 3 | Complete |
| API-03 | Phase 3 | Complete |
| API-04 | Phase 2 | Complete |
| API-05 | Phase 2 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| TENANT-01 | Phase 2 | Complete |
| TENANT-02 | Phase 2 | Complete |
| TENANT-03 | Phase 2 | Complete |
| EMBED-01 | Phase 5 | Pending |
| EMBED-02 | Phase 5 | Pending |
| EMBED-03 | Phase 5 | Pending |
| EMBED-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-10 after Phase 03 completion*
