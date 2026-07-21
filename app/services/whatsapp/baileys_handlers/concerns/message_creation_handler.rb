# Ported (Phase 19, feat/baileys-channel-port) IN RECORTE from fazer-ai/chatwoot@main
# (.../baileys_handlers/concerns/message_creation_handler.rb). REMOVED: reaction handling
# (mark_existing_reaction_as_removed, find_existing_reaction — reactions never reach this
# handler now, filtered upstream in Helpers#ignore_message?) and referral/CTWA attribution
# (normalize_baileys_referral call in build_message_content_attributes — cut scope, method
# was never ported per 19-01-PLAN.md Task 2/3).
module Whatsapp::BaileysHandlers::Concerns::MessageCreationHandler # rubocop:disable Metrics/ModuleLength
  extend ActiveSupport::Concern

  private

  def build_and_save_message(conversation:, sender:, attach_media: false)
    return build_and_save_contact_messages(conversation: conversation, sender: sender) if message_type == 'contact'

    @message = conversation.messages.build(
      content: message_content,
      account_id: inbox.account_id,
      inbox_id: inbox.id,
      source_id: raw_message_id,
      sender: incoming? ? sender : nil,
      message_type: incoming? ? :incoming : :outgoing,
      content_attributes: build_message_content_attributes
    )

    attach_media_to_message if attach_media
    attach_location_to_message if message_type == 'location'

    @message.save!

    inbox.channel.received_messages([@message], conversation) if incoming?

    @message
  end

  # Mirrors the Cloud provider (create_contact_messages): one message per shared
  # contact, each with a native contact attachment, so the dashboard renders them
  # in the contact bubble instead of as plain text.
  def build_and_save_contact_messages(conversation:, sender:)
    messages = baileys_contacts.filter_map { |contact| build_contact_message(conversation, sender, contact) }
    inbox.channel.received_messages(messages, conversation) if incoming? && messages.any?
    @message = messages.last
  end

  def build_contact_message(conversation, sender, contact)
    fields = baileys_contact_fields(contact)
    return if fields[:phone].blank? && fields[:name].blank?

    message = conversation.messages.build(
      content: baileys_contact_line(contact), account_id: inbox.account_id, inbox_id: inbox.id,
      source_id: raw_message_id, sender: incoming? ? sender : nil,
      message_type: incoming? ? :incoming : :outgoing, content_attributes: build_message_content_attributes
    )
    attach_contact_card(message, fields)
    message.save!
    message
  end

  def attach_contact_card(message, fields)
    message.attachments.build(
      account_id: message.account_id, file_type: :contact,
      fallback_title: fields[:phone].presence || fields[:name], meta: { firstName: fields[:name] }.compact
    )
  end

  def build_message_content_attributes
    type = message_type
    msg = unwrap_ephemeral_message(@raw_message[:message])
    content_attributes = { external_created_at: baileys_extract_message_timestamp(@raw_message[:messageTimestamp]) }
    content_attributes[:external_sender_name] = 'WhatsApp' unless incoming?

    if reply_to_message_id
      content_attributes[:in_reply_to_external_id] = reply_to_message_id
    elsif type == 'unsupported'
      content_attributes[:is_unsupported] = true
    end

    add_rich_content_attributes(content_attributes, msg) if type == 'rich'

    content_attributes
  end

  # Persists the structured card payload. A rich shape with neither text/buttons
  # nor a media header falls back to unsupported (the previous empty-bubble
  # behavior) and is logged to capture real shapes. A media-only header still
  # renders via the attached media, so it is not flagged unsupported.
  def add_rich_content_attributes(content_attributes, msg)
    rich = Whatsapp::Baileys::RichMessageParser.new(msg).parse
    content_attributes[:rich] = rich if rich.present?
    return if rich.present? || should_attach_media?

    content_attributes[:is_unsupported] = true
    Rails.logger.info("[Baileys] rich message fell back to unsupported: keys=#{msg.keys}")
  end

  def attach_media_to_message
    attachment_file = download_attachment_file
    msg = unwrap_ephemeral_message(@raw_message[:message])

    attachment = @message.attachments.build(
      account_id: @message.account_id,
      file_type: file_content_type.to_s,
      file: { io: attachment_file, filename: build_attachment_filename, content_type: message_mimetype }
    )
    attachment.meta = { is_recorded_audio: true } if msg.dig(:audioMessage, :ptt)
  rescue Down::Error => e
    @message.is_unsupported = true
    Rails.logger.error "Failed to download attachment for message #{raw_message_id}: #{e.message}"
  end

  def download_attachment_file
    Down.download(
      inbox.channel.media_url(@raw_message.dig(:key, :id)),
      headers: inbox.channel.api_headers
    )
  end

  def build_attachment_filename
    msg = unwrap_ephemeral_message(@raw_message[:message])
    filename = msg.dig(:documentMessage, :fileName) ||
               msg.dig(:documentWithCaptionMessage, :message, :documentMessage, :fileName) ||
               rich_media_header&.dig(:node, :fileName)
    return filename if filename.present?

    ext = ".#{message_mimetype.split(';').first.split('/').last}" if message_mimetype.present?
    "#{file_content_type}_#{raw_message_id}_#{Time.current.strftime('%Y%m%d')}#{ext}"
  end

  # Location carries no downloadable bytes; persist coordinates as a native
  # location attachment so the dashboard renders it in the map bubble.
  def attach_location_to_message
    loc = unwrap_ephemeral_message(@raw_message[:message])
    loc = loc[:locationMessage] || loc[:liveLocationMessage]
    return if loc.blank?

    name = [loc[:name], loc[:address]].compact_blank.join(', ')
    @message.attachments.build(
      account_id: @message.account_id,
      file_type: :location,
      coordinates_lat: loc[:degreesLatitude],
      coordinates_long: loc[:degreesLongitude],
      fallback_title: name.presence,
      external_url: loc[:url]
    )
  end

  def should_attach_media?
    %w[image file video audio sticker].include?(message_type) || rich_media_header.present?
  end
end
