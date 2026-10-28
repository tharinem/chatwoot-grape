<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import WhatsappMessageTemplatesAPI from 'dashboard/api/whatsappMessageTemplates';
import {
  TEMPLATE_LIMITS,
  BUTTON_TYPES,
  DEFAULT_TEMPLATE_LANGUAGE,
  extractVariables,
  validateTemplateDraft,
  buildTemplatePayload,
} from 'dashboard/helper/whatsappTemplateBuilder';

import Input from 'dashboard/components-next/input/Input.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import WhatsappTemplatePreview from './WhatsappTemplatePreview.vue';

const props = defineProps({
  inboxId: { type: [Number, String], required: true },
});

const emit = defineEmits(['created', 'cancel']);

const { t } = useI18n();

const draft = reactive({
  name: '',
  category: 'MARKETING',
  language: DEFAULT_TEMPLATE_LANGUAGE,
  headerText: '',
  headerExample: '',
  body: '',
  bodyExamples: [],
  footer: '',
  buttons: [],
});

const buttonType = ref('');
const errors = ref([]);
const metaError = ref('');
const isSubmitting = ref(false);

const categoryOptions = computed(() => [
  {
    value: 'MARKETING',
    label: t('WHATSAPP_TEMPLATES.MANAGE.FORM.CATEGORY.MARKETING'),
  },
  {
    value: 'UTILITY',
    label: t('WHATSAPP_TEMPLATES.MANAGE.FORM.CATEGORY.UTILITY'),
  },
]);

