import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { stagesApi } from '@/api/stages';
import { cardsApi } from '@/api/cards';
import type { Stage, StageWithCount, CreateStageInput, UpdateStageInput, ReorderStageItem } from '@/types/stage';
import type { Card, CreateCardInput, UpdateCardInput } from '@/types/card';

export const useBoardStore = defineStore('board', () => {
  const stages = ref<StageWithCount[]>([]);
  const cardsByStage = ref<Record<string, Card[]>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const sortedStages = computed(() =>
    [...stages.value].sort((a, b) => a.position - b.position),
  );

  const allCards = computed(() =>
    Object.values(cardsByStage.value).flat(),
  );

  const cardCount = computed(() => allCards.value.length);

  // Actions
  async function fetchBoard() {
    loading.value = true;
    error.value = null;

    try {
      const fetchedStages = await stagesApi.list();
      stages.value = fetchedStages;

      const cardsMap: Record<string, Card[]> = {};
      await Promise.all(
        fetchedStages.map(async (stage) => {
          const result = await cardsApi.listByStage(stage.id);
          cardsMap[stage.id] = result.data;
        }),
      );
      cardsByStage.value = cardsMap;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load board';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function moveCard(
    cardId: string,
    fromStageId: string,
    toStageId: string,
    newPosition: number,
  ) {
    // Snapshot for rollback (optimistic update per D-05)
    const prevCardsByStage = JSON.parse(JSON.stringify(cardsByStage.value)) as Record<string, Card[]>;

    // Optimistic: move card in local state
    const fromCards = cardsByStage.value[fromStageId] ?? [];
    const cardIndex = fromCards.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const [card] = fromCards.splice(cardIndex, 1);
    if (!card) return;

    card.stageId = toStageId;
    card.position = newPosition;

    const toCards = cardsByStage.value[toStageId] ?? [];
    toCards.splice(newPosition, 0, card);
    cardsByStage.value[toStageId] = toCards;

    if (fromStageId !== toStageId) {
      cardsByStage.value[fromStageId] = fromCards;
    }

    try {
      await cardsApi.update(cardId, {
        stage_id: toStageId,
        position: newPosition,
      });
    } catch {
      // Rollback on API failure
      cardsByStage.value = prevCardsByStage;
      throw new Error('move_failed');
    }
  }

  async function createCard(stageId: string, input: CreateCardInput) {
    const card = await cardsApi.create(stageId, input);
    const stageCards = cardsByStage.value[stageId] ?? [];
    stageCards.push(card);
    cardsByStage.value[stageId] = stageCards;
    return card;
  }

  async function updateCard(id: string, input: UpdateCardInput) {
    const updated = await cardsApi.update(id, input);

    // Update in local state
    for (const stageId of Object.keys(cardsByStage.value)) {
      const cards = cardsByStage.value[stageId];
      if (!cards) continue;
      const idx = cards.findIndex((c) => c.id === id);
      if (idx !== -1) {
        cards[idx] = updated;
        break;
      }
    }

    return updated;
  }

  async function deleteCard(id: string) {
    await cardsApi.remove(id);

    // Remove from local state
    for (const stageId of Object.keys(cardsByStage.value)) {
      const cards = cardsByStage.value[stageId];
      if (!cards) continue;
      const idx = cards.findIndex((c) => c.id === id);
      if (idx !== -1) {
        cards.splice(idx, 1);
        break;
      }
    }
  }

  async function createStage(input: CreateStageInput) {
    const stage = await stagesApi.create(input);
    stages.value.push(stage);
    cardsByStage.value[stage.id] = [];
    return stage;
  }

  async function updateStage(id: string, input: UpdateStageInput) {
    const updated = await stagesApi.update(id, input);
    const idx = stages.value.findIndex((s) => s.id === id);
    if (idx !== -1) {
      stages.value[idx] = { ...stages.value[idx], ...updated };
    }
    return updated;
  }

  async function deleteStage(id: string) {
    await stagesApi.remove(id);
    stages.value = stages.value.filter((s) => s.id !== id);
    delete cardsByStage.value[id];
  }

  async function reorderStages(items: ReorderStageItem[]) {
    const updated = await stagesApi.reorder(items);
    stages.value = updated;
  }

  return {
    stages,
    cardsByStage,
    loading,
    error,
    sortedStages,
    allCards,
    cardCount,
    fetchBoard,
    moveCard,
    createCard,
    updateCard,
    deleteCard,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  };
});
