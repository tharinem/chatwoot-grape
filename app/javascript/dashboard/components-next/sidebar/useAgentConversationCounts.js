import { ref, onMounted, onBeforeUnmount, unref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import AgentsAPI from 'dashboard/api/agents';
import {
  CONVERSATION_STATS_EVENT,
  REALTIME_DEBOUNCE_MS,
  REALTIME_MAX_WAIT_MS,
  POLL_INTERVAL_MS,
} from './useTeamQueueCounts';

const EMPTY = Object.freeze({ open: 0, waiting: 0 });

/**
 * Painel da gerência: open and waiting-for-reply conversations per agent,
 * as `{ [agentId]: { open, waiting } }`. Same refresh strategy as the team
 * queue counter (realtime debounce + 60 s fallback poll). The endpoint is
 * admin-only, so nothing is requested while `enabled` is false.
 */
export function useAgentConversationCounts({ enabled = true } = {}) {
  const counts = ref({});
  let isFetching = false;
  let intervalId = null;

  const fetchCounts = async () => {
    if (!unref(enabled) || isFetching) return;
    isFetching = true;
    try {
      const { data } = await AgentsAPI.getConversationCounts();
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

  const getCounts = agentId => counts.value[agentId] || EMPTY;
  const hasAgent = agentId => Boolean(counts.value[agentId]);

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

  return { counts, getCounts, hasAgent, fetchCounts };
}
