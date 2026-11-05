import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import ContactAPI from 'dashboard/api/contacts';
import ContactLabelBySpreadsheetDialog from '../ContactLabelBySpreadsheetDialog.vue';

vi.mock('dashboard/composables/store');
vi.mock('dashboard/composables', () => ({ useAlert: vi.fn() }));
vi.mock('dashboard/api/contacts', () => ({
  default: { bulkLabelByCodes: vi.fn() },
}));

const DialogStub = {
  props: ['confirmButtonLabel', 'disableConfirmButton', 'title'],
  emits: ['confirm'],
  setup(_, { expose }) {
    expose({ open: () => {}, close: vi.fn() });
  },
  template: `<div>
    <slot />
    <button
      data-test-id="confirm"
      :disabled="disableConfirmButton"
      @click="$emit('confirm')"
    >{{ confirmButtonLabel }}</button>
  </div>`,
};

const csvFile = content => {
  const file = new File([content], 'lista.csv', { type: 'text/csv' });
  file.arrayBuffer = () =>
    Promise.resolve(new TextEncoder().encode(content).buffer);
  return file;
};

const mountDialog = () =>
  mount(ContactLabelBySpreadsheetDialog, {
    global: {
      stubs: { Dialog: DialogStub },
    },
  });

const selectFile = async (wrapper, file) => {
  const input = wrapper.find('[data-test-id="file-input"]');
  Object.defineProperty(input.element, 'files', {
    value: [file],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
};

describe('ContactLabelBySpreadsheetDialog', () => {
  const dispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.mockReturnValue({ dispatch });
    useMapGetter.mockImplementation(getter =>
      getter === 'labels/getLabels'
        ? ref([{ id: 1, title: 'lista-da-semana' }])
        : ref(null)
    );
  });

  it('previews the rows read and sends only codes and phones', async () => {
    ContactAPI.bulkLabelByCodes.mockResolvedValue({
      data: {
        label: 'lista-da-semana',
        received: 2,
        matched: 1,
        labeled: 1,
        already_labeled: 0,
        queued: 0,
        not_found: 1,
        not_found_codes: ['55'],
      },
    });
    const wrapper = mountDialog();
    const confirm = () => wrapper.find('[data-test-id="confirm"]');

    expect(confirm().attributes('disabled')).toBeDefined();

    await selectFile(
      wrapper,
      csvFile(
        'Código;Nome;CPF;Telefone\n1234;Maria Silva;123.456.789-09;(11) 98765-4321\n55;João;;\n'
      )
    );
    expect(wrapper.find('[data-test-id="preview"]').exists()).toBe(true);

    await wrapper
      .find('input[data-test-id="label-input"]')
      .setValue('Lista da Semana');
    expect(confirm().attributes('disabled')).toBeUndefined();

    await confirm().trigger('click');
    await flushPromises();

    expect(ContactAPI.bulkLabelByCodes).toHaveBeenCalledWith({
      label: 'lista-da-semana',
      rows: [
        { code: '1234', phones: ['11987654321'] },
        { code: '55', phones: [] },
      ],
    });
    const payload = JSON.stringify(ContactAPI.bulkLabelByCodes.mock.calls[0]);
    expect(payload).not.toContain('Maria');
    expect(payload).not.toContain('123.456.789');
    expect(dispatch).toHaveBeenCalledWith('labels/get');
    expect(wrapper.find('[data-test-id="result"]').exists()).toBe(true);
    expect(wrapper.find('[data-test-id="download-not-found"]').exists()).toBe(
      true
    );
  });

  it('shows an error when no code or phone is found', async () => {
    const wrapper = mountDialog();
    await selectFile(wrapper, csvFile('Nome;Cidade\nMaria;Floripa\n'));

    expect(wrapper.find('[data-test-id="parse-error"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-test-id="confirm"]').attributes('disabled')
    ).toBeDefined();
    expect(ContactAPI.bulkLabelByCodes).not.toHaveBeenCalled();
  });
});
