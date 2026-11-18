class CreateCampaignDeliveries < ActiveRecord::Migration[7.1]
  def change
    create_table :campaign_deliveries do |t|
      t.references :account, null: false, index: false
      t.references :campaign, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :contact, null: true, index: false
      t.string :source_id
      t.integer :status, null: false, default: 0
      t.text :external_error
      t.timestamps
    end

    add_index :campaign_deliveries, :source_id, unique: true
    add_index :campaign_deliveries, [:campaign_id, :status]
  end
end
