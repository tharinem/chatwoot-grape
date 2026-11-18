class Whatsapp::OneoffCampaignService
  pattr_initialize [:campaign!]

  def perform
    validate_campaign!
    # marks campaign completed so that other jobs won't pick it up
    campaign.completed!
    process_audience(extract_audience_labels)
  end

  private

  delegate :inbox, to: :campaign
  delegate :channel, to: :inbox

  def validate_campaign_type!
    raise "Invalid campaign #{campaign.id}" unless whatsapp_campaign? && campaign.one_off?
  end

  def whatsapp_campaign?
    campaign.inbox.inbox_type == 'Whatsapp'
  end

  def validate_campaign_status!
    raise 'Completed Campaign' if campaign.completed?
  end

  def validate_provider!
    raise 'WhatsApp Cloud provider required' if channel.provider != 'whatsapp_cloud'
  end

  def validate_feature_flag!
    raise 'WhatsApp campaigns feature not enabled' unless campaign.account.feature_enabled?(:whatsapp_campaign)
  end

  def validate_campaign!
    validate_campaign_type!
    validate_campaign_status!
    validate_provider!
    validate_feature_flag!
  end

  def extract_audience_labels
    audience_label_ids = campaign.audience.select { |audience| audience['type'] == 'Label' }.pluck('id')
    campaign.account.labels.where(id: audience_label_ids).pluck(:title)
  end

  def process_contact(contact)
    Rails.logger.info "Processing contact: #{contact.name} (#{contact.phone_number})"

    if contact.phone_number.blank?
      Rails.logger.info "Skipping contact #{contact.name} - no phone number"
      return
    end

    if campaign.template_params.blank?
      Rails.logger.error "Skipping contact #{contact.name} - no template_params found for WhatsApp campaign"
      return
    end

    send_whatsapp_template_message(contact)
  end

  def process_audience(audience_labels)
    contacts = campaign.account.contacts.tagged_with(audience_labels, any: true)
    Rails.logger.info "Processing #{contacts.count} contacts for campaign #{campaign.id}"

    contacts.each { |contact| process_contact(contact) }

    Rails.logger.info "Campaign #{campaign.id} processing completed"
  end

  def send_whatsapp_template_message(contact)
    delivery = build_delivery(contact)
    processor = Whatsapp::TemplateProcessorService.new(
      channel: channel,
      template_params: campaign.template_params
    )

    name, namespace, lang_code, processed_parameters = processor.call

    return if name.blank?

    # The delivery is passed in place of a Message: on an API error the
    # provider stores the error text in external_error and marks it failed.
    source_id = channel.send_template(contact.phone_number, {
                                        name: name,
                                        namespace: namespace,
                                        lang_code: lang_code,
                                        parameters: processed_parameters
                                      }, delivery)
    record_delivery(delivery, source_id)
  rescue StandardError => e
    Rails.logger.error "Failed to send WhatsApp template message to #{contact.phone_number}: #{e.message}"
    Rails.logger.error "Backtrace: #{e.backtrace.first(5).join('\n')}"
    record_failure(delivery, e.message)
    # continue processing remaining contacts
    nil
  end

  def build_delivery(contact)
    CampaignDelivery.new(account_id: campaign.account_id, campaign: campaign, contact: contact, status: :sent)
  end

  def record_delivery(delivery, source_id)
    if source_id.present?
      delivery.update!(source_id: source_id, status: :sent)
    else
      record_failure(delivery, delivery.external_error.presence || 'No message id returned by WhatsApp')
    end
  end

  def record_failure(delivery, error)
    return if delivery.blank?

    delivery.update!(status: :failed, external_error: error.to_s.truncate(1000))
  rescue StandardError => e
    Rails.logger.error "Failed to record campaign delivery for campaign #{campaign.id}: #{e.message}"
  end
end
