<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { onClickOutside } from '@vueuse/core';
import type { Stage } from '@/types/stage';
import { useBoardStore } from '@/stores/board';
import { useToast } from '@/composables/useToast';
import DropdownMenu from '@/components/shared/DropdownMenu.vue';
import StageColorPicker from '@/components/stage/StageColorPicker.vue';
import type { DropdownItem } from '@/components/shared/DropdownMenu.vue';

const props = defineProps<{
  stage: Stage;
  cardCount: number;
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  addCard: [];
  deleteStage: [];
}>();

const { t } = useI18n();
const boardStore = useBoardStore();
const { showToast } = useToast();

// Inline rename
const isEditing = ref(false);
const editName = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);

async function startEditing() {
  if (!props.isAdmin) return;
  isEditing.value = true;
  editName.value = props.stage.name;
  await nextTick();
  editInputRef.value?.focus();
  editInputRef.value?.select();
}

async function saveRename() {
  if (!isEditing.value) return;
  const trimmed = editName.value.trim();
  if (trimmed && trimmed !== props.stage.name) {
    try {
      await boardStore.updateStage(props.stage.id, { name: trimmed });
      showToast('success', t('toast.stageCreated'));
    } catch {
      showToast('error', t('toast.genericError'));
    }
  }
  isEditing.value = false;
}

function cancelRename() {
  isEditing.value = false;
}

// Dropdown menu
const showMenu = ref(false);
const showColorPicker = ref(false);
const menuWrapperRef = ref<HTMLElement | null>(null);

onClickOutside(menuWrapperRef, () => {
  showMenu.value = false;
});

const menuItems: DropdownItem[] = [
  {
    label: t('stage.menu.rename'),
    icon: 'i-lucide-pencil',
    action: () => {
      showMenu.value = false;
      startEditing();
    },
  },
  {
    label: t('stage.menu.changeColor'),
    icon: 'i-lucide-palette',
    action: () => {
      showMenu.value = false;
      showColorPicker.value = true;
    },
  },
  {
    label: t('stage.menu.delete'),
    icon: 'i-lucide-trash-2',
    variant: 'danger',
    action: () => {
      showMenu.value = false;
      emit('deleteStage');
    },
  },
];
</script>

<template>
  <div class="flex items-center justify-between px-3 py-2">
    <div class="flex items-center gap-2 min-w-0">
      <!-- Editable stage name -->
      <input
        v-if="isEditing"
        ref="editInputRef"
        v-model="editName"
        class="text-base font-semibold text-n-slate-12 bg-n-slate-1 border border-n-strong rounded px-1 -mx-1 w-full outline-none"
        @keydown.enter="saveRename"
        @keydown.escape="cancelRename"
        @blur="saveRename"
      />
      <h3
        v-else
        class="text-base font-semibold text-n-slate-12 truncate"
        :class="isAdmin ? 'cursor-pointer hover:bg-n-alpha-2 rounded px-1 -mx-1 transition-colors' : ''"
        @click="startEditing"
      >
        {{ stage.name }}
      </h3>
      <span class="text-xs text-n-slate-11">({{ cardCount }})</span>
    </div>

    <!-- Admin actions -->
    <div v-if="isAdmin" class="flex items-center gap-0.5 flex-shrink-0">
      <button
        class="w-8 h-8 flex items-center justify-center rounded hover:bg-n-alpha-2 text-n-slate-11 hover:text-n-slate-12 transition-colors"
        :aria-label="t('aria.addCardToStage')"
        :title="t('tooltip.addCard')"
        @click="emit('addCard')"
      >
        <span class="i-lucide-plus w-4 h-4" />
      </button>

      <div ref="menuWrapperRef" class="relative">
        <button
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-n-alpha-2 text-n-slate-11 hover:text-n-slate-12 transition-colors"
          :aria-label="t('aria.stageMenu', { stageName: stage.name })"
          :title="t('tooltip.stageOptions')"
          @click="showMenu = !showMenu"
        >
          <span class="i-lucide-ellipsis w-4 h-4" />
        </button>

        <div v-if="showMenu" class="absolute right-0 top-full mt-1">
          <DropdownMenu :items="menuItems" />
        </div>
      </div>

      <!-- Color picker popover -->
      <div v-if="showColorPicker" class="absolute right-0 top-full mt-1 z-50">
        <StageColorPicker
          :current-color="stage.color"
          :stage-id="stage.id"
          @close="showColorPicker = false"
        />
      </div>
    </div>
  </div>
</template>
