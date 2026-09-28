<script setup>
import { computed, ref } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';

// Use the Chatwoot store getters directly (no `auth/` namespace) so we
// get the real account id + the user's API access token. The previous
// `auth/getCurrentUser` namespace doesn't exist and was producing
// `undefined` / empty values in the iframe URL.
const currentUser = useMapGetter('getCurrentUser');
const accountId = useMapGetter('getCurrentAccountId');

const kanbanUrl = computed(() => {
  const baseUrl = 'https://kanban.grapeai.com.br';
  const token = currentUser.value?.access_token || '';
  return `${baseUrl}?account_id=${accountId.value}&token=${token}`;
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
      <span class="text-n-slate-11">Carregando Kanban...</span>
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
