import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';

/**
 * "Fixar conversa": pin/unpin a conversation for the current user only.
 * Shared by the conversation card context menu and the header menu.
 */
export function useConversationPin() {
  const store = useStore();
  const { t } = useI18n();

  const togglePin = async conversation => {
    if (!conversation?.id) return;
    const pinned = !conversation.pinned;
    try {
      await store.dispatch('setConversationPinned', {
        conversationId: conversation.id,
        pinned,
      });
      useAlert(
        pinned
          ? t('CONVERSATION.CARD_CONTEXT_MENU.PIN_SUCCESS')
          : t('CONVERSATION.CARD_CONTEXT_MENU.UNPIN_SUCCESS')
      );
    } catch (error) {
      useAlert(
        error?.response?.data?.error ||
          t('CONVERSATION.CARD_CONTEXT_MENU.PIN_FAILED')
      );
    }
  };

  return { togglePin };
}
