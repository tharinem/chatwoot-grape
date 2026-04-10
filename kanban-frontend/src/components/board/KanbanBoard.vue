<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useBoardStore } from '@/stores/board';
import { useToast } from '@/composables/useToast';
import KanbanColumn from './KanbanColumn.vue';

const { t } = useI18n();
const boardStore = useBoardStore();
const { showToast } = useToast();

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
      :cards="boardStore.cardsByStage[stage.id] || []"
      @card-moved="handleCardMoved"
    />
    <!-- Placeholder for AddStageButton (Plan 04 implements) -->
    <div class="flex-shrink-0 w-[280px]" />
  </div>
</template>
