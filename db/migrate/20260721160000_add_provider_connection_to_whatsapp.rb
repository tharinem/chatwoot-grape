# frozen_string_literal: true

# Ported (Phase 19, feat/baileys-channel-port) from fazer-ai/chatwoot 4.15
# (db/migrate/20250314185939_add_provider_connection_to_whatsapp.rb). Renumbered to a
# current timestamp so it sorts after our fork's latest migration instead of being
# inserted into 2025-03 migration history. Purely additive: adds one jsonb column with
# a default, no existing column touched. Reversible (down = remove_column, implicit).
class AddProviderConnectionToWhatsapp < ActiveRecord::Migration[7.0]
  def change
    add_column :channel_whatsapp, :provider_connection, :jsonb, default: {}
  end
end
