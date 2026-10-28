import { mount } from '@vue/test-utils';
import WhatsappTemplatePreview from '../components/WhatsappTemplatePreview.vue';
import { templates } from 'dashboard/store/modules/specs/inboxes/templateFixtures';

const findText = (wrapper, testId) =>
  wrapper.find(`[data-test-id="${testId}"]`);

describe('WhatsappTemplatePreview', () => {
  it('renders a draft with variables replaced by their examples', () => {
    const wrapper = mount(WhatsappTemplatePreview, {
      props: {
        draft: {
          headerText: 'Pedido de {{1}}',
          headerExample: 'Maria',
          body: 'Oi {{1}}, seu pedido {{2}} saiu para entrega.',
          bodyExamples: ['Maria', '1234'],
          footer: 'Feito com carinho',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Obrigado' },
            { type: 'QUICK_REPLY', text: 'Falar com alguém' },
          ],
        },
      },
    });

    expect(findText(wrapper, 'preview-header').text()).toBe('Pedido de Maria');
    expect(findText(wrapper, 'preview-body').text()).toBe(
      'Oi Maria, seu pedido 1234 saiu para entrega.'
    );
    expect(findText(wrapper, 'preview-footer').text()).toBe(
      'Feito com carinho'
    );
    const buttons = wrapper.findAll('[data-test-id="preview-button"]');
    expect(buttons.map(button => button.text())).toEqual([
      'Obrigado',
      'Falar com alguém',
    ]);
  });

  it('keeps the variable visible while the example is empty', () => {
    const wrapper = mount(WhatsappTemplatePreview, {
      props: { draft: { body: 'Oi {{1}}, tudo bem?', bodyExamples: [''] } },
    });

    expect(findText(wrapper, 'preview-body').text()).toBe(
      'Oi {{1}}, tudo bem?'
    );
    expect(findText(wrapper, 'preview-header').exists()).toBe(false);
    expect(findText(wrapper, 'preview-footer').exists()).toBe(false);
  });

  it('renders a synced template from its components', () => {
    const template = templates.find(
      item =>
        item.name === 'sample_issue_resolution' && item.language === 'pt_BR'
    );
    const wrapper = mount(WhatsappTemplatePreview, { props: { template } });

    expect(findText(wrapper, 'preview-body').text()).toBe(
      'Oi, {{1}}. Nós conseguimos resolver o problema que você estava enfrentando?'
    );
    expect(findText(wrapper, 'preview-footer').text()).toBe(
      'Esta mensagem é de uma empresa não verificada.'
    );
    expect(
      wrapper.findAll('[data-test-id="preview-button"]').map(b => b.text())
    ).toEqual(['Sim', 'Não']);
  });

  it('does not render media headers of synced templates as text', () => {
    const template = templates.find(
      item => item.name === 'sample_flight_confirmation'
    );
    const wrapper = mount(WhatsappTemplatePreview, { props: { template } });

    expect(findText(wrapper, 'preview-header').exists()).toBe(false);
  });
});
