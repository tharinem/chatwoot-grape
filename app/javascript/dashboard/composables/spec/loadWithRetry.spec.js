import { effectScope } from 'vue';
import { useLoadWithRetry, withRetryParam } from '../loadWithRetry';

let images = [];

class FakeImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.src = '';
    images.push(this);
  }
}

const lastImage = () => images[images.length - 1];

describe('withRetryParam', () => {
  it('returns the url untouched for the first attempt', () => {
    expect(withRetryParam('https://x.test/a.png', 0)).toBe(
      'https://x.test/a.png'
    );
  });

  it('appends ?retry=N when the url has no query', () => {
    expect(withRetryParam('https://x.test/a.png', 2)).toBe(
      'https://x.test/a.png?retry=2'
    );
  });

  it('appends &retry=N when the url already has a query', () => {
    expect(withRetryParam('https://x.test/a.png?v=1', 3)).toBe(
      'https://x.test/a.png?v=1&retry=3'
    );
  });
});

describe('useLoadWithRetry', () => {
  let scope;

  beforeEach(() => {
    images = [];
    vi.useFakeTimers();
    vi.stubGlobal('Image', FakeImage);
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setup = () => scope.run(() => useLoadWithRetry());

  it('loads on the first attempt without retrying', () => {
    const state = setup();
    state.loadWithRetry('https://x.test/a.png');

    expect(state.isLoading.value).toBe(true);
    lastImage().onload();

    expect(state.isLoaded.value).toBe(true);
    expect(state.isLoading.value).toBe(false);
    expect(state.hasError.value).toBe(false);
    expect(state.loadedUrl.value).toBe('https://x.test/a.png');
    expect(images).toHaveLength(1);
  });

  it('retries after 2s, 5s and 10s with a cache-busting param', () => {
    const state = setup();
    state.loadWithRetry('https://x.test/a.png');

    lastImage().onerror();
    expect(state.isLoading.value).toBe(true);
    expect(state.hasError.value).toBe(false);

    vi.advanceTimersByTime(1999);
    expect(images).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(images).toHaveLength(2);
    expect(lastImage().src).toBe('https://x.test/a.png?retry=1');

    lastImage().onerror();
    vi.advanceTimersByTime(4999);
    expect(images).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(lastImage().src).toBe('https://x.test/a.png?retry=2');

    lastImage().onerror();
    vi.advanceTimersByTime(9999);
    expect(images).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(lastImage().src).toBe('https://x.test/a.png?retry=3');
    expect(state.isLoading.value).toBe(true);
  });

  it('succeeds after a retry and exposes the url that loaded', () => {
    const state = setup();
    state.loadWithRetry('https://x.test/a.png?v=1');

    lastImage().onerror();
    vi.advanceTimersByTime(2000);
    lastImage().onload();

    expect(state.isLoaded.value).toBe(true);
    expect(state.hasError.value).toBe(false);
    expect(state.loadedUrl.value).toBe('https://x.test/a.png?v=1&retry=1');
  });

  it('gives up after 3 retries and shows the error state', () => {
    const state = setup();
    state.loadWithRetry('https://x.test/a.png');

    lastImage().onerror();
    [2000, 5000, 10000].forEach(delay => {
      vi.advanceTimersByTime(delay);
      lastImage().onerror();
    });

    expect(images).toHaveLength(4);
    expect(state.hasError.value).toBe(true);
    expect(state.isLoaded.value).toBe(false);
    expect(state.isLoading.value).toBe(false);

    vi.advanceTimersByTime(60000);
    expect(images).toHaveLength(4);
  });

  it('resets the retry state when a new url is loaded', () => {
    const state = setup();
    state.loadWithRetry('https://x.test/a.png');
    const firstImage = lastImage();
    firstImage.onerror();

    state.loadWithRetry('https://x.test/b.png');
    expect(state.retryCount.value).toBe(0);
    expect(lastImage().src).toBe('https://x.test/b.png');

    // Pending retry of the old url must not fire.
    vi.advanceTimersByTime(20000);
    expect(images).toHaveLength(2);

    lastImage().onload();
    expect(state.loadedUrl.value).toBe('https://x.test/b.png');
  });

  it('shows the error state right away when there is no url', () => {
    const state = setup();
    state.loadWithRetry('');

    expect(state.hasError.value).toBe(true);
    expect(images).toHaveLength(0);
  });

  it('clears pending timers when the scope is disposed', () => {
    const state = setup();
    state.loadWithRetry('https://x.test/a.png');
    lastImage().onerror();

    scope.stop();
    vi.advanceTimersByTime(20000);

    expect(images).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
