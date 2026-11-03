import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { emitter } from 'shared/helpers/mitt';
import TeamsAPI from 'dashboard/api/teams';
import TeamLeaf from '../TeamLeaf.vue';
import {
  useTeamQueueCounts,
  CONVERSATION_STATS_EVENT,
  REALTIME_DEBOUNCE_MS,
  POLL_INTERVAL_MS,
} from '../useTeamQueueCounts';

vi.mock('dashboard/api/teams', () => ({
  default: { getQueueCounts: vi.fn() },
}));

const mountLeaf = props =>
  mount(TeamLeaf, {
    props: { label: 'Vendas', ...props },
    global: {
      mocks: { $t: (key, count) => `${key}:${count}` },
      directives: { tooltip: {} },
    },
  });

describe('TeamLeaf', () => {
  it('shows the queue size next to the team name', () => {
    const wrapper = mountLeaf({ count: 7 });

    expect(wrapper.text()).toContain('Vendas');
    expect(wrapper.find('[data-test-id="team-queue-count"]').text()).toBe('7');
  });

  it('hides the number when the queue is empty', () => {
    const wrapper = mountLeaf({ count: 0 });

    expect(wrapper.find('[data-test-id="team-queue-count"]').exists()).toBe(
      false
    );
  });

  it('caps large numbers at 99+', () => {
    const wrapper = mountLeaf({ count: 150 });

    expect(wrapper.find('[data-test-id="team-queue-count"]').text()).toBe(
      '99+'
    );
  });
});

describe('useTeamQueueCounts', () => {
  let composable;
  let mounted = [];

  const mountComposable = () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          composable = useTeamQueueCounts();
          return () => h('div');
        },
      })
    );
    mounted.push(wrapper);
    return wrapper;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TeamsAPI.getQueueCounts.mockReset();
    TeamsAPI.getQueueCounts.mockResolvedValue({ data: { 1: 3 } });
  });

  afterEach(() => {
    mounted.forEach(wrapper => wrapper.unmount());
    mounted = [];
    vi.useRealTimers();
  });

  it('loads the counts on mount', async () => {
    mountComposable();
    await flushPromises();

    expect(TeamsAPI.getQueueCounts).toHaveBeenCalledTimes(1);
    expect(composable.getCount(1)).toBe(3);
    expect(composable.getCount(2)).toBe(0);
  });

  it('debounces realtime conversation events into a single request', async () => {
    mountComposable();
    await flushPromises();
    TeamsAPI.getQueueCounts.mockResolvedValue({ data: { 1: 4 } });

    emitter.emit(CONVERSATION_STATS_EVENT);
    emitter.emit(CONVERSATION_STATS_EVENT);
    emitter.emit(CONVERSATION_STATS_EVENT);
    expect(TeamsAPI.getQueueCounts).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(REALTIME_DEBOUNCE_MS);
    await flushPromises();

    expect(TeamsAPI.getQueueCounts).toHaveBeenCalledTimes(2);
    expect(composable.getCount(1)).toBe(4);
  });

  it('refreshes periodically as a fallback and stops after unmount', async () => {
    const wrapper = mountComposable();
    await flushPromises();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(TeamsAPI.getQueueCounts).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    mounted = [];
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    emitter.emit(CONVERSATION_STATS_EVENT);
    await vi.advanceTimersByTimeAsync(REALTIME_DEBOUNCE_MS);

    expect(TeamsAPI.getQueueCounts).toHaveBeenCalledTimes(2);
  });

  it('keeps the last known counts when a request fails', async () => {
    mountComposable();
    await flushPromises();
    TeamsAPI.getQueueCounts.mockRejectedValue(new Error('network'));

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await flushPromises();

    expect(composable.getCount(1)).toBe(3);
  });
});
