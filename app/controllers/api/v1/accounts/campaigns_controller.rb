class Api::V1::Accounts::CampaignsController < Api::V1::Accounts::BaseController
  before_action :campaign, except: [:index, :create]
  before_action :check_authorization
  before_action :check_inbox_access, only: [:create, :update]

  def index
    @campaigns = Current.account.campaigns
  end

  def show; end

  def create
    @campaign = Current.account.campaigns.create!(campaign_params)
  end

  def update
    @campaign.update!(campaign_params)
  end

  def destroy
    @campaign.destroy!
    head :ok
  end

  private

  # Non-admin campaign managers (custom role or CAMPAIGN_AGENT_IDS) can only
  # use inboxes they are members of.
  def check_inbox_access
    return if Current.account_user.administrator?

    inbox_ids = [params.dig(:campaign, :inbox_id), @campaign&.inbox_id].compact_blank.map(&:to_i).uniq
    return if inbox_ids.all? { |inbox_id| Current.user.assigned_inboxes.exists?(id: inbox_id) }

    raise Pundit::NotAuthorizedError
  end

  def campaign
    @campaign ||= Current.account.campaigns.find_by(display_id: params[:id])
  end

  def campaign_params
    params.require(:campaign).permit(:title, :description, :message, :enabled, :trigger_only_during_business_hours, :inbox_id, :sender_id,
                                     :scheduled_at, audience: [:type, :id], trigger_rules: {}, template_params: {})
  end
end
