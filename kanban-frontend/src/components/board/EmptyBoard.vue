<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineEmits<{
  createCard: [];
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full text-center py-16">
    <span class="i-lucide-layout-dashboard w-12 h-12 text-n-slate-9 mb-4" />
    <h2 class="text-xl font-semibold text-n-slate-12 mb-2">
      {{ t('board.emptyHeading') }}
    </h2>
    <p class="text-sm text-n-slate-11 max-w-md mb-6">
      {{ t('board.emptyBody') }}
    </p>
    <button
      class="px-4 py-2 bg-n-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
      @click="$emit('createCard')"
    >
      <span class="i-lucide-plus w-4 h-4" />
      {{ t('board.emptyCta') }}
    </button>
  </div>
</template>
