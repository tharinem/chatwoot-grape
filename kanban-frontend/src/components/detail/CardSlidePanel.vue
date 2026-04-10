<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { onKeyStroke } from '@vueuse/core';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUiStore } from '@/stores/ui';
import { useBoardStore } from '@/stores/board';
import { useToast } from '@/composables/useToast';
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue';

const { t } = useI18n();
const uiStore = useUiStore();
const boardStore = useBoardStore();
const { showToast } = useToast();

const isExpanded = ref(false);
const showDeleteConfirm = ref(false);

const card = computed(() => {
  if (!uiStore.slidePanel.cardId) return null;
  return boardStore.allCards.find((c) => c.id === uiStore.slidePanel.cardId) ?? null;
});

const stageName = computed(() => {
  if (!card.value) return '';
  const stage = boardStore.sortedStages.find((s) => s.id === card.value!.stageId);
  return stage?.name ?? '';
});

const stageColor = computed(() => {
  if (!card.value) return '#7B5EA7';
  const stage = boardStore.sortedStages.find((s) => s.id === card.value!.stageId);
  return stage?.color ?? '#7B5EA7';
});

const chatwootUrl = computed(() => {
  if (!card.value?.conversationId) return null;
  const base = import.meta.env.VITE_CHATWOOT_URL || '';
  return `${base}/app/accounts/${card.value.accountId}/conversations/${card.value.conversationId}`;
});

const formattedDate = computed(() => {
  if (!card.value) return '';
  return format(parseISO(card.value.createdAt), "dd MMM yyyy 'as' HH:mm", { locale: ptBR });
});

onKeyStroke('Escape', () => {
  if (uiStore.slidePanel.isOpen) {
    uiStore.closeSlidePanel();
  }
});

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

async function confirmDeleteCard() {
  showDeleteConfirm.value = true;
}

async function executeDelete() {
  if (!card.value) return;
  try {
    await boardStore.deleteCard(card.value.id);
    uiStore.closeSlidePanel();
    showDeleteConfirm.value = false;
  } catch {
    showToast('error', t('toast.genericError'));
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-[250ms] ease-out"
    enter-from-class="translate-x-full"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="uiStore.slidePanel.isOpen && card"
      class="fixed top-0 right-0 h-full bg-n-slate-1 border-l border-n-weak shadow-2xl z-40 flex flex-col"
      :class="isExpanded ? 'w-[640px]' : 'w-[400px]'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-n-weak">
        <div class="flex items-center gap-2">
          <button
            class="w-8 h-8 flex items-center justify-center rounded hover:bg-n-alpha-2 text-n-slate-11"
            :aria-label="t('aria.expandPanel')"
            :title="t('tooltip.expand')"
            @click="toggleExpand"
          >
            <span class="i-lucide-maximize-2 w-5 h-5" />
          </button>
        </div>
        <button
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-n-alpha-2 text-n-slate-11"
          :aria-label="t('aria.closePanel')"
          :title="t('tooltip.close')"
          @click="uiStore.closeSlidePanel()"
        >
          <span class="i-lucide-x w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Contact name -->
        <h2 class="text-xl font-semibold text-n-slate-12">
          {{ card.contactName }}
        </h2>

        <!-- Stage -->
        <div class="flex items-center gap-2">
          <span
            class="w-3 h-3 rounded-full flex-shrink-0"
            :style="{ backgroundColor: stageColor }"
          />
          <span class="text-sm text-n-slate-11">{{ stageName }}</span>
        </div>

        <!-- Channel -->
        <div v-if="card.channelType" class="flex items-center gap-2">
          <span class="i-lucide-message-square w-4 h-4 text-n-slate-11" />
          <span class="text-sm text-n-slate-11">{{ card.channelType }}</span>
        </div>

        <!-- Agent -->
        <div v-if="card.assigneeId" class="flex items-center gap-2">
          <span class="i-lucide-user w-4 h-4 text-n-slate-11" />
          <span class="text-sm text-n-slate-11">Agente #{{ card.assigneeId }}</span>
        </div>

        <!-- Created at -->
        <div class="flex items-center gap-2">
          <span class="i-lucide-calendar w-4 h-4 text-n-slate-11" />
          <span class="text-sm text-n-slate-11">{{ formattedDate }}</span>
        </div>

        <!-- Chatwoot link -->
        <a
          v-if="chatwootUrl"
          :href="chatwootUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2 text-sm text-n-blue-11 hover:text-n-blue-12"
        >
          <span class="i-lucide-external-link w-4 h-4" />
          {{ t('slidePanel.openInChatwoot') }}
        </a>

        <!-- Custom fields -->
        <div
          v-if="card.customFields && Object.keys(card.customFields).length > 0"
          class="space-y-2 pt-2 border-t border-n-weak"
        >
          <div
            v-for="(value, key) in card.customFields"
            :key="String(key)"
            class="flex items-start gap-2"
          >
            <span class="text-xs text-n-slate-11 font-semibold min-w-[80px]">{{ key }}</span>
            <span class="text-xs text-n-slate-12">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- Footer: delete action -->
      <div class="px-4 py-3 border-t border-n-weak">
        <button
          class="text-sm text-n-ruby-11 hover:text-n-ruby-12 flex items-center gap-1"
          @click="confirmDeleteCard"
        >
          <span class="i-lucide-trash-2 w-4 h-4" />
          {{ t('stage.menu.delete') }}
        </button>
      </div>
    </div>
  </Transition>

  <!-- Delete confirmation -->
  <ConfirmDialog
    :is-open="showDeleteConfirm"
    title="Excluir card"
    :message="t('card.deleteConfirm', { contactName: card?.contactName ?? '' })"
    :confirm-label="t('stage.menu.delete')"
    variant="danger"
    @confirm="executeDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>
