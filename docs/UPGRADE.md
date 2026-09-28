# Runbook de atualização do Chatwoot da Grape

Este é o passo a passo para trazer uma versão nova do Chatwoot (upstream) para o fork da
Grape (`tharinem/chatwoot-grape`, branch `custom`) e colocar em produção sem susto.
A lista de patches da Grape que precisam sobreviver a cada merge está em
[`UPSTREAM_DIFF.md`](../UPSTREAM_DIFF.md).

## Cadência

- **Release minor** (`v4.X.0`): atualizar de 1 a 2 semanas depois da publicação. Esse
  intervalo deixa sair o primeiro patch (`v4.X.1`) com as correções da comunidade.
- **Correção de segurança** (advisory do GitHub, release com "security"/"CVE"): em até
  **72 horas**.
- O workflow `.github/workflows/upstream-sync.yml` roda toda segunda às 09:00 UTC e abre
  um PR `upgrade/<tag>` para a `custom` sempre que existir uma release nova. Ele pode ser
  disparado à mão em Actions > Upstream sync > Run workflow.
  - Merge limpo: PR normal, pronto para revisar.
  - Conflito: PR em rascunho com a lista de arquivos em conflito. Resolva à mão (seção
    "Resolver conflitos" abaixo).
  - Requisitos do repositório: em Settings > Actions > General, marcar "Allow GitHub
    Actions to create and approve pull requests". Quando a release do upstream mexe em
    `.github/workflows/`, o `GITHUB_TOKEN` não consegue enviar a branch; para esses casos
    crie o secret `UPSTREAM_SYNC_TOKEN` (PAT fine-grained com Contents, Pull requests e
    Workflows de escrita neste repositório).

## Resolver conflitos

```bash
git fetch origin
git checkout upgrade/vX.Y.Z            # branch aberta pelo workflow
git fetch https://github.com/chatwoot/chatwoot 'refs/tags/vX.Y.Z:refs/tags/upstream/vX.Y.Z' --no-tags
git merge --no-ff upstream/vX.Y.Z
git diff --name-only --diff-filter=U   # lista o que falta resolver
```

Regra: **fica o comportamento do upstream + a intenção do patch da Grape**. Para cada
arquivo em conflito, abra a linha dele no `UPSTREAM_DIFF.md` e reaplique só a intenção.
Se o upstream já corrigiu o que o patch fazia, descarte o patch e tire a linha do
`UPSTREAM_DIFF.md`. Nunca use force-push; o merge é um commit novo.

Depois de resolver:

```bash
git diff upstream/vX.Y.Z HEAD --stat   # deve mostrar só os arquivos do UPSTREAM_DIFF.md
git push origin upgrade/vX.Y.Z
```

## Passo a passo do deploy

