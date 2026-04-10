<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { useBoardStore } from '@/stores/board';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  currentColor: string | null;
  stageId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const boardStore = useBoardStore();
const { showToast } = useToast();
const pickerRef = ref<HTMLElement | null>(null);

const presetColors = [
  '#7B5EA7',
  '#3B82F6',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#6B7280',
  '#D97706',
];

onClickOutside(pickerRef, () => {
  emit('close');
});

async function selectColor(color: string | null) {
  try {
    await boardStore.updateStage(props.stageId, { color });
  } catch {
    showToast('error', 'Algo deu errado. Tente novamente.');
  }
  emit('close');
}
</script>

<template>
  <div
    ref="pickerRef"
    class="bg-n-slate-1 border border-n-weak rounded-lg shadow-lg p-3 z-50"
  >
    <div class="flex flex-wrap gap-2 max-w-[200px]">
      <button
        v-for="color in presetColors"
        :key="color"
        class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
        :class="color === currentColor ? 'border-n-slate-12 scale-110' : 'border-transparent'"
        :style="{ backgroundColor: color }"
        @click="selectColor(color)"
      />
    </div>
    <button
      class="w-full mt-2 text-xs text-n-slate-11 hover:text-n-slate-12 text-center py-1"
      @click="selectColor(null)"
    >
      Remover cor
    </button>
  </div>
</template>
