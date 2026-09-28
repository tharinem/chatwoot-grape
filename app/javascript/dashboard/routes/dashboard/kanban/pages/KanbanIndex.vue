<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter } from 'dashboard/composables/store';

// O CRM (kanban) agora vive no Grape Studio. Só o account_id vai na URL:
// nenhum token do Chatwoot sai daqui. O SSO será uma troca de código de uso
// único implementada no Grape Studio.
const GRAPE_STUDIO_CRM_URL = 'https://studio.grapeai.com.br/crm';

const { t } = useI18n();
const accountId = useMapGetter('getCurrentAccountId');

const kanbanUrl = computed(() => {
  const url = new URL(GRAPE_STUDIO_CRM_URL);
  url.searchParams.set('account_id', accountId.value);
  return url.toString();
});

const iframeLoaded = ref(false);

function onIframeLoad() {
  iframeLoaded.value = true;
}
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
      :src="kanbanUrl"
      class="w-full h-full border-0"
      :class="{ hidden: !iframeLoaded }"
      allow="clipboard-write"
      @load="onIframeLoad"
    />
  </div>
</template>
