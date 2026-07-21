# Ported (Phase 19, feat/baileys-channel-port) in RECORTE from fazer-ai/chatwoot@main
# (app/jobs/channels/whatsapp/baileys_connection_check_job.rb). The source also refreshes
# the reach-out time-lock and the new-chat message cap (message-cap/reachout-lock — CUT scope,
# see 19-RESEARCH.md). Those calls are removed here; only the health-check / re-arm of the
# session (setup_channel_provider, idempotent on the baileys-api side) is kept.
class Channels::Whatsapp::BaileysConnectionCheckJob < ApplicationJob
  queue_as :low

  def perform(whatsapp_channel)
    whatsapp_channel.setup_channel_provider
  end
end
