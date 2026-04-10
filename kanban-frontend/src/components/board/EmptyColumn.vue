<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-8 text-center">
    <p class="text-xs text-n-slate-9">{{ t('board.emptyColumn') }}</p>
  </div>
</template>
