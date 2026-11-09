import { mount } from '@vue/test-utils';
import ContactHeader from '../ContactHeader.vue';

const userPermissions = { value: [] };

vi.mock('dashboard/composables/usePolicy', () => ({
  usePolicy: () => ({
    checkPermissions: required =>
      required.some(permission => userPermissions.value.includes(permission)),
  }),
}));

const mountHeader = () =>
  mount(ContactHeader, {
    props: { headerTitle: 'Contatos' },
    global: {
      mocks: { $t: key => key },
      stubs: {
        Input: true,
        Icon: true,
        ContactSortMenu: true,
        ContactMoreActions: true,
        ComposeConversation: true,
        Button: {
          props: ['label'],
          template: '<button v-bind="$attrs">{{ label }}</button>',
        },
      },
    },
  });

const spreadsheetButton = wrapper =>
  wrapper.find('[data-test-id="label-by-spreadsheet-button"]');

describe('ContactHeader label by spreadsheet action', () => {
  it('is shown to administrators', () => {
    userPermissions.value = ['administrator'];
    expect(spreadsheetButton(mountHeader()).exists()).toBe(true);
  });

  it('is shown to agents with campaign_manage', () => {
    userPermissions.value = ['agent', 'campaign_manage'];
    expect(spreadsheetButton(mountHeader()).exists()).toBe(true);
  });

  it('is hidden from regular agents', () => {
    userPermissions.value = ['agent'];
    expect(spreadsheetButton(mountHeader()).exists()).toBe(false);
  });
});
