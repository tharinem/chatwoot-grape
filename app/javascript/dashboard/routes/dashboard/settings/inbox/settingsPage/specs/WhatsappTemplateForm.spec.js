import { mount, flushPromises } from '@vue/test-utils';
import WhatsappTemplateForm from '../components/WhatsappTemplateForm.vue';
import WhatsappMessageTemplatesAPI from 'dashboard/api/whatsappMessageTemplates';
import { useAlert } from 'dashboard/composables';
import { uploadFile } from 'dashboard/helper/uploadHelper';

vi.mock('dashboard/api/whatsappMessageTemplates', () => ({
  default: { create: vi.fn() },
}));

vi.mock('dashboard/helper/uploadHelper', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('dashboard/composables', () => ({
  useAlert: vi.fn(),
}));

const mountForm = () => mount(WhatsappTemplateForm, { props: { inboxId: 7 } });

const fillValidDraft = async wrapper => {
  await wrapper.find('input[name="name"]').setValue('pedido_enviado');
  await wrapper.find('textarea').setValue('Oi {{1}}, seu pedido saiu.');
  await wrapper.find('input[name="body_example_1"]').setValue('Maria');
};

describe('WhatsappTemplateForm', () => {
  it('shows one example field per detected body variable', async () => {
    const wrapper = mountForm();
    expect(wrapper.find('[data-test-id="body-examples"]').exists()).toBe(false);

    await wrapper.find('textarea').setValue('Oi {{1}}, pedido {{2}} saiu.');

    expect(wrapper.find('input[name="body_example_1"]').exists()).toBe(true);
    expect(wrapper.find('input[name="body_example_2"]').exists()).toBe(true);

    await wrapper.find('textarea').setValue('Oi {{1}}, pedido saiu.');
    expect(wrapper.find('input[name="body_example_2"]').exists()).toBe(false);
  });

  it('shows the header example field only when the header has a variable', async () => {
    const wrapper = mountForm();
    await wrapper.find('input[name="header_text"]').setValue('Novidades');
    expect(wrapper.find('input[name="header_example"]').exists()).toBe(false);

    await wrapper.find('input[name="header_text"]').setValue('Oi {{1}}');
    expect(wrapper.find('input[name="header_example"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="header-counter"]').text()).toBe('8/60');
  });

  it('blocks the request when local validation fails', async () => {
    const wrapper = mountForm();
    await wrapper.find('input[name="name"]').setValue('Nome Inválido');
    await wrapper.find('textarea').setValue('Oi {{1}}, tudo bem?');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(WhatsappMessageTemplatesAPI.create).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Invalid format.');
    expect(wrapper.text()).toContain('Fill in an example for each variable.');
    expect(useAlert).toHaveBeenCalled();
  });

  it('sends the payload and emits created on success', async () => {
    WhatsappMessageTemplatesAPI.create.mockResolvedValue({
      data: {
        template: { id: '1', status: 'PENDING', name: 'pedido_enviado' },
      },
    });
    const wrapper = mountForm();
    await fillValidDraft(wrapper);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(WhatsappMessageTemplatesAPI.create).toHaveBeenCalledWith(7, {
      name: 'pedido_enviado',
      category: 'MARKETING',
      language: 'pt_BR',
      body: 'Oi {{1}}, seu pedido saiu.',
      body_examples: ['Maria'],
    });
    expect(wrapper.emitted('created')[0][0]).toEqual({
      id: '1',
      status: 'PENDING',
      name: 'pedido_enviado',
    });
  });

  it('shows the Meta error message exactly as returned', async () => {
    WhatsappMessageTemplatesAPI.create.mockRejectedValue({
      response: {
        data: {
          error: 'Já existe um modelo com esse nome em pt_BR.',
          error_type: 'meta',
          details: { code: 100 },
        },
      },
    });
    const wrapper = mountForm();
    await fillValidDraft(wrapper);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-test-id="meta-error"]').text()).toContain(
      'Já existe um modelo com esse nome em pt_BR.'
    );
    expect(wrapper.find('[data-test-id="meta-error-title"]').exists()).toBe(
      true
    );
    expect(wrapper.emitted('created')).toBeUndefined();
  });

  it('asks for a refresh instead of blaming Meta when the request failed', async () => {
    WhatsappMessageTemplatesAPI.create.mockRejectedValue({
      response: {
        data: {
          error: 'request_failed',
          error_type: 'request_failed',
          details: {},
        },
      },
    });
    const wrapper = mountForm();
    await fillValidDraft(wrapper);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const box = wrapper.find('[data-test-id="meta-error"]');
    expect(box.text()).toContain('Refresh from Meta');
    expect(box.text()).not.toContain('request_failed');
    expect(wrapper.find('[data-test-id="meta-error-title"]').exists()).toBe(
      false
    );
  });

  it('shows a generic error without the Meta heading for other failures', async () => {
    WhatsappMessageTemplatesAPI.create.mockRejectedValue({
      response: { status: 500, data: '<html>oops</html>' },
    });
    const wrapper = mountForm();
    await fillValidDraft(wrapper);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-test-id="meta-error"]').text()).toContain(
      'Could not create the template'
    );
    expect(wrapper.find('[data-test-id="meta-error-title"]').exists()).toBe(
      false
    );
  });

  it('shows the translated status in the success alert', async () => {
    WhatsappMessageTemplatesAPI.create.mockResolvedValue({
      data: { template: { status: 'APPROVED' } },
    });
    const wrapper = mountForm();
    await fillValidDraft(wrapper);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(useAlert).toHaveBeenLastCalledWith(
      expect.stringContaining('Approved')
    );
  });

  it('labels each example field with the position used in the payload', async () => {
    const wrapper = mountForm();
    await wrapper.find('textarea').setValue('Oi {{2}}, pedido {{1}} saiu.');

    const inputs = wrapper.findAll('[data-test-id="body-examples"] input');
    expect(inputs.map(input => input.attributes('name'))).toEqual([
      'body_example_1',
      'body_example_2',
    ]);
    expect(wrapper.find('[data-test-id="body-examples"]').text()).toContain(
      'Example for {{1}}'
    );
  });

  it('shows backend validation errors next to the fields', async () => {
    WhatsappMessageTemplatesAPI.create.mockRejectedValue({
      response: {
        data: { errors: [{ field: 'footer', code: 'variables_not_allowed' }] },
      },
    });
    const wrapper = mountForm();
    await fillValidDraft(wrapper);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Variables are not allowed here.');
    expect(wrapper.find('[data-test-id="meta-error"]').exists()).toBe(false);
  });

  it('shows the best practice tips', () => {
    const tips = mountForm().find('[data-test-id="template-tips"]').text();

    expect(tips).toContain('Meta reviews the category');
    expect(tips).toContain('charged per delivered message');
    expect(tips).toContain('up to 24 hours');
    expect(tips).toContain('Do not create promotional templates as utility');
  });

  it('adds up to three quick reply buttons', async () => {
    const wrapper = mountForm();
    await wrapper.find('select[name="button_type"]').setValue('QUICK_REPLY');

    expect(wrapper.find('input[name="button_text_0"]').exists()).toBe(true);
    const addButton = () => wrapper.find('[data-test-id="add-button"]');
    await addButton().trigger('click');
    await addButton().trigger('click');

    expect(wrapper.find('input[name="button_text_2"]').exists()).toBe(true);
    expect(addButton().exists()).toBe(false);
  });

  it('builds a URL button with example when the link ends with a variable', async () => {
    WhatsappMessageTemplatesAPI.create.mockResolvedValue({
      data: { template: { status: 'PENDING' } },
    });
    const wrapper = mountForm();
    await fillValidDraft(wrapper);
    await wrapper.find('select[name="button_type"]').setValue('URL');
    await wrapper.find('input[name="button_text_0"]').setValue('Ver pedido');
    await wrapper
      .find('input[name="button_url_0"]')
      .setValue('https://loja.com/pedido/{{1}}');
    await wrapper
      .find('input[name="button_example_0"]')
      .setValue('https://loja.com/pedido/42');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(WhatsappMessageTemplatesAPI.create.mock.calls[0][1].buttons).toEqual(
      [
        {
          type: 'URL',
          text: 'Ver pedido',
          url: 'https://loja.com/pedido/{{1}}',
          example: 'https://loja.com/pedido/42',
        },
      ]
    );
  });

  it('emits cancel', async () => {
    const wrapper = mountForm();
    const buttons = wrapper.findAll('button[type="button"]');
    await buttons[buttons.length - 1].trigger('click');

    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  describe('image header', () => {
    const chooseFile = async (wrapper, file) => {
      const input = wrapper.find('input[name="header_image_file"]');
      Object.defineProperty(input.element, 'files', {
        value: [file],
        configurable: true,
      });
      await input.trigger('change');
      await flushPromises();
    };

    const pngFile = (size = 1000) => {
      const file = new File(['x'], 'promo.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: size });
      return file;
    };

    const selectImageHeader = async wrapper => {
      await wrapper.find('select[name="header_format"]').setValue('IMAGE');
    };

    it('swaps the text header for an image picker', async () => {
      const wrapper = mountForm();
      expect(wrapper.find('[data-test-id="header-image"]').exists()).toBe(
        false
      );

      await selectImageHeader(wrapper);

      expect(wrapper.find('[data-test-id="header-image"]').exists()).toBe(true);
      expect(wrapper.find('input[name="header_text"]').exists()).toBe(false);
    });

    it('uploads the image and sends its blob id in the payload', async () => {
      uploadFile.mockResolvedValue({
        blobId: 'signed-blob',
        fileUrl: 'https://chat.example.com/promo.png',
      });
      WhatsappMessageTemplatesAPI.create.mockResolvedValue({
        data: { template: { status: 'PENDING' } },
      });
      const wrapper = mountForm();
      await fillValidDraft(wrapper);
      await selectImageHeader(wrapper);

      await chooseFile(wrapper, pngFile());

      expect(wrapper.find('[data-test-id="header-image-name"]').text()).toBe(
        'promo.png'
      );
      expect(
        wrapper.find('[data-test-id="preview-header-image"]').attributes('src')
      ).toBe('https://chat.example.com/promo.png');

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(WhatsappMessageTemplatesAPI.create).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({
          header_format: 'IMAGE',
          header_image: 'signed-blob',
        })
      );
    });

    it('rejects files over 5 MB without uploading', async () => {
      uploadFile.mockClear();
      const wrapper = mountForm();
      await selectImageHeader(wrapper);

      await chooseFile(wrapper, pngFile(5 * 1024 * 1024 + 1));

      expect(uploadFile).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain('The image must be at most 5 MB.');
    });

    it('blocks submit until an image is uploaded', async () => {
      WhatsappMessageTemplatesAPI.create.mockClear();
      const wrapper = mountForm();
      await fillValidDraft(wrapper);
      await selectImageHeader(wrapper);

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(WhatsappMessageTemplatesAPI.create).not.toHaveBeenCalled();
      expect(wrapper.find('[data-test-id="header-image"]').text()).toContain(
        'This field is required.'
      );
    });

    it('explains when the Meta app id is not configured', async () => {
      WhatsappMessageTemplatesAPI.create.mockRejectedValue({
        response: {
          data: { errors: [{ field: 'header_image', code: 'app_id_missing' }] },
        },
      });
      uploadFile.mockResolvedValue({ blobId: 'b', fileUrl: 'https://x/y.png' });
      const wrapper = mountForm();
      await fillValidDraft(wrapper);
      await selectImageHeader(wrapper);
      await chooseFile(wrapper, pngFile());

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.text()).toContain('WHATSAPP_APP_ID');
    });
  });
});
