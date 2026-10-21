import { computed, unref } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';
import {
  getContactHighlight,
  resolveContactHighlightConfig,
} from 'dashboard/helper/contactHighlight';

/**
 * Highlight state (blocked / exclusive seller / default) for a contact,
 * using the attribute names configured on the current account.
 * @param {import('vue').Ref<Object>|Object} contact
 */
export function useContactHighlight(contact) {
  const currentAccountId = useMapGetter('getCurrentAccountId');
  const getAccount = useMapGetter('accounts/getAccount');

  const config = computed(() => {
    const account = getAccount.value?.(currentAccountId.value) || {};
    return resolveContactHighlightConfig(account.settings);
  });

  const highlight = computed(() =>
    getContactHighlight(unref(contact)?.custom_attributes, config.value)
  );

  return { config, highlight };
}
