<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEventListener } from '@vueuse/core';
import { useMapGetter } from 'dashboard/composables/store';

// O CRM (kanban) vive no Grape Studio. Só o account_id vai na URL. O acesso vai
// por postMessage: o CRM avisa "grape-crm:ready" e respondemos com o token do
// usuário, só para a origem exata do Grape Studio (nunca '*'). Sem token na URL
// e sem cookie de terceiro (o Safari bloqueia dentro de iframe).
// Frontend do Grape Studio (Vercel). studio.grapeai.com.br é o backend FastAPI.
const GRAPE_STUDIO_CRM_URL = 'https://grape-studio.vercel.app/crm';
const CRM_ORIGIN = new URL(GRAPE_STUDIO_CRM_URL).origin;

const { t } = useI18n();
const accountId = useMapGetter('getCurrentAccountId');
const currentUser = useMapGetter('getCurrentUser');

const kanbanUrl = computed(() => {
  const url = new URL(GRAPE_STUDIO_CRM_URL);
  url.searchParams.set('account_id', accountId.value);
  return url.toString();
});

const iframe = ref(null);
const iframeLoaded = ref(false);

function onIframeLoad() {
  iframeLoaded.value = true;
}

useEventListener(window, 'message', event => {
  const crmWindow = iframe.value?.contentWindow;
  if (event.origin !== CRM_ORIGIN || event.source !== crmWindow) return;
  if (event.data?.type !== 'grape-crm:ready') return;
  const accessToken = currentUser.value?.access_token;
  if (!accessToken) return;
  crmWindow.postMessage(
    {
      type: 'grape-crm:auth',
      accessToken,
      accountId: Number(accountId.value),
    },
    CRM_ORIGIN
  );
});
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <div
      v-if="!iframeLoaded"
      class="flex items-center justify-center w-full h-full"
    >
      <span class="text-n-slate-11">{{ t('SIDEBAR.KANBAN_LOADING') }}</span>
    </div>
    <iframe
      ref="iframe"
      :src="kanbanUrl"
      class="w-full h-full border-0"
      :class="{ hidden: !iframeLoaded }"
      allow="clipboard-write"
      @load="onIframeLoad"
    />
  </div>
</template>
