<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useStore, useFunctionGetter } from 'dashboard/composables/store';
import { findComponentByType } from 'dashboard/helper/templateHelper';
import InboxesAPI from 'dashboard/api/inboxes';

import Input from 'dashboard/components-next/input/Input.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import WhatsappTemplateForm from './components/WhatsappTemplateForm.vue';
import WhatsappTemplatePreview from './components/WhatsappTemplatePreview.vue';

const props = defineProps({
  inbox: { type: Object, required: true },
});

const { t } = useI18n();
const store = useStore();

const inboxId = computed(() => props.inbox.id);
// Raw getter on purpose: shows every status (pending, rejected...), not only approved ones
const rawTemplates = useFunctionGetter('inboxes/getWhatsAppTemplates', inboxId);

const searchQuery = ref('');
const showForm = ref(false);
const isRefreshing = ref(false);
const showRefreshHint = ref(false);
const selectedKey = ref('');

const STATUS_LABELS = {
  APPROVED: () => t('WHATSAPP_TEMPLATES.MANAGE.STATUS.APPROVED'),
  PENDING: () => t('WHATSAPP_TEMPLATES.MANAGE.STATUS.PENDING'),
  REJECTED: () => t('WHATSAPP_TEMPLATES.MANAGE.STATUS.REJECTED'),
  PAUSED: () => t('WHATSAPP_TEMPLATES.MANAGE.STATUS.PAUSED'),
  DISABLED: () => t('WHATSAPP_TEMPLATES.MANAGE.STATUS.DISABLED'),
};
const STATUS_CLASSES = {
  APPROVED: 'text-n-teal-11',
  PENDING: 'text-n-amber-11',
  REJECTED: 'text-n-ruby-11',
};

const bodyText = template => findComponentByType(template, 'BODY')?.text || '';
const templateKey = template => `${template.name}:${template.language}`;

const templates = computed(() =>
  Array.isArray(rawTemplates.value) ? rawTemplates.value : []
);

const filteredTemplates = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return templates.value;
  return templates.value.filter(
    template =>
      String(template.name || '')
        .toLowerCase()
        .includes(query) || bodyText(template).toLowerCase().includes(query)
  );
});

const selectedTemplate = computed(() =>
  templates.value.find(template => templateKey(template) === selectedKey.value)
);

const normalizedStatus = template =>
  String(template.status || '').toUpperCase();

const statusLabel = template => {
  const label = STATUS_LABELS[normalizedStatus(template)];
  return label ? label() : t('WHATSAPP_TEMPLATES.MANAGE.STATUS.UNKNOWN');
};

const statusClass = template =>
  STATUS_CLASSES[normalizedStatus(template)] || 'text-n-slate-11';

const excerpt = template => {
  const text = bodyText(template);
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
};

// Refetch only this inbox and update just its templates in the store.
// Avoids `inboxes/get`, which toggles the global fetching flag and re-renders the whole settings page.
const refetchTemplates = async () => {
  const { data } = await InboxesAPI.show(inboxId.value);
  const current = store.state.inboxes.records.find(
    record => record.id === data?.id
  );
  if (!current) return;
  store.commit('inboxes/EDIT_INBOXES', {
    ...current,
    message_templates: data.message_templates,
  });
};

const refreshTemplates = async () => {
  isRefreshing.value = true;
  try {
    await store.dispatch('inboxes/syncTemplates', inboxId.value);
    await refetchTemplates();
    showRefreshHint.value = true;
  } catch (error) {
    useAlert(t('WHATSAPP_TEMPLATES.MANAGE.REFRESH_ERROR'));
  } finally {
    isRefreshing.value = false;
  }
};

const onTemplateCreated = async () => {
  showForm.value = false;
  showRefreshHint.value = true;
  // The backend already enqueued a sync; refetch so the list catches up when Meta answers
  try {
    await refetchTemplates();
  } catch (error) {
    // The list catches up on the next manual refresh
  }
};
</script>

