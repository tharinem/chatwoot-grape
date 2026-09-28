# Phase 4: Kanban Frontend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 04-kanban-frontend
**Areas discussed:** Design dos cards, Drag-and-drop e interacoes, Gestao de estagios pelo admin, Filtros e empty states

---

## Design dos Cards

### Estilo de card

| Option | Description | Selected |
|--------|-------------|----------|
| Compacto | 1-2 linhas: nome + canal. Hover/click expande. | ✓ |
| Detalhado | 3-4 linhas: nome, canal, agente, data, link. | |
| Minimo | Apenas nome do contato. | |

**User's choice:** Compacto, mas com configuracao estilo Notion para escolher campos visiveis.
**Notes:** Usuario quer flexibilidade — quem quer compacto deixa compacto, quem quer detalhado personaliza.

### Configuracao de campos

| Option | Description | Selected |
|--------|-------------|----------|
| Menu no header da coluna | Dropdown com toggles dos campos | ✓ |
| Settings page separada | Pagina de configuracoes do board | |
| Claude decide | | |

**User's choice:** Menu no header da coluna

### Acao ao clicar no card

| Option | Description | Selected |
|--------|-------------|----------|
| Painel lateral | Slide-in pela direita, board visivel | ✓ |
| Modal centralizado | Dialog com board escurecido | |
| Pagina dedicada | Navega para /cards/:id | |

**User's choice:** Painel lateral como default, com opcao de expandir para modal ou pagina completa — estilo Notion.

---

## Drag-and-drop e Interacoes

### Experiencia de drag-and-drop

| Option | Description | Selected |
|--------|-------------|----------|
| Fluido com animacao | Sombra, highlight, espaco suave | ✓ |
| Simples e direto | Drag basico sem animacoes | |
| Claude decide | | |

**User's choice:** Fluido com animacao

### Confirmacao ao mover

| Option | Description | Selected |
|--------|-------------|----------|
| Sem confirmacao | Drop imediato, rollback se falhar | ✓ |
| Toast com undo | Move + toast com desfazer por 5s | |
| Confirmacao previa | Dialog antes de efetivar | |

**User's choice:** Sem confirmacao

### Suporte mobile

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop-first | Scroll horizontal basico em mobile | ✓ |
| Responsivo completo | Colunas empilhadas, touch nativo | |
| Apenas desktop | Aviso 'Use no computador' | |

**User's choice:** Desktop-first (alinhado com padrao Chatwoot)
**Notes:** Usuario perguntou se Chatwoot e responsivo — sim, basico. Seguir mesmo padrao.

---

## Gestao de Estagios pelo Admin

### Como gerenciar estagios

| Option | Description | Selected |
|--------|-------------|----------|
| Inline no board | Rename, +, menu ... direto no board | ✓ |
| Modal de configuracao | Botao abre modal com lista | |
| Pagina de settings | Secao dedicada em /settings | |

**User's choice:** Inline no board

### Deletar estagio com cards

| Option | Description | Selected |
|--------|-------------|----------|
| Move cards para outra coluna | Pede destino antes de deletar | ✓ |
| Bloqueia delecao | Nao permite se tem cards | |
| Claude decide | | |

**User's choice:** Move cards para outra coluna

---

## Filtros e Empty States

### Filtragem por agente

| Option | Description | Selected |
|--------|-------------|----------|
| Barra de filtros no topo | Dropdown Agente no header | ✓ (expandido) |
| Sidebar com filtros | Painel lateral avancado | |
| Tabs por visao | Tabs Todos / Meus | |

**User's choice:** Barra de filtros no topo, mas com mais opcoes: Agente, Canal, Data de entrada.
**Notes:** Atalho rapido "Atribuidos a mim" como botao destacado.

### Empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Ilustracao + CTA | Mensagem + botao criar + texto automacao | ✓ (ajustado) |
| Colunas vazias visiveis | Colunas normais sem cards | |
| Claude decide | | |

**User's choice:** Mensagem "Nenhum lead ainda" + botao criar + texto sobre automacao (NAO mencionar n8n).
**Notes:** n8n e detalhe tecnico, nao deve aparecer em textos user-facing.

### Criacao manual de card

| Option | Description | Selected |
|--------|-------------|----------|
| Botao + na coluna | + no header de cada coluna | |
| Botao global no header | Botao "Novo card" no header do board | |
| Ambos | + na coluna E botao global | ✓ |

**User's choice:** Ambos — dois pontos de entrada para criacao.

---

## Claude's Discretion

- Biblioteca de drag-and-drop
- Estrutura de pastas Vue 3
- Biblioteca de componentes UI
- State management
- Formato do formulario de criacao

## Deferred Ideas

None — discussion stayed within phase scope
