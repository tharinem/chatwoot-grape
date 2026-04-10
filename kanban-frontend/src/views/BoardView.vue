<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import BoardLayout from '@/components/layout/BoardLayout.vue';
import BoardTopBar from '@/components/layout/BoardTopBar.vue';
import KanbanBoard from '@/components/board/KanbanBoard.vue';
import EmptyBoard from '@/components/board/EmptyBoard.vue';
import CardSlidePanel from '@/components/detail/CardSlidePanel.vue';
import CardForm from '@/components/detail/CardForm.vue';
import Toast from '@/components/shared/Toast.vue';

const { t } = useI18n();
const boardStore = useBoardStore();
const authStore = useAuthStore();

// Card form state
const showCardForm = ref(false);
const cardFormStageId = ref<string | null>(null);

onMounted(async () => {
  authStore.initFromStorage();
  await boardStore.fetchBoard();
});

async function handleRetry() {
  await boardStore.fetchBoard();
}

function openNewCardForm(stageId?: string) {
  cardFormStageId.value = stageId ?? null;
  showCardForm.value = true;
}
</script>

<template>
  <BoardLayout>
    <template #topbar>
      <BoardTopBar @new-card="openNewCardForm()" />
    </template>

    <!-- Loading skeleton -->
    <div v-if="boardStore.loading" class="flex gap-8 h-full items-start pt-4">
      <div
        v-for="i in 4"
        :key="i"
        class="w-[280px] flex-shrink-0 rounded-xl bg-n-slate-2 p-4"
      >
        <div class="h-4 w-24 rounded bg-n-slate-3 animate-pulse mb-4" />
        <div class="space-y-3">
          <div
            v-for="j in 3"
            :key="j"
            class="h-16 rounded-lg bg-n-slate-3 animate-pulse"
          />
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="boardStore.error"
      class="flex flex-col items-center justify-center h-full text-center py-16"
    >
      <span class="i-lucide-alert-triangle w-12 h-12 text-n-ruby-9 mb-4" />
      <p class="text-sm text-n-slate-11 mb-4">{{ t('toast.loadFail') }}</p>
      <button
        class="rounded-lg bg-n-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        @click="handleRetry"
      >
        {{ t('board.retryCta') }}
      </button>
    </div>

    <!-- Empty state -->
    <EmptyBoard
      v-else-if="boardStore.cardCount === 0 && !boardStore.loading"
      @create-card="openNewCardForm()"
    />

    <!-- Board -->
    <KanbanBoard
      v-else
      @add-card="(stageId: string) => openNewCardForm(stageId)"
    />

    <!-- Slide panel for card details -->
    <CardSlidePanel />

    <!-- Card creation form -->
    <CardForm
      :stage-id="cardFormStageId"
      :is-open="showCardForm"
      @close="showCardForm = false"
    />

    <Toast />
  </BoardLayout>
</template>
