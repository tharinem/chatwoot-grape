# Ported (Phase 19, feat/baileys-channel-port) as an INERT STUB — not the full 202-line
# fazer-ai/chatwoot@main parser (app/services/whatsapp/baileys/rich_message_parser.rb).
#
# "Rich" WhatsApp messages (interactive templates/buttons/lists) are OUT of the Phase 19
# recorte (see 19-RESEARCH.md / 19-01-PLAN.md cut scope). `self.rich?` always returns false,
# so `message_type` in Whatsapp::BaileysHandlers::Helpers never classifies an incoming
# message as 'rich' — it falls through to 'unsupported' instead. The remaining methods are
# defined (not deleted) purely so the `message_type == 'rich'` branches elsewhere in the
# ported code (message_context_info, rich_media_header, message_content, add_rich_content_attributes)
# do not raise NameError if ever reached; they are unreachable in the current recorte.
class Whatsapp::Baileys::RichMessageParser
  def self.rich?(_msg)
    false
  end

  def self.to_text(_parsed)
    nil
  end

  def initialize(_msg); end

  def parse
    nil
  end

  def context_info
    nil
  end

  def media_header
    nil
  end
end
