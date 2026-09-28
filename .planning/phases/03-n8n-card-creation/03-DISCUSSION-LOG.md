# Phase 3: n8n Card Creation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-n8n-card-creation
**Areas discussed:** Autenticação do webhook, Endpoint e rota do webhook, Estratégia de idempotência, Resposta rápida (<100ms)

---

## Autenticação do Webhook

| Option | Description | Selected |
|--------|-------------|----------|
| API Key dedicada | Gerar API key por conta, header x-api-key. Simples para server-to-server | ✓ |
| JWT via token Chatwoot | n8n faz token exchange antes de cada request. Mais seguro, mais complexo | |
| Token fixo no .env | Token único compartilhado por todas as contas. Simples mas sem isolamento | |

**User's choice:** API Key dedicada
**Notes:** Nenhuma nota adicional

### Follow-up: Quem gera/revoga API keys?

| Option | Description | Selected |
|--------|-------------|----------|
| Admin gera via API | Endpoint REST para criar/revogar. Múltiplas keys possível | |
| Gerada automaticamente | Key criada no seed/primeiro login. Admin pode regenerar | ✓ |
| Você decide | Claude escolhe | |

**User's choice:** Gerada automaticamente
**Notes:** Perguntou a diferença antes de decidir. Explicação sobre conveniência vs flexibilidade levou à escolha.

---

## Endpoint e Rota do Webhook

| Option | Description | Selected |
|--------|-------------|----------|
| Rota dedicada | POST /api/v1/webhooks/chatwoot — endpoint específico para n8n | ✓ |
| Reutilizar POST existente | n8n usa o mesmo POST /stages/:stageId/cards | |
| Você decide | Claude escolhe | |

**User's choice:** Rota dedicada (via free text)
**Notes:** Usuária explicou que ela mesma monta os workflows do n8n para cada cliente, com nodes para criar e atualizar o CRM. Confirmou que rota dedicada se alinha com esse fluxo.

### Follow-up: Payload do webhook

| Option | Description | Selected |
|--------|-------------|----------|
| Dados básicos | contact_name, conversation_id, channel_type, assignee_id | |
| Dados básicos + extras | Acima + telefone, email, URL da conversa | ✓ |
| Você decide | Claude define | |

**User's choice:** Dados básicos + extras

---

## Estratégia de Idempotência

| Option | Description | Selected |
|--------|-------------|----------|
| Unique constraint + upsert | Unique index (account_id, conversation_id). Garantia a nível de banco | ✓ |
| Check antes de inserir | Busca antes de criar. Simples mas tem race condition | |
| Você decide | Claude escolhe | |

**User's choice:** Unique constraint + upsert

### Follow-up: Comportamento em duplicata

| Option | Description | Selected |
|--------|-------------|----------|
| Retorna existente sem alterar | 201 primeira vez, 200 depois. Card não é modificado | ✓ |
| Atualiza campos se mudaram | Upsert completo — pode sobrescrever edições manuais | |
| Você decide | Claude escolhe | |

**User's choice:** Retorna existente sem alterar
**Notes:** Usuária comentou que o comportamento de atualização será definido no fluxo do n8n. Seguiu o recomendado para a API.

---

## Resposta Rápida (<100ms)

| Option | Description | Selected |
|--------|-------------|----------|
| Síncrono direto | INSERT/upsert direto ~5-20ms. Sem fila | |
| Async com fila | 202 Accepted + BullMQ background processing | ✓ |
| Você decide | Claude escolhe | |

**User's choice:** Async com fila

### Follow-up: Redis para BullMQ

| Option | Description | Selected |
|--------|-------------|----------|
| Redis existente | Usa Redis do stack com DB number separado | ✓ |
| Redis separado | Container Redis dedicado para filas | |

**User's choice:** Redis existente
**Notes:** Pediu explicação da diferença. Após entender que o volume v1 é baixo e DB number separado evita conflito, escolheu Redis existente.

---

## Claude's Discretion

- Estrutura do worker BullMQ (retry, concurrency)
- Hash algorithm para API keys
- Formato da resposta 202
- Campos extras como custom_fields vs colunas dedicadas

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