const buttonTypeOptions = computed(() => [
  { value: '', label: t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.NONE') },
  {
    value: BUTTON_TYPES.QUICK_REPLY,
    label: t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.QUICK_REPLY'),
  },
  {
    value: BUTTON_TYPES.URL,
    label: t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.URL'),
  },
]);

const bodyVariables = computed(() => extractVariables(draft.body));
const headerHasVariable = computed(
  () => extractVariables(draft.headerText).length > 0
);
const canAddButton = computed(
  () =>
    buttonType.value === BUTTON_TYPES.QUICK_REPLY &&
    draft.buttons.length < TEMPLATE_LIMITS.QUICK_REPLIES
);

// Keep one example slot per detected body variable
watch(
  () => bodyVariables.value.length,
  count => {
    const examples = draft.bodyExamples.slice(0, count);
    while (examples.length < count) examples.push('');
    draft.bodyExamples = examples;
  }
);

watch(buttonType, type => {
  if (!type) {
    draft.buttons = [];
  } else if (type === BUTTON_TYPES.URL) {
    draft.buttons = [{ type, text: '', url: '', example: '' }];
  } else {
    draft.buttons = [{ type, text: '' }];
  }
});

const addButton = () => {
  if (!canAddButton.value) return;
  draft.buttons.push({ type: BUTTON_TYPES.QUICK_REPLY, text: '' });
};

const removeButton = index => {
  draft.buttons.splice(index, 1);
  if (!draft.buttons.length) buttonType.value = '';
};

const urlHasVariable = button => String(button.url || '').endsWith('{{1}}');

const ERROR_MESSAGES = {
  required: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.REQUIRED'),
  invalid_format: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.INVALID_FORMAT'),
  invalid_value: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.INVALID_VALUE'),
  too_long: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.TOO_LONG'),
  non_sequential_variables: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.NON_SEQUENTIAL_VARIABLES'),
  variable_at_edge: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.VARIABLE_AT_EDGE'),
  missing_examples: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.MISSING_EXAMPLES'),
  too_many_variables: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.TOO_MANY_VARIABLES'),
  variables_not_allowed: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.VARIABLES_NOT_ALLOWED'),
  mixed_types: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.MIXED_TYPES'),
  invalid_type: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.INVALID_TYPE'),
  too_many: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.TOO_MANY'),
  invalid_url: () => t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.INVALID_URL'),
};

const errorFor = field => {
  const error = errors.value.find(item => item.field === field);
  if (!error) return '';
  const message = ERROR_MESSAGES[error.code];
  return message
    ? message()
    : t('WHATSAPP_TEMPLATES.MANAGE.ERRORS.INVALID_VALUE');
};

const messageTypeFor = field => (errorFor(field) ? 'error' : 'info');

const counter = (value, max) => `${String(value || '').length}/${max}`;

const handleRequestError = error => {
  const data = error?.response?.data || {};
  if (Array.isArray(data.errors)) {
    errors.value = data.errors;
    useAlert(t('WHATSAPP_TEMPLATES.MANAGE.FORM.FIX_ERRORS'));
    return;
  }
  // Show Meta's message exactly as returned, without masking it
  metaError.value =
    data.error || t('WHATSAPP_TEMPLATES.MANAGE.FORM.GENERIC_ERROR');
};

const submit = async () => {
  metaError.value = '';
  errors.value = validateTemplateDraft(draft);
  if (errors.value.length) {
    useAlert(t('WHATSAPP_TEMPLATES.MANAGE.FORM.FIX_ERRORS'));
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await WhatsappMessageTemplatesAPI.create(
      props.inboxId,
      buildTemplatePayload(draft)
    );
    const template = response?.data?.template || {};
    useAlert(
      t('WHATSAPP_TEMPLATES.MANAGE.FORM.SUCCESS', {
        status: template.status || 'PENDING',
      })
    );
    emit('created', template);
  } catch (error) {
    handleRequestError(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-6 lg:flex-row">
    <form class="flex flex-col gap-4 lg:basis-3/5" @submit.prevent="submit">
      <h3 class="text-base font-medium text-n-slate-12">
        {{ $t('WHATSAPP_TEMPLATES.MANAGE.FORM.TITLE') }}
      </h3>

      <Input
        v-model="draft.name"
        name="name"
        :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.NAME.LABEL')"
        :placeholder="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.NAME.PLACEHOLDER')"
        :message="
          errorFor('name') || $t('WHATSAPP_TEMPLATES.MANAGE.FORM.NAME.HELP')
        "
        :message-type="messageTypeFor('name')"
      />

      <div class="flex flex-col gap-4 sm:flex-row">
        <label class="flex flex-1 flex-col gap-1 text-sm text-n-slate-12">
          {{ $t('WHATSAPP_TEMPLATES.MANAGE.FORM.CATEGORY.LABEL') }}
          <select
            v-model="draft.category"
            name="category"
            class="!mb-0 rounded-lg"
          >
            <option
              v-for="option in categoryOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <span v-if="errorFor('category')" class="text-xs text-n-ruby-9">
            {{ errorFor('category') }}
          </span>
        </label>
        <Input
          v-model="draft.language"
          class="flex-1"
          name="language"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.LANGUAGE.LABEL')"
          :message="
            errorFor('language') ||
            $t('WHATSAPP_TEMPLATES.MANAGE.FORM.LANGUAGE.HELP')
          "
          :message-type="messageTypeFor('language')"
        />
      </div>

      <div class="flex flex-col gap-1">
        <Input
          v-model="draft.headerText"
          name="header_text"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.HEADER.LABEL')"
          :placeholder="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.HEADER.PLACEHOLDER')"
          :message="errorFor('header_text')"
          :message-type="messageTypeFor('header_text')"
        />
        <span
          class="self-end text-xs text-n-slate-10"
          data-test-id="header-counter"
        >
          {{ counter(draft.headerText, TEMPLATE_LIMITS.HEADER) }}
        </span>
        <Input
          v-if="headerHasVariable"
          v-model="draft.headerExample"
          name="header_example"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.HEADER.EXAMPLE')"
          :message="errorFor('header_example')"
          :message-type="messageTypeFor('header_example')"
        />
      </div>

      <TextArea
        v-model="draft.body"
        name="body"
        :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.BODY.LABEL')"
        :placeholder="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.BODY.PLACEHOLDER')"
        :max-length="TEMPLATE_LIMITS.BODY"
        show-character-count
        auto-height
        min-height="6rem"
        :message="
          errorFor('body') || $t('WHATSAPP_TEMPLATES.MANAGE.FORM.BODY.HELP')
        "
        :message-type="messageTypeFor('body')"
      />

      <div
        v-if="bodyVariables.length"
        class="flex flex-col gap-2"
        data-test-id="body-examples"
      >
        <Input
          v-for="(variable, index) in bodyVariables"
          :key="variable"
          v-model="draft.bodyExamples[index]"
          :name="`body_example_${variable}`"
          :label="
            $t('WHATSAPP_TEMPLATES.MANAGE.FORM.VARIABLE_EXAMPLE', {
              variable: `{{${index + 1}}}`,
            })
          "
        />
        <span v-if="errorFor('body_examples')" class="text-xs text-n-ruby-9">
          {{ errorFor('body_examples') }}
        </span>
      </div>

      <div class="flex flex-col gap-1">
        <Input
          v-model="draft.footer"
          name="footer"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.FOOTER.LABEL')"
          :placeholder="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.FOOTER.PLACEHOLDER')"
          :message="errorFor('footer')"
          :message-type="messageTypeFor('footer')"
        />
        <span class="self-end text-xs text-n-slate-10">
          {{ counter(draft.footer, TEMPLATE_LIMITS.FOOTER) }}
        </span>
      </div>

      <div class="flex flex-col gap-2">
        <label class="flex flex-col gap-1 text-sm text-n-slate-12">
          {{ $t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.LABEL') }}
          <select
            v-model="buttonType"
            name="button_type"
            class="!mb-0 rounded-lg"
          >
            <option
              v-for="option in buttonTypeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
        <span v-if="errorFor('buttons')" class="text-xs text-n-ruby-9">
          {{ errorFor('buttons') }}
        </span>

        <div
          v-for="(button, index) in draft.buttons"
          :key="index"
          class="flex flex-col gap-2 rounded-lg p-3 outline outline-1 outline-n-weak"
        >
          <div class="flex items-end gap-2">
            <Input
              v-model="button.text"
              class="flex-1"
              :name="`button_text_${index}`"
              :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.TEXT')"
              :message="errorFor(`buttons.${index}.text`)"
              :message-type="messageTypeFor(`buttons.${index}.text`)"
            />
            <span class="pb-2 text-xs text-n-slate-10">
              {{ counter(button.text, TEMPLATE_LIMITS.BUTTON_TEXT) }}
            </span>
            <NextButton
              type="button"
              sm
              faded
              ruby
              icon="i-lucide-trash-2"
              :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.REMOVE')"
              @click="removeButton(index)"
            />
          </div>
          <template v-if="button.type === BUTTON_TYPES.URL">
            <Input
              v-model="button.url"
              :name="`button_url_${index}`"
              placeholder="https://"
              :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.URL_FIELD')"
              :message="errorFor(`buttons.${index}.url`)"
              :message-type="messageTypeFor(`buttons.${index}.url`)"
            />
            <Input
              v-if="urlHasVariable(button)"
              v-model="button.example"
              :name="`button_example_${index}`"
              :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.URL_EXAMPLE')"
              :message="errorFor(`buttons.${index}.example`)"
              :message-type="messageTypeFor(`buttons.${index}.example`)"
            />
          </template>
        </div>

        <NextButton
          v-if="canAddButton"
          type="button"
          sm
          faded
          slate
          icon="i-lucide-plus"
          class="self-start"
          data-test-id="add-button"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.BUTTONS.ADD')"
          @click="addButton"
        />
      </div>

      <div
        v-if="metaError"
        class="rounded-lg bg-n-alpha-2 p-3 text-sm text-n-ruby-11"
        data-test-id="meta-error"
      >
        <p class="font-medium">
          {{ $t('WHATSAPP_TEMPLATES.MANAGE.FORM.META_ERROR') }}
        </p>
        <p class="whitespace-pre-wrap break-words">{{ metaError }}</p>
      </div>

      <div class="flex gap-2">
        <NextButton
          type="submit"
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.SUBMIT')"
          :is-loading="isSubmitting"
          :disabled="isSubmitting"
          data-test-id="submit-template"
        />
        <NextButton
          type="button"
          faded
          slate
          :label="$t('WHATSAPP_TEMPLATES.MANAGE.FORM.CANCEL')"
          @click="emit('cancel')"
        />
      </div>
    </form>

    <aside class="flex flex-col gap-4 lg:basis-2/5">
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-n-slate-12">
          {{ $t('WHATSAPP_TEMPLATES.MANAGE.FORM.PREVIEW') }}
        </span>
        <WhatsappTemplatePreview :draft="draft" />
      </div>
      <div
        class="flex flex-col gap-2 rounded-lg bg-n-alpha-2 p-3 text-xs text-n-slate-11"
        data-test-id="template-tips"
      >
        <span class="text-sm font-medium text-n-slate-12">
          {{ $t('WHATSAPP_TEMPLATES.MANAGE.TIPS.TITLE') }}
        </span>
        <p>{{ $t('WHATSAPP_TEMPLATES.MANAGE.TIPS.CATEGORY') }}</p>
        <p>{{ $t('WHATSAPP_TEMPLATES.MANAGE.TIPS.COST') }}</p>
        <p>{{ $t('WHATSAPP_TEMPLATES.MANAGE.TIPS.APPROVAL') }}</p>
        <p>{{ $t('WHATSAPP_TEMPLATES.MANAGE.TIPS.PROMOTION') }}</p>
      </div>
    </aside>
  </div>
</template>
