<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  open: {
    type: Number,
    default: 0,
  },
  waiting: {
    type: Number,
    default: 0,
  },
});

const format = value => (value > 99 ? '99+' : value);
const displayOpen = computed(() => format(props.open));
const displayWaiting = computed(() => format(props.waiting));
</script>

<template>
  <div class="flex-1 truncate min-w-0 text-sm">{{ label }}</div>
  <span
    v-if="waiting > 0"
    v-tooltip.top-end="$t('SIDEBAR.AGENT_WAITING_COUNT', waiting)"
    data-test-id="agent-waiting-count"
    class="rounded-md text-xs leading-5 font-medium text-center px-1 flex-shrink-0 text-white bg-[#6B3FA0]"
  >
    {{ displayWaiting }}
  </span>
  <span
    v-if="open > 0"
    v-tooltip.top-end="$t('SIDEBAR.AGENT_OPEN_COUNT', open)"
    data-test-id="agent-open-count"
    class="rounded-md text-xs leading-5 font-medium text-center outline outline-1 px-1 flex-shrink-0"
    :class="{
      'text-n-slate-12 outline-n-slate-6': active,
      'text-n-slate-11 outline-n-strong': !active,
    }"
  >
    {{ displayOpen }}
  </span>
</template>
