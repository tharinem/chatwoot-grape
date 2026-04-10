<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBoardStore } from '@/stores/board';
import { useToast } from '@/composables/useToast';
import type { CreateCardInput } from '@/types/card';

const props = defineProps<{
  stageId: string | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const boardStore = useBoardStore();
const { showToast } = useToast();

const form = ref({
  contact_name: '',
  stage_id: props.stageId ?? '',
  channel_type: '',
  assignee_id: null as number | null,
  conversation_id: null as number | null,
});

// Reset form when opened
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      form.value = {
        contact_name: '',
        stage_id: props.stageId ?? boardStore.sortedStages[0]?.id ?? '',
        channel_type: '',
        assignee_id: null,
        conversation_id: null,
      };
    }
  },
);

async function submitCard() {
  const stageId = form.value.stage_id;
  if (!stageId || !form.value.contact_name.trim()) return;

  const input: CreateCardInput = {
    contact_name: form.value.contact_name.trim(),
  };

  if (form.value.channel_type.trim()) {
    input.channel_type = form.value.channel_type.trim();
  }
  if (form.value.assignee_id) {
    input.assignee_id = form.value.assignee_id;
  }
  if (form.value.conversation_id) {
    input.conversation_id = form.value.conversation_id;
  }

  try {
    await boardStore.createCard(stageId, input);
    showToast('success', t('toast.cardCreated'));
    emit('close');
  } catch {
    showToast('error', t('toast.genericError'));
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="emit('close')"
    >
      <div class="bg-n-slate-1 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <h3 class="text-base font-semibold text-n-slate-12 mb-4">
          {{ t('board.newCard') }}
        </h3>

        <div class="space-y-3">
          <!-- Contact name (required) -->
          <div>
            <label class="block text-xs text-n-slate-11 mb-1">{{ t('card.form.contactName') }}</label>
            <input
              v-model="form.contact_name"
              class="w-full px-3 py-2 text-sm bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12 placeholder:text-n-slate-9 focus:border-n-strong focus:outline-none"
              :placeholder="t('card.form.contactNamePlaceholder')"
            />
          </div>

          <!-- Stage selector -->
          <div>
            <label class="block text-xs text-n-slate-11 mb-1">{{ t('card.form.stage') }}</label>
            <select
              v-model="form.stage_id"
              class="w-full px-3 py-2 text-sm bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12"
            >
              <option
                v-for="stage in boardStore.sortedStages"
                :key="stage.id"
                :value="stage.id"
              >
                {{ stage.name }}
              </option>
            </select>
          </div>

          <!-- Channel (optional) -->
          <div>
            <label class="block text-xs text-n-slate-11 mb-1">{{ t('card.form.channel') }}</label>
            <input
              v-model="form.channel_type"
              class="w-full px-3 py-2 text-sm bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12 placeholder:text-n-slate-9 focus:border-n-strong focus:outline-none"
            />
          </div>

          <!-- Agent ID (optional) -->
          <div>
            <label class="block text-xs text-n-slate-11 mb-1">{{ t('card.form.agent') }}</label>
            <input
              v-model.number="form.assignee_id"
              type="number"
              class="w-full px-3 py-2 text-sm bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12 placeholder:text-n-slate-9 focus:border-n-strong focus:outline-none"
            />
          </div>

          <!-- Conversation ID (optional) -->
          <div>
            <label class="block text-xs text-n-slate-11 mb-1">{{ t('card.form.chatwootLink') }}</label>
            <input
              v-model.number="form.conversation_id"
              type="number"
              class="w-full px-3 py-2 text-sm bg-n-slate-2 border border-n-weak rounded-lg text-n-slate-12 placeholder:text-n-slate-9 focus:border-n-strong focus:outline-none"
            />
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 mt-4">
          <button
            class="px-4 py-2 text-sm text-n-slate-11 hover:bg-n-alpha-2 rounded-lg transition-colors"
            @click="emit('close')"
          >
            {{ t('card.form.cancel') }}
          </button>
          <button
            class="px-4 py-2 bg-n-brand text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="!form.contact_name.trim()"
            @click="submitCard"
          >
            {{ t('card.form.submit') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
