class CampaignPolicy < ApplicationPolicy
  def index?
    campaign_manager?
  end

  def update?
    campaign_manager?
  end

  def show?
    campaign_manager?
  end

  def create?
    campaign_manager?
  end

  def destroy?
    campaign_manager?
  end

  private

  def campaign_manager?
    @account_user&.campaign_manager? || false
  end
end