<template>
  <div class="mx-6 flex flex-col gap-4">
    <WhatsappTemplateForm
      v-if="showForm"
      :inbox-id="inboxId"
      @created="onTemplateCreated"
      @cancel="showForm = false"
    />

    <template v-else>
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-medium text-n-slate-12">
          {{ $t('WHATSAPP_TEMPLATES.MANAGE.TITLE') }}
        </h2>
        <p class="text-sm text-n-slate-11">
          {{ $t('WHATSAPP_TEMPLATES.MANAGE.DESCRIPTION') }}
        </p>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          v-model="searchQuery"
          class="flex-1"
          name="template_search"
          :placeholder="$t('WHATSAPP_TEMPLATES.MANAGE.SEARCH_PLACEHOLDER')"
        />
        <NextButton
          faded
          slate
          icon="i-lucide-refresh-cw"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.REFRESH')"
          :is-loading="isRefreshing"
          data-test-id="refresh-templates"
          @click="refreshTemplates"
        />
        <NextButton
          icon="i-lucide-plus"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.NEW_TEMPLATE')"
          data-test-id="new-template"
          @click="showForm = true"
        />
      </div>

      <p
        v-if="showRefreshHint"
        class="text-xs text-n-slate-11"
        data-test-id="refresh-hint"
      >
        {{ $t('WHATSAPP_TEMPLATES.MANAGE.REFRESH_HINT') }}
      </p>

      <div class="flex flex-col gap-6 lg:flex-row">
        <div class="overflow-x-auto lg:basis-3/5">
          <p
            v-if="!templates.length"
            class="py-6 text-sm text-n-slate-11"
            data-test-id="templates-empty"
          >
            {{ $t('WHATSAPP_TEMPLATES.MANAGE.EMPTY') }}
          </p>
          <p
            v-else-if="!filteredTemplates.length"
            class="py-6 text-sm text-n-slate-11"
            data-test-id="templates-no-results"
          >
            {{ $t('WHATSAPP_TEMPLATES.MANAGE.NO_RESULTS') }}
          </p>
          <table v-else class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-n-slate-11">
                <th class="py-2 pr-3 font-medium">
                  {{ $t('WHATSAPP_TEMPLATES.MANAGE.COLUMNS.NAME') }}
                </th>
                <th class="py-2 pr-3 font-medium">
                  {{ $t('WHATSAPP_TEMPLATES.MANAGE.COLUMNS.CATEGORY') }}
                </th>
                <th class="py-2 pr-3 font-medium">
                  {{ $t('WHATSAPP_TEMPLATES.MANAGE.COLUMNS.STATUS') }}
                </th>
                <th class="py-2 pr-3 font-medium">
                  {{ $t('WHATSAPP_TEMPLATES.MANAGE.COLUMNS.LANGUAGE') }}
                </th>
                <th class="py-2 font-medium">
                  {{ $t('WHATSAPP_TEMPLATES.MANAGE.COLUMNS.BODY') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="template in filteredTemplates"
                :key="templateKey(template)"
                class="cursor-pointer border-t border-n-weak hover:bg-n-alpha-1"
                :class="{
                  'bg-n-alpha-2': templateKey(template) === selectedKey,
                }"
                data-test-id="template-row"
                @click="selectedKey = templateKey(template)"
              >
                <td class="py-2 pr-3 font-medium text-n-slate-12">
                  {{ template.name }}
                </td>
                <td class="py-2 pr-3 text-n-slate-11">
                  {{ template.category }}
                </td>
                <td class="py-2 pr-3">
                  <span
                    class="rounded-md bg-n-alpha-2 px-2 py-0.5 text-xs font-medium"
                    :class="statusClass(template)"
                    data-test-id="template-status"
                  >
                    {{ statusLabel(template) }}
                  </span>
                </td>
                <td class="py-2 pr-3 text-n-slate-11">
                  {{ template.language }}
                </td>
                <td class="py-2 text-n-slate-11">{{ excerpt(template) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <aside class="lg:basis-2/5">
          <WhatsappTemplatePreview
            v-if="selectedTemplate"
            :template="selectedTemplate"
          />
          <p v-else class="text-sm text-n-slate-11">
            {{ $t('WHATSAPP_TEMPLATES.MANAGE.PREVIEW_HINT') }}
          </p>
        </aside>
      </div>
    </template>
  </div>
</template>
