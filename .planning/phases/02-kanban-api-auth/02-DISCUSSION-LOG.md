# Phase 2: Kanban API & Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 02-kanban-api-auth
**Areas discussed:** Modelo de dados, Estrutura do JWT, Design da API REST, Stages padrao

---

## Modelo de Dados

| Option | Description | Selected |
|--------|-------------|----------|
| Lixeira (soft delete) | Card fica oculto mas pode ser recuperado | ✓ |
| Deletar de vez | Card removido permanentemente | |

**User's choice:** Lixeira (soft delete)
**Notes:** Campo `deleted_at` nullable

---

| Option | Description | Selected |
|--------|-------------|----------|
| So nome do contato | Minimo possivel, rapido de criar | ✓ |
| Nome + estagio | Usuario escolhe coluna ao criar | |
| Nome + canal + agente | Exige mais informacoes | |

**User's choice:** So nome do contato
**Notes:** Card vai automaticamente para o primeiro estagio

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, campo opcional | Cards do n8n tem link, manuais nao precisam | ✓ |
| Sim, campo obrigatorio | Todo card precisa de conversa vinculada | |

**User's choice:** conversation_id opcional
**Notes:** None

---

## Estrutura do JWT

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, incluir role | API sabe se usuario e admin ou agente | ✓ |
| Nao, so user_id + account_id | Mais simples mas sem controle de permissao | |

**User's choice:** Incluir role no JWT
**Notes:** Role extraida do Chatwoot via /api/v1/profile

---

| Option | Description | Selected |
|--------|-------------|----------|
| Re-autenticar silenciosamente | Frontend usa token Chatwoot pra renovar JWT | ✓ |
| Pedir login novamente | Redireciona pro Chatwoot | |

**User's choice:** Re-autenticacao silenciosa
**Notes:** Sem refresh token, re-autentica via token Chatwoot

---

## Design da API REST

| Option | Description | Selected |
|--------|-------------|----------|
| Rotas aninhadas | /api/v1/stages/:id/cards | ✓ |
| Rotas planas | /api/v1/cards?stage_id=123 | |

**User's choice:** Rotas aninhadas
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, /api/v1 | Permite evolucao sem quebrar | ✓ |
| Nao, sem versao | Mais simples | |

**User's choice:** Versionamento /api/v1
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor | Usa marcador, mais eficiente | ✓ |
| Offset/page | Paginacao classica | |

**User's choice:** Paginacao por cursor
**Notes:** None

---

## Stages Padrao

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, com defaults | Board ja vem com colunas prontas | ✓ |
| Nao, comecar vazio | Admin cria cada estagio | |

**User's choice:** Sim, com defaults
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline de vendas | Prospeccao → Qualificado → Proposta → Negociacao → Fechado Ganho → Perdido | ✓ |
| Pipeline simples | Novo → Em andamento → Concluido | |
| Pipeline de atendimento | Primeiro Contato → Aguardando → Em Atendimento → Resolvido | |

**User's choice:** Pipeline de vendas classico
**Notes:** Admin pode personalizar depois

---

## Claude's Discretion

- Formato de resposta de erro
- Schema Prisma detalhado
- Rate limiting
- Estrutura de pastas
- Estrategia de testes

## Deferred Ideas

None — discussion stayed within phase scope
