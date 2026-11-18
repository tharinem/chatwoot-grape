require 'rails_helper'

RSpec.describe CampaignDelivery do
  let(:campaign) { create(:campaign) }

  describe '#apply_status!' do
    let(:delivery) { create(:campaign_delivery, campaign: campaign) }

    it 'moves forward from sent to delivered to read' do
      delivery.apply_status!('delivered')
      expect(delivery.reload).to be_delivered

      delivery.apply_status!('read')
      expect(delivery.reload).to be_read
    end

    it 'does not downgrade a read delivery' do
      delivery.update!(status: :read)

      delivery.apply_status!('delivered')
      delivery.apply_status!('sent')
      expect(delivery.reload).to be_read
    end

    it 'marks the delivery failed with the error at any time' do
      delivery.update!(status: :delivered)

      delivery.apply_status!('failed', '131026: Message undeliverable')
      expect(delivery.reload).to be_failed
      expect(delivery.external_error).to eq('131026: Message undeliverable')
    end

    it 'keeps a failed delivery failed' do
      delivery.update!(status: :failed)

      delivery.apply_status!('read')
      expect(delivery.reload).to be_failed
    end

    it 'ignores unknown statuses' do
      expect { delivery.apply_status!('deleted') }.not_to(change { delivery.reload.status })
    end
  end

  describe '.stats_for' do
    it 'returns cumulative counts per campaign' do
      other_campaign = create(:campaign, account: campaign.account)
      create(:campaign_delivery, campaign: campaign, status: :sent)
      create_list(:campaign_delivery, 2, campaign: campaign, status: :delivered)
      create(:campaign_delivery, campaign: campaign, status: :read)
      create(:campaign_delivery, campaign: campaign, status: :failed, source_id: nil)
      create(:campaign_delivery, campaign: other_campaign, status: :read)

      stats = described_class.stats_for([campaign.id, other_campaign.id])

      expect(stats[campaign.id]).to eq(sent: 4, delivered: 3, read: 1, failed: 1)
      expect(stats[other_campaign.id]).to eq(sent: 1, delivered: 1, read: 1, failed: 0)
    end

    it 'has no entry for a campaign without recorded sends' do
      expect(described_class.stats_for([campaign.id])).to eq({})
    end
  end
end
