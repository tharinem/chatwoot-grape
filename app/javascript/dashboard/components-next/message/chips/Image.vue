<script setup>
import { ref, watch } from 'vue';
import Icon from 'next/icon/Icon.vue';
import { useSnakeCase } from 'dashboard/composables/useTransformKeys';
import { useMessageContext } from '../provider.js';
import { useLoadWithRetry } from 'dashboard/composables/loadWithRetry';

import GalleryView from 'dashboard/components/widgets/conversation/components/GalleryView.vue';

const props = defineProps({
  attachment: {
    type: Object,
    required: true,
  },
});
const showGallery = ref(false);

const { filteredCurrentChatAttachments } = useMessageContext();

const { isLoading, hasError, loadedUrl, loadWithRetry } = useLoadWithRetry();

// The file of a just-created message may not be in storage yet, so the
// composable retries with backoff. Restart whenever the URL changes.
watch(
  () => props.attachment?.dataUrl,
  url => loadWithRetry(url),
  { immediate: true }
);

const handleError = () => {
  hasError.value = true;
};
</script>

<template>
  <div
    class="size-[72px] overflow-hidden contain-content rounded-xl cursor-pointer"
    @click="showGallery = true"
  >
    <div
      v-if="hasError"
      class="flex flex-col items-center justify-center gap-1 text-xs text-center rounded-lg size-full bg-n-alpha-1 text-n-slate-11"
    >
      <Icon icon="i-lucide-circle-off" class="text-n-slate-11" />
      {{ $t('COMPONENTS.MEDIA.LOADING_FAILED') }}
    </div>
    <div
      v-else-if="isLoading"
      class="size-full bg-n-alpha-2 animate-pulse"
      aria-busy="true"
      data-testid="image-loading-skeleton"
    />
    <img
      v-else
      class="object-cover w-full h-full skip-context-menu"
      :src="loadedUrl"
      @error="handleError"
    />
  </div>
  <GalleryView
    v-if="showGallery"
    v-model:show="showGallery"
    :attachment="useSnakeCase(attachment)"
    :all-attachments="filteredCurrentChatAttachments"
    @error="handleError"
    @close="() => (showGallery = false)"
  />
</template>
