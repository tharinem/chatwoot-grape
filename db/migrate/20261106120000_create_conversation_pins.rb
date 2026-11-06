class CreateConversationPins < ActiveRecord::Migration[7.1]
  def change
    create_table :conversation_pins do |t|
      t.references :user, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :conversation, null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, index: false
      t.timestamps
    end

    add_index :conversation_pins, [:user_id, :conversation_id], unique: true
    add_index :conversation_pins, [:account_id, :user_id]
  end
end
