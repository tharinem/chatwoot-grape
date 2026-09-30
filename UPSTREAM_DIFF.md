# Diferenças do fork Grape em relação ao Chatwoot

**Base upstream:** chatwoot/chatwoot **v4.18.0** (tag `v4.18.0`, commit `9f920b549`)
**Última sincronização:** 2026-09-28
**Edição:** só a parte MIT. `enterprise/` fica fora da imagem (`.dockerignore` + passo na CI)
e `DISABLE_ENTERPRISE=true` no compose.
**Como atualizar:** [`docs/UPGRADE.md`](docs/UPGRADE.md). O workflow `upstream-sync.yml` abre
o PR de atualização toda segunda.

Conferência rápida: `git diff upstream/v4.18.0 HEAD --stat` deve listar só os arquivos abaixo
(mais `.planning/`, que é documentação interna).

Legenda de risco no merge: **núcleo** = arquivo do Chatwoot que o upstream mexe com
frequência (conflito provável); **isolado** = arquivo só nosso ou que o upstream quase
não toca.

## 1. Marca Grape (cor `#7B5EA7`, nome, logos)

| Arquivo | O que muda | Risco |
|---|---|---|
| `config/installation_config.yml` | Defaults de nome, logos, URLs de marca/termos/privacidade | núcleo |
| `theme/colors.js` | Escala `woot` em violeta e `brand: '#7B5EA7'` | núcleo |
| `app/javascript/dashboard/assets/scss/_next-colors.scss` | Tokens de acento em violeta | núcleo |
| `app/views/layouts/vueapp.html.erb` | Cor do tema/tile e ícones via `LOGO_THUMBNAIL` | núcleo |
| `public/manifest.json` | Nome "Grape Ai" e cores | isolado |
| `app/javascript/sdk/sdk.css` | Cor da bolha do widget | isolado |
| `app/javascript/widget/components/ChatInputWrap.vue` | Cor de foco padrão do widget | núcleo |
| `app/models/portal.rb` | `DEFAULT_COLOR` do Help Center | núcleo |
| `app/javascript/dashboard/components-next/icon/Logo.vue`, `app/javascript/dashboard/assets/images/bubble-logo.svg`, `app/javascript/widget/assets/images/logo.svg` | Cor do logo | isolado |
| `app/assets/stylesheets/administrate/{library,utilities}/_variables.scss` | Cor do Super Admin | isolado |
| `app/javascript/v3/views/login/Index.vue` | Login só com o logo (sem título), logo maior | núcleo |
| `app/javascript/dashboard/i18n/locale/{en,pt_BR}/login.json` | Texto do título de login | núcleo |
| `public/*.png`, `public/brand-assets/grape-*.png` | Favicons e logos da Grape | isolado |

Não existe mais branding forçado (initializer, rake, entrypoint, callback no model). O
branding é só default; instalação existente aplica uma vez com o comando de `docs/UPGRADE.md`.

## 2. CRM (Kanban) na sidebar

| Arquivo | O que muda | Risco |
|---|---|---|
| `app/javascript/dashboard/components-next/sidebar/Sidebar.vue` | Item "Kanban" no menu | núcleo |
| `app/javascript/dashboard/routes/dashboard/dashboard.routes.js` | Registra as rotas do kanban | núcleo |
| `app/javascript/dashboard/routes/dashboard/kanban/*` | Página com iframe para `https://grape-studio.vercel.app/crm?account_id=<id>` | isolado |
| `app/javascript/dashboard/i18n/locale/{en,pt_BR}/settings.json` | Chave `SIDEBAR.KANBAN` | núcleo |

O backend do kanban saiu deste repositório (vive no Grape Studio). Nenhum token vai na URL;
o SSO será uma troca de código de uso único implementada no Studio.

## 3. WhatsApp: coexistência (agenda e histórico do app viram `cliente_antigo`)

| Arquivo | O que muda | Risco |
|---|---|---|
| `app/jobs/webhooks/whatsapp_events_job.rb` | `process_events` desvia `smb_app_state_sync`/`history` para o serviço abaixo | **núcleo** |
| `app/services/whatsapp/facebook_api_client.rb` | `WEBHOOK_DEFAULT_FIELDS` inclui `smb_app_state_sync` e `history` | **núcleo** |
| `app/services/whatsapp/webhook_setup_service.rb` | Lista de campos vem de `WEBHOOK_DEFAULT_FIELDS` | **núcleo** |
| `app/services/whatsapp/coexistence_sync_service.rb` | Serviço novo (grava chunks brutos em `storage/` e marca contatos) | isolado |
| `spec/services/whatsapp/coexistence_sync_service_spec.rb` | Spec do serviço | isolado |
| `spec/services/whatsapp/{facebook_api_client,webhook_setup_service}_spec.rb` | Esperam os 4 campos | núcleo |

## 4. Patch de segurança (commit `6dc793a68`)

| Arquivo | O que muda | Risco |
|---|---|---|
| `app/models/account.rb` | `remove_account_sequences` com id citado (`connection.quote`) | núcleo |
| `app/models/article.rb` | Contador de views atômico (`update_all('views = COALESCE(views, 0) + 1')`) | núcleo |
| `app/jobs/hook_job.rb` | Erro vai para `ChatwootExceptionTracker` em vez de só log | núcleo |

As partes de frontend do patch (`v-html` sem sanitizar em `MessageList.vue`,
`ScenariosCard.vue`, `Signup/Form.vue`) foram descartadas: a v4.18 já sanitiza esses pontos.
Quando o upstream corrigir os três itens acima, descarte o patch no merge.

## 5. Deploy, CI e licença

| Arquivo | O que muda | Risco |
|---|---|---|
| `docker-compose.yaml`, `docker-compose.production.yaml` | Build a partir do código, variáveis no formato do Coolify, healthchecks, `db:chatwoot_prepare` no start, `DISABLE_ENTERPRISE=true` | isolado |
| `docker-compose.test.yaml` | Sem `NODE_ENV`/`RAILS_ENV` fixos (conflito no Coolify) | isolado |
| `.dockerignore` | Exclui `enterprise/` e `spec/enterprise/` da imagem | isolado |
| `.github/workflows/publish_custom_docker.yml` | Imagem `ghcr.io/tharinem/chatwoot-grape` com tags `:custom` e `:<versão>-grape-<sha>` | isolado |
| `.github/workflows/upstream-sync.yml` | PR semanal de atualização do upstream | isolado |

`docker/Dockerfile` é o do upstream, sem alteração.

## 6. Documentação

`UPSTREAM_DIFF.md` (este arquivo), `docs/UPGRADE.md` e `.planning/` (planejamento interno).
