require 'rails_helper'

RSpec.describe Api::V1::Accounts::InboxMessageTemplatesController, type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:whatsapp_channel) do
    create(:channel_whatsapp, account: account, provider: 'whatsapp_cloud', sync_templates: false, validate_provider_config: false)
  end
  let(:whatsapp_inbox) { create(:inbox, channel: whatsapp_channel, account: account) }
  let(:web_widget_inbox) { create(:inbox, account: account) }
  let(:templates_url) { 'https://graph.facebook.com/v14.0/123456789/message_templates' }
  let(:template_params) do
    { template: { name: 'boas_vindas', category: 'MARKETING', language: 'pt_BR', body: 'Oi! Temos novidades para você.' } }
  end

  def create_path(inbox)
    "/api/v1/accounts/#{account.id}/inboxes/#{inbox.id}/message_templates"
  end

  before do
    create(:inbox_member, user: agent, inbox: whatsapp_inbox)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('WHATSAPP_CLOUD_BASE_URL', anything).and_return('https://graph.facebook.com')
  end

  describe 'POST /api/v1/accounts/{account.id}/inboxes/{inbox.id}/message_templates' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        post create_path(whatsapp_inbox), params: template_params, as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an agent assigned to the inbox' do
      it 'returns unauthorized and does not call Meta' do
        post create_path(whatsapp_inbox), params: template_params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(a_request(:post, //)).not_to have_been_made
      end
    end

    context 'when it is not a WhatsApp channel' do
      it 'returns bad request' do
        post create_path(web_widget_inbox), params: template_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_request)
      end
    end

    context 'when it is a WhatsApp channel from another provider' do
      it 'returns bad request' do
        dialog_channel = create(:channel_whatsapp, account: account, provider: 'default', sync_templates: false, validate_provider_config: false)

        post create_path(dialog_channel.inbox), params: template_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_request)
        expect(a_request(:post, //)).not_to have_been_made
      end
    end

    context 'when it is a WhatsApp Cloud channel' do
      it 'creates the template and enqueues a template sync' do
        stub_request(:post, templates_url).to_return(
          status: 200, body: { id: '987654321', status: 'PENDING', category: 'MARKETING' }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

        expect do
          post create_path(whatsapp_inbox), params: template_params, headers: admin.create_new_auth_token, as: :json
        end.to have_enqueued_job(Channels::Whatsapp::TemplatesSyncJob).with(whatsapp_channel)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body['template']).to include(
          'id' => '987654321', 'status' => 'PENDING', 'category' => 'MARKETING', 'name' => 'boas_vindas', 'language' => 'pt_BR'
        )
      end

      it 'returns the Meta error and does not enqueue a sync' do
        stub_request(:post, templates_url).to_return(
          status: 400,
          body: { error: { message: 'Invalid parameter', code: 100, error_subcode: 2_388_023, error_user_msg: 'Nome já existe.' } }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

        expect do
          post create_path(whatsapp_inbox), params: template_params, headers: admin.create_new_auth_token, as: :json
        end.not_to have_enqueued_job(Channels::Whatsapp::TemplatesSyncJob)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['error']).to eq('Nome já existe.')
        expect(response.parsed_body['details']).to include('code' => 100, 'error_subcode' => 2_388_023)
      end

      it 'returns validation errors without calling Meta' do
        invalid_params = { template: template_params[:template].merge(name: 'Nome Inválido') }

        expect do
          post create_path(whatsapp_inbox), params: invalid_params, headers: admin.create_new_auth_token, as: :json
        end.not_to have_enqueued_job(Channels::Whatsapp::TemplatesSyncJob)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['errors']).to include({ 'field' => 'name', 'code' => 'invalid_format' })
        expect(a_request(:post, //)).not_to have_been_made
      end

      it 'returns unprocessable entity when template params are missing' do
        post create_path(whatsapp_inbox), params: {}, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end
end
