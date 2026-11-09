class Api::V1::Accounts::AgentsController < Api::V1::Accounts::BaseController
  before_action :fetch_agent, except: [:create, :index, :bulk_create, :conversation_counts]
  before_action :check_authorization
  before_action :validate_limit, only: [:create]
  before_action :validate_limit_for_bulk_create, only: [:bulk_create]

  WAITING_FOR_REPLY_SQL = <<~SQL.squish.freeze
    (SELECT last_message.message_type FROM messages last_message
     WHERE last_message.conversation_id = conversations.id
       AND last_message.private = FALSE
       AND last_message.message_type <> #{Message.message_types[:activity]}
     ORDER BY last_message.created_at DESC, last_message.id DESC LIMIT 1) = #{Message.message_types[:incoming]}
  SQL

  def index
    @agents = agents
  end

  # Painel da gerência: for each agent who is a member of at least one inbox,
  # how many open conversations are assigned to them and how many of those are
  # waiting for a reply (last public, non-activity message came from the contact).
  # Returns { agent_id => { open:, waiting: } } in a single grouped query.
  def conversation_counts
    conversations = Conversations::PermissionFilterService.new(
      Current.account.conversations, Current.user, Current.account
    ).perform

    counts = conversations.open.where(assignee_id: inbox_member_ids).group(:assignee_id)
                          .pluck(:assignee_id, Arel.sql('COUNT(*)'), Arel.sql("COUNT(*) FILTER (WHERE #{WAITING_FOR_REPLY_SQL})"))
                          .to_h { |agent_id, open, waiting| [agent_id, { open: open, waiting: waiting }] }

    render json: inbox_member_ids.index_with { |id| counts[id] || { open: 0, waiting: 0 } }.transform_keys(&:to_s)
  end

  def create
    builder = AgentBuilder.new(
      email: new_agent_params['email'],
      name: new_agent_params['name'],
      role: new_agent_params['role'],
      availability: new_agent_params['availability'],
      auto_offline: new_agent_params['auto_offline'],
      inviter: current_user,
      account: Current.account
    )

    @agent = builder.perform
  end

  def update
    @agent.update!(agent_params.slice(:name).compact)
    @agent.current_account_user.update!(agent_params.slice(*account_user_attributes).compact)
  end

  def destroy
    @agent.current_account_user.destroy!
    delete_user_record(@agent)
    head :ok
  end

  def bulk_create
    emails = params[:emails]

    emails.each do |email|
      builder = AgentBuilder.new(
        email: email,
        name: email.split('@').first,
        inviter: current_user,
        account: Current.account
      )
      begin
        builder.perform
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.info "[Agent#bulk_create] ignoring email #{email}, errors: #{e.record.errors}"
      end
    end

    # This endpoint is used to bulk create agents during onboarding
    # onboarding_step key in present in Current account custom attributes, since this is a one time operation
    Current.account.custom_attributes.delete('onboarding_step')
    Current.account.save!
    head :ok
  end

  private

  def inbox_member_ids
    @inbox_member_ids ||= InboxMember.joins(:inbox)
                                     .where(inboxes: { account_id: Current.account.id })
                                     .where(user_id: Current.account.account_users.select(:user_id))
                                     .distinct.pluck(:user_id)
  end

  def check_authorization
    super(User)
  end

  def fetch_agent
    @agent = agents.find(params[:id])
  end

  def account_user_attributes
    [:role, :availability, :auto_offline]
  end

  def allowed_agent_params
    [:name, :email, :role, :availability, :auto_offline]
  end

  def agent_params
    params.require(:agent).permit(allowed_agent_params)
  end

  def new_agent_params
    params.require(:agent).permit(:email, :name, :role, :availability, :auto_offline)
  end

  def agents
    @agents ||= Current.account.users.order_by_full_name.includes(:account_users, { avatar_attachment: [:blob] })
  end

  def validate_limit_for_bulk_create
    limit_available = params[:emails].count <= available_agent_count

    render_payment_required('Account limit exceeded. Please purchase more licenses') unless limit_available
  end

  def validate_limit
    render_payment_required('Account limit exceeded. Please purchase more licenses') unless can_add_agent?
  end

  def available_agent_count
    Current.account.usage_limits[:agents] - agents.count
  end

  def can_add_agent?
    available_agent_count.positive?
  end

  def delete_user_record(agent)
    DeleteObjectJob.perform_later(agent) if agent.reload.account_users.blank?
  end
end

Api::V1::Accounts::AgentsController.prepend_mod_with('Api::V1::Accounts::AgentsController')
