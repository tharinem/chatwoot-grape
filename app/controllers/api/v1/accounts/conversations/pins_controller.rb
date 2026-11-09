# "Fixar conversa": personal pins. The base controller already restricts the
# conversation to the ones the current user can see (ConversationPolicy#show?).
class Api::V1::Accounts::Conversations::PinsController < Api::V1::Accounts::Conversations::BaseController
  def create
    pin = ConversationPin.find_or_initialize_by(user: Current.user, conversation: @conversation)
    pin.save! if pin.new_record?
    render json: { id: @conversation.display_id, pinned: true }
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def destroy
    ConversationPin.where(user: Current.user, conversation: @conversation).delete_all
    render json: { id: @conversation.display_id, pinned: false }
  end
end
