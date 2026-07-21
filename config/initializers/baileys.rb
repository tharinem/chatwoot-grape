# Ported (Phase 19, feat/baileys-channel-port) verbatim from fazer-ai/chatwoot@main
# (config/initializers/baileys.rb). Enqueues the health-check scheduler on Sidekiq boot only.
Rails.application.config.after_initialize do
  next unless defined?(Sidekiq::CLI)

  Channels::Whatsapp::BaileysConnectionCheckSchedulerJob.perform_later
end
