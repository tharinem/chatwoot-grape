# == Schema Information
#
# Table name: campaign_deliveries
#
#  id             :bigint           not null, primary key
#  external_error :text
#  status         :integer          default("sent"), not null
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  account_id     :bigint           not null
#  campaign_id    :bigint           not null
#  contact_id     :bigint
#  source_id      :string
#
# Indexes
#
#  index_campaign_deliveries_on_campaign_id_and_status  (campaign_id,status)
#  index_campaign_deliveries_on_source_id               (source_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (campaign_id => campaigns.id) ON DELETE => cascade
#

# One row per template message sent by a one-off WhatsApp campaign. The
# provider message id (wamid) is stored in source_id so that the WhatsApp
# status webhooks (sent/delivered/read/failed) can update the row, since
# campaign sends do not create a Message.
class CampaignDelivery < ApplicationRecord
  belongs_to :account
  belongs_to :campaign
  belongs_to :contact, optional: true

  enum status: { sent: 0, delivered: 1, read: 2, failed: 3 }

  # sent -> delivered -> read only moves forward. failed can arrive at any
  # time and is terminal.
  PROGRESSION = %w[sent delivered read].freeze

  # Returns { campaign_id => { sent:, delivered:, read:, failed: } } with
  # cumulative counts (a read message was also delivered and sent), using a
  # single grouped query.
  def self.stats_for(campaign_ids)
    counts = where(campaign_id: campaign_ids).group(:campaign_id, :status).count
    counts.each_with_object({}) do |((campaign_id, status), count), stats|
      entry = stats[campaign_id] ||= { sent: 0, delivered: 0, read: 0, failed: 0 }
      case status
      when 'failed' then entry[:failed] += count
      else
        entry[:sent] += count
        entry[:delivered] += count if %w[delivered read].include?(status)
        entry[:read] += count if status == 'read'
      end
    end
  end

  # Applies a WhatsApp Cloud status webhook entry ({ id:, status:, errors: })
  # to the delivery with that message id, if any.
  def self.update_from_whatsapp_status(account_id, status)
    return if status[:id].blank?

    delivery = find_by(account_id: account_id, source_id: status[:id])
    return if delivery.blank?

    error = status[:errors]&.first
    delivery.apply_status!(status[:status], error.present? ? "#{error[:code]}: #{error[:title]}" : nil)
  end

  def apply_status!(new_status, error = nil)
    new_status = new_status.to_s
    return unless self.class.statuses.key?(new_status)

    with_lock do
      next unless status_advances?(new_status)

      self.status = new_status
      self.external_error = error if new_status == 'failed' && error.present?
      save!
    end
  end

  private

  def status_advances?(new_status)
    return false if failed?
    return true if new_status == 'failed'

    PROGRESSION.index(new_status) > PROGRESSION.index(status)
  end
end
