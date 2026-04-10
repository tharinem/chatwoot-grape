<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBoardStore } from '@/stores/board';
import { useToast } from '@/composables/useToast';

const { t } = useI18n();
const boardStore = useBoardStore();
const { showToast } = useToast();

const isAdding = ref(false);
const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

async function startAdding() {
  isAdding.value = true;
  inputValue.value = '';
  await nextTick();
  inputRef.value?.focus();
}

async function createStage() {
  const name = inputValue.value.trim();
  if (!name) {
    isAdding.value = false;
    return;
  }

  try {
    await boardStore.createStage({ name });
    showToast('success', t('toast.stageCreated'));
  } catch {
    showToast('error', t('toast.genericError'));
  }

  isAdding.value = false;
}

function cancelAdding() {
  isAdding.value = false;
}
</script>

<template>
  <div class="w-[280px] flex-shrink-0">
    <!-- Adding state: input field -->
    <div v-if="isAdding" class="bg-n-slate-2 rounded-xl p-3">
      <input
        ref="inputRef"
        v-model="inputValue"
        class="w-full px-3 py-2 text-sm bg-n-slate-1 border border-n-weak rounded-lg text-n-slate-12 placeholder:text-n-slate-9 focus:border-n-strong focus:outline-none"
        :placeholder="t('stage.namePlaceholder')"
        @keydown.enter="createStage"
        @keydown.escape="cancelAdding"
        @blur="createStage"
      />
    </div>

    <!-- Default state: dashed button -->
    <button
      v-else
      class="w-full h-12 border-2 border-dashed border-n-weak rounded-xl flex items-center justify-center gap-2 text-n-slate-11 hover:text-n-slate-12 hover:border-n-strong transition-colors"
      :aria-label="t('aria.addNewStage')"
      :title="t('tooltip.newStage')"
      @click="startAdding"
    >
      <span class="i-lucide-plus w-5 h-5" />
      {{ t('tooltip.newStage') }}
    </button>
  </div>
</template>
