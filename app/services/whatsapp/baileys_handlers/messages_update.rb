# Ported (Phase 19, feat/baileys-channel-port) IN RECORTE from fazer-ai/chatwoot@main
# (app/services/whatsapp/baileys_handlers/messages_update.rb). Kept: status transitions
# (sent/delivered/read/failed) — core to the recorte (status de leitura/handoff). REMOVED:
# handle_edited_content (message editing — cut scope per 19-01-PLAN.md Task 3 action text,
# "edição/deleção" not in the minimal send/receive/read recorte).
module Whatsapp::BaileysHandlers::MessagesUpdate
  include Whatsapp::BaileysHandlers::Helpers

  class MessageNotFoundError < StandardError; end

  private

  def process_messages_update
    updates = processed_params[:data]
    updates.each do |update|
      @message = nil
      @raw_message = update

      next handle_update if incoming?

      # NOTE: Shared lock with Whatsapp::SendOnWhatsappService
      # Avoids race conditions when sending messages.
      with_baileys_channel_lock_on_outgoing_message(inbox.channel.id) { handle_update }
    end
  end

  def handle_update
    raise MessageNotFoundError unless find_message_by_source_id(raw_message_id)

    update_status if @raw_message.dig(:update, :status).present?
  end

  def update_status
    status = status_mapper
    update_last_seen_at if incoming? && status == 'read'
    return unless status.present? && status_transition_allowed?(status)

    attrs = { status: status }
    attrs[:external_error] = extract_external_error if status == 'failed'
    @message.update!(attrs)
  end

  def extract_external_error
    stub = Array(@raw_message.dig(:update, :messageStubParameters))
    return if stub.empty?

    code, description = stub
    description.present? ? "#{description} (#{code})" : "WhatsApp error #{code}"
  end

  def status_mapper
    # NOTE: Baileys status codes vs. Chatwoot support:
    #  - (0) ERROR         → (3) failed
    #  - (1) PENDING       → (0) sent
    #  - (2) SERVER_ACK    → (0) sent
    #  - (3) DELIVERY_ACK  → (1) delivered
    #  - (4) READ          → (2) read
    #  - (5) PLAYED        → (unsupported: PLAYED)
    # For details: https://github.com/WhiskeySockets/Baileys/blob/v6.7.16/WAProto/index.d.ts#L36694
    status = @raw_message.dig(:update, :status)
    case status
    when 0
      'failed'
    when 1, 2
      'sent'
    when 3
      'delivered'
    when 4
      'read'
    when 5
      Rails.logger.warn 'Baileys unsupported message update status: PLAYED(5)'
      nil
    else
      Rails.logger.warn "Baileys unsupported message update status: #{status}"
      nil
    end
  end

  def update_last_seen_at
    conversation = @message.conversation
    to_update = { agent_last_seen_at: Time.current }
    to_update[:assignee_last_seen_at] = Time.current if conversation.assignee_id.present?

    conversation.update_columns(to_update) # rubocop:disable Rails/SkipsModelValidations
  end

  def status_transition_allowed?(new_status)
    return false if @message.status == 'read'
    return false if @message.status == 'delivered' && new_status == 'sent'

    true
  end
end
