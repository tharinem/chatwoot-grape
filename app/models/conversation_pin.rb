# == Schema Information
#
# Table name: conversation_pins
#
#  id              :bigint           not null, primary key
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  account_id      :bigint           not null
#  conversation_id :bigint           not null
#  user_id         :bigint           not null
#
# Indexes
#
#  index_conversation_pins_on_account_id_and_user_id       (account_id,user_id)
#  index_conversation_pins_on_conversation_id              (conversation_id)
#  index_conversation_pins_on_user_id_and_conversation_id  (user_id,conversation_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (conversation_id => conversations.id) ON DELETE => cascade
#  fk_rails_...  (user_id => users.id) ON DELETE => cascade
#

# A conversation pinned by one user ("Fixar conversa"). Pins are personal:
# they only change the order of that user's conversation lists.
class ConversationPin < ApplicationRecord
  MAX_PER_USER = 20

  belongs_to :user
  belongs_to :conversation
  belongs_to :account

  before_validation :set_account

  validates :conversation_id, uniqueness: { scope: :user_id }
  validate :pin_limit, on: :create

  scope :for_user, ->(user, account) { where(user_id: user.id, account_id: account.id) }

  def self.pinned_conversation_ids(user, account)
    return [] if user.blank? || account.blank?

    for_user(user, account).pluck(:conversation_id)
  end

  private

  def set_account
    self.account_id ||= conversation&.account_id
  end

  def pin_limit
    return if user.blank? || account_id.blank?
    return if self.class.where(user_id: user_id, account_id: account_id).count < MAX_PER_USER

    errors.add(:base, I18n.t('errors.conversation_pins.limit_reached', limit: MAX_PER_USER))
  end
end
