<script setup>
import Button from 'dashboard/components-next/button/Button.vue';
import ButtonGroup from 'dashboard/components-next/buttonGroup/ButtonGroup.vue';
import { useUISettings } from 'dashboard/composables/useUISettings';
import { computed } from 'vue';
import { FEATURE_FLAGS } from 'dashboard/featureFlags';
import { useMapGetter } from 'dashboard/composables/store';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import { useI18n } from 'vue-i18n';
import { useContactHighlight } from 'dashboard/composables/useContactHighlight';
import { CONTACT_HIGHLIGHT_STATUS } from 'dashboard/helper/contactHighlight';

const { updateUISettings } = useUISettings();

const currentAccountId = useMapGetter('getCurrentAccountId');
const isFeatureEnabledonAccount = useMapGetter(
  'accounts/isFeatureEnabledonAccount'
);

const showCopilotTab = computed(() =>
  isFeatureEnabledonAccount.value(currentAccountId.value, FEATURE_FLAGS.CAPTAIN)
);

const { t } = useI18n();
const { uiSettings } = useUISettings();

const currentChat = useMapGetter('getSelectedChat');
const contactGetter = useMapGetter('contacts/getContact');
const contact = computed(() => {
  const sender = currentChat.value?.meta?.sender || {};
  const storedContact = sender.id ? contactGetter.value(sender.id) : {};
  return storedContact?.custom_attributes ? storedContact : sender;
});
const { highlight } = useContactHighlight(contact);

const CONTACT_BUTTON_CLASSES = {
  [CONTACT_HIGHLIGHT_STATUS.BLOCKED]:
    '!bg-n-ruby-9 !text-white hover:!bg-n-ruby-10 ring-2 ring-n-ruby-9/30',
  [CONTACT_HIGHLIGHT_STATUS.EXCLUSIVE_SELLER]:
    '!bg-[#6B3FA0] !text-white hover:!bg-[#5A3388] ring-2 ring-[#6B3FA0]/30',
  [CONTACT_HIGHLIGHT_STATUS.DEFAULT]:
    '!bg-n-alpha-3 !text-n-slate-12 ring-1 ring-n-slate-7',
};

const contactButtonClass = computed(
  () =>
    CONTACT_BUTTON_CLASSES[highlight.value.status] ||
    CONTACT_BUTTON_CLASSES[CONTACT_HIGHLIGHT_STATUS.DEFAULT]
);

const contactButtonTooltip = computed(() => {
  const label = t('CONVERSATION.SIDEBAR.CONTACT');
  if (highlight.value.status === CONTACT_HIGHLIGHT_STATUS.BLOCKED) {
    return `${label} · ${t('CONTACT_PANEL.HIGHLIGHTS.BLOCKED_BADGE')}`;
  }
  if (highlight.value.status === CONTACT_HIGHLIGHT_STATUS.EXCLUSIVE_SELLER) {
    return `${label} · ${t('CONTACT_PANEL.HIGHLIGHTS.EXCLUSIVE_SELLER')}: ${
      highlight.value.exclusiveSeller
    }`;
  }
  return label;
});
const isContactSidebarOpen = computed(
  () => uiSettings.value.is_contact_sidebar_open
);
const isCopilotPanelOpen = computed(
  () => uiSettings.value.is_copilot_panel_open
);

const handleConversationSidebarToggle = () => {
  updateUISettings({
    is_contact_sidebar_open: !isContactSidebarOpen.value,
    is_copilot_panel_open: false,
  });
};

const handleCopilotSidebarToggle = () => {
  updateUISettings({
    is_contact_sidebar_open: false,
    is_copilot_panel_open: !isCopilotPanelOpen.value,
  });
};

const keyboardEvents = {
  'Alt+KeyO': {
    action: handleConversationSidebarToggle,
  },
};
useKeyboardEvents(keyboardEvents);
</script>

<template>
  <ButtonGroup
    class="flex flex-col justify-center items-center absolute top-36 xl:top-24 ltr:right-2 rtl:left-2 bg-n-solid-2/90 backdrop-blur-lg border border-n-weak/50 rounded-full gap-1.5 p-1.5 shadow-sm transition-shadow duration-200 hover:shadow !z-20"
  >
    <Button
      v-tooltip.top="contactButtonTooltip"
      ghost
      slate
      sm
      class="!rounded-full transition-all duration-[250ms] ease-out active:!scale-95 active:!brightness-105 active:duration-75"
      :class="[
        contactButtonClass,
        { 'active:shadow-sm': isContactSidebarOpen },
      ]"
      :data-highlight="highlight.status"
      :aria-label="contactButtonTooltip"
      icon="i-ph-user-bold"
      @click="handleConversationSidebarToggle"
    />
    <Button
      v-if="showCopilotTab"
      v-tooltip.bottom="$t('CONVERSATION.SIDEBAR.COPILOT')"
      ghost
      slate
      sm
      class="!rounded-full transition-all duration-[250ms] ease-out active:!scale-95 active:duration-75"
      :class="{
        'bg-n-alpha-2 !text-n-iris-9 active:!brightness-105 active:shadow-sm':
          isCopilotPanelOpen,
      }"
      icon="i-woot-captain"
      @click="handleCopilotSidebarToggle"
    />
  </ButtonGroup>
</template>
