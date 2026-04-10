<script setup lang="ts">
export interface DropdownItem {
  label: string;
  icon?: string;
  variant?: 'danger' | 'default';
  action: () => void;
}

defineProps<{
  items: DropdownItem[];
}>();
</script>

<template>
  <div class="bg-n-slate-1 border border-n-weak rounded-lg shadow-lg py-1 min-w-[160px] z-50">
    <button
      v-for="(item, idx) in items"
      :key="idx"
      class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-n-alpha-2 transition-colors"
      :class="item.variant === 'danger' ? 'text-n-ruby-11' : 'text-n-slate-12'"
      @click="item.action()"
    >
      <span v-if="item.icon" :class="[item.icon, 'w-4 h-4']" />
      {{ item.label }}
    </button>
  </div>
</template>
