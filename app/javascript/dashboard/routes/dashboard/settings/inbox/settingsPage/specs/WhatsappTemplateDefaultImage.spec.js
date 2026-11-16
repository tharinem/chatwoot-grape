import { mount, flushPromises } from '@vue/test-utils';
import WhatsappTemplateDefaultImage from '../components/WhatsappTemplateDefaultImage.vue';
import WhatsappMessageTemplatesAPI from 'dashboard/api/whatsappMessageTemplates';
import { uploadFile } from 'dashboard/helper/uploadHelper';

vi.mock('dashboard/api/whatsappMessageTemplates', () => ({
  default: { setHeaderImage: vi.fn() },
}));

vi.mock('dashboard/helper/uploadHelper', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('dashboard/composables', () => ({
  useAlert: vi.fn(),
}));

const template = {
  name: 'promo',
  language: 'pt_BR',
  components: [{ type: 'HEADER', format: 'IMAGE' }],
};

const savedImages = {
  'promo:pt_BR': { url: 'https://chat.example.com/promo.png', blob_id: 1 },
};

const mountComponent = (image = null) =>
  mount(WhatsappTemplateDefaultImage, {
    props: { inboxId: 3, template, image },
  });

const chooseFile = async (wrapper, file) => {
  const input = wrapper.find(
    '[data-test-id="template-default-image-upload"] input'
  );
  Object.defineProperty(input.element, 'files', {
    value: [file],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
};

describe('WhatsappTemplateDefaultImage', () => {
  beforeEach(() => {
    WhatsappMessageTemplatesAPI.setHeaderImage.mockReset();
    uploadFile.mockReset();
  });

  it('offers to copy the template image when none is saved yet', async () => {
    WhatsappMessageTemplatesAPI.setHeaderImage.mockResolvedValue({
      data: { template_header_images: savedImages },
    });
    const wrapper = mountComponent();

    expect(
      wrapper.find('[data-test-id="template-default-image-empty"]').exists()
    ).toBe(true);
    await wrapper
      .find('[data-test-id="template-default-image-from-meta"]')
      .trigger('click');
    await flushPromises();

    expect(WhatsappMessageTemplatesAPI.setHeaderImage).toHaveBeenCalledWith(3, {
      name: 'promo',
      language: 'pt_BR',
      from_template: true,
    });
    expect(wrapper.emitted('updated')).toEqual([[savedImages]]);
  });

  it('shows the saved image and only offers to replace it', () => {
    const wrapper = mountComponent(savedImages['promo:pt_BR']);

    expect(
      wrapper
        .find('[data-test-id="template-default-image-preview"]')
        .attributes('src')
    ).toBe('https://chat.example.com/promo.png');
    expect(
      wrapper.find('[data-test-id="template-default-image-from-meta"]').exists()
    ).toBe(false);
  });

  it('uploads a new image and saves it by blob id', async () => {
    uploadFile.mockResolvedValue({ blobId: 'signed-blob' });
    WhatsappMessageTemplatesAPI.setHeaderImage.mockResolvedValue({
      data: { template_header_images: savedImages },
    });
    const wrapper = mountComponent();

    await chooseFile(
      wrapper,
      new File(['x'], 'promo.png', { type: 'image/png' })
    );

    expect(WhatsappMessageTemplatesAPI.setHeaderImage).toHaveBeenCalledWith(3, {
      name: 'promo',
      language: 'pt_BR',
      header_image: 'signed-blob',
    });
    expect(wrapper.emitted('updated')).toHaveLength(1);
  });

  it('shows the error returned by the server', async () => {
    WhatsappMessageTemplatesAPI.setHeaderImage.mockRejectedValue({
      response: { data: { error: 'download_failed' } },
    });
    const wrapper = mountComponent();

    await wrapper
      .find('[data-test-id="template-default-image-from-meta"]')
      .trigger('click');
    await flushPromises();

    expect(
      wrapper.find('[data-test-id="template-default-image-error"]').text()
    ).toBe('Could not copy the image from Meta. Upload the image instead.');
    expect(wrapper.emitted('updated')).toBeUndefined();
  });
});
