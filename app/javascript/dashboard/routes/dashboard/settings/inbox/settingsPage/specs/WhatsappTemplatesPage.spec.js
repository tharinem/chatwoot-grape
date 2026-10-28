import { mount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import WhatsappTemplatesPage from '../WhatsappTemplatesPage.vue';
import InboxesAPI from 'dashboard/api/inboxes';

vi.mock('dashboard/api/inboxes', () => ({
  default: { show: vi.fn() },
}));

vi.mock('dashboard/composables', () => ({
  useAlert: vi.fn(),
}));

const templates = [
  {
    name: 'pedido_enviado',
    status: 'APPROVED',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [{ type: 'BODY', text: 'Seu pedido saiu para entrega.' }],
  },
  {
    name: 'promo_semana',
    status: 'PENDING',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [{ type: 'BODY', text: 'Promoção de chocolate esta semana.' }],
  },
];

const buildStore = ({ syncTemplates = vi.fn() } = {}) =>
  createStore({
    modules: {
      inboxes: {
        namespaced: true,
        state: () => ({
          records: [{ id: 3, name: 'WhatsApp', message_templates: templates }],
        }),
        getters: {
          getWhatsAppTemplates: state => inboxId =>
            state.records.find(record => record.id === Number(inboxId))
              ?.message_templates,
        },
        mutations: {
          EDIT_INBOXES(state, data) {
            state.records = state.records.map(record =>
              record.id === data.id ? data : record
            );
          },
        },
        actions: { syncTemplates },
      },
    },
  });

const mountPage = store =>
  mount(WhatsappTemplatesPage, {
    props: { inbox: { id: 3 } },
    global: { plugins: [store] },
  });

describe('WhatsappTemplatesPage', () => {
  it('lists templates of every status', () => {
    const wrapper = mountPage(buildStore());
    const rows = wrapper.findAll('[data-test-id="template-row"]');

    expect(rows).toHaveLength(2);
    expect(
      wrapper.findAll('[data-test-id="template-status"]').map(s => s.text())
    ).toEqual(['Approved', 'Pending']);
  });

  it('filters by name or text', async () => {
    const wrapper = mountPage(buildStore());

    await wrapper.find('input[name="template_search"]').setValue('chocolate');
    expect(wrapper.findAll('[data-test-id="template-row"]')).toHaveLength(1);
    expect(wrapper.text()).toContain('promo_semana');

    await wrapper.find('input[name="template_search"]').setValue('nada');
    expect(wrapper.find('[data-test-id="templates-no-results"]').exists()).toBe(
      true
    );
  });

  it('shows the preview of the selected template', async () => {
    const wrapper = mountPage(buildStore());
    expect(
      wrapper.find('[data-test-id="whatsapp-template-preview"]').exists()
    ).toBe(false);

    await wrapper.findAll('[data-test-id="template-row"]')[1].trigger('click');

    expect(wrapper.find('[data-test-id="preview-body"]').text()).toBe(
      'Promoção de chocolate esta semana.'
    );
  });

  it('syncs from Meta, refetches only this inbox and shows the hint', async () => {
    const syncTemplates = vi.fn();
    const store = buildStore({ syncTemplates });
    InboxesAPI.show.mockResolvedValue({
      data: {
        id: 3,
        message_templates: [...templates, { ...templates[0], name: 'novo' }],
      },
    });
    const wrapper = mountPage(store);

    await wrapper.find('[data-test-id="refresh-templates"]').trigger('click');
    await flushPromises();

    expect(syncTemplates).toHaveBeenCalledWith(expect.anything(), 3);
    expect(InboxesAPI.show).toHaveBeenCalledWith(3);
    expect(store.state.inboxes.records[0].name).toBe('WhatsApp');
    expect(wrapper.findAll('[data-test-id="template-row"]')).toHaveLength(3);
    expect(wrapper.find('[data-test-id="refresh-hint"]').exists()).toBe(true);
  });

  it('opens the form for a new template', async () => {
    const wrapper = mountPage(buildStore());

    await wrapper.find('[data-test-id="new-template"]').trigger('click');

    expect(wrapper.find('form').exists()).toBe(true);
  });
});
