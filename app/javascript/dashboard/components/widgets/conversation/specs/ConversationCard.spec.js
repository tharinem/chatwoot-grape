import { mount } from '@vue/test-utils';
import { createStore } from 'vuex';
import ConversationCard from '../ConversationCard.vue';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

const chat = {
  id: 42,
  inbox_id: 7,
  unread_count: 0,
  labels: [],
  timestamp: 1700000000,
  created_at: 1700000000,
  messages: [],
  meta: { sender: { id: 3 }, assignee: {} },
  additional_attributes: {},
};

const createTestStore = () =>
  createStore({
    getters: {
      getSelectedChat: () => ({ id: 1 }),
      'inboxes/getInboxes': () => [{ id: 7 }],
      getSelectedInbox: () => null,
      getCurrentAccountId: () => 1,
      'contacts/getContact': () => () => ({ id: 3, name: 'Maria' }),
      'inboxes/getInbox': () => id => ({ id }),
    },
  });

const mountCard = (props = {}) =>
  mount(ConversationCard, {
    props: { chat, ...props },
    global: {
      plugins: [createTestStore()],
      stubs: {
        MessagePreview: true,
        InboxName: true,
        TimeAgo: true,
        CardLabels: true,
        PriorityMark: true,
        SLACardLabel: true,
        VoiceCallStatus: true,
        ContextMenu: true,
        ConversationContextMenu: true,
        FluentIcon: true,
        Avatar: {
          template:
            '<div class="avatar"><slot name="overlay" :size="32" /></div>',
        },
      },
    },
  });

const checkbox = wrapper => wrapper.find('input[type="checkbox"]');

describe('ConversationCard selection', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('keeps the desktop behaviour: checkbox hidden and a click opens the chat', async () => {
    const wrapper = mountCard();
    expect(checkbox(wrapper).exists()).toBe(false);

    await wrapper.trigger('click');
    expect(push).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('selectConversation')).toBeUndefined();
  });

  it('shows the checkbox on every card in selection mode', () => {
    const wrapper = mountCard({ selectionMode: true });
    expect(checkbox(wrapper).exists()).toBe(true);
  });

  it('selects on tap instead of navigating in selection mode', async () => {
    const wrapper = mountCard({ selectionMode: true });
    await wrapper.trigger('click');

    expect(push).not.toHaveBeenCalled();
    expect(wrapper.emitted('selectConversation')).toEqual([[42, 7]]);
  });

  it('deselects on tap when the card is already selected', async () => {
    const wrapper = mountCard({ selectionMode: true, selected: true });
    await wrapper.trigger('click');

    expect(push).not.toHaveBeenCalled();
    expect(wrapper.emitted('deSelectConversation')).toEqual([[42, 7]]);
  });

  it('toggles once when the checkbox itself is tapped', async () => {
    const wrapper = mountCard({ selectionMode: true });
    await checkbox(wrapper).setValue(true);

    expect(push).not.toHaveBeenCalled();
    expect(wrapper.emitted('selectConversation')).toEqual([[42, 7]]);
  });
});
