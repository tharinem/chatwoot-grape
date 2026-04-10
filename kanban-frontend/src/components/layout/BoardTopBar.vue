<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import FilterBar from '@/components/layout/FilterBar.vue';
import FieldVisibilityMenu from '@/components/shared/FieldVisibilityMenu.vue';

const { t } = useI18n();

defineEmits<{
  newCard: [];
}>();
</script>

<template>
  <div class="px-8 py-6 border-b border-n-weak bg-n-slate-1">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-n-slate-12">
        {{ t('board.title') }}
      </h1>
      <div class="flex items-center gap-2">
        <FieldVisibilityMenu />
        <button
          class="flex items-center gap-2 rounded-lg bg-n-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          @click="$emit('newCard')"
        >
          <span class="i-lucide-plus w-4 h-4" />
          {{ t('board.newCard') }}
        </button>
      </div>
    </div>
    <FilterBar />
  </div>
</template>
