class MessageTemplates::Template::OutOfOffice
  pattr_initialize [:conversation!]

  PARAGRAPH_SEPARATOR = /\r?\n\s*\r?\n/

  def self.perform_if_applicable(conversation)
    inbox = conversation.inbox
    return unless inbox.out_of_office?
    return if inbox.out_of_office_message.blank?

    new(conversation: conversation).perform
  end

  def perform
    ActiveRecord::Base.transaction do
      conversation.messages.create!(out_of_office_message_params)
    end
  rescue StandardError => e
    ChatwootExceptionTracker.new(e, account: conversation.account).capture_exception
    true
  end

  private

  delegate :contact, :account, to: :conversation
  delegate :inbox, to: :message

  def out_of_office_message_params
    content = @conversation.inbox&.out_of_office_message
    content = content.strip.split(PARAGRAPH_SEPARATOR, 2).first if content.present? && conversation_routed?

    {
      account_id: @conversation.account_id,
      inbox_id: @conversation.inbox_id,
      message_type: :template,
      content: content
    }
  end

  # Conversations already routed (team or assignee) skip the routing menu that
  # usually follows the first paragraph, so they only get the closing notice.
  def conversation_routed?
    @conversation.team_id.present? || @conversation.assignee_id.present?
  end
end
