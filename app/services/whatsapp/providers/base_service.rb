#######################################
# To create a whatsapp provider
# - Inherit this as the base class.
# - Implement `send_message` method in your child class.
# - Implement `send_template_message` method in your child class.
# - Implement `sync_templates` method in your child class.
# - Implement `validate_provider_config` method in your child class.
# - Use Childclass.new(whatsapp_channel: channel).perform.
######################################

class Whatsapp::Providers::BaseService
  pattr_initialize [:whatsapp_channel!]

  def send_message(_phone_number, _message)
    raise 'Overwrite this method in child class'
  end

  def send_template(_phone_number, _template_info, _message)
    raise 'Overwrite this method in child class'
  end

  def sync_template
    raise 'Overwrite this method in child class'
  end

  def validate_provider_config
    raise 'Overwrite this method in child class'
  end

  def error_message
    raise 'Overwrite this method in child class'
  end

  def process_response(response, message)
    parsed_response = response.parsed_response
    if response.success? && parsed_response['error'].blank?
      parsed_response['messages'].first['id']
    else
      handle_error(response, message)
      nil
    end
  end

  def handle_error(response, message)
    Rails.logger.error response.body
    return if message.blank?

    # https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/#sample-response
    error_message = error_message(response)
    return if error_message.blank?

    message.external_error = error_message
    message.status = :failed
    message.save!
  end

  def create_buttons(items)
    buttons = []
    items.each do |item|
      button = { :type => 'reply', 'reply' => { 'id' => item['value'], 'title' => item['title'] } }
      buttons << button
    end
    buttons
  end

  def create_rows(items)
    rows = []
    items.each do |item|
      row = { 'id' => item['value'], 'title' => item['title'] }
      rows << row
    end
    rows
  end

  # Text sent to WhatsApp for a session message body or attachment caption.
  # Opt-in per inbox (WHATSAPP_AGENT_NAME_PREFIX_INBOX_IDS="17,42"): messages
  # typed by a human agent reach the customer as "*<agent name>:*\n<content>".
  # Only the outgoing payload changes; the stored message content does not.
  def whatsapp_outgoing_content(message)
    content = message.outgoing_content
    return content unless agent_name_prefix?(message, content)

    name = message.sender.available_name
    prefix = "*#{name}:*"
    return content if content.start_with?(prefix)

    # The agent typed the prefix already: markdown rendering turns "*Name:*" into "_Name:_".
    typed_prefix = "_#{name}:_"
    return prefix + content.delete_prefix(typed_prefix) if message.content.to_s.start_with?(prefix) && content.start_with?(typed_prefix)

    "#{prefix}\n#{content}"
  end

  def agent_name_prefix?(message, content)
    content.present? && agent_name_prefix_inbox? && human_agent_message?(message)
  end

  # Outgoing, public, typed by a User; not a template, campaign or automation rule.
  def human_agent_message?(message)
    return false unless message.outgoing? && !message.private?
    return false unless message.sender.is_a?(User) && message.sender.available_name.present?

    additional_attributes = message.additional_attributes.to_h
    additional_attributes['template_params'].blank? &&
      additional_attributes['campaign_id'].blank? &&
      message.content_attributes.to_h['automation_rule_id'].blank?
  end

  def agent_name_prefix_inbox?
    inbox_ids = ENV.fetch('WHATSAPP_AGENT_NAME_PREFIX_INBOX_IDS', '').split(',').map(&:strip).compact_blank
    inbox_ids.include?(whatsapp_channel.inbox&.id.to_s)
  end

  def create_payload(type, message_content, action)
    {
      'type': type,
      'body': {
        'text': message_content
      },
      'action': action
    }
  end

  def create_payload_based_on_items(message)
    if message.content_attributes['items'].length <= 3
      create_button_payload(message)
    else
      create_list_payload(message)
    end
  end

  def create_button_payload(message)
    buttons = create_buttons(message.content_attributes['items'])
    json_hash = { 'buttons' => buttons }
    create_payload('button', message.outgoing_content, JSON.generate(json_hash))
  end

  def create_list_payload(message)
    rows = create_rows(message.content_attributes['items'])
    section1 = { 'rows' => rows }
    sections = [section1]
    json_hash = { :button => I18n.t('conversations.messages.whatsapp.list_button_label'), 'sections' => sections }
    create_payload('list', message.outgoing_content, JSON.generate(json_hash))
  end
end
