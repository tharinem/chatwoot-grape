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
  count: {
    type: Number,
    default: 0,
  },
});

const displayCount = computed(() => (props.count > 99 ? '99+' : props.count));
</script>

<template>
  <div class="flex-1 truncate min-w-0 text-sm">{{ label }}</div>
  <span
    v-if="count > 0"
    v-tooltip.top-end="$t('SIDEBAR.TEAM_QUEUE_COUNT', count)"
    data-test-id="team-queue-count"
    class="rounded-md text-xs leading-5 font-medium text-center outline outline-1 px-1 flex-shrink-0"
    :class="{
      'text-n-slate-12 outline-n-slate-6': active,
      'text-n-slate-11 outline-n-strong': !active,
    }"
  >
    {{ displayCount }}
  </span>
</template>
