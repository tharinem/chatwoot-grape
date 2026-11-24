class MessageTemplates::Template::Greeting
  pattr_initialize [:conversation!]

  # Inboxes that also get the greeting again when a contact reopens a resolved
  # conversation that has no team, so the routing menu in the greeting reaches
  # returning contacts (single-conversation inboxes reuse the old conversation).
  # Opt-in per inbox: RESEND_GREETING_ON_REOPEN_INBOX_IDS="17,42"
  def self.resend_on_reopen_enabled_for?(inbox)
    inbox_ids = ENV.fetch('RESEND_GREETING_ON_REOPEN_INBOX_IDS', '').split(',').map(&:strip).compact_blank
    inbox_ids.include?(inbox.id.to_s)
  end

  def perform
    ActiveRecord::Base.transaction do
      conversation.messages.create!(greeting_message_params)
    end
  rescue StandardError => e
    ChatwootExceptionTracker.new(e, account: conversation.account).capture_exception
    true
  end

  private

  delegate :contact, :account, to: :conversation
  delegate :inbox, to: :message

  def greeting_message_params
    content = @conversation.inbox&.greeting_message

    {
      account_id: @conversation.account_id,
      inbox_id: @conversation.inbox_id,
      message_type: :template,
      content: content
    }
  end
end
