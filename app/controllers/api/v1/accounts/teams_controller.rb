class Api::V1::Accounts::TeamsController < Api::V1::Accounts::BaseController
  before_action :fetch_team, only: [:show, :update, :destroy]
  before_action :check_authorization

  def index
    @teams = Current.account.teams
  end

  def show; end

  # Fila de cada time: conversas abertas, sem responsável, respeitando as
  # mesmas permissões de caixa de entrada da listagem de conversas.
  # Retorna { team_id => count } apenas para times com fila > 0.
  def queue_counts
    conversations = Conversations::PermissionFilterService.new(
      Current.account.conversations,
      Current.user,
      Current.account
    ).perform

    counts = conversations.open.unassigned.where.not(team_id: nil).group(:team_id).count
    render json: counts.transform_keys(&:to_s)
  end

  def create
    @team = Current.account.teams.new(team_params)
    @team.save!
  end

  def update
    @team.update!(team_params)
  end

  def destroy
    @team.destroy!
    head :ok
  end

  private

  def fetch_team
    @team = Current.account.teams.find(params[:id])
  end

  def team_params
    params.require(:team).permit(:name, :description, :allow_auto_assign)
  end
end
