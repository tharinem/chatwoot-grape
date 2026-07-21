# Ported (Phase 19, feat/baileys-channel-port) IN RECORTE from fazer-ai/chatwoot@main
# (app/services/whatsapp/baileys_handlers/messages_upsert.rb). REMOVED: GroupContactMessageHandler,
# GroupEventHelper, GroupStubMessageHandler concerns (grupos — cut scope), and handle_revoke
# (protocolMessage/REVOKE — "deleção" cut per 19-01-PLAN.md Task 3; a revoke webhook now falls
# through to ignore_message? via message_type == 'protocol' and is silently ignored instead of
# flagging the original message deleted_by_contact).
module Whatsapp::BaileysHandlers::MessagesUpsert
  include Whatsapp::BaileysHandlers::Helpers
  include Whatsapp::BaileysHandlers::Concerns::IndividualContactMessageHandler
  include BaileysHelper

  private

  def process_messages_upsert
    messages = processed_params[:data][:messages]
    messages.each do |message|
      @message = nil
      @contact_inbox = nil
      @contact = nil
      @raw_message = message

      next handle_message if incoming?

      # NOTE: Shared lock with Whatsapp::SendOnWhatsappService
      # Avoids race conditions when sending messages.
      with_baileys_channel_lock_on_outgoing_message(inbox.channel.id) { handle_message }
    end
  end

  def handle_message
    @lock_acquired = false

    return if message_stub? # Recorte: message stubs (membership/icon/group-create) are group-only, cut.
    return if ignore_message? # protocol (incl. revoke)/context/edited/reaction — cut/unsupported here.
    return if find_message_by_source_id(raw_message_id)

    route_contact_message
  end

  def route_contact_message
    return handle_individual_contact_message if %w[lid user].include?(jid_type)
    # NOTE: group branch (jid_type == 'group') removed — groups are cut scope.
  end

  def message_stub?
    @raw_message[:messageStubType].present?
  end
end
