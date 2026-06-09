<script setup>
import { computed, ref, onMounted } from 'vue';
import { useStore } from 'dashboard/composables/store';

const store = useStore();

const currentUser = computed(() => store.getters['auth/getCurrentUser']);
const accountId = computed(() => store.getters['auth/getCurrentAccountId']);

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
