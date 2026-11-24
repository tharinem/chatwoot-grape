import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ImageChip from '../Image.vue';

vi.mock('../../provider.js', () => ({
  useMessageContext: () => ({ filteredCurrentChatAttachments: [] }),
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

const mountChip = dataUrl =>
  mount(ImageChip, {
    props: { attachment: { id: 1, fileType: 'image', dataUrl } },
    global: {
      stubs: { GalleryView: true, Icon: true },
      mocks: { $t: key => key },
    },
  });

describe('ImageChip', () => {
  beforeEach(() => {
    images = [];
    vi.useFakeTimers();
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows a skeleton while retrying, then the image once it loads', async () => {
    const wrapper = mountChip('https://x.test/a.png');
    expect(
      wrapper.find('[data-testid="image-loading-skeleton"]').exists()
    ).toBe(true);

    lastImage().onerror();
    await nextTick();
    expect(
      wrapper.find('[data-testid="image-loading-skeleton"]').exists()
    ).toBe(true);
    expect(wrapper.text()).not.toContain('COMPONENTS.MEDIA.LOADING_FAILED');

    vi.advanceTimersByTime(2000);
    lastImage().onload();
    await nextTick();

    expect(wrapper.find('img').attributes('src')).toBe(
      'https://x.test/a.png?retry=1'
    );
    expect(
      wrapper.find('[data-testid="image-loading-skeleton"]').exists()
    ).toBe(false);
  });

  it('shows the error state only after retries are exhausted', async () => {
    const wrapper = mountChip('https://x.test/a.png');

    lastImage().onerror();
    vi.advanceTimersByTime(2000);
    lastImage().onerror();
    vi.advanceTimersByTime(5000);
    lastImage().onerror();
    vi.advanceTimersByTime(10000);
    await nextTick();
    expect(wrapper.text()).not.toContain('COMPONENTS.MEDIA.LOADING_FAILED');

    lastImage().onerror();
    await nextTick();
    expect(wrapper.text()).toContain('COMPONENTS.MEDIA.LOADING_FAILED');
  });

  it('restarts loading when the url changes', async () => {
    const wrapper = mountChip('https://x.test/a.png');
    lastImage().onerror();
    vi.advanceTimersByTime(2000);
    lastImage().onerror();

    await wrapper.setProps({
      attachment: { id: 1, fileType: 'image', dataUrl: 'https://x.test/b.png' },
    });
    expect(lastImage().src).toBe('https://x.test/b.png');

    lastImage().onload();
    await nextTick();
    expect(wrapper.find('img').attributes('src')).toBe('https://x.test/b.png');
  });

  it('clears pending retries on unmount', () => {
    const wrapper = mountChip('https://x.test/a.png');
    lastImage().onerror();
    wrapper.unmount();

    vi.advanceTimersByTime(20000);
    expect(images).toHaveLength(1);
  });
});
