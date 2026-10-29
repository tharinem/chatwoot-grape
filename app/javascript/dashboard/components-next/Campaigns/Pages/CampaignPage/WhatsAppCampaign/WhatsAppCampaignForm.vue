<script setup>
import { reactive, computed, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVuelidate } from '@vuelidate/core';
import { required, minLength } from '@vuelidate/validators';
import { useMapGetter } from 'dashboard/composables/store';

import Input from 'dashboard/components-next/input/Input.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import ComboBox from 'dashboard/components-next/combobox/ComboBox.vue';
import TagMultiSelectComboBox from 'dashboard/components-next/combobox/TagMultiSelectComboBox.vue';
import WhatsAppTemplateParser from 'dashboard/components-next/whatsapp/WhatsAppTemplateParser.vue';
import {
  MIN_SCHEDULE_LEAD_MINUTES,
  currentLocalDateTimeInput,
  formatToUTCString,
  isAtLeastMinutesAhead,
  toLocalDateTimeInput,
} from './scheduledAtHelper';

const props = defineProps({
  mode: {
    type: String,
    default: 'create',
    validator: value => ['edit', 'create'].includes(value),
  },
  selectedCampaign: {
    type: Object,
    default: null,
  },
  showActionButtons: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['submit', 'cancel']);

const { t } = useI18n();

const formState = {
  uiFlags: useMapGetter('campaigns/getUIFlags'),
  labels: useMapGetter('labels/getLabels'),
  inboxes: useMapGetter('inboxes/getWhatsAppInboxes'),
  getFilteredWhatsAppTemplates: useMapGetter(
    'inboxes/getFilteredWhatsAppTemplates'
  ),
};

const initialState = {
  title: '',
  inboxId: null,
  templateId: null,
  scheduledAt: null,
  selectedAudience: [],
};

const isEditMode = computed(
  () => props.mode === 'edit' && !!props.selectedCampaign
);

const findTemplateId = (inboxId, templateParams) => {
  if (!inboxId || !templateParams?.name) return null;
  const templates = formState.getFilteredWhatsAppTemplates.value(inboxId) || [];
  const match = templates.find(
    template =>
      template.name === templateParams.name &&
      (!templateParams.language ||
        template.language === templateParams.language)
  );
  return match?.id ?? null;
};

const buildStateFromCampaign = campaign => {
  const inboxId = campaign.inbox?.id ?? null;
  return {
    title: campaign.title || '',
    inboxId,
    templateId: findTemplateId(inboxId, campaign.template_params),
    scheduledAt: toLocalDateTimeInput(campaign.scheduled_at),
    selectedAudience: (campaign.audience || [])
      .filter(item => item.type === 'Label')
      .map(item => item.id),
  };
};

const state = reactive(
  isEditMode.value
    ? buildStateFromCampaign(props.selectedCampaign)
    : { ...initialState }
);
const templateParserRef = ref(null);

// Reference time for the "in the future" rule. Refreshed before each
// validation so a form left open for a while is not checked against the
// moment it was opened.
const now = ref(Date.now());

// The input's min attribute is not enforced on a JS submit, so the rule
// keeps a past date from reaching the API (the scheduler would send it
// right away and mark the campaign as completed).
const isInFuture = value =>
  !value || isAtLeastMinutesAhead(value, MIN_SCHEDULE_LEAD_MINUTES, now.value);

const rules = {
  title: { required, minLength: minLength(1) },
  inboxId: { required },
  templateId: { required },
  scheduledAt: { required, isInFuture },
  selectedAudience: { required },
};

const v$ = useVuelidate(rules, state);

// A saved time that is already too close or past shows its error right away.
if (isEditMode.value) v$.value.scheduledAt.$touch();

const isCreating = computed(() => formState.uiFlags.value.isCreating);
const isUpdating = computed(() => formState.uiFlags.value.isUpdating);
const isSubmitting = computed(() =>
  isEditMode.value ? isUpdating.value : isCreating.value
);

const submitButtonLabel = computed(() =>
  isEditMode.value
    ? t('CAMPAIGN.WHATSAPP.EDIT.FORM.BUTTONS.SAVE')
    : t('CAMPAIGN.WHATSAPP.CREATE.FORM.BUTTONS.CREATE')
);

// Added to disable the scheduled at field from being set to the current time
const currentDateTime = computed(() => currentLocalDateTimeInput(now.value));

const mapToOptions = (items, valueKey, labelKey) =>
  items?.map(item => ({
    value: item[valueKey],
    label: item[labelKey],
  })) ?? [];

const audienceList = computed(() =>
  mapToOptions(formState.labels.value, 'id', 'title')
);

const inboxOptions = computed(() =>
  mapToOptions(formState.inboxes.value, 'id', 'name')
);

const templateOptions = computed(() => {
  if (!state.inboxId) return [];
  const templates = formState.getFilteredWhatsAppTemplates.value(state.inboxId);
  return templates.map(template => {
    // Create a more user-friendly label from template name
    const friendlyName = template.name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    return {
      value: template.id,
      label: `${friendlyName} (${template.language || 'en'})`,
      template: template,
    };
  });
});

const selectedTemplate = computed(() => {
  if (!state.templateId) return null;
  return templateOptions.value.find(option => option.value === state.templateId)
    ?.template;
});

// Prefill the template variables only while the campaign's own template is
// selected; picking another template starts from empty values.
const templateInitialParams = computed(() => {
  if (!isEditMode.value || !selectedTemplate.value) return null;
  const savedParams = props.selectedCampaign.template_params;
  if (savedParams?.name !== selectedTemplate.value.name) return null;
  return savedParams?.processed_params || null;
});

const getErrorMessage = (field, errorKey) => {
  const baseKey = 'CAMPAIGN.WHATSAPP.CREATE.FORM';
  return v$.value[field].$error ? t(`${baseKey}.${errorKey}.ERROR`) : '';
};

const scheduledAtError = computed(() => {
  const field = v$.value.scheduledAt;
  if (!field.$error) return '';
  return field.required.$invalid
    ? t('CAMPAIGN.WHATSAPP.CREATE.FORM.SCHEDULED_AT.ERROR')
    : t('CAMPAIGN.WHATSAPP.CREATE.FORM.SCHEDULED_AT.FUTURE_ERROR');
});

const formErrors = computed(() => ({
  title: getErrorMessage('title', 'TITLE'),
  inbox: getErrorMessage('inboxId', 'INBOX'),
  template: getErrorMessage('templateId', 'TEMPLATE'),
  scheduledAt: scheduledAtError.value,
  audience: getErrorMessage('selectedAudience', 'AUDIENCE'),
}));

const hasRequiredTemplateParams = computed(() => {
  return templateParserRef.value?.v$?.$invalid === false || true;
});

const isSubmitDisabled = computed(
  () => v$.value.$invalid || !hasRequiredTemplateParams.value
);

const resetState = () => {
  Object.assign(state, initialState);
  v$.value.$reset();
};

const handleCancel = () => emit('cancel');

const prepareCampaignDetails = () => {
  // Find the selected template to get its content
  const currentTemplate = selectedTemplate.value;
  const parserData = templateParserRef.value;

  // Extract template content - this should be the template message body
  const templateContent = parserData?.renderedTemplate || '';

  // Prepare template_params object with the same structure as used in contacts
  const templateParams = {
    name: currentTemplate?.name || '',
    namespace: currentTemplate?.namespace || '',
    category: currentTemplate?.category || 'UTILITY',
    language: currentTemplate?.language || 'en_US',
    processed_params: parserData?.processedParams || {},
  };

  const details = {
    title: state.title,
    message: templateContent,
    template_params: templateParams,
    scheduled_at: formatToUTCString(state.scheduledAt),
    audience: state.selectedAudience?.map(id => ({
      id,
      type: 'Label',
    })),
  };

  // The inbox is fixed once the campaign exists.
  if (!isEditMode.value) details.inbox_id = state.inboxId;

  return details;
};

const validate = () => {
  now.value = Date.now();
  return v$.value.$validate();
};

const handleSubmit = async () => {
  const isFormValid = await validate();
  if (!isFormValid) return;

  emit('submit', prepareCampaignDetails());
  if (isEditMode.value) return;

  resetState();
  handleCancel();
};

// Reset template selection when inbox changes
watch(
  () => state.inboxId,
  () => {
    if (isEditMode.value) return;
    state.templateId = null;
  }
);

defineExpose({ prepareCampaignDetails, isSubmitDisabled, v$, validate });
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
    <Input
      v-model="state.title"
      :label="t('CAMPAIGN.WHATSAPP.CREATE.FORM.TITLE.LABEL')"
      :placeholder="t('CAMPAIGN.WHATSAPP.CREATE.FORM.TITLE.PLACEHOLDER')"
      :message="formErrors.title"
      :message-type="formErrors.title ? 'error' : 'info'"
    />

    <div class="flex flex-col gap-1">
      <label for="inbox" class="mb-0.5 text-sm font-medium text-n-slate-12">
        {{ t('CAMPAIGN.WHATSAPP.CREATE.FORM.INBOX.LABEL') }}
      </label>
      <ComboBox
        id="inbox"
        v-model="state.inboxId"
        :options="inboxOptions"
        :has-error="!!formErrors.inbox"
        :placeholder="t('CAMPAIGN.WHATSAPP.CREATE.FORM.INBOX.PLACEHOLDER')"
        :message="formErrors.inbox"
        :disabled="isEditMode"
        class="[&>div>button]:bg-n-alpha-black2 [&>div>button:not(.focused)]:dark:outline-n-weak [&>div>button:not(.focused)]:hover:!outline-n-slate-6"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label for="template" class="mb-0.5 text-sm font-medium text-n-slate-12">
        {{ t('CAMPAIGN.WHATSAPP.CREATE.FORM.TEMPLATE.LABEL') }}
      </label>
      <ComboBox
        id="template"
        v-model="state.templateId"
        :options="templateOptions"
        :has-error="!!formErrors.template"
        :placeholder="t('CAMPAIGN.WHATSAPP.CREATE.FORM.TEMPLATE.PLACEHOLDER')"
        :message="formErrors.template"
        class="[&>div>button]:bg-n-alpha-black2 [&>div>button:not(.focused)]:dark:outline-n-weak [&>div>button:not(.focused)]:hover:!outline-n-slate-6"
      />
      <p class="mt-1 text-xs text-n-slate-11">
        {{ t('CAMPAIGN.WHATSAPP.CREATE.FORM.TEMPLATE.INFO') }}
      </p>
    </div>

    <!-- Template Parser -->
    <WhatsAppTemplateParser
      v-if="selectedTemplate"
      ref="templateParserRef"
      :template="selectedTemplate"
      :initial-params="templateInitialParams"
    />

    <div class="flex flex-col gap-1">
      <label for="audience" class="mb-0.5 text-sm font-medium text-n-slate-12">
        {{ t('CAMPAIGN.WHATSAPP.CREATE.FORM.AUDIENCE.LABEL') }}
      </label>
      <TagMultiSelectComboBox
        v-model="state.selectedAudience"
        :options="audienceList"
        :label="t('CAMPAIGN.WHATSAPP.CREATE.FORM.AUDIENCE.LABEL')"
        :placeholder="t('CAMPAIGN.WHATSAPP.CREATE.FORM.AUDIENCE.PLACEHOLDER')"
        :has-error="!!formErrors.audience"
        :message="formErrors.audience"
        class="[&>div>button]:bg-n-alpha-black2"
      />
    </div>

    <Input
      v-model="state.scheduledAt"
      :label="t('CAMPAIGN.WHATSAPP.CREATE.FORM.SCHEDULED_AT.LABEL')"
      type="datetime-local"
      :min="currentDateTime"
      :placeholder="t('CAMPAIGN.WHATSAPP.CREATE.FORM.SCHEDULED_AT.PLACEHOLDER')"
      :message="formErrors.scheduledAt"
      :message-type="formErrors.scheduledAt ? 'error' : 'info'"
    />

    <div
      v-if="showActionButtons"
      class="flex gap-3 justify-between items-center w-full"
    >
      <Button
        variant="faded"
        color="slate"
        type="button"
        :label="t('CAMPAIGN.WHATSAPP.CREATE.FORM.BUTTONS.CANCEL')"
        class="w-full bg-n-alpha-2 text-n-blue-11 hover:bg-n-alpha-3"
        @click="handleCancel"
      />
      <Button
        :label="submitButtonLabel"
        class="w-full"
        type="submit"
        :is-loading="isSubmitting"
        :disabled="isSubmitting || isSubmitDisabled"
      />
    </div>
  </form>
</template>
