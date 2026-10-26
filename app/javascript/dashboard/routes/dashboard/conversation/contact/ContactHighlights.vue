<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter } from 'dashboard/composables/store';
import { useContactHighlight } from 'dashboard/composables/useContactHighlight';
import Icon from 'dashboard/components-next/icon/Icon.vue';

const props = defineProps({
  contact: {
    type: Object,
    default: () => ({}),
  },
});

const { t } = useI18n();
const contact = computed(() => props.contact);
const { config, highlight, extraHighlights } = useContactHighlight(contact);

const getAttributesByModel = useMapGetter('attributes/getAttributesByModel');

const attributeLabel = (attributeKey, fallbackLabel) => {
  const definitions = getAttributesByModel.value?.('contact_attribute') || [];
  const definition = definitions.find(
    item => item.attribute_key === attributeKey
  );
  return definition?.attribute_display_name || fallbackLabel;
};

const displayTextLabel = computed(() =>
  attributeLabel(
    config.value.displayTextAttribute,
    t('CONTACT_PANEL.HIGHLIGHTS.DISPLAY_TEXT')
  )
);

const exclusiveSellerLabel = computed(() =>
  attributeLabel(
    config.value.exclusiveSellerAttribute,
    t('CONTACT_PANEL.HIGHLIGHTS.EXCLUSIVE_SELLER')
  )
);

const hasHighlights = computed(
  () =>
    !!highlight.value.displayText ||
    !!highlight.value.exclusiveSeller ||
    highlight.value.isBlocked ||
    extraHighlights.value.length > 0
);
</script>

<template>
  <div class="contents">
    <div
      v-if="hasHighlights"
      class="flex flex-col gap-2 px-4 pt-3"
      data-test-id="contact-highlights"
    >
      <div
        v-if="highlight.isBlocked"
        class="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-lg bg-n-ruby-9"
        data-test-id="contact-highlights-blocked"
      >
        <Icon icon="i-ph-warning-circle-bold" class="flex-shrink-0 size-4" />
        <span>{{ t('CONTACT_PANEL.HIGHLIGHTS.BLOCKED_BADGE') }}</span>
      </div>

      <div
        v-if="highlight.displayText"
        class="flex flex-col gap-1 px-3 py-2.5 rounded-lg border"
        :class="
          highlight.isBlocked
            ? 'bg-n-ruby-2 border-n-ruby-7'
            : 'bg-n-amber-2 border-n-amber-7'
        "
        data-test-id="contact-highlights-display-text"
      >
        <span
          class="text-xs font-medium uppercase tracking-wide"
          :class="highlight.isBlocked ? 'text-n-ruby-11' : 'text-n-amber-11'"
        >
          {{ displayTextLabel }}
        </span>
        <p
          class="mb-0 text-sm font-medium whitespace-pre-line break-words text-n-slate-12"
        >
          {{ highlight.displayText }}
        </p>
      </div>

      <div
        v-if="highlight.exclusiveSeller"
        class="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#6B3FA0]/40 bg-[#6B3FA0]/10"
        data-test-id="contact-highlights-exclusive-seller"
      >
        <Icon
          icon="i-ph-user-circle-check-bold"
          class="flex-shrink-0 size-4 text-[#6B3FA0] dark:text-[#B794E0]"
        />
        <div class="flex flex-col min-w-0">
          <span
            class="text-xs font-medium uppercase tracking-wide text-[#6B3FA0] dark:text-[#B794E0]"
          >
            {{ exclusiveSellerLabel }}
          </span>
          <span class="text-sm font-semibold break-words text-n-slate-12">
            {{ highlight.exclusiveSeller }}
          </span>
        </div>
      </div>

      <div
        v-for="item in extraHighlights"
        :key="item.key"
        class="flex flex-col gap-0.5 px-3 py-2 rounded-lg border border-n-weak bg-n-alpha-1"
        data-test-id="contact-highlights-extra"
      >
        <span
          class="text-xs font-medium uppercase tracking-wide text-n-slate-11"
        >
          {{ attributeLabel(item.key, item.key) }}
        </span>
        <span
          class="text-sm font-semibold whitespace-pre-line break-words text-n-slate-12"
        >
          {{ item.value }}
        </span>
      </div>
    </div>
  </div>
</template>
