import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';
import { useUISettings } from 'dashboard/composables/useUISettings';
import SidepanelSwitch from '../SidepanelSwitch.vue';

vi.mock('dashboard/composables/store');
vi.mock('dashboard/composables/useUISettings');
vi.mock('dashboard/composables/useKeyboardEvents', () => ({
  useKeyboardEvents: vi.fn(),
}));

const mockGetters = ({ sender = {}, storedContact = {} } = {}) => {
  useMapGetter.mockImplementation(getter => {
    if (getter === 'getCurrentAccountId') return ref(4);
    if (getter === 'accounts/isFeatureEnabledonAccount')
      return ref(() => false);
    if (getter === 'accounts/getAccount') {
      return ref(() => ({ id: 4, settings: {} }));
    }
    if (getter === 'getSelectedChat') return ref({ id: 10, meta: { sender } });
    if (getter === 'contacts/getContact') return ref(() => storedContact);
    return ref(null);
  });
};

const contactButton = wrapper => wrapper.find('[data-highlight]');

describe('SidepanelSwitch', () => {
  const updateUISettings = vi.fn();

  beforeEach(() => {
    updateUISettings.mockReset();
    useUISettings.mockReturnValue({
      uiSettings: ref({ is_contact_sidebar_open: false }),
      updateUISettings,
    });
  });

  it('uses the default highlight for contacts without attributes', () => {
    mockGetters({ sender: { id: 1, custom_attributes: {} } });
    const button = contactButton(mount(SidepanelSwitch));
    expect(button.attributes('data-highlight')).toBe('default');
    expect(button.classes()).toContain('!bg-n-alpha-3');
  });

  it('uses the brand purple when the contact has an exclusive seller', () => {
    mockGetters({
      sender: { id: 1, custom_attributes: { vendedor_exclusivo: 'Jenifer' } },
    });
    const button = contactButton(mount(SidepanelSwitch));
    expect(button.attributes('data-highlight')).toBe('exclusive_seller');
    expect(button.classes()).toContain('!bg-[#6B3FA0]');
  });

  it('uses red when the contact is blocked', () => {
    mockGetters({
      sender: {
        id: 1,
        custom_attributes: { vendedor_exclusivo: 'Jenifer', bloqueado: true },
      },
    });
    const button = contactButton(mount(SidepanelSwitch));
    expect(button.attributes('data-highlight')).toBe('blocked');
    expect(button.classes()).toContain('!bg-n-ruby-9');
  });

  it('prefers the contact from the store when it is loaded', () => {
    mockGetters({
      sender: { id: 1, custom_attributes: {} },
      storedContact: { id: 1, custom_attributes: { bloqueado: 'sim' } },
    });
    const button = contactButton(mount(SidepanelSwitch));
    expect(button.attributes('data-highlight')).toBe('blocked');
  });

  it('opens the contact panel on click', async () => {
    mockGetters({ sender: { id: 1 } });
    await contactButton(mount(SidepanelSwitch)).trigger('click');
    expect(updateUISettings).toHaveBeenCalledWith({
      is_contact_sidebar_open: true,
      is_copilot_panel_open: false,
    });
  });
});
