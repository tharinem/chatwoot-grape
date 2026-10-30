import { mount } from '@vue/test-utils';
import ChatListHeader from '../ChatListHeader.vue';

vi.mock('dashboard/composables/useUISettings', () => ({
  useUISettings: () => ({
    uiSettings: { value: {} },
    updateUISettings: vi.fn(),
  }),
}));

const baseProps = {
  pageTitle: 'Conversations',
  hasAppliedFilters: false,
  hasActiveFolders: false,
  activeStatus: 'open',
  isOnExpandedLayout: false,
  conversationStats: {},
  isListLoading: false,
};

const mountHeader = (props = {}) =>
  mount(ChatListHeader, {
    props: { ...baseProps, ...props },
    global: {
      stubs: {
        ConversationBasicFilter: true,
        SwitchLayout: true,
        NextButton: {
          props: ['label'],
          emits: ['click'],
          template:
            '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  });

const toggle = wrapper => wrapper.find('[data-testid="selection-mode-toggle"]');

describe('ChatListHeader selection toggle', () => {
  it('is hidden on desktop', () => {
    const wrapper = mountHeader();
    expect(toggle(wrapper).exists()).toBe(false);
  });

  it('shows "Select" when the touch selection mode is available', () => {
    const wrapper = mountHeader({ showSelectionToggle: true });
    expect(toggle(wrapper).exists()).toBe(true);
    expect(toggle(wrapper).text()).toBe('Select');
  });

  it('shows "Done" while the mode is on and emits the toggle', async () => {
    const wrapper = mountHeader({
      showSelectionToggle: true,
      isSelectionMode: true,
    });
    expect(toggle(wrapper).text()).toBe('Done');
    await toggle(wrapper).trigger('click');
    expect(wrapper.emitted('toggleSelectionMode')).toHaveLength(1);
  });
});
