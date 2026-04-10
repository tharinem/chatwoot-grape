<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center justify-center h-screen">
    <h1 class="text-xl font-semibold text-n-slate-12">
      {{ t('board.title') }}
    </h1>
  </div>
</template>
