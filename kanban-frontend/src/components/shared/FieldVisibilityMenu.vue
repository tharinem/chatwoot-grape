<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onClickOutside } from '@vueuse/core';
import { useUiStore } from '@/stores/ui';

const { t } = useI18n();
const uiStore = useUiStore();

const isOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const fields = [
  { key: 'channelType', label: t('card.form.channel') },
  { key: 'assigneeId', label: t('card.form.agent') },
  { key: 'createdAt', label: 'Data de entrada' },
  { key: 'conversationId', label: t('card.form.chatwootLink') },
];

onClickOutside(menuRef, () => {
  isOpen.value = false;
});
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      class="w-8 h-8 flex items-center justify-center rounded hover:bg-n-alpha-2 text-n-slate-11"
      :aria-label="t('aria.fieldVisibility')"
      :title="t('tooltip.fieldVisibility')"
      @click="isOpen = !isOpen"
    >
      <span class="i-lucide-sliders-horizontal w-4 h-4" />
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 top-full mt-1 bg-n-slate-1 border border-n-weak rounded-lg shadow-lg py-1 min-w-[200px] z-50"
    >
      <label
        v-for="field in fields"
        :key="field.key"
        class="flex items-center justify-between px-3 py-2 hover:bg-n-alpha-2 cursor-pointer"
      >
        <span class="text-sm text-n-slate-12">{{ field.label }}</span>
        <input
          type="checkbox"
          :checked="uiStore.visibleFields.includes(field.key)"
          class="accent-n-brand"
          @change="uiStore.toggleField(field.key)"
        />
      </label>
    </div>
  </div>
</template>
