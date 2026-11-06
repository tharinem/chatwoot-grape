import { mount } from '@vue/test-utils';
import ChatTypeTabs from '../../ChatTypeTabs.vue';
import Tabs from '../../../ui/Tabs/Tabs.vue';
import TabsItem from '../../../ui/Tabs/TabsItem.vue';
import ConversationContextMenu from '../contextMenu/Index.vue';

vi.mock('dashboard/composables/useKeyboardEvents', () => ({
  useKeyboardEvents: vi.fn(),
}));

vi.mock('dashboard/composables/useAdmin', () => ({
  useAdmin: () => ({ isAdmin: { value: false } }),
}));

const $t = (key, count) => (count === undefined ? key : `${key}:${count}`);

describe('ChatTypeTabs waiting count', () => {
  const mountTabs = items =>
    mount(ChatTypeTabs, {
      props: { items, activeTab: 'me' },
      global: {
        components: {
          WootTabs: Tabs,
          WootTabsItem: TabsItem,
          FluentIcon: { render: () => null },
        },
        mocks: { $t },
      },
    });

  it('shows how many of my conversations are waiting for a reply', () => {
    const wrapper = mountTabs([
      { key: 'me', name: 'Minhas', count: 8, waitingCount: 3 },
      { key: 'all', name: 'Todas', count: 20, waitingCount: 0 },
    ]);

    const pills = wrapper.findAll('[data-test-id="mine-waiting-count"]');
    expect(pills).toHaveLength(1);
    expect(pills[0].text()).toBe('3');
  });

  it('hides the marker when nobody is waiting', () => {
    const wrapper = mountTabs([
      { key: 'me', name: 'Minhas', count: 8, waitingCount: 0 },
    ]);

    expect(wrapper.find('[data-test-id="mine-waiting-count"]').exists()).toBe(
      false
    );
  });
});

describe('Conversation context menu pin option', () => {
  const mountMenu = props =>
    mount(ConversationContextMenu, {
      props: { chatId: 1, inboxId: 1, status: 'open', ...props },
      global: {
        mocks: {
          $t,
          $store: {
            getters: {
              'labels/getLabels': [],
              'teams/getTeams': [],
              'inboxAssignableAgents/getUIFlags': {},
              'inboxAssignableAgents/getAssignableAgents': () => [],
              getCurrentUser: {},
              getCurrentAccountId: 1,
            },
            dispatch: vi.fn(),
          },
        },
        components: { FluentIcon: { render: () => null } },
        stubs: { MenuItemWithSubmenu: true, AgentLoadingPlaceholder: true },
      },
    });

  it('offers to pin an unpinned conversation and emits togglePin', async () => {
    const wrapper = mountMenu({ pinned: false });
    const item = wrapper.find('[data-test-id="conversation-pin-toggle"]');

    expect(item.text()).toContain('CONVERSATION.CARD_CONTEXT_MENU.PIN');
    await item.trigger('click');
    expect(wrapper.emitted('togglePin')).toHaveLength(1);
  });

  it('offers to unpin a pinned conversation', () => {
    const wrapper = mountMenu({ pinned: true });

    expect(
      wrapper.find('[data-test-id="conversation-pin-toggle"]').text()
    ).toContain('CONVERSATION.CARD_CONTEXT_MENU.UNPIN');
  });

  it('respects the allowed options list', () => {
    const wrapper = mountMenu({ allowedOptions: ['status'] });

    expect(
      wrapper.find('[data-test-id="conversation-pin-toggle"]').exists()
    ).toBe(false);
  });
});
