<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBoardStore } from '@/stores/board';
import { useUiStore } from '@/stores/ui';

const { t } = useI18n();
const boardStore = useBoardStore();
const uiStore = useUiStore();

// Derive unique agents and channels from all cards
const uniqueAgentIds = computed(() => {
  const ids = new Set<number>();
  for (const card of boardStore.allCards) {
    if (card.assigneeId) ids.add(card.assigneeId);
  }
  return [...ids].sort((a, b) => a - b);
});

const uniqueChannels = computed(() => {
  const channels = new Set<string>();
  for (const card of boardStore.allCards) {
    if (card.channelType) channels.add(card.channelType);
  }
  return [...channels].sort();
});

const datePresets = [
  { value: '', label: t('filter.dateRange') },
  { value: 'today', label: 'Hoje' },
  { value: '7days', label: 'Ultimos 7 dias' },
  { value: '30days', label: 'Ultimos 30 dias' },
  { value: 'all', label: 'Todos' },
];

function onAgentChange(e: Event) {
  const select = e.target as HTMLSelectElement;
  const selectedValues = Array.from(select.selectedOptions, (opt) => Number(opt.value));
  uiStore.setFilter('agentIds', selectedValues);
}

function onChannelChange(e: Event) {
  const select = e.target as HTMLSelectElement;
  const selectedValues = Array.from(select.selectedOptions, (opt) => opt.value);
  uiStore.setFilter('channelTypes', selectedValues);
}

function onDateChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  uiStore.setFilter('datePreset', value || null);
}
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap mt-3">
    <!-- Assigned to me toggle -->
    <button
      class="px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors"
      :class="
        uiStore.activeFilters.assignedToMe
          ? 'bg-n-brand/10 text-n-blue-11 border-n-blue-7'
          : 'text-n-slate-11 border-n-weak hover:border-n-strong'
      "
      @click="uiStore.toggleAssignedToMe()"
    >
      {{ t('board.assignedToMe') }}
    </button>

    <!-- Agent filter -->
    <select
      class="px-3 py-1.5 text-xs bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12"
      @change="onAgentChange"
    >
      <option value="">{{ t('filter.agent') }}</option>
      <option
        v-for="agentId in uniqueAgentIds"
        :key="agentId"
        :value="agentId"
      >
        Agente #{{ agentId }}
      </option>
    </select>

    <!-- Channel filter -->
    <select
      class="px-3 py-1.5 text-xs bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12"
      @change="onChannelChange"
    >
      <option value="">{{ t('filter.channel') }}</option>
      <option
        v-for="channel in uniqueChannels"
        :key="channel"
        :value="channel"
      >
        {{ channel }}
      </option>
    </select>

    <!-- Date range filter -->
    <select
      class="px-3 py-1.5 text-xs bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12"
      @change="onDateChange"
    >
      <option
        v-for="preset in datePresets"
        :key="preset.value"
        :value="preset.value"
      >
        {{ preset.label }}
      </option>
    </select>

    <!-- Clear filters -->
    <button
      v-if="uiStore.hasActiveFilters"
      class="text-xs text-n-blue-11 hover:text-n-blue-12"
      @click="uiStore.clearFilters()"
    >
      {{ t('filter.clearAll') }}
    </button>
  </div>
</template>
