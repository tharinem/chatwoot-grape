import { mount } from '@vue/test-utils';
import CampaignCard from '../CampaignCard.vue';

const inbox = {
  id: 7,
  name: 'WhatsApp Loja',
  channel_type: 'Channel::Whatsapp',
};

const mountCard = props =>
  mount(CampaignCard, {
    props: {
      title: 'Promo de sexta',
      message: 'Oi',
      inbox,
      scheduledAt: 1893504600,
      ...props,
    },
    global: { directives: { dompurifyHtml: {} } },
  });

const editButton = wrapper =>
  wrapper.find('[data-test-id="campaign-edit-button"]');

describe('CampaignCard edit action', () => {
  it('shows the edit action for an editable campaign not sent yet', async () => {
    const wrapper = mountCard({ isEditable: true, status: 'active' });

    expect(editButton(wrapper).exists()).toBe(true);
    await editButton(wrapper).trigger('click');
    expect(wrapper.emitted('edit')).toHaveLength(1);
  });

  it('hides the edit action once the campaign was sent', () => {
    const wrapper = mountCard({ isEditable: true, status: 'completed' });
    expect(editButton(wrapper).exists()).toBe(false);
  });

  it('hides the edit action for one-off campaigns that are not editable', () => {
    const wrapper = mountCard({ status: 'active' });
    expect(editButton(wrapper).exists()).toBe(false);
  });

  it('keeps the edit action for live chat campaigns', () => {
    const wrapper = mountCard({ isLiveChatType: true, isEnabled: true });
    expect(editButton(wrapper).exists()).toBe(true);
  });
});
