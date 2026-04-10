import { computed } from 'vue';
import { isAfter, subDays, startOfDay, parseISO } from 'date-fns';
import { useBoardStore } from '@/stores/board';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import type { Card } from '@/types/card';

export function useFilters() {
  const boardStore = useBoardStore();
  const uiStore = useUiStore();
  const authStore = useAuthStore();

  function matchesFilters(card: Card): boolean {
    const filters = uiStore.activeFilters;

    if (filters.assignedToMe && card.assigneeId !== authStore.userId) {
      return false;
    }

    if (filters.agentIds.length > 0 && !filters.agentIds.includes(card.assigneeId ?? -1)) {
      return false;
    }

    if (filters.channelTypes.length > 0 && !filters.channelTypes.includes(card.channelType ?? '')) {
      return false;
    }

    if (filters.datePreset && filters.datePreset !== 'all') {
      const cardDate = parseISO(card.createdAt);
      const now = new Date();

      if (filters.datePreset === 'today') {
        if (cardDate < startOfDay(now)) return false;
      } else if (filters.datePreset === '7days') {
        if (!isAfter(cardDate, subDays(now, 7))) return false;
      } else if (filters.datePreset === '30days') {
        if (!isAfter(cardDate, subDays(now, 30))) return false;
      }
    }

    return true;
  }

  const filteredCardsByStage = computed(() => {
    const result: Record<string, Card[]> = {};

    for (const stageId of Object.keys(boardStore.cardsByStage)) {
      const cards = boardStore.cardsByStage[stageId] ?? [];
      result[stageId] = cards.filter(matchesFilters);
    }

    return result;
  });

  const hasActiveFilters = computed(() => uiStore.hasActiveFilters);

  return {
    filteredCardsByStage,
    hasActiveFilters,
  };
}
