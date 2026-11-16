import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ConversationCard from '../ConversationCard.vue';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('dashboard/composables/store', () => ({
  useStore: () => ({
    getters: {
      'contacts/getContact': () => ({}),
      'inboxes/getInbox': () => ({ id: 1 }),
    },
  }),
  useMapGetter: name => {
    const values = {
      getSelectedChat: {},
      'inboxes/getInboxes': [],
      getSelectedInbox: null,
      getCurrentAccountId: 1,
    };
    return ref(values[name]);
  },
}));

vi.mock('dashboard/composables/useConversationPin', () => ({
  useConversationPin: () => ({ togglePin: vi.fn() }),
}));

describe('ConversationCard context menu scroll lock', () => {
  const mountCard = onToggle =>
    mount(ConversationCard, {
      props: {
        chat: { id: 7, inbox_id: 1, meta: {}, messages: [] },
        enableContextMenu: true,
        onContextMenuToggle: onToggle,
      },
      global: {
        mocks: { $t: key => key },
        stubs: {
          Avatar: true,
          MessagePreview: true,
          InboxName: true,
          TimeAgo: true,
          CardLabels: true,
          PriorityMark: true,
          SLACardLabel: true,
          ContextMenu: true,
          ConversationContextMenu: true,
          VoiceCallStatus: true,
          Icon: true,
        },
      },
    });

  it('releases the list scroll lock when unmounted with the menu open', async () => {
    const onToggle = vi.fn();
    const wrapper = mountCard(onToggle);
    await wrapper.trigger('contextmenu');
    expect(onToggle.mock.calls).toEqual([[true]]);

    wrapper.unmount();
    expect(onToggle.mock.calls).toEqual([[true], [false]]);
  });

  it('does not emit anything on unmount when the menu was closed', () => {
    const onToggle = vi.fn();
    const wrapper = mountCard(onToggle);
    wrapper.unmount();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
