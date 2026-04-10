import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';

export interface ActiveFilters {
  agentIds: number[];
  channelTypes: string[];
  datePreset: string | null;
  assignedToMe: boolean;
}

export const useUiStore = defineStore('ui', () => {
  // Visible fields persisted to localStorage (D-01: compact default)
  const visibleFields = useLocalStorage<string[]>('kanban_visible_fields', [
    'channelType',
    'createdAt',
  ]);

  // Slide panel state
  const slidePanel = ref<{ isOpen: boolean; cardId: string | null }>({
    isOpen: false,
    cardId: null,
  });

  // Active filters (D-09)
  const activeFilters = ref<ActiveFilters>({
    agentIds: [],
    channelTypes: [],
    datePreset: null,
    assignedToMe: false,
  });

  const hasActiveFilters = computed(() =>
    activeFilters.value.agentIds.length > 0 ||
    activeFilters.value.channelTypes.length > 0 ||
    activeFilters.value.datePreset !== null ||
    activeFilters.value.assignedToMe,
  );

  // Actions
  function toggleField(field: string) {
    const idx = visibleFields.value.indexOf(field);
    if (idx === -1) {
      visibleFields.value.push(field);
    } else {
      visibleFields.value.splice(idx, 1);
    }
  }

  function openSlidePanel(cardId: string) {
    slidePanel.value = { isOpen: true, cardId };
  }

  function closeSlidePanel() {
    slidePanel.value = { isOpen: false, cardId: null };
  }

  function setFilter<K extends keyof ActiveFilters>(key: K, value: ActiveFilters[K]) {
    activeFilters.value[key] = value;
  }

  function clearFilters() {
    activeFilters.value = {
      agentIds: [],
      channelTypes: [],
      datePreset: null,
      assignedToMe: false,
    };
  }

  function toggleAssignedToMe() {
    activeFilters.value.assignedToMe = !activeFilters.value.assignedToMe;
  }

  return {
    visibleFields,
    slidePanel,
    activeFilters,
    hasActiveFilters,
    toggleField,
    openSlidePanel,
    closeSlidePanel,
    setFilter,
    clearFilters,
    toggleAssignedToMe,
  };
});
