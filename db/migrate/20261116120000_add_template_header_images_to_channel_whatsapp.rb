class AddTemplateHeaderImagesToChannelWhatsapp < ActiveRecord::Migration[7.1]
  def change
    # { "<template name>:<language>" => { "url" => public url, "blob_id" => id } }
    add_column :channel_whatsapp, :template_header_images, :jsonb, default: {}, null: false
  end
end
