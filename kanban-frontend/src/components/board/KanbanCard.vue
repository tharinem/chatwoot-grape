<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUiStore } from '@/stores/ui';
import type { Card } from '@/types/card';

const props = defineProps<{
  card: Card;
}>();

const { t } = useI18n();
const uiStore = useUiStore();

const visibleFields = computed(() => uiStore.visibleFields);

const chatwootUrl = computed(() => {
  if (!props.card.conversationId) return null;
  const base = import.meta.env.VITE_CHATWOOT_URL || '';
  return `${base}/app/accounts/${props.card.accountId}/conversations/${props.card.conversationId}`;
});

const relativeTime = computed(() =>
  formatDistanceToNow(new Date(props.card.createdAt), {
    addSuffix: true,
    locale: ptBR,
  }),
);

const channelIcon = computed(() => {
  const type = props.card.channelType;
  if (!type) return 'i-lucide-message-square';
  if (type.includes('whatsapp')) return 'i-lucide-phone';
  if (type.includes('email')) return 'i-lucide-mail';
  if (type.includes('web')) return 'i-lucide-globe';
  return 'i-lucide-message-square';
});

let isDragging = false;

function onDragStart() {
  isDragging = true;
}

function onDragEnd() {
  setTimeout(() => {
    isDragging = false;
  }, 0);
}

function handleClick() {
  if (!isDragging) {
    uiStore.openSlidePanel(props.card.id);
  }
}
</script>

<template>
  <div
    :data-card-id="card.id"
    class="bg-n-slate-1 rounded-lg border border-n-weak p-3 cursor-grab hover:shadow-md transition-shadow duration-150 active:cursor-grabbing"
    @mousedown="onDragStart"
    @mouseup="onDragEnd"
    @click="handleClick"
  >
    <!-- Contact name (always visible) -->
    <p class="text-sm font-semibold text-n-slate-12 truncate">
      {{ card.contactName }}
    </p>

    <!-- Channel type -->
    <div
      v-if="visibleFields.includes('channelType') && card.channelType"
      class="flex items-center gap-1 mt-1"
    >
      <span :class="[channelIcon, 'w-3 h-3 text-n-slate-11']" />
      <span class="text-xs text-n-slate-11">{{ card.channelType }}</span>
    </div>

    <!-- Created at -->
    <p
      v-if="visibleFields.includes('createdAt')"
      class="text-xs text-n-slate-11 mt-1"
    >
      {{ relativeTime }}
    </p>

    <!-- Assignee -->
    <div
      v-if="visibleFields.includes('assigneeId') && card.assigneeId"
      class="flex items-center gap-1 mt-1"
    >
      <span class="i-lucide-user w-3 h-3 text-n-slate-11" />
      <span class="text-xs text-n-slate-11">Agente #{{ card.assigneeId }}</span>
    </div>

    <!-- Chatwoot link -->
    <a
      v-if="visibleFields.includes('conversationId') && chatwootUrl"
      :href="chatwootUrl"
      target="_blank"
      rel="noopener"
      class="flex items-center gap-1 mt-1 text-xs text-n-blue-11 hover:text-n-blue-12"
      @click.stop
    >
      <span class="i-lucide-external-link w-3 h-3" />
      {{ t('slidePanel.openInChatwoot') }}
    </a>
  </div>
</template>
