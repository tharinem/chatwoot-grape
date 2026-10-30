import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import TeamsAPI from 'dashboard/api/teams';

// Realtime conversation events (created, status/assignee/team changed) are
// funneled by the action cable connector into `fetch_conversation_stats`.
export const CONVERSATION_STATS_EVENT = 'fetch_conversation_stats';
export const REALTIME_DEBOUNCE_MS = 4000;
// Under a steady stream of events, still refresh at least this often.
export const REALTIME_MAX_WAIT_MS = 15000;
export const POLL_INTERVAL_MS = 60000;

/**
 * Queue size (open + unassigned conversations) per team, as a map
 * `{ [teamId]: count }`. Teams with an empty queue are absent from the map.
 */
export function useTeamQueueCounts() {
  const counts = ref({});
  let isFetching = false;
  let intervalId = null;

  const fetchCounts = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
      const { data } = await TeamsAPI.getQueueCounts();
      counts.value = data || {};
    } catch {
      // Keep the last known numbers; the next event or poll will retry.
    } finally {
      isFetching = false;
    }
  };

  const debouncedFetch = useDebounceFn(fetchCounts, REALTIME_DEBOUNCE_MS, {
    maxWait: REALTIME_MAX_WAIT_MS,
  });

  const onPoll = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    fetchCounts();
  };

  const getCount = teamId => counts.value[teamId] || 0;

  onMounted(() => {
    fetchCounts();
    emitter.on(CONVERSATION_STATS_EVENT, debouncedFetch);
    emitter.on(BUS_EVENTS.WEBSOCKET_RECONNECT, debouncedFetch);
    intervalId = setInterval(onPoll, POLL_INTERVAL_MS);
  });

  onBeforeUnmount(() => {
    emitter.off(CONVERSATION_STATS_EVENT, debouncedFetch);
    emitter.off(BUS_EVENTS.WEBSOCKET_RECONNECT, debouncedFetch);
    clearInterval(intervalId);
  });

  return { counts, getCount, fetchCounts };
}
