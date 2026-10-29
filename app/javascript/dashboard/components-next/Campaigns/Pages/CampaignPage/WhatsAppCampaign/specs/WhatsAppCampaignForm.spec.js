import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';
import WhatsAppCampaignForm from '../WhatsAppCampaignForm.vue';

vi.mock('dashboard/composables/store');

const TEMPLATES = [
  {
    id: 't-1',
    name: 'promo_semana',
    language: 'pt_BR',
    category: 'MARKETING',
    namespace: 'ns-1',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Oi {{1}}, cupom {{2}}' }],
  },
  {
    id: 't-2',
    name: 'aviso_geral',
    language: 'pt_BR',
    category: 'UTILITY',
    namespace: 'ns-1',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Aviso {{1}}' }],
  },
];

const uiFlags = ref({ isCreating: false, isUpdating: false });

const mockGetters = () => {
  useMapGetter.mockImplementation(getter => {
    if (getter === 'campaigns/getUIFlags') return uiFlags;
    if (getter === 'labels/getLabels') {
      return ref([
        { id: 11, title: 'vip' },
        { id: 12, title: 'cliente_antigo' },
      ]);
    }
    if (getter === 'inboxes/getWhatsAppInboxes') {
      return ref([{ id: 7, name: 'WhatsApp Loja' }]);
    }
    if (getter === 'inboxes/getFilteredWhatsAppTemplates') {
      return ref(inboxId => (Number(inboxId) === 7 ? TEMPLATES : []));
    }
    return ref(null);
  });
};

// Scheduled for 2030-01-15 13:30 UTC (TZ=UTC in the test script).
const SCHEDULED_AT = Date.UTC(2030, 0, 15, 13, 30) / 1000;

const campaign = {
  id: 42,
  title: 'Promo de sexta',
  message: 'Oi Ana, cupom CAFE10',
  campaign_status: 'active',
  inbox: { id: 7, name: 'WhatsApp Loja', channel_type: 'Channel::Whatsapp' },
  scheduled_at: SCHEDULED_AT,
  audience: [
    { id: 11, type: 'Label' },
    { id: 12, type: 'Label' },
  ],
  template_params: {
    name: 'promo_semana',
    language: 'pt_BR',
    category: 'MARKETING',
    namespace: 'ns-1',
    processed_params: { body: { 1: 'Ana', 2: 'CAFE10' } },
  },
};

const ComboBoxStub = {
  name: 'ComboBox',
  props: ['modelValue', 'options', 'disabled'],
  template: '<div class="combobox-stub" :data-disabled="disabled" />',
};

const TagMultiSelectStub = {
  name: 'TagMultiSelectComboBox',
  props: ['modelValue', 'options'],
  template: '<div class="tag-multiselect-stub" />',
};

const mountForm = props =>
  mount(WhatsAppCampaignForm, {
    props,
    global: {
      stubs: {
        ComboBox: ComboBoxStub,
        TagMultiSelectComboBox: TagMultiSelectStub,
      },
    },
  });

