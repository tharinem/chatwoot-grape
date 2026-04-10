<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDraggable } from 'vue-draggable-plus';
import type { Stage } from '@/types/stage';
import type { Card } from '@/types/card';
import KanbanCard from './KanbanCard.vue';
import EmptyColumn from './EmptyColumn.vue';

const props = defineProps<{
  stage: Stage;
  cards: Card[];
}>();

const emit = defineEmits<{
  cardMoved: [payload: {
    cardId: string;
    fromStageId: string;
    toStageId: string;
    newPosition: number;
  }];
}>();

const cardListRef = ref<HTMLElement | null>(null);
const localCards = ref<Card[]>([...props.cards]);

// Sync local cards when props change (e.g. after store update)
watch(
  () => props.cards,
  (newCards) => {
    localCards.value = [...newCards];
  },
);

useDraggable(cardListRef, localCards, {
  group: 'cards',
  animation: 200,
  ghostClass: 'opacity-50',
  dragClass: 'shadow-lg',
  chosenClass: 'ring-2',
  onEnd(event) {
    const cardEl = event.item;
    const cardId = cardEl.dataset.cardId;
    if (!cardId) return;

    const toContainer = event.to as HTMLElement;
    const toStageId = toContainer.dataset.stageId;
    if (!toStageId) return;

    const newPosition = event.newIndex ?? 0;

    emit('cardMoved', {
      cardId,
      fromStageId: props.stage.id,
      toStageId,
      newPosition,
    });
  },
});
</script>

<template>
  <div class="w-[280px] flex-shrink-0 bg-n-slate-2 rounded-xl flex flex-col max-h-full">
    <!-- Color accent bar -->
    <div
      class="h-1 rounded-t-xl"
      :style="{ backgroundColor: stage.color || '#7B5EA7' }"
    />

    <!-- Column header -->
    <div class="flex items-center justify-between px-3 py-2">
      <div class="flex items-center gap-2">
        <h3 class="text-base font-semibold text-n-slate-12">
          {{ stage.name }}
        </h3>
        <span class="text-xs text-n-slate-11">({{ cards.length }})</span>
      </div>
      <!-- Placeholder for "+" add card button and "..." menu (Plan 04 wires these) -->
    </div>

    <!-- Card list (drag zone) -->
    <div
      ref="cardListRef"
      :data-stage-id="stage.id"
      class="flex flex-col gap-2 px-2 pb-2 min-h-[80px] overflow-y-auto"
    >
      <KanbanCard
        v-for="card in localCards"
        :key="card.id"
        :card="card"
        :data-card-id="card.id"
      />
    </div>

    <!-- Empty column state -->
    <EmptyColumn v-if="localCards.length === 0" />
  </div>
</template>
