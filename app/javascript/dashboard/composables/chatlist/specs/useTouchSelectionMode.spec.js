import { mount } from '@vue/test-utils';
import {
  useTouchSelectionMode,
  TOUCH_SELECTION_MEDIA_QUERY,
} from '../useTouchSelectionMode';

const mockMatchMedia = initialMatches => {
  const listeners = new Set();
  const mql = {
    matches: initialMatches,
    media: TOUCH_SELECTION_MEDIA_QUERY,
    addEventListener: (_, cb) => listeners.add(cb),
    removeEventListener: (_, cb) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn(() => mql);
  return {
    change(matches) {
      mql.matches = matches;
      listeners.forEach(cb => cb({ matches }));
    },
  };
};

const mountComposable = options => {
  let result;
  mount({
    render: () => null,
    setup() {
      result = useTouchSelectionMode(options);
      return {};
    },
  });
  return result;
};

describe('useTouchSelectionMode', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('queries for touch devices without hover or narrow viewports', () => {
    expect(TOUCH_SELECTION_MEDIA_QUERY).toContain('(hover: none)');
    expect(TOUCH_SELECTION_MEDIA_QUERY).toContain('(max-width: 767px)');
  });

  it('is available on hover:none devices', () => {
    mockMatchMedia(true);
    const { isSelectionModeAvailable } = mountComposable();
    expect(window.matchMedia).toHaveBeenCalledWith(TOUCH_SELECTION_MEDIA_QUERY);
    expect(isSelectionModeAvailable.value).toBe(true);
  });

  it('is not available on hover capable wide screens and cannot be entered', () => {
    mockMatchMedia(false);
    const { isSelectionModeAvailable, isSelectionMode, toggleSelectionMode } =
      mountComposable();
    expect(isSelectionModeAvailable.value).toBe(false);
    toggleSelectionMode();
    expect(isSelectionMode.value).toBe(false);
  });

  it('toggles the mode and calls onExit when leaving it', () => {
    mockMatchMedia(true);
    const onExit = vi.fn();
    const { isSelectionMode, toggleSelectionMode } = mountComposable({
      onExit,
    });
    toggleSelectionMode();
    expect(isSelectionMode.value).toBe(true);
    expect(onExit).not.toHaveBeenCalled();
    toggleSelectionMode();
    expect(isSelectionMode.value).toBe(false);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('exits the mode when the screen stops matching', () => {
    const media = mockMatchMedia(true);
    const onExit = vi.fn();
    const { isSelectionMode, toggleSelectionMode } = mountComposable({
      onExit,
    });
    toggleSelectionMode();
    media.change(false);
    expect(isSelectionMode.value).toBe(false);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