describe('WhatsAppCampaignForm', () => {
  beforeEach(() => {
    uiFlags.value = { isCreating: false, isUpdating: false };
    mockGetters();
  });

  describe('edit mode', () => {
    it('prefills title, template, audience and scheduled time', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      expect(wrapper.find('input[type="text"]').element.value).toBe(
        'Promo de sexta'
      );
      expect(wrapper.find('input[type="datetime-local"]').element.value).toBe(
        '2030-01-15T13:30'
      );

      const [inboxCombo, templateCombo] = wrapper.findAllComponents({
        name: 'ComboBox',
      });
      expect(inboxCombo.props('modelValue')).toBe(7);
      expect(templateCombo.props('modelValue')).toBe('t-1');
      expect(
        wrapper
          .findComponent({ name: 'TagMultiSelectComboBox' })
          .props('modelValue')
      ).toEqual([11, 12]);
    });

    it('keeps the inbox fixed', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      const [inboxCombo] = wrapper.findAllComponents({ name: 'ComboBox' });
      expect(inboxCombo.props('disabled')).toBe(true);
      expect(wrapper.vm.prepareCampaignDetails()).not.toHaveProperty(
        'inbox_id'
      );
    });

    it('restores the saved template variables in the payload', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      const details = wrapper.vm.prepareCampaignDetails();
      expect(details).toMatchObject({
        title: 'Promo de sexta',
        message: 'Oi Ana, cupom CAFE10',
        scheduled_at: '2030-01-15T13:30:00.000Z',
        audience: [
          { id: 11, type: 'Label' },
          { id: 12, type: 'Label' },
        ],
        template_params: {
          name: 'promo_semana',
          language: 'pt_BR',
          processed_params: { body: { 1: 'Ana', 2: 'CAFE10' } },
        },
      });
    });

    it('does not reuse saved variables when another template is picked', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      const [, templateCombo] = wrapper.findAllComponents({ name: 'ComboBox' });
      templateCombo.vm.$emit('update:modelValue', 't-2');
      await flushPromises();

      const details = wrapper.vm.prepareCampaignDetails();
      expect(details.template_params.name).toBe('aviso_geral');
      expect(details.template_params.processed_params).toEqual({
        body: { 1: '' },
      });
    });

    it('emits the update payload on submit without closing the form', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.emitted('submit')).toHaveLength(1);
      expect(wrapper.emitted('submit')[0][0]).not.toHaveProperty('inbox_id');
      expect(wrapper.emitted('cancel')).toBeUndefined();
    });

    it('can hide its own action buttons for use inside a dialog', async () => {
      const wrapper = mountForm({
        mode: 'edit',
        selectedCampaign: campaign,
        showActionButtons: false,
      });
      await flushPromises();

      expect(wrapper.find('button[type="submit"]').exists()).toBe(false);
    });
  });

  describe('scheduled time in the past', () => {
    // TZ=UTC in the test script, so the input value is the UTC wall time.
    const NOW = Date.UTC(2030, 0, 15, 12, 0);
    const FUTURE_ERROR = 'Choose a date and time in the future.';

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const setScheduledAt = async (wrapper, value) => {
      await wrapper.find('input[type="datetime-local"]').setValue(value);
    };

    it('blocks saving an edit moved to a past date', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      await setScheduledAt(wrapper, '2030-01-13T08:10');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeUndefined();
      expect(wrapper.text()).toContain(FUTURE_ERROR);
      expect(await wrapper.vm.validate()).toBe(false);
    });

    it('shows the error right away when the saved time already passed', async () => {
      const wrapper = mountForm({
        mode: 'edit',
        selectedCampaign: {
          ...campaign,
          scheduled_at: Date.UTC(2030, 0, 14, 9, 0) / 1000,
        },
      });
      await flushPromises();

      expect(wrapper.text()).toContain(FUTURE_ERROR);
      expect(wrapper.vm.isSubmitDisabled).toBe(true);
    });

    it('refuses a time less than two minutes ahead', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      await setScheduledAt(wrapper, '2030-01-15T12:01');
      expect(await wrapper.vm.validate()).toBe(false);

      await setScheduledAt(wrapper, '2030-01-15T12:02');
      expect(await wrapper.vm.validate()).toBe(true);
    });

    it('checks against the time of submit, not of opening', async () => {
      const wrapper = mountForm({ mode: 'edit', selectedCampaign: campaign });
      await flushPromises();

      await setScheduledAt(wrapper, '2030-01-15T12:10');
      expect(await wrapper.vm.validate()).toBe(true);

      vi.setSystemTime(Date.UTC(2030, 0, 15, 12, 30));
      expect(await wrapper.vm.validate()).toBe(false);
    });

    it('also applies in create mode', async () => {
      const wrapper = mountForm({});
      await flushPromises();

      await setScheduledAt(wrapper, '2030-01-15T11:00');
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeUndefined();
      expect(wrapper.text()).toContain(FUTURE_ERROR);
    });

    it('keeps the required message for an empty time', async () => {
      const wrapper = mountForm({});
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.text()).toContain('Scheduled time is required');
      expect(wrapper.text()).not.toContain(FUTURE_ERROR);
    });
  });

  describe('create mode', () => {
    it('starts empty and sends the inbox', async () => {
      const wrapper = mountForm({});
      await flushPromises();

      expect(wrapper.find('input[type="text"]').element.value).toBe('');
      const [inboxCombo] = wrapper.findAllComponents({ name: 'ComboBox' });
      expect(inboxCombo.props('disabled')).toBeFalsy();
      expect(wrapper.vm.prepareCampaignDetails()).toHaveProperty(
        'inbox_id',
        null
      );
      expect(wrapper.find('button[type="submit"]').text()).toContain('Create');
    });
  });
});
