# Notice sent during business hours when the agent assigned to the
# conversation is busy or offline, so the contact knows the conversation is
# still with the team. Opt-in per inbox:
#   AGENT_AWAY_NOTICE_INBOX_IDS="17,42"
# The text can be changed without a deploy through AGENT_AWAY_NOTICE_MESSAGE.
class MessageTemplates::Template::AgentAway
  pattr_initialize [:conversation!]

  TEMPLATE_KIND = 'agent_away'.freeze
  DEFAULT_MESSAGE = 'Oi! Seu atendimento continua com a nossa equipe. ' \
                    'A pessoa que está te atendendo saiu para um intervalo rápido e já te responde.'.freeze

  def self.enabled_for?(inbox)
    inbox_ids = ENV.fetch('AGENT_AWAY_NOTICE_INBOX_IDS', '').split(',').map(&:strip).compact_blank
    inbox_ids.include?(inbox.id.to_s)
  end

  def self.message_content
    ENV.fetch('AGENT_AWAY_NOTICE_MESSAGE', '').presence || DEFAULT_MESSAGE
  end

  def perform
    ActiveRecord::Base.transaction do
      conversation.messages.create!(
        account_id: conversation.account_id,
        inbox_id: conversation.inbox_id,
        message_type: :template,
        content: self.class.message_content,
        content_attributes: { template_kind: TEMPLATE_KIND }
      )
    end
  rescue StandardError => e
    ChatwootExceptionTracker.new(e, account: conversation.account).capture_exception
    true
  end
end
