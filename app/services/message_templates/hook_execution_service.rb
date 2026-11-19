class MessageTemplates::HookExecutionService
  pattr_initialize [:message!]

  def perform
    return if conversation.last_incoming_message.blank?
    return if message.auto_reply_email?

    trigger_templates
  end

  private

  delegate :inbox, :conversation, to: :message
  delegate :contact, to: :conversation

  def trigger_templates
    ::MessageTemplates::Template::OutOfOffice.new(conversation: conversation).perform if should_send_out_of_office_message?
    ::MessageTemplates::Template::Greeting.new(conversation: conversation).perform if should_send_greeting?
    # after the greeting, which only goes out while the conversation has no template message
    ::MessageTemplates::Template::AgentAway.new(conversation: conversation).perform if should_send_agent_away_notice?
    ::MessageTemplates::Template::EmailCollect.new(conversation: conversation).perform if inbox.enable_email_collect && should_send_email_collect?
  end

  def should_send_out_of_office_message?
    return false if conversation.campaign.present?
    # should not send if its a tweet message
    return false if conversation.tweet?
    # should not send for outbound messages
    return false unless message.incoming?
    # prevents sending out-of-office message if an agent has sent a message in last 5 minutes
    # ensures better UX by not interrupting active conversations at the end of business hours
    return false if conversation.messages.outgoing.where(private: false).exists?(['created_at > ?', 5.minutes.ago])

    inbox.out_of_office? && !out_of_office_sent_today? && inbox.out_of_office_message.present?
  end

  # Only out-of-office notices count towards the once-a-day limit. A greeting
  # or menu sent earlier in the day must not block the notice after hours.
  def out_of_office_sent_today?
    latest_template_message_of_kind(conversation.messages.today, ::MessageTemplates::Template::OutOfOffice::TEMPLATE_KIND).present?
  end

  def should_send_agent_away_notice?
    return false unless public_incoming_contact_message?
    return false unless ::MessageTemplates::Template::AgentAway.enabled_for?(inbox)
    # after hours the out-of-office notice takes over
    return false if inbox.out_of_office?
    return false unless assignee_away?

    !agent_away_notice_sent_since_last_agent_reply?
  end

  def public_incoming_contact_message?
    return false if conversation.campaign.present? || conversation.tweet?

    message.incoming? && !message.private?
  end

  # Uses the same effective status the dashboard shows: with auto-offline on,
  # an agent without a live session counts as offline.
  def assignee_away?
    return false if conversation.assignee_id.blank?

    account_user = conversation.account.account_users.find_by(user_id: conversation.assignee_id)
    return false if account_user.blank?

    %w[busy offline].include?(account_user.availability_status.to_s)
  end

  # One notice per away period: a new one is allowed only after the agent has
  # sent a public reply since the last notice.
  def agent_away_notice_sent_since_last_agent_reply?
    last_notice = latest_template_message_of_kind(conversation.messages, ::MessageTemplates::Template::AgentAway::TEMPLATE_KIND)
    return false if last_notice.blank?

    last_agent_reply_at = conversation.messages.outgoing.where(private: false, sender_type: 'User').maximum(:created_at)
    last_agent_reply_at.blank? || last_notice.created_at > last_agent_reply_at
  end

  # content_attributes is serialized by the model, so it is not reliably
  # queryable with JSON operators. A conversation has few template messages,
  # so they are filtered here instead.
  def latest_template_message_of_kind(scope, kind)
    scope.template.reorder(created_at: :desc).select(:id, :created_at, :content_attributes)
         .detect { |template| template.content_attributes['template_kind'] == kind }
  end

  def first_message_from_contact?
    conversation.messages.outgoing.count.zero? && conversation.messages.template.count.zero?
  end

  def should_send_greeting?
    return false if conversation.campaign.present?
    # should not send if its a tweet message
    return false if conversation.tweet?

    first_message_from_contact? && inbox.greeting_enabled? && inbox.greeting_message.present?
  end

  def email_collect_was_sent?
    conversation.messages.where(content_type: 'input_email').present?
  end

  # TODO: we should be able to reduce this logic once we have a toggle for email collect messages
  def should_send_email_collect?
    return false if conversation.campaign.present?

    !contact_has_email? && inbox.web_widget? && !email_collect_was_sent?
  end

  def contact_has_email?
    contact.email
  end
end
MessageTemplates::HookExecutionService.prepend_mod_with('MessageTemplates::HookExecutionService')
