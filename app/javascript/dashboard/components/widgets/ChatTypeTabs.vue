<script setup>
import { computed } from 'vue';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import wootConstants from 'dashboard/constants/globals';

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  activeTab: {
    type: String,
    default: wootConstants.ASSIGNEE_TYPE.ME,
  },
});

const emit = defineEmits(['chatTabChange']);

const formatWaitingCount = count => (count > 99 ? '99+' : count);

const activeTabIndex = computed(() => {
  return props.items.findIndex(item => item.key === props.activeTab);
});

const onTabChange = selectedTabIndex => {
  if (selectedTabIndex >= 0 && selectedTabIndex < props.items.length) {
    const selectedItem = props.items[selectedTabIndex];
    if (selectedItem.key !== props.activeTab) {
      emit('chatTabChange', selectedItem.key);
    }
  }
};

const keyboardEvents = {
  'Alt+KeyN': {
    action: () => {
      if (props.activeTab === wootConstants.ASSIGNEE_TYPE.ALL) {
        onTabChange(0);
      } else {
        const nextIndex = (activeTabIndex.value + 1) % props.items.length;
        onTabChange(nextIndex);
      }
    },
  },
};

useKeyboardEvents(keyboardEvents);
</script>

<template>
  <woot-tabs
    :index="activeTabIndex"
    class="w-full px-3 -mt-1 py-0 [&_ul]:p-0 h-10"
    @change="onTabChange"
  >
    <woot-tabs-item
      v-for="(item, index) in items"
      :key="item.key"
      class="text-sm [&_a]:font-medium"
      :index="index"
      :name="item.name"
      :count="item.count"
      is-compact
    >
      <span
        v-if="item.waitingCount > 0"
        v-tooltip.top="$t('CHAT_LIST.MINE_WAITING_COUNT', item.waitingCount)"
        data-test-id="mine-waiting-count"
        class="rounded-md h-5 flex items-center justify-center text-xs font-medium ltr:ml-1 rtl:mr-1 px-1.5 min-w-[20px] text-white bg-[#6B3FA0]"
      >
        {{ formatWaitingCount(item.waitingCount) }}
      </span>
    </woot-tabs-item>
  </woot-tabs>
</template>
