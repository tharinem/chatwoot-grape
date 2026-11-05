import { mount, flushPromises } from '@vue/test-utils';
import WhatsAppTemplateParser from '../WhatsAppTemplateParser.vue';
import { uploadFile } from 'dashboard/helper/uploadHelper';

vi.mock('dashboard/helper/uploadHelper', () => ({
  uploadFile: vi.fn(),
}));

const imageTemplate = {
  name: 'promo_semana',
  language: 'pt_BR',
  category: 'MARKETING',
  components: [
    { type: 'HEADER', format: 'IMAGE' },
    { type: 'BODY', text: 'Novidades da semana.' },
  ],
};

const documentTemplate = {
  ...imageTemplate,
  components: [
    { type: 'HEADER', format: 'DOCUMENT' },
    { type: 'BODY', text: 'Seu recibo.' },
  ],
};

const mountParser = template =>
  mount(WhatsAppTemplateParser, {
    props: { template },
    slots: {
      actions: `<template #actions="{ disabled }">
        <button data-test-id="send" :disabled="disabled">send</button>
      </template>`,
    },
  });

const imageFile = ({ type = 'image/png', size = 1000 } = {}) => {
  const file = new File(['x'], 'promo.png', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const chooseFile = async (wrapper, file) => {
  const input = wrapper.find('[data-test-id="media-upload"] input');
  Object.defineProperty(input.element, 'files', {
    value: [file],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
};

describe('WhatsAppTemplateParser media upload', () => {
  beforeEach(() => {
    uploadFile.mockReset();
  });

  it('offers the upload next to the URL field for image headers only', () => {
    expect(
      mountParser(imageTemplate).find('[data-test-id="media-upload"]').exists()
    ).toBe(true);
    expect(
      mountParser(documentTemplate)
        .find('[data-test-id="media-upload"]')
        .exists()
    ).toBe(false);
  });

  it('fills media_url with the public URL of the uploaded image', async () => {
    uploadFile.mockResolvedValue({
      fileUrl:
        'https://chat.example.com/rails/active_storage/blobs/redirect/a/promo.png',
      publicUrl:
        'https://chat.example.com/rails/active_storage/blobs/proxy/a/promo.png',
    });
    const wrapper = mountParser(imageTemplate);
    expect(wrapper.find('[data-test-id="send"]').attributes()).toHaveProperty(
      'disabled'
    );

    await chooseFile(wrapper, imageFile());

    expect(uploadFile).toHaveBeenCalled();
    expect(wrapper.vm.processedParams.header.media_url).toBe(
      'https://chat.example.com/rails/active_storage/blobs/proxy/a/promo.png'
    );
    expect(wrapper.find('input[type="url"]').element.value).toContain(
      '/blobs/proxy/'
    );
    expect(
      wrapper.find('[data-test-id="send"]').attributes('disabled')
    ).toBeUndefined();
  });

  it('keeps the typed URL as an alternative', async () => {
    const wrapper = mountParser(imageTemplate);

    await wrapper
      .find('input[type="url"]')
      .setValue('https://cdn.loja.com/a.jpg');

    expect(wrapper.vm.processedParams.header.media_url).toBe(
      'https://cdn.loja.com/a.jpg'
    );
  });

  it('rejects files that are not jpg or png without uploading', async () => {
    const wrapper = mountParser(imageTemplate);

    await chooseFile(wrapper, imageFile({ type: 'image/gif' }));

    expect(uploadFile).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test-id="media-upload-error"]').text()).toBe(
      'Use a JPG or PNG image.'
    );
  });

  it('rejects images over 5 MB without uploading', async () => {
    const wrapper = mountParser(imageTemplate);

    await chooseFile(wrapper, imageFile({ size: 5 * 1024 * 1024 + 1 }));

    expect(uploadFile).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test-id="media-upload-error"]').text()).toBe(
      'The image must be at most 5 MB.'
    );
  });

  it('shows an error when the upload fails', async () => {
    uploadFile.mockRejectedValue(new Error('network'));
    const wrapper = mountParser(imageTemplate);

    await chooseFile(wrapper, imageFile());

    expect(wrapper.find('[data-test-id="media-upload-error"]').exists()).toBe(
      true
    );
    expect(wrapper.vm.processedParams.header.media_url).toBe('');
  });
});
