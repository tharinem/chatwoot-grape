import { mount, flushPromises } from '@vue/test-utils';
import WhatsappTemplateForm from '../components/WhatsappTemplateForm.vue';
import WhatsappMessageTemplatesAPI from 'dashboard/api/whatsappMessageTemplates';
import { useAlert } from 'dashboard/composables';

vi.mock('dashboard/api/whatsappMessageTemplates', () => ({
  default: { create: vi.fn() },
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
    expect(wrapper.emitted('created')).toBeUndefined();
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
});
