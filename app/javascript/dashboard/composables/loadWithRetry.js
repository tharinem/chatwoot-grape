import { ref, computed, getCurrentScope, onScopeDispose } from 'vue';

// Delays (ms) before each retry. A just-created message can be broadcast
// before its file has been uploaded to storage, so the first request may fail.
export const DEFAULT_RETRY_DELAYS = [2000, 5000, 10000];

export const withRetryParam = (url, attempt) => {
  if (!attempt) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}retry=${attempt}`;
};

/**
 * Preloads an image and retries on failure with a cache-busting param.
 * Exposes `loadedUrl`, the URL that actually loaded, so the rendered <img>
 * reuses the successful (cached) response instead of a failed one.
 */
export const useLoadWithRetry = (config = {}) => {
  const retryDelays = config.retryDelays || DEFAULT_RETRY_DELAYS;

  const isLoaded = ref(false);
  const hasError = ref(false);
  const loadedUrl = ref('');
  const retryCount = ref(0);
  const isLoading = computed(() => !isLoaded.value && !hasError.value);

  let timer = null;
  let pendingImage = null;
  // Incremented on every new load/cleanup so stale callbacks are ignored.
  let generation = 0;

  const cancel = () => {
    generation += 1;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pendingImage) {
      pendingImage.onload = null;
      pendingImage.onerror = null;
      pendingImage = null;
    }
  };

  const attemptLoad = (url, attempt, currentGeneration) => {
    const img = new Image();
    pendingImage = img;
    const attemptUrl = withRetryParam(url, attempt);

    img.onload = () => {
      if (currentGeneration !== generation) return;
      pendingImage = null;
      loadedUrl.value = attemptUrl;
      isLoaded.value = true;
      hasError.value = false;
    };

    img.onerror = () => {
      if (currentGeneration !== generation) return;
      pendingImage = null;
      if (attempt >= retryDelays.length) {
        hasError.value = true;
        isLoaded.value = false;
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        retryCount.value = attempt + 1;
        attemptLoad(url, attempt + 1, currentGeneration);
      }, retryDelays[attempt]);
    };

    img.src = attemptUrl;
  };

  const loadWithRetry = url => {
    cancel();
    isLoaded.value = false;
    hasError.value = false;
    loadedUrl.value = '';
    retryCount.value = 0;

    if (!url) {
      hasError.value = true;
      return;
    }

    attemptLoad(url, 0, generation);
  };

  if (getCurrentScope()) {
    onScopeDispose(cancel);
  }

  return {
    isLoaded,
    isLoading,
    hasError,
    loadedUrl,
    retryCount,
    loadWithRetry,
    cancel,
  };
};
