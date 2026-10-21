import { mount } from '@vue/test-utils';
import { useMapGetter } from 'dashboard/composables/store';
import ContactHighlights from '../ContactHighlights.vue';

vi.mock('dashboard/composables/store');

const mockGetters = ({ settings = {}, attributes = [] } = {}) => {
  useMapGetter.mockImplementation(getter => {
    if (getter === 'getCurrentAccountId') return { value: 4 };
    if (getter === 'accounts/getAccount') {
      return { value: () => ({ id: 4, settings }) };
    }
    if (getter === 'attributes/getAttributesByModel') {
      return { value: () => attributes };
    }
    return { value: null };
  });
};

const mountWith = customAttributes =>
  mount(ContactHighlights, {
    props: { contact: { id: 1, custom_attributes: customAttributes } },
  });

describe('ContactHighlights', () => {
  beforeEach(() => {
    mockGetters();
  });

  it('renders nothing when the contact has no highlight attributes', () => {
    const wrapper = mountWith({ cidade: 'Recife' });
    expect(wrapper.find('[data-test-id="contact-highlights"]').exists()).toBe(
      false
    );
  });

  it('renders nothing when the contact has no custom attributes', () => {
    const wrapper = mount(ContactHighlights, { props: { contact: {} } });
    expect(wrapper.find('[data-test-id="contact-highlights"]').exists()).toBe(
      false
    );
  });

  it('shows the display text and the exclusive seller', () => {
    const wrapper = mountWith({
      texto_exibicao: 'Entregar só pela manhã',
      vendedor_exclusivo: 'Jenifer',
    });

    const displayText = wrapper.find(
      '[data-test-id="contact-highlights-display-text"]'
    );
    const seller = wrapper.find(
      '[data-test-id="contact-highlights-exclusive-seller"]'
    );

    expect(displayText.text()).toContain('Display text');
    expect(displayText.text()).toContain('Entregar só pela manhã');
    expect(seller.text()).toContain('Exclusive seller');
    expect(seller.text()).toContain('Jenifer');
    expect(
      wrapper.find('[data-test-id="contact-highlights-blocked"]').exists()
    ).toBe(false);
  });

  it('shows the blocked badge when the contact is blocked', () => {
    const wrapper = mountWith({ texto_exibicao: 'Cliente bloqueado' });
    expect(
      wrapper.find('[data-test-id="contact-highlights-blocked"]').exists()
    ).toBe(true);
  });

  it('uses the custom attribute display name when it exists', () => {
    mockGetters({
      attributes: [
        {
          attribute_key: 'texto_exibicao',
          attribute_display_name: 'Aviso do ERP',
        },
      ],
    });
    const wrapper = mountWith({ texto_exibicao: 'Pagamento antecipado' });
    expect(
      wrapper.find('[data-test-id="contact-highlights-display-text"]').text()
    ).toContain('Aviso do ERP');
  });

  it('reads the attribute names from the account settings', () => {
    mockGetters({
      settings: {
        contact_highlight: {
          display_text_attribute: 'popup',
          exclusive_seller_attribute: 'seller',
        },
      },
    });
    const wrapper = mountWith({ popup: 'Aviso', seller: 'John' });
    expect(
      wrapper.find('[data-test-id="contact-highlights-display-text"]').text()
    ).toContain('Aviso');
    expect(
      wrapper
        .find('[data-test-id="contact-highlights-exclusive-seller"]')
        .text()
    ).toContain('John');
  });
});
