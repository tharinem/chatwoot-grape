import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import ImageBubble from '../Image.vue';

const attachments = ref([]);

vi.mock('../../provider.js', () => ({
  useMessageContext: () => ({
    attachments,
    filteredCurrentChatAttachments: [],
  }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: key => key }),
}));

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
const SKELETON = '[data-testid="image-loading-skeleton"]';

const mountBubble = () =>
  mount(ImageBubble, {
    global: {
      stubs: {
        BaseBubble: { template: '<div><slot /></div>' },
        GalleryView: true,
        Button: true,
        Icon: true,
      },
      mocks: { $t: key => key },
    },
  });

describe('ImageBubble', () => {
  beforeEach(() => {
    images = [];
    attachments.value = [
      { id: 1, fileType: 'image', dataUrl: 'https://x.test/a.png?v=1' },
    ];
    vi.useFakeTimers();
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the skeleton while retrying and renders the loaded url', async () => {
    const wrapper = mountBubble();
    expect(wrapper.find(SKELETON).exists()).toBe(true);

    lastImage().onerror();
    vi.advanceTimersByTime(2000);
    lastImage().onerror();
    await nextTick();
    expect(wrapper.find(SKELETON).exists()).toBe(true);
    expect(wrapper.text()).not.toContain('COMPONENTS.MEDIA.IMAGE_UNAVAILABLE');

    vi.advanceTimersByTime(5000);
    expect(lastImage().src).toBe('https://x.test/a.png?v=1&retry=2');
    lastImage().onload();
    await nextTick();

    expect(wrapper.find(SKELETON).exists()).toBe(false);
    expect(wrapper.find('img').attributes('src')).toBe(
      'https://x.test/a.png?v=1&retry=2'
    );
  });

  it('shows the unavailable state after 3 failed retries', async () => {
    const wrapper = mountBubble();

    lastImage().onerror();
    [2000, 5000, 10000].forEach(delay => {
      vi.advanceTimersByTime(delay);
      lastImage().onerror();
    });
    await nextTick();

    expect(wrapper.find(SKELETON).exists()).toBe(false);
    expect(wrapper.text()).toContain('COMPONENTS.MEDIA.IMAGE_UNAVAILABLE');
  });
});
