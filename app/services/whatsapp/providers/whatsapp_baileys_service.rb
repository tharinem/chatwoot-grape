# Ported (Phase 19, feat/baileys-channel-port) IN RECORTE from fazer-ai/chatwoot@main
# (~968 lines original). Per 19-01-PLAN.md Task 3 / Pitfall 1: NOT a verbatim port.
class Whatsapp::Providers::WhatsappBaileysService < Whatsapp::Providers::BaseService
  include BaileysHelper

  class ProviderUnavailableError < StandardError; end
  class MessageAlreadyProcessingError < StandardError; end

  DEFAULT_CLIENT_NAME = ENV.fetch('BAILEYS_PROVIDER_DEFAULT_CLIENT_NAME', nil)
  DEFAULT_URL = ENV.fetch('BAILEYS_PROVIDER_DEFAULT_URL', nil)
  DEFAULT_API_KEY = ENV.fetch('BAILEYS_PROVIDER_DEFAULT_API_KEY', nil)

  # NOTE: groups cut from recorte (see file header). Always false so setup_channel_provider
  # never asks baileys-api to enable group ingestion, matching IGNORE_GROUP_MESSAGES=true.
  def self.groups_enabled?
    false
  end

  # Used by Channels::Whatsapp::BaileysConnectionCheckJob (health-check).
  def self.status
    if DEFAULT_URL.blank? || DEFAULT_API_KEY.blank?
      raise ProviderUnavailableError, 'Missing BAILEYS_PROVIDER_DEFAULT_URL or BAILEYS_PROVIDER_DEFAULT_API_KEY setup'
    end

    response = HTTParty.get(
      "#{DEFAULT_URL}/status",
      headers: { 'x-api-key' => DEFAULT_API_KEY }
    )

    unless response.success?
      Rails.logger.error response.body
      raise ProviderUnavailableError, 'Baileys API is unavailable'
    end

    response.parsed_response.deep_symbolize_keys
  rescue ProviderUnavailableError
    raise
  rescue StandardError => e
    Rails.logger.error e.message
    raise ProviderUnavailableError, 'Baileys API is unavailable'
  end

  def setup_channel_provider
    response = HTTParty.post(
      "#{provider_url}/connections/#{whatsapp_channel.phone_number}",
      headers: api_headers,
      body: {
        clientName: DEFAULT_CLIENT_NAME,
        webhookUrl: whatsapp_channel.inbox.callback_webhook_url,
        webhookVerifyToken: whatsapp_channel.provider_config['webhook_verify_token'],
        # TODO: Remove on Baileys v2, default will be false
        includeMedia: false,
        groupsEnabled: self.class.groups_enabled?
      }.compact.to_json
    )

    raise ProviderUnavailableError unless process_response(response)

    true
  end

  # Best-effort disconnect: we tell the Baileys API to drop the session and move on regardless
  # of the response. A stale/already-cleared session (404), a Baileys API hiccup (5xx), or even
  # a network error should not block channel teardown.
  def disconnect_channel_provider
    response = HTTParty.delete(
      "#{provider_url}/connections/#{whatsapp_channel.phone_number}",
      headers: api_headers,
      timeout: 10
    )
    Rails.logger.warn("[WHATSAPP][BAILEYS] disconnect_channel_provider non-success status=#{response.code}") unless response.success?
    true
  rescue StandardError => e
    Rails.logger.warn("[WHATSAPP][BAILEYS] disconnect_channel_provider failed (ignored): #{e.message}")
    true
  end

  # Recorte: text + attachment only. Reaction branch (content_attributes[:is_reaction]) and
  # mention merging (merge_mention_data) removed — reactions/mentions are cut scope.
  def send_message(recipient_id, message)
    @message = message
    @recipient_id = recipient_id

    if @message.attachments.present?
      @message_content = attachment_message_content.merge(reply_context)
    elsif @message.outgoing_content.present?
      @message_content = { text: @message.outgoing_content }.merge(reply_context)
    else
      @message.update!(is_unsupported: true)
      return
    end

    send_message_request
  end

  # No-op stubs: Channel::Whatsapp delegates send_template/sync_templates to provider_service
  # regardless of provider. Baileys has no template API (session-based, not Business Platform).
  def send_template(phone_number, template_info); end

  def sync_templates; end

  def media_url(media_id)
    "#{provider_url}/media/#{media_id}"
  end

  def api_headers
    { 'x-api-key' => api_key, 'Content-Type' => 'application/json' }
  end

  def validate_provider_config?
    response = HTTParty.get(
      "#{provider_url}/status/auth",
      headers: api_headers
    )

    process_response(response)
  end

  def read_messages(messages, recipient_id:, **)
    @recipient_id = recipient_id

    response = HTTParty.post(
      "#{provider_url}/connections/#{whatsapp_channel.phone_number}/read-messages",
      headers: api_headers,
      body: {
        keys: messages.map { |message| message_key_for(message) }
      }.to_json
    )

    raise ProviderUnavailableError unless process_response(response)

    true
  end

  def received_messages(recipient_id, messages)
    @recipient_id = recipient_id

    response = HTTParty.post(
      "#{provider_url}/connections/#{whatsapp_channel.phone_number}/send-receipts",
      headers: api_headers,
      body: {
        keys: messages.map { |message| message_key_for(message) }
      }.to_json
    )

    raise ProviderUnavailableError unless process_response(response)

    true
  end

  private

  def provider_url
    whatsapp_channel.provider_config['provider_url'].presence || DEFAULT_URL
  end

  def api_key
    whatsapp_channel.provider_config['api_key'].presence || DEFAULT_API_KEY
  end

  def reply_context
    reply_to_external_id = @message.content_attributes[:in_reply_to_external_id]
    return {} if reply_to_external_id.blank?

    reply_to_message = @message.conversation.messages.find_by(source_id: reply_to_external_id)
    return {} unless reply_to_message

    {
      quotedMessage: {
        key: message_key_for(reply_to_message),
        message: quoted_message_content(reply_to_message)
      }
    }
  end

  # NOTE: group_participant_jid (upstream) dropped with group support; `participant` is never
  # set for a 1:1 remoteJid, and message_key_for degrades gracefully via `.compact`.
  def message_key_for(message)
    {
      id: message.source_id,
      remoteJid: remote_jid,
      fromMe: message.message_type == 'outgoing'
    }.compact
  end

  def quoted_message_content(message)
    if message.attachments.present?
      attachment = message.attachments.first
      case attachment.file_type
      when 'image'
        { imageMessage: { caption: message.content } }
      when 'video'
        { videoMessage: { caption: message.content } }
      when 'audio'
        { audioMessage: {} }
      when 'file'
        { documentMessage: { caption: message.content, fileName: attachment.file.filename.to_s } }
      else
        { conversation: message.content.to_s }
      end
    else
      { conversation: message.content.to_s }
    end
  end

  def attachment_message_content # rubocop:disable Metrics/MethodLength
    attachment = @message.attachments.first
    buffer = attachment_to_base64(attachment)

    content = {
      fileName: attachment.file.filename,
      caption: @message.outgoing_content
    }
    case attachment.file_type
    when 'image'
      content[:image] = buffer
    when 'audio'
      content[:audio] = buffer
      content[:ptt] = true if voice_note_attachment?(attachment)
    when 'file'
      content[:document] = buffer
      content[:mimetype] = attachment.file.content_type
    when 'sticker'
      content[:sticker] = buffer
    when 'video'
      content[:video] = buffer
    end

    content.compact
  end

  # `is_recorded_audio` is the legacy fazer.ai meta key (transcode pipeline and old messages).
  def voice_note_attachment?(attachment)
    meta = attachment.meta || {}
    meta['is_voice_message'].present? || meta['is_recorded_audio'].present?
  end

  def send_message_request
    response = HTTParty.post(
      "#{provider_url}/connections/#{whatsapp_channel.phone_number}/send-message",
      headers: api_headers,
      body: {
        jid: remote_jid,
        messageContent: @message_content,
        chatwootMessageId: "#{@message.id}:#{@message.updated_at.to_f}"
      }.to_json,
      timeout: 120
    )

    raise MessageAlreadyProcessingError if response.code == 409
    raise ProviderUnavailableError unless process_response(response)

    update_external_created_at(response)
    response.parsed_response.dig('data', 'key', 'id')
  end

  def process_response(response)
    Rails.logger.error response.body unless response.success?
    response.success?
  end

  def remote_jid
    return @recipient_id if @recipient_id.ends_with?('@lid')

    "#{@recipient_id.delete('+')}@s.whatsapp.net"
  end

  def update_external_created_at(response)
    timestamp = response.parsed_response.dig('data', 'messageTimestamp')
    return unless timestamp

    external_created_at = baileys_extract_message_timestamp(timestamp)
    @message.update!(external_created_at: external_created_at)
  end

  private_class_method def self.with_error_handling(*method_names)
    method_names.each do |method_name|
      original_method = instance_method(method_name)

      define_method("#{method_name}_without_error_handling") do |*args, **kwargs, &block|
        original_method.bind_call(self, *args, **kwargs, &block)
      end

      define_method(method_name) do |*args, **kwargs, &block|
        original_method.bind_call(self, *args, **kwargs, &block)
      rescue MessageAlreadyProcessingError
        raise
      rescue StandardError => e
        handle_channel_error
        raise e
      end
    end
  end

  def handle_channel_error
    whatsapp_channel.update_provider_connection!(connection: 'close')

    return if @handling_error

    @handling_error = true
    begin
      setup_channel_provider_without_error_handling
    rescue StandardError => e
      Rails.logger.error "Failed to reconnect channel after error: #{e.message}"
    ensure
      @handling_error = false
    end
  end

  with_error_handling :setup_channel_provider,
                      :send_message,
                      :read_messages,
                      :received_messages
end