1. **Ler as notas da release** de todas as versões entre a atual e a nova
   (https://github.com/chatwoot/chatwoot/releases). Procurar migrations pesadas, variáveis
   de ambiente novas e mudanças de webhook/API.
2. **Staging no Coolify** com uma **cópia do banco de produção** (restaurar o último
   `pg_dump` num Postgres separado; nunca apontar staging para o banco de prod).
3. Subir a imagem nova em staging e rodar o **checklist de smoke** (abaixo) inteiro.
4. **Backup de produção**, logo antes da janela:
   ```bash
   pg_dump -Fc -h <host> -U <usuario> -d chatwoot > chatwoot-$(date +%F-%H%M).dump
   ```
   Anote também a tag da imagem que está no ar (ex.: `ghcr.io/tharinem/chatwoot-grape:4.12.1-grape-0bb39c7`).
5. **Parar o Sidekiq** de produção (evita jobs rodando contra schema pela metade).
6. **Migrations num container avulso** com a imagem nova:
   ```bash
   bundle exec rails db:chatwoot_prepare
   ```
7. **Subir web + Sidekiq** com a imagem nova, fixada pela tag imutável
   `:<versão>-grape-<sha curto>` (a CI publica essa tag e a `:custom`; não existe mais `:latest`).
8. **Smoke em produção** (checklist abaixo).
9. **Rollback**, se algo falhar: voltar a tag da imagem no Coolify para a anterior e
   reiniciar web + Sidekiq. Se a versão nova rodou migration que quebra a antiga, restaurar
   o dump do passo 4 (`pg_restore --clean -d chatwoot chatwoot-<data>.dump`) antes de subir a
   imagem antiga.

## Mudanças que quebram, de 4.12 para 4.18 (conferir antes do primeiro upgrade)

- **SafeFetch bloqueia webhook para rede privada.** Desde a 4.14 os webhooks (conta,
  Agent Bot, canal API, automações) saem pelo `SafeFetch`, que recusa IP privado
  (10.x, 172.16-31.x, 192.168.x, localhost, nomes internos da rede Docker). Se o Chatwoot
  chama o Grape Studio pela rede interna do Coolify, defina
  `SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true` no web **e** no Sidekiq, ou use a URL pública
  (https) do Grape Studio. Sintoma: log `Invalid webhook URL ... UnsafeUrlError` e nenhuma
  chamada chegando no Studio.
- **Toggle `api_and_webhooks` por conta.** A 4.16 criou a feature `api_and_webhooks`; sem
  ela a API por token responde 403 e os webhooks da conta não saem. Na edição MIT (sem
  `enterprise/`), `Account#api_and_webhooks_enabled?` sempre devolve `true`, então a Grape
  não depende do toggle. Mesmo assim confira no smoke (se alguém voltar a ligar o
  enterprise, o toggle passa a valer).
- **Webhooks assinados para Agent Bot e canal API (desde a 4.13).** Quando o bot/inbox tem
  `secret`, cada chamada leva `X-Chatwoot-Timestamp` e
  `X-Chatwoot-Signature: sha256=HMAC_SHA256(secret, "<timestamp>.<corpo>")`. O Grape Studio
  deve validar a assinatura e rejeitar timestamp antigo. Bots criados antes da 4.13 podem
  estar sem secret: gere um e copie para o Studio.
- **Dyte virou Cloudflare RealtimeKit (4.16).** A integração de vídeo agora pede
  credenciais da Cloudflare (account id, app id, api token). A Grape não usa hoje; se
  alguém ligar, as credenciais antigas da Dyte não servem.
- **Edição MIT.** A partir desta versão a imagem da Grape é construída sem `enterprise/`
  (e com `DISABLE_ENTERPRISE=true`). Recursos pagos (Captain, SLA, papéis customizados,
  empresas, SAML, relatórios avançados) somem da interface. Veja "Antes de produção".

## Checklist de smoke

Marque cada item com evidência (print ou log). Vale para staging e para produção.

- [ ] Login funciona e a interface mostra a marca Grape (nome, logo, cor roxa).
- [ ] Sidekiq processando: Super Admin > Sidekiq sem fila crescendo nem jobs mortos novos.
- [ ] API e webhooks habilitados em **todas** as contas:
      `bundle exec rails runner "puts Account.all.reject(&:api_and_webhooks_enabled?).map(&:id).inspect"` devolve `[]`.
- [ ] Webhook chega no Grape Studio com `X-Chatwoot-Signature` válido e sem bloqueio do
      SafeFetch (log do Studio + ausência de `UnsafeUrlError` no log do Chatwoot).
- [ ] WhatsApp Cloud: mensagem de texto, anexo (imagem/PDF) e áudio entram e saem.
- [ ] Coexistência: mensagem enviada pelo app WhatsApp Business aparece como echo na
      conversa, e o sync de agenda/histórico marca contatos como `cliente_antigo`.
- [ ] Handoff: IA pausa e transfere para humano na inbox de teste, **no canal real**
      (não vale `/chat` do Studio).
- [ ] CRM abre na sidebar (item Kanban carrega `studio.grapeai.com.br/crm`).
- [ ] Widget do site com a cor da Grape.

## Branding em instalações existentes

O branding da Grape agora é só o **default** de `config/installation_config.yml`: ele vale
para instalações novas, mas não sobrescreve o que já está no banco. Numa instalação que
ainda mostra "Chatwoot", aplique uma vez:

```bash
bundle exec rails runner "{ 'INSTALLATION_NAME' => 'Grape Ai', 'BRAND_NAME' => 'Grape Ai', 'LOGO' => '/brand-assets/grape-logo-light.png', 'LOGO_DARK' => '/brand-assets/grape-logo-dark.png', 'LOGO_THUMBNAIL' => '/brand-assets/grape-thumbnail.png', 'BRAND_URL' => 'https://www.grapeai.com.br/', 'WIDGET_BRAND_URL' => 'https://www.grapeai.com.br/' }.each { |name, value| InstallationConfig.find_by!(name: name).update!(value: value) }"
```

## Antes de produção (primeira vez sem enterprise)

1. **Revisão jurídica.** Um advogado confirma que rodar só a parte MIT (sem `enterprise/`)
   resolve o risco de licença e que a marca "Grape Ai" no lugar de "Chatwoot" está dentro
   do que a licença MIT permite.
2. **Conferir que nada se perde.** As tabelas das funções enterprise continuam no banco
   (as migrations são do núcleo), mas a interface deixa de usá-las. Contar as linhas em
   produção antes de trocar a imagem:
   ```bash
   bundle exec rails runner "%w[companies sla_policies applied_slas custom_roles captain_assistants captain_documents captain_assistant_responses captain_scenarios captain_custom_tools captain_inboxes copilot_threads agent_capacity_policies account_saml_settings].each { |t| puts format('%-28s %s', t, ActiveRecord::Base.connection.select_value(%(SELECT COUNT(*) FROM #{t}))) }"
   ```
   Tudo zero: segue. Algum número acima de zero: decidir com a Tharine antes (exportar os
   dados ou manter a função por outro caminho).
