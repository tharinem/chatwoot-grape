# == Schema Information
#
# Table name: channel_whatsapp
#
#  id                             :bigint           not null, primary key
#  message_templates              :jsonb
#  message_templates_last_updated :datetime
#  phone_number                   :string           not null
#  provider                       :string           default("default")
#  provider_config                :jsonb
#  provider_connection            :jsonb
#  created_at                     :datetime         not null
#  updated_at                     :datetime         not null
#  account_id                     :integer          not null
#
# Indexes
#
#  index_channel_whatsapp_on_phone_number  (phone_number) UNIQUE
#

class Channel::Whatsapp < ApplicationRecord
  include Channelable
  include Reauthorizable

  self.table_name = 'channel_whatsapp'
  EDITABLE_ATTRS = [:phone_number, :provider, { provider_config: {} }].freeze

  # default at the moment is 360dialog lets change later.
  # NOTE: 'baileys' ported in Phase 19 (feat/baileys-channel-port). zapi/voice/groups NOT ported (cut scope).
  PROVIDERS = %w[default whatsapp_cloud baileys].freeze
  before_validation :ensure_webhook_verify_token

  validates :provider, inclusion: { in: PROVIDERS }
  validates :phone_number, presence: true, uniqueness: true
  validate :validate_provider_config

  after_create :sync_templates
  before_destroy :teardown_webhooks
  before_destroy :disconnect_channel_provider, if: -> { provider_service.respond_to?(:disconnect_channel_provider) }
  after_commit :setup_webhooks, on: :create, if: :should_auto_setup_webhooks?

  def name
    'Whatsapp'
  end

  def provider_service
    case provider
    when 'whatsapp_cloud'
      Whatsapp::Providers::WhatsappCloudService.new(whatsapp_channel: self)
    when 'baileys'
      Whatsapp::Providers::WhatsappBaileysService.new(whatsapp_channel: self)
    else
      Whatsapp::Providers::Whatsapp360DialogService.new(whatsapp_channel: self)
    end
  end

  def mark_message_templates_updated
    # rubocop:disable Rails/SkipsModelValidations
    update_column(:message_templates_last_updated, Time.zone.now)
    # rubocop:enable Rails/SkipsModelValidations
  end

  # NOTE: Ported (Phase 19) from fazer-ai/chatwoot 4.15 Channel::Whatsapp#update_provider_connection!.
  # Persists QR/connection status pushed by the Baileys provider (connection.update webhook).
  def update_provider_connection!(provider_connection)
    provider_connection ||= {} # deep_stringify_keys below requires a hash
    # Normalize to string keys to match the persisted jsonb (which always reads back as
    # strings) so an unchanged status is recognized as a no-op and skipped.
    normalized = provider_connection.deep_stringify_keys
    return if normalized == self.provider_connection

    assign_attributes(provider_connection: normalized)
    # NOTE: Skip `validate_provider_config?` check.
    # `Inbox.no_touching` suppresses the `has_one :inbox, touch: true` callback
    # (inherited from Channelable) so this high-frequency connection-status change does
    # NOT touch the inbox and invalidate the whole account inbox cache. The change is
    # pushed to clients via a targeted `inbox.provider_connection_updated` event.
    Inbox.no_touching { save!(validate: false) }
    broadcast_provider_connection_updated
  end

  # NOTE: Ported (Phase 19). Shape read by the Baileys settings screen (QR/connection status).
  def provider_connection_data
    data = { connection: provider_connection['connection'] }
    if Current.account_user&.administrator?
      data[:qr_data_url] = provider_connection['qr_data_url']
      data[:error] = provider_connection['error']
    end
    data
  end

  # NOTE: Ported (Phase 19). Used by the Baileys incoming handler to mark inbound messages as read.
  def read_messages(messages, conversation:)
    return unless provider_service.respond_to?(:read_messages)
    # NOTE: This is the default behavior, so `mark_as_read` being `nil` is the same as `true`.
    return if provider_config&.dig('mark_as_read') == false

    recipient_id = conversation.contact.identifier || conversation.contact.phone_number
    provider_service.read_messages(messages, recipient_id: recipient_id)
  end

  # NOTE: Ported (Phase 19). Pushes delivery ack to WhatsApp right after an inbound message is saved.
  def received_messages(messages, conversation)
    return unless provider_service.respond_to?(:received_messages)

    recipient_id = conversation.contact.identifier || conversation.contact.phone_number
    provider_service.received_messages(recipient_id, messages)
  end

  def disconnect_channel_provider
    provider_service.disconnect_channel_provider
  rescue StandardError => e
    # NOTE: Don't prevent destruction if disconnect fails
    Rails.logger.error "Failed to disconnect channel provider: #{e.message}"
  end

  delegate :setup_channel_provider, to: :provider_service
  delegate :send_message, to: :provider_service
  delegate :send_template, to: :provider_service
  delegate :sync_templates, to: :provider_service
  delegate :media_url, to: :provider_service
  delegate :api_headers, to: :provider_service

  def setup_webhooks
    perform_webhook_setup
  rescue StandardError => e
    Rails.logger.error "[WHATSAPP] Webhook setup failed: #{e.message}"
    prompt_reauthorization!
  end

  private

  # NOTE: Ported (Phase 19). Pushes the connection status to the account's agents over the
  # websocket without going through the full dispatcher (wasteful for such a high-frequency event).
  def broadcast_provider_connection_updated
    return if inbox.blank?

    Rails.configuration.dispatcher.sync_dispatcher.dispatch(
      Events::Types::INBOX_PROVIDER_CONNECTION_UPDATED, Time.zone.now,
      inbox: inbox, provider_connection: provider_connection
    )
  end

  def ensure_webhook_verify_token
    provider_config['webhook_verify_token'] ||= SecureRandom.hex(16) if provider.in?(%w[whatsapp_cloud baileys])
  end

  def validate_provider_config
    errors.add(:provider_config, 'Invalid Credentials') unless provider_service.validate_provider_config?
  end

  def perform_webhook_setup
    business_account_id = provider_config['business_account_id']
    api_key = provider_config['api_key']

    Whatsapp::WebhookSetupService.new(self, business_account_id, api_key).perform
  end

  def teardown_webhooks
    Whatsapp::WebhookTeardownService.new(self).perform
  end

  def should_auto_setup_webhooks?
    # Only auto-setup webhooks for whatsapp_cloud provider with manual setup
    # Embedded signup calls setup_webhooks explicitly in EmbeddedSignupService
    provider == 'whatsapp_cloud' && provider_config['source'] != 'embedded_signup'
  end
end
