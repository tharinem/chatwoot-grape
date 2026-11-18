<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  // { sent, delivered, read, failed } with cumulative counts, or null when the
  // campaign has no recorded sends (e.g. sent before tracking existed).
  stats: {
    type: Object,
    default: null,
  },
});

const { t } = useI18n();

const items = computed(() => {
  if (!props.stats) return [];
  return [
    { key: 'sent', label: t('CAMPAIGN.WHATSAPP.CARD.DELIVERY_STATS.SENT') },
    {
      key: 'delivered',
      label: t('CAMPAIGN.WHATSAPP.CARD.DELIVERY_STATS.DELIVERED'),
    },
    { key: 'read', label: t('CAMPAIGN.WHATSAPP.CARD.DELIVERY_STATS.READ') },
    { key: 'failed', label: t('CAMPAIGN.WHATSAPP.CARD.DELIVERY_STATS.FAILED') },
  ].map(item => ({ ...item, value: props.stats[item.key] || 0 }));
});

const readRate = computed(() => {
  const sent = props.stats?.sent || 0;
  if (!sent) return null;
  return Math.round(((props.stats.read || 0) / sent) * 100);
});
</script>

<template>
  <div
    class="flex flex-wrap items-center w-full text-sm gap-x-3 gap-y-1"
    data-test-id="campaign-delivery-stats"
  >
    <span v-if="!stats" class="text-n-slate-11" data-test-id="no-data">
      {{ t('CAMPAIGN.WHATSAPP.CARD.DELIVERY_STATS.NO_DATA') }}
    </span>
    <template v-else>
      <span
        v-for="item in items"
        :key="item.key"
        class="inline-flex items-center gap-1 whitespace-nowrap"
        :data-test-id="`stat-${item.key}`"
      >
        <span class="text-n-slate-11">{{ item.label }}</span>
        <span
          class="font-medium"
          :class="
            item.key === 'failed' && item.value
              ? 'text-n-ruby-11'
              : 'text-n-slate-12'
          "
        >
          {{ item.value }}
        </span>
      </span>
      <span
        v-if="readRate !== null"
        class="text-xs font-medium inline-flex items-center h-6 px-2 py-0.5 rounded-md bg-n-alpha-2 text-n-slate-12 whitespace-nowrap"
        data-test-id="read-rate"
      >
        {{
          t('CAMPAIGN.WHATSAPP.CARD.DELIVERY_STATS.READ_RATE', {
            rate: readRate,
          })
        }}
      </span>
    </template>
  </div>
</template>
