# == Schema Information
#
# Table name: teams
#
#  id                :bigint           not null, primary key
#  allow_auto_assign :boolean          default(TRUE)
#  description       :text
#  name              :string           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#
# Indexes
#
#  index_teams_on_account_id           (account_id)
#  index_teams_on_name_and_account_id  (name,account_id) UNIQUE
#
class Team < ApplicationRecord
  include AccountCacheRevalidator

  belongs_to :account
  has_many :team_members, dependent: :destroy_async
  has_many :members, through: :team_members, source: :user
  has_many :conversations, dependent: :nullify

  validates :name,
            presence: { message: I18n.t('errors.validations.presence') },
            uniqueness: { scope: :account_id }

  before_validation do
    self.name = name.downcase if attribute_present?('name')
  end

  # Adds multiple members to the team
  # @param user_ids [Array<Integer>] Array of user IDs to add as members
  # @return [Array<User>] Array of newly added members
  def add_members(user_ids)
    revalidating_account_cache { create_members(user_ids) }
  end

  # Removes multiple members from the team
  # @param user_ids [Array<Integer>] Array of user IDs to remove
  # @return [void]
  def remove_members(user_ids)
    revalidating_account_cache { destroy_members(user_ids) }
  end

  # Adds and removes members in a single transaction, bumping the account
  # cache key once after the commit
  # @param user_ids_to_add [Array<Integer>] Array of user IDs to add as members
  # @param user_ids_to_remove [Array<Integer>] Array of user IDs to remove
  # @return [void]
  def update_members(user_ids_to_add, user_ids_to_remove)
    revalidating_account_cache do
      create_members(user_ids_to_add)
      destroy_members(user_ids_to_remove)
    end
  end

  def messages
    account.messages.where(conversation_id: conversations.pluck(:id))
  end

  def reporting_events
    account.reporting_events.where(conversation_id: conversations.pluck(:id))
  end

  def push_event_data
    {
      id: id,
      name: name
    }
  end

  private

  def create_members(user_ids)
    team_members.create(user_ids.map { |user_id| { user_id: user_id } }).filter_map(&:user)
  end

  def destroy_members(user_ids)
    team_members.where(user_id: user_ids).destroy_all
  end
end

Team.include_mod_with('Audit::Team')
