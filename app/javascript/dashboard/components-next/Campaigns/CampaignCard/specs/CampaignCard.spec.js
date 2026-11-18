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

describe('CampaignCard delivery stats', () => {
  const statsBlock = wrapper =>
    wrapper.find('[data-test-id="campaign-delivery-stats"]');
  // Label and count render as sibling spans spaced by CSS gap.
  const stat = (wrapper, key) =>
    wrapper
      .find(`[data-test-id="stat-${key}"]`)
      .findAll('span')
      .map(span => span.text())
      .join(' ');

  it('shows the four counts and the read rate for a sent campaign', () => {
    const wrapper = mountCard({
      status: 'completed',
      showDeliveryStats: true,
      deliveryStats: { sent: 200, delivered: 180, read: 90, failed: 4 },
    });

    expect(statsBlock(wrapper).exists()).toBe(true);
    expect(stat(wrapper, 'sent')).toBe('Sent 200');
    expect(stat(wrapper, 'delivered')).toBe('Delivered 180');
    expect(stat(wrapper, 'read')).toBe('Read 90');
    expect(stat(wrapper, 'failed')).toBe('Failed 4');
    expect(wrapper.find('[data-test-id="read-rate"]').text()).toBe('45% read');
  });

  it('hides the read rate when nothing was accepted for sending', () => {
    const wrapper = mountCard({
      status: 'completed',
      showDeliveryStats: true,
      deliveryStats: { sent: 0, delivered: 0, read: 0, failed: 3 },
    });

    expect(stat(wrapper, 'failed')).toBe('Failed 3');
    expect(wrapper.find('[data-test-id="read-rate"]').exists()).toBe(false);
  });

  it('shows "no data" for a sent campaign without recorded sends', () => {
    const wrapper = mountCard({
      status: 'completed',
      showDeliveryStats: true,
      deliveryStats: null,
    });

    expect(wrapper.find('[data-test-id="no-data"]').text()).toBe('No data');
    expect(wrapper.find('[data-test-id="stat-sent"]').exists()).toBe(false);
  });

  it('does not show stats before the campaign is sent', () => {
    const wrapper = mountCard({ status: 'active', showDeliveryStats: true });
    expect(statsBlock(wrapper).exists()).toBe(false);
  });

  it('does not show stats outside the WhatsApp list', () => {
    const wrapper = mountCard({
      status: 'completed',
      deliveryStats: { sent: 1, delivered: 1, read: 1, failed: 0 },
    });
    expect(statsBlock(wrapper).exists()).toBe(false);
  });
});
