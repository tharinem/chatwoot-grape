<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useBoardStore } from '@/stores/board';
import { useToast } from '@/composables/useToast';
import { useFilters } from '@/composables/useFilters';
import KanbanColumn from './KanbanColumn.vue';
import AddStageButton from './AddStageButton.vue';

const { t } = useI18n();
const boardStore = useBoardStore();
const { showToast } = useToast();
const { filteredCardsByStage } = useFilters();

const emit = defineEmits<{
  addCard: [stageId: string];
}>();

async function handleCardMoved(payload: {
  cardId: string;
  fromStageId: string;
  toStageId: string;
  newPosition: number;
}) {
  const targetStage = boardStore.sortedStages.find(
    (s) => s.id === payload.toStageId,
  );
  const stageName = targetStage?.name ?? '';

  try {
    await boardStore.moveCard(
      payload.cardId,
      payload.fromStageId,
      payload.toStageId,
      payload.newPosition,
    );
    showToast('success', t('toast.cardMoved', { stageName }));
  } catch {
    showToast('error', t('toast.dragFail'));
  }
}
</script>

<template>
  <div class="flex gap-8 h-full items-start pt-4">
    <KanbanColumn
      v-for="stage in boardStore.sortedStages"
      :key="stage.id"
      :stage="stage"
      :cards="filteredCardsByStage[stage.id] || []"
      @card-moved="handleCardMoved"
      @add-card="(stageId: string) => emit('addCard', stageId)"
    />
    <AddStageButton />
  </div>
</template>
