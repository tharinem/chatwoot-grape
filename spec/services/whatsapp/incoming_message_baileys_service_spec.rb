require 'rails_helper'

# Regression coverage for the bug found in debug session `baileys-reconnect-stuck`
# (.planning/debug/baileys-reconnect-stuck.md in the reengenharia-digital planning repo,
# resolved 2026-07-22): a `connection.update` webhook that carries `data[:error]` but no
# `data[:connection]` (any baileys-api terminal error — wrong_phone_number,
# reconnect_loop_detected, etc.) was silently treated as "still reconnecting" forever,
# because `provider_connection_payload` fell back to the last known `connection` value
# whenever the payload itself didn't set one.
describe Whatsapp::IncomingMessageBaileysService do
  describe '#perform - connection.update' do
    let!(:whatsapp_channel) { create(:channel_whatsapp, provider: 'baileys', sync_templates: false, validate_provider_config: false) }
    let(:webhook_verify_token) { whatsapp_channel.provider_config['webhook_verify_token'] }

    def connection_update_params(data)
      {
        event: 'connection.update',
        webhookVerifyToken: webhook_verify_token,
        data: data
      }.with_indifferent_access
    end

    context 'when a terminal provider error arrives without a `connection` value' do
      before do
        # Simulates the real sequence observed: `isNewLogin` set the channel to
        # 'reconnecting' right after the QR scan, epoch 8.
        whatsapp_channel.update_provider_connection!(connection: 'reconnecting', epoch: 8)
      end

      it 'treats it as an explicit terminal state (close) instead of preserving the stale connection value' do
        # Exact payload shape captured from the baileys-api wrong_phone_number webhook
        # (fazer-ai/baileys-api handleWrongPhoneNumber): no `connection` key at all.
        params = connection_update_params(error: 'wrong_phone_number', epoch: 9)

        described_class.new(inbox: whatsapp_channel.inbox, params: params).perform

        whatsapp_channel.reload
        expect(whatsapp_channel.provider_connection['connection']).to eq('close')
        expect(whatsapp_channel.provider_connection['error']).to eq('Wrong phone number')
        expect(whatsapp_channel.provider_connection['epoch']).to eq(9)
      end

      it 'applies the same terminal treatment for any other error code, not just wrong_phone_number' do
        params = connection_update_params(error: 'reconnect_loop_detected', epoch: 9)

        described_class.new(inbox: whatsapp_channel.inbox, params: params).perform

        whatsapp_channel.reload
        expect(whatsapp_channel.provider_connection['connection']).to eq('close')
      end
    end

    context 'when the payload has neither `connection` nor `error` (e.g. a standalone reachoutTimeLock push)' do
      before do
        whatsapp_channel.update_provider_connection!(connection: 'open', epoch: 8)
      end

      it 'preserves the existing connection value (non-regression: no false terminal state)' do
        params = connection_update_params(reachoutTimeLock: { isActive: true, timeEnforcementEnds: '2026-01-01T00:00:00Z', enforcementType: 'per_day' }, epoch: 9)

        described_class.new(inbox: whatsapp_channel.inbox, params: params).perform

        whatsapp_channel.reload
        expect(whatsapp_channel.provider_connection['connection']).to eq('open')
      end
    end

    context 'when the payload explicitly sets a `connection` value (non-regression: normal flow untouched)' do
      before do
        whatsapp_channel.update_provider_connection!(connection: 'connecting', epoch: 8)
      end

      it 'reflects the explicit connection value from the payload' do
        params = connection_update_params(connection: 'open', epoch: 9)

        described_class.new(inbox: whatsapp_channel.inbox, params: params).perform

        whatsapp_channel.reload
        expect(whatsapp_channel.provider_connection['connection']).to eq('open')
        expect(whatsapp_channel.provider_connection['error']).to be_nil
      end
    end
  end
end
