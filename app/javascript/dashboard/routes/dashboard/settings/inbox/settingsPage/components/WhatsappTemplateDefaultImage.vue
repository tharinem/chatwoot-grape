<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { uploadFile } from 'dashboard/helper/uploadHelper';
import {
  HEADER_IMAGE,
  validateHeaderImageFile,
} from 'dashboard/helper/whatsappTemplateBuilder';
import WhatsappMessageTemplatesAPI from 'dashboard/api/whatsappMessageTemplates';
import NextButton from 'dashboard/components-next/button/Button.vue';

// Default IMAGE header campaigns use for a template. Templates created in the
// Modelos tab get one automatically; older ones can copy the example image
// Meta keeps, or receive a new upload.
const props = defineProps({
  inboxId: { type: Number, required: true },
  template: { type: Object, required: true },
  image: { type: Object, default: null },
});

const emit = defineEmits(['updated']);

const { t } = useI18n();

const isSaving = ref(false);
const errorMessage = ref('');

const imageUrl = computed(() => props.image?.url || '');

watch(
  () => `${props.template.name}:${props.template.language}`,
  () => {
    errorMessage.value = '';
  }
);

const ERROR_MESSAGES = {
  invalid_file_type: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.ERRORS.INVALID_FILE_TYPE'),
  file_too_large: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.ERRORS.FILE_TOO_LARGE'),
  no_image_header: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.ERRORS.NO_IMAGE_HEADER'),
  download_failed: () =>
    t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.ERRORS.DOWNLOAD_FAILED'),
};

const errorFor = code =>
  ERROR_MESSAGES[code]?.() ||
  t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.ERRORS.DEFAULT');

const save = async extra => {
  isSaving.value = true;
  errorMessage.value = '';
  try {
    const { data } = await WhatsappMessageTemplatesAPI.setHeaderImage(
      props.inboxId,
      { name: props.template.name, language: props.template.language, ...extra }
    );
    emit('updated', data.template_header_images);
    useAlert(t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.SAVED'));
  } catch (error) {
    errorMessage.value = errorFor(error?.response?.data?.error || 'default');
  } finally {
    isSaving.value = false;
  }
};

const useTemplateImage = () => save({ from_template: true });

const onFileChange = async event => {
  const input = event.target;
  const [file] = input.files || [];
  if (!file) return;

  const code = validateHeaderImageFile(file);
  if (code) {
    errorMessage.value = errorFor(code);
    input.value = '';
    return;
  }

  isSaving.value = true;
  try {
    const { blobId } = await uploadFile(file);
    await save({ header_image: blobId });
  } catch (error) {
    errorMessage.value = errorFor('default');
    isSaving.value = false;
  } finally {
    input.value = '';
  }
};
</script>

<template>
  <div
    class="flex flex-col gap-3 p-4 mt-4 rounded-xl outline outline-1 outline-n-weak"
    data-test-id="template-default-image"
  >
    <div class="flex flex-col gap-1">
      <h3 class="text-sm font-medium text-n-slate-12">
        {{ t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.TITLE') }}
      </h3>
      <p class="text-xs text-n-slate-11">
        {{ t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.DESCRIPTION') }}
      </p>
    </div>

    <img
      v-if="imageUrl"
      :src="imageUrl"
      alt=""
      class="object-cover w-full max-h-48 rounded-lg"
      data-test-id="template-default-image-preview"
    />
    <p
      v-else
      class="text-xs text-n-slate-11"
      data-test-id="template-default-image-empty"
    >
      {{ t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.EMPTY') }}
    </p>

    <div class="flex flex-wrap gap-2">
      <NextButton
        v-if="!imageUrl"
        faded
        slate
        sm
        icon="i-lucide-copy"
        :label="t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.USE_TEMPLATE_IMAGE')"
        :is-loading="isSaving"
        data-test-id="template-default-image-from-meta"
        @click="useTemplateImage"
      />
      <label
        class="flex items-center gap-1.5 px-3 h-8 text-sm font-medium rounded-lg cursor-pointer text-n-slate-12 outline outline-1 outline-n-weak hover:bg-n-alpha-2"
        :class="{ 'pointer-events-none opacity-60': isSaving }"
        data-test-id="template-default-image-upload"
      >
        <span class="i-lucide-image-up size-4" />
        {{
          isSaving
            ? t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.SAVING')
            : imageUrl
              ? t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.REPLACE')
              : t('WHATSAPP_TEMPLATES.MANAGE.DEFAULT_IMAGE.UPLOAD')
        }}
        <input
          type="file"
          class="hidden"
          :accept="HEADER_IMAGE.ACCEPT"
          :disabled="isSaving"
          @change="onFileChange"
        />
      </label>
    </div>

    <p
      v-if="errorMessage"
      class="text-xs text-n-ruby-9"
      data-test-id="template-default-image-error"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
