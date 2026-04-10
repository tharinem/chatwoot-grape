<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts, removeToast } = useToast();
</script>

<template>
  <Teleport to="#toast-container">
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <TransitionGroup
        enter-from-class="opacity-0 translate-y-2"
        enter-active-class="transition-all duration-200 ease-out"
        enter-to-class="opacity-100 translate-y-0"
        leave-from-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-normal"
          :class="[
            toast.type === 'success'
              ? 'bg-n-teal-3 text-n-teal-11 border border-n-teal-7'
              : 'bg-n-ruby-3 text-n-ruby-11 border border-n-ruby-7',
          ]"
        >
          <span class="flex-1">{{ toast.message }}</span>
          <button
            class="flex-shrink-0 w-4 h-4 i-lucide-x opacity-70 hover:opacity-100"
            @click="removeToast(toast.id)"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
