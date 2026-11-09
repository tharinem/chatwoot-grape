require 'rails_helper'

RSpec.describe 'Campaigns API', type: :request do
  let(:account) { create(:account) }

  describe 'GET /api/v1/accounts/{account.id}/campaigns' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        get "/api/v1/accounts/#{account.id}/campaigns"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }
      let(:inbox) { create(:inbox, account: account) }
      let!(:campaign) { create(:campaign, account: account, inbox: inbox, trigger_rules: { url: 'https://test.com' }) }

      it 'returns unauthorized for agents' do
        get "/api/v1/accounts/#{account.id}/campaigns",
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'returns all campaigns to administrators' do
        get "/api/v1/accounts/#{account.id}/campaigns",
            headers: administrator.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        body = JSON.parse(response.body, symbolize_names: true)
        expect(body.first[:id]).to eq(campaign.display_id)
      end
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/campaigns/:id' do
    let(:campaign) { create(:campaign, account: account, trigger_rules: { url: 'https://test.com' }) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        get "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }

      it 'returns unauthorized for agents' do
        get "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'shows the campaign for administrators' do
        get "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
            headers: administrator.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body, symbolize_names: true)[:id]).to eq(campaign.display_id)
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/campaigns' do
    let(:inbox) { create(:inbox, account: account) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        post "/api/v1/accounts/#{account.id}/campaigns",
             params: { inbox_id: inbox.id, title: 'test', message: 'test message' },
             as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }

      it 'returns unauthorized for agents' do
        post "/api/v1/accounts/#{account.id}/campaigns",
             params: { inbox_id: inbox.id, title: 'test', message: 'test message' },
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'creates a new campaign' do
        post "/api/v1/accounts/#{account.id}/campaigns",
             params: { inbox_id: inbox.id, title: 'test', message: 'test message' },
             headers: administrator.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body, symbolize_names: true)[:title]).to eq('test')
      end

      it 'creates a new ongoing campaign' do
        post "/api/v1/accounts/#{account.id}/campaigns",
             params: { inbox_id: inbox.id, title: 'test', message: 'test message', trigger_rules: { url: 'https://test.com' } },
             headers: administrator.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body, symbolize_names: true)[:title]).to eq('test')
      end

      it 'throws error when invalid url provided for ongoing campaign' do
        post "/api/v1/accounts/#{account.id}/campaigns",
             params: { inbox_id: inbox.id, title: 'test', message: 'test message', trigger_rules: { url: 'javascript' } },
             headers: administrator.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'creates a new oneoff campaign' do
        twilio_sms = create(:channel_twilio_sms, account: account)
        twilio_inbox = create(:inbox, channel: twilio_sms, account: account)
        label1 = create(:label, account: account)
        label2 = create(:label, account: account)
        scheduled_at = 2.days.from_now

        post "/api/v1/accounts/#{account.id}/campaigns",
             params: {
               inbox_id: twilio_inbox.id, title: 'test', message: 'test message',
               scheduled_at: scheduled_at,
               audience: [{ type: 'Label', id: label1.id }, { type: 'Label', id: label2.id }]
             },
             headers: administrator.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        response_data = JSON.parse(response.body, symbolize_names: true)
        expect(response_data[:campaign_type]).to eq('one_off')
        expect(response_data[:scheduled_at].present?).to be true
        expect(response_data[:scheduled_at]).to eq(scheduled_at.to_i)
        expect(response_data[:audience].pluck(:id)).to include(label1.id, label2.id)
      end

      it 'refuses a oneoff campaign scheduled in the past' do
        twilio_sms = create(:channel_twilio_sms, account: account)
        twilio_inbox = create(:inbox, channel: twilio_sms, account: account)

        expect do
          post "/api/v1/accounts/#{account.id}/campaigns",
               params: { inbox_id: twilio_inbox.id, title: 'test', message: 'test message', scheduled_at: 1.day.ago },
               headers: administrator.create_new_auth_token,
               as: :json
        end.not_to change(Campaign, :count)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['message']).to include('Scheduled at must be in the future')
      end
    end
  end

  describe 'PATCH /api/v1/accounts/{account.id}/campaigns/:id' do
    let(:inbox) { create(:inbox, account: account) }
    let!(:campaign) { create(:campaign, account: account, trigger_rules: { url: 'https://test.com' }) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        patch "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
              params: { inbox_id: inbox.id, title: 'test', message: 'test message' },
              as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }

      it 'returns unauthorized for agents' do
        patch "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
              params: { inbox_id: inbox.id, title: 'test', message: 'test message' },
              headers: agent.create_new_auth_token,
              as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'updates the campaign' do
        patch "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
              params: { inbox_id: inbox.id, title: 'test', message: 'test message' },
              headers: administrator.create_new_auth_token,
              as: :json

        expect(response).to have_http_status(:success)
        expect(JSON.parse(response.body, symbolize_names: true)[:title]).to eq('test')
      end

      context 'with a scheduled whatsapp campaign' do
        let(:whatsapp_inbox) do
          create(:channel_whatsapp, account: account, provider: 'whatsapp_cloud', validate_provider_config: false, sync_templates: false).inbox
        end
        let(:label) { create(:label, account: account) }
        let(:new_scheduled_at) { 3.days.from_now.change(usec: 0) }
        let(:edit_params) do
          {
            title: 'Promo editada',
            message: 'Oi Ana, cupom CAFE20',
            scheduled_at: new_scheduled_at,
            audience: [{ type: 'Label', id: label.id }],
            template_params: {
              name: 'ticket_status_updated', namespace: 'ns', category: 'UTILITY', language: 'en',
              processed_params: { body: { '1' => 'Ana', '2' => 'CAFE20' } }
            }
          }
        end

        it 'updates title, template params, audience and scheduled time while not sent' do
          whatsapp_campaign = create(:campaign, account: account, inbox: whatsapp_inbox, scheduled_at: 1.day.from_now)

          patch "/api/v1/accounts/#{account.id}/campaigns/#{whatsapp_campaign.display_id}",
                params: edit_params,
                headers: administrator.create_new_auth_token,
                as: :json

          expect(response).to have_http_status(:success)
          whatsapp_campaign.reload
          expect(whatsapp_campaign.title).to eq('Promo editada')
          expect(whatsapp_campaign.scheduled_at.to_i).to eq(new_scheduled_at.to_i)
          expect(whatsapp_campaign.audience).to eq([{ 'type' => 'Label', 'id' => label.id }])
          expect(whatsapp_campaign.template_params['processed_params']).to eq('body' => { '1' => 'Ana', '2' => 'CAFE20' })
        end

        it 'refuses to edit a campaign that was already sent' do
          sent_campaign = travel_to(2.days.ago) { create(:campaign, account: account, inbox: whatsapp_inbox, scheduled_at: 1.day.from_now) }
          sent_campaign.completed!

          patch "/api/v1/accounts/#{account.id}/campaigns/#{sent_campaign.display_id}",
                params: edit_params,
                headers: administrator.create_new_auth_token,
                as: :json

          expect(response).to have_http_status(:unprocessable_entity)
          expect(response.parsed_body['message']).to include('already completed')
          expect(sent_campaign.reload.title).not_to eq('Promo editada')
        end

        it 'refuses to move the scheduled time to the past' do
          whatsapp_campaign = create(:campaign, account: account, inbox: whatsapp_inbox, scheduled_at: 1.day.from_now)

          patch "/api/v1/accounts/#{account.id}/campaigns/#{whatsapp_campaign.display_id}",
                params: edit_params.merge(scheduled_at: 1.day.ago),
                headers: administrator.create_new_auth_token,
                as: :json

          expect(response).to have_http_status(:unprocessable_entity)
          expect(response.parsed_body['message']).to include('Scheduled at must be in the future')
          whatsapp_campaign.reload
          expect(whatsapp_campaign.title).not_to eq('Promo editada')
          expect(whatsapp_campaign.scheduled_at).to be > Time.current
          expect(whatsapp_campaign).to be_active
        end
      end
    end
  end

  describe 'DELETE /api/v1/accounts/{account.id}/campaigns/:id' do
    let(:inbox) { create(:inbox, account: account) }
    let!(:campaign) { create(:campaign, account: account, trigger_rules: { url: 'https://test.com' }) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        delete "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
               as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }

      it 'return unauthorized if agent' do
        delete "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
               headers: agent.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'delete campaign if admin' do
        delete "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}",
               headers: administrator.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:success)
        expect(Campaign.exists?(campaign.display_id)).to be false
      end
    end
  end

  describe 'campaign agents (CAMPAIGN_AGENT_IDS)' do
    let(:campaign_agent) { create(:user, account: account, role: :agent) }
    let(:other_agent) { create(:user, account: account, role: :agent) }
    let(:whatsapp_inbox) do
      create(:channel_whatsapp, account: account, provider: 'whatsapp_cloud', validate_provider_config: false, sync_templates: false).inbox
    end
    let(:label) { create(:label, account: account) }
    let(:campaign_params) do
      {
        title: 'Promo da semana',
        message: 'Oi, cupom CAFE20',
        inbox_id: whatsapp_inbox.id,
        scheduled_at: 1.day.from_now,
        audience: [{ type: 'Label', id: label.id }],
        template_params: { name: 'promo', namespace: 'ns', category: 'MARKETING', language: 'pt_BR', processed_params: {} }
      }
    end

    around do |example|
      with_modified_env('CAMPAIGN_AGENT_IDS' => " 999999 , #{campaign_agent.id}") { example.run }
    end

    before { create(:inbox_member, user: campaign_agent, inbox: whatsapp_inbox) }

    it 'lets the listed agent create, list and show campaigns' do
      headers = campaign_agent.create_new_auth_token

      post "/api/v1/accounts/#{account.id}/campaigns", params: campaign_params, headers: headers, as: :json
      expect(response).to have_http_status(:success)
      display_id = response.parsed_body['id']

      get "/api/v1/accounts/#{account.id}/campaigns", headers: headers, as: :json
      expect(response).to have_http_status(:success)
      expect(response.parsed_body.pluck('id')).to include(display_id)

      get "/api/v1/accounts/#{account.id}/campaigns/#{display_id}", headers: headers, as: :json
      expect(response).to have_http_status(:success)
    end

    it 'lets the listed agent update and delete campaigns' do
      headers = campaign_agent.create_new_auth_token
      campaign = create(:campaign, account: account, inbox: whatsapp_inbox, scheduled_at: 1.day.from_now)

      patch "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}", params: { title: 'Promo editada' }, headers: headers, as: :json
      expect(response).to have_http_status(:success)
      expect(campaign.reload.title).to eq('Promo editada')

      delete "/api/v1/accounts/#{account.id}/campaigns/#{campaign.display_id}", headers: headers, as: :json
      expect(response).to have_http_status(:success)
      expect(Campaign.exists?(campaign.id)).to be(false)
    end

    it 'refuses a campaign on an inbox the agent is not a member of' do
      other_inbox = create(:channel_whatsapp, account: account, provider: 'whatsapp_cloud', validate_provider_config: false,
                                              sync_templates: false).inbox

      expect do
        post "/api/v1/accounts/#{account.id}/campaigns",
             params: campaign_params.merge(inbox_id: other_inbox.id), headers: campaign_agent.create_new_auth_token, as: :json
      end.not_to change(Campaign, :count)
      expect(response).to have_http_status(:unauthorized)
    end

    it 'still refuses agents that are not listed' do
      get "/api/v1/accounts/#{account.id}/campaigns", headers: other_agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)

      post "/api/v1/accounts/#{account.id}/campaigns", params: campaign_params, headers: other_agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it 'keeps settings APIs blocked for the listed agent' do
      get "/api/v1/accounts/#{account.id}/automation_rules", headers: campaign_agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)

      post "/api/v1/accounts/#{account.id}/labels", params: { title: 'nova' }, headers: campaign_agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it 'exposes the campaign_manage permission on the profile' do
      get '/api/v1/profile', headers: campaign_agent.create_new_auth_token, as: :json

      account_payload = response.parsed_body['accounts'].find { |a| a['id'] == account.id }
      expect(account_payload['role']).to eq('agent')
      expect(account_payload['permissions']).to eq(%w[agent campaign_manage])
    end
  end
end
