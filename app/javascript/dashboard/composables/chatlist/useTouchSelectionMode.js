import { ref, onMounted, onBeforeUnmount } from 'vue';

// Phones and tablets have no hover, so the avatar checkbox used for bulk
// selection on desktop never shows up. On those screens we offer an explicit
// selection mode instead. Desktop (hover capable, wide viewport) is untouched.
export const TOUCH_SELECTION_MEDIA_QUERY = '(hover: none), (max-width: 767px)';

const getMediaQueryList = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(TOUCH_SELECTION_MEDIA_QUERY)
    : null;

export function useTouchSelectionMode({ onExit } = {}) {
  const isSelectionModeAvailable = ref(false);
  const isSelectionMode = ref(false);
  let mediaQueryList = null;

  const exitSelectionMode = () => {
    if (!isSelectionMode.value) return;
    isSelectionMode.value = false;
    onExit?.();
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode.value) {
      exitSelectionMode();
      return;
    }
    if (isSelectionModeAvailable.value) isSelectionMode.value = true;
  };

  // If the screen stops matching (rotation, window resize) leave the mode,
  // otherwise the user would be stuck without the button to exit it.
  const onMediaChange = event => {
    isSelectionModeAvailable.value = event.matches;
    if (!event.matches) exitSelectionMode();
  };

  onMounted(() => {
    mediaQueryList = getMediaQueryList();
    if (!mediaQueryList) return;
    isSelectionModeAvailable.value = mediaQueryList.matches;
    mediaQueryList.addEventListener?.('change', onMediaChange);
  });

  onBeforeUnmount(() => {
    mediaQueryList?.removeEventListener?.('change', onMediaChange);
    mediaQueryList = null;
  });

  return {
    isSelectionModeAvailable,
    isSelectionMode,
    toggleSelectionMode,
    exitSelectionMode,
  };
}
