<script setup>
import { computed } from 'vue';
import { findComponentByType } from 'dashboard/helper/templateHelper';
import { buildPreview } from 'dashboard/helper/whatsappTemplateBuilder';

const props = defineProps({
  // Draft from the template form (camelCase fields)
  draft: { type: Object, default: null },
  // Template already synced from Meta (components array)
  template: { type: Object, default: null },
});

// Meta returns a sample image URL as the header_handle of synced templates
const sampleImageUrl = header => {
  const handle = header?.example?.header_handle?.[0] || '';
  return /^https?:\/\//.test(handle) ? handle : '';
};

const previewFromTemplate = template => {
  const header = findComponentByType(template, 'HEADER');
  const body = findComponentByType(template, 'BODY');
  const footer = findComponentByType(template, 'FOOTER');
  const buttons = findComponentByType(template, 'BUTTONS');

  return {
    ...(header?.format === 'IMAGE' && { headerImage: sampleImageUrl(header) }),
    header: header?.format === 'TEXT' ? header.text || '' : '',
    body: body?.text || '',
    footer: footer?.text || '',
    buttons: (buttons?.buttons || []).map(button => ({
      type: button.type,
      text: button.text,
    })),
  };
};

const preview = computed(() => {
  if (props.template) return previewFromTemplate(props.template);
  if (props.draft) return buildPreview(props.draft);
  return { header: '', body: '', footer: '', buttons: [] };
});

const hasImageHeader = computed(() => 'headerImage' in preview.value);
</script>

<template>
  <div
    class="rounded-xl bg-n-alpha-2 p-4"
    data-test-id="whatsapp-template-preview"
  >
    <div
      class="max-w-xs rounded-lg rounded-tl-none bg-n-solid-1 p-3 shadow-sm outline outline-1 outline-n-weak"
    >
      <template v-if="hasImageHeader">
        <img
          v-if="preview.headerImage"
          :src="preview.headerImage"
          alt=""
          class="mb-2 max-h-48 w-full rounded-md object-cover"
          data-test-id="preview-header-image"
        />
        <div
          v-else
          class="mb-2 flex h-32 w-full items-center justify-center rounded-md bg-n-alpha-2 text-n-slate-10"
          data-test-id="preview-header-image-placeholder"
        >
          <span class="i-lucide-image size-8" />
        </div>
      </template>
      <p
        v-if="preview.header"
        class="mb-1 text-sm font-semibold text-n-slate-12 break-words"
        data-test-id="preview-header"
      >
        {{ preview.header }}
      </p>
      <p
        class="text-sm whitespace-pre-wrap break-words text-n-slate-12"
        data-test-id="preview-body"
      >
        {{ preview.body }}
      </p>
      <p
        v-if="preview.footer"
        class="mt-1 text-xs text-n-slate-10 break-words"
        data-test-id="preview-footer"
      >
        {{ preview.footer }}
      </p>
    </div>
    <div
      v-if="preview.buttons.length"
      class="mt-1 flex max-w-xs flex-col gap-1"
    >
      <span
        v-for="(button, index) in preview.buttons"
        :key="index"
        class="flex items-center justify-center gap-1 rounded-lg bg-n-solid-1 px-3 py-2 text-sm font-medium text-n-blue-11 outline outline-1 outline-n-weak"
        data-test-id="preview-button"
      >
        <span
          v-if="button.type === 'URL'"
          class="i-lucide-external-link size-3.5"
        />
        {{ button.text }}
      </span>
    </div>
  </div>
</template>
