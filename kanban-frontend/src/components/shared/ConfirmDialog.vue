<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

defineProps<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'danger' | 'default';
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('cancel');
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="emit('cancel')"
    >
      <div class="bg-n-slate-1 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h3 class="text-base font-semibold text-n-slate-12 mb-2">
          {{ title }}
        </h3>
        <p class="text-sm text-n-slate-11 mb-4">
          {{ message }}
        </p>

        <!-- Slot for extra content (e.g. stage selector) -->
        <slot />

        <div class="flex items-center justify-end gap-2 mt-4">
          <button
            class="px-4 py-2 text-sm text-n-slate-11 hover:bg-n-alpha-2 rounded-lg transition-colors"
            @click="emit('cancel')"
          >
            Cancelar
          </button>
          <button
            class="px-4 py-2 text-sm text-white rounded-lg transition-colors"
            :class="variant === 'danger' ? 'bg-n-ruby-9 hover:bg-n-ruby-10' : 'bg-n-brand hover:opacity-90'"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
