<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDraggable } from 'vue-draggable-plus';
import type { Stage } from '@/types/stage';
import type { Card } from '@/types/card';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import KanbanCard from './KanbanCard.vue';
import ColumnHeader from './ColumnHeader.vue';
import EmptyColumn from './EmptyColumn.vue';
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue';

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
  addCard: [stageId: string];
}>();

const { t } = useI18n();
const boardStore = useBoardStore();
const authStore = useAuthStore();
const { showToast } = useToast();

const cardListRef = ref<HTMLElement | null>(null);
const localCards = ref<Card[]>([...props.cards]);

// Delete stage flow
const showDeleteConfirm = ref(false);
const destinationStageId = ref('');

// Sync local cards when props change
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

const isAdmin = ref(authStore.role === 'administrator');

const otherStages = ref(
  boardStore.sortedStages.filter((s) => s.id !== props.stage.id),
);

function handleDeleteStage() {
  if (props.cards.length > 0) {
    destinationStageId.value = otherStages.value[0]?.id ?? '';
  }
  showDeleteConfirm.value = true;
}

async function executeDeleteStage() {
  try {
    // If cards exist, move them first
    if (props.cards.length > 0 && destinationStageId.value) {
      await Promise.all(
        props.cards.map((c) =>
          boardStore.updateCard(c.id, { stage_id: destinationStageId.value }),
        ),
      );
    }
    await boardStore.deleteStage(props.stage.id);
    showToast('success', t('toast.stageDeleted'));
  } catch {
    showToast('error', t('toast.genericError'));
  }
  showDeleteConfirm.value = false;
}
</script>

<template>
  <div class="w-[280px] flex-shrink-0 bg-n-slate-2 rounded-xl flex flex-col max-h-full">
    <!-- Color accent bar -->
    <div
      class="h-1 rounded-t-xl"
      :style="{ backgroundColor: stage.color || '#7B5EA7' }"
    />

    <!-- Column header -->
    <ColumnHeader
      :stage="stage"
      :card-count="cards.length"
      :is-admin="isAdmin"
      @add-card="emit('addCard', stage.id)"
      @delete-stage="handleDeleteStage"
    />

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

    <!-- Delete stage confirmation -->
    <ConfirmDialog
      :is-open="showDeleteConfirm"
      :title="t('stage.menu.delete')"
      :message="cards.length > 0
        ? t('stage.deleteConfirmWithCards', { count: cards.length })
        : t('stage.deleteConfirmEmpty', { name: stage.name })"
      :confirm-label="t('stage.menu.delete')"
      variant="danger"
      @confirm="executeDeleteStage"
      @cancel="showDeleteConfirm = false"
    >
      <!-- Stage selector for cards migration -->
      <div v-if="cards.length > 0" class="mt-3">
        <select
          v-model="destinationStageId"
          class="w-full px-3 py-2 text-sm bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12"
        >
          <option
            v-for="s in otherStages"
            :key="s.id"
            :value="s.id"
          >
            {{ s.name }}
          </option>
        </select>
      </div>
    </ConfirmDialog>
  </div>
</template>
