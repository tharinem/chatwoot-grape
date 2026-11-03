class Api::V1::Accounts::TeamMembersController < Api::V1::Accounts::BaseController
  before_action :fetch_team
  before_action :check_authorization
  before_action :validate_member_id_params, only: [:create, :update, :destroy]

  def index
    @team_members = @team.team_members.map(&:user)
  end

  # The member methods run their own transaction and bump the account cache
  # key only after the commit, so they must not be wrapped in another transaction.
  def create
    @team_members = @team.add_members(members_to_be_added_ids)
  end

  def update
    @team.update_members(members_to_be_added_ids, members_to_be_removed_ids)
    @team_members = @team.members
    render action: 'create'
  end

  def destroy
    @team.remove_members(params[:user_ids])
    head :ok
  end

  private

  def members_to_be_added_ids
    params[:user_ids] - current_members_ids
  end

  def members_to_be_removed_ids
    current_members_ids - params[:user_ids]
  end

  def current_members_ids
    @current_members_ids ||= @team.members.pluck(:id)
  end

  def fetch_team
    @team = Current.account.teams.find(params[:team_id])
  end

  def validate_member_id_params
    invalid_ids = params[:user_ids].map(&:to_i) - @team.account.user_ids

    render json: { error: 'Invalid User IDs' }, status: :unauthorized and return if invalid_ids.present?
  end
end
