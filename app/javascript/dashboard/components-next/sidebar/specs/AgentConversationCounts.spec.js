import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { emitter } from 'shared/helpers/mitt';
import AgentsAPI from 'dashboard/api/agents';
import AgentLeaf from '../AgentLeaf.vue';
import { useAgentConversationCounts } from '../useAgentConversationCounts';
import {
  CONVERSATION_STATS_EVENT,
  REALTIME_DEBOUNCE_MS,
  POLL_INTERVAL_MS,
} from '../useTeamQueueCounts';

vi.mock('dashboard/api/agents', () => ({
  default: { getConversationCounts: vi.fn() },
}));

const mountLeaf = props =>
  mount(AgentLeaf, {
    props: { label: 'Ana', ...props },
    global: {
      mocks: { $t: (key, count) => `${key}:${count}` },
      directives: { tooltip: {} },
    },
  });

describe('AgentLeaf', () => {
  it('shows open and waiting counts next to the agent name', () => {
    const wrapper = mountLeaf({ open: 12, waiting: 3 });

    expect(wrapper.text()).toContain('Ana');
    expect(wrapper.find('[data-test-id="agent-open-count"]').text()).toBe('12');
    expect(wrapper.find('[data-test-id="agent-waiting-count"]').text()).toBe(
      '3'
    );
  });

  it('hides the numbers that are zero', () => {
    const wrapper = mountLeaf({ open: 2, waiting: 0 });

    expect(wrapper.find('[data-test-id="agent-open-count"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-test-id="agent-waiting-count"]').exists()).toBe(
      false
    );
  });

  it('caps large numbers at 99+', () => {
    const wrapper = mountLeaf({ open: 150, waiting: 120 });

    expect(wrapper.find('[data-test-id="agent-open-count"]').text()).toBe(
      '99+'
    );
    expect(wrapper.find('[data-test-id="agent-waiting-count"]').text()).toBe(
      '99+'
    );
  });
});

describe('useAgentConversationCounts', () => {
  let composable;
  let mounted = [];

  const mountComposable = (options = {}) => {
    const wrapper = mount(
      defineComponent({
        setup() {
          composable = useAgentConversationCounts(options);
          return () => h('div');
        },
      })
    );
    mounted.push(wrapper);
    return wrapper;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    AgentsAPI.getConversationCounts.mockReset();
    AgentsAPI.getConversationCounts.mockResolvedValue({
      data: { 4: { open: 5, waiting: 2 }, 9: { open: 0, waiting: 0 } },
    });
  });

  afterEach(() => {
    mounted.forEach(wrapper => wrapper.unmount());
    mounted = [];
    vi.useRealTimers();
  });

  it('loads the counts on mount', async () => {
    mountComposable();
    await flushPromises();

    expect(AgentsAPI.getConversationCounts).toHaveBeenCalledTimes(1);
    expect(composable.getCounts(4)).toEqual({ open: 5, waiting: 2 });
    expect(composable.hasAgent(9)).toBe(true);
    expect(composable.hasAgent(1)).toBe(false);
    expect(composable.getCounts(1)).toEqual({ open: 0, waiting: 0 });
  });

  it('does not call the admin-only endpoint when disabled', async () => {
    mountComposable({ enabled: ref(false) });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(AgentsAPI.getConversationCounts).not.toHaveBeenCalled();
  });

  it('debounces realtime conversation events into a single request', async () => {
    mountComposable();
    await flushPromises();
    AgentsAPI.getConversationCounts.mockResolvedValue({
      data: { 4: { open: 6, waiting: 3 } },
    });

    emitter.emit(CONVERSATION_STATS_EVENT);
    emitter.emit(CONVERSATION_STATS_EVENT);
    expect(AgentsAPI.getConversationCounts).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(REALTIME_DEBOUNCE_MS);
    await flushPromises();

    expect(AgentsAPI.getConversationCounts).toHaveBeenCalledTimes(2);
    expect(composable.getCounts(4)).toEqual({ open: 6, waiting: 3 });
  });

  it('keeps the last known counts when a request fails', async () => {
    mountComposable();
    await flushPromises();
    AgentsAPI.getConversationCounts.mockRejectedValue(new Error('network'));

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await flushPromises();

    expect(composable.getCounts(4)).toEqual({ open: 5, waiting: 2 });
  });
});
