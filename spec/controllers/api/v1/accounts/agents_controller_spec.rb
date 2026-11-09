require 'rails_helper'

RSpec.describe 'Agents API', type: :request do
  include ActiveJob::TestHelper

  let(:account) { create(:account) }
  let!(:admin) { create(:user, custom_attributes: { test: 'test' }, account: account, role: :administrator) }
  let!(:agent) { create(:user, account: account, email: 'exists@example.com', role: :agent) }

  describe 'GET /api/v1/accounts/{account.id}/agents' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        get "/api/v1/accounts/#{account.id}/agents"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let!(:agent) { create(:user, account: account, role: :agent) }

      it 'returns all agents of account' do
        get "/api/v1/accounts/#{account.id}/agents",
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(response.parsed_body.size).to eq(account.users.count)
      end

      it 'returns custom fields on agents if present' do
        agent.update(custom_attributes: { test: 'test' })

        get "/api/v1/accounts/#{account.id}/agents",
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        data = response.parsed_body
        expect(data.first['custom_attributes']['test']).to eq('test')
      end
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/agents/conversation_counts' do
    let(:url) { "/api/v1/accounts/#{account.id}/agents/conversation_counts" }
    let(:inbox) { create(:inbox, account: account) }
    let(:other_inbox) { create(:inbox, account: account) }
    let!(:agent_without_inbox) { create(:user, account: account, role: :agent) }
    let(:waiting) { create(:conversation, account: account, inbox: inbox, assignee: agent, status: :open) }
    let(:replied) { create(:conversation, account: account, inbox: other_inbox, assignee: agent, status: :open) }
    let(:noted) { create(:conversation, account: account, inbox: inbox, assignee: agent, status: :open) }

    before do
      create(:inbox_member, user: agent, inbox: inbox)
      create(:inbox_member, user: admin, inbox: other_inbox)
      create(:message, conversation: waiting, account: account, inbox: inbox, message_type: :outgoing, created_at: 2.minutes.ago)
      create(:message, conversation: waiting, account: account, inbox: inbox, message_type: :incoming, created_at: 1.minute.ago)
      create(:message, conversation: waiting, account: account, inbox: inbox, message_type: :activity, created_at: 30.seconds.ago)
      create(:message, conversation: replied, account: account, inbox: other_inbox, message_type: :incoming, created_at: 2.minutes.ago)
      create(:message, conversation: replied, account: account, inbox: other_inbox, message_type: :outgoing, created_at: 1.minute.ago)
      # a private note after the customer message does not count as a reply
      create(:message, conversation: noted, account: account, inbox: inbox, message_type: :incoming, created_at: 2.minutes.ago)
      create(:message, conversation: noted, account: account, inbox: inbox, message_type: :outgoing, private: true, created_at: 1.minute.ago)
      # not open: ignored
      create(:conversation, account: account, inbox: inbox, assignee: agent, status: :resolved)
      create(:conversation, account: account, inbox: inbox, assignee: agent_without_inbox, status: :open)
    end

    it 'returns unauthorized for unauthenticated users' do
      get url

      expect(response).to have_http_status(:unauthorized)
    end

    it 'is not available to agents' do
      get url, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns open and waiting counts for every agent who belongs to an inbox' do
      get url, headers: admin.create_new_auth_token, as: :json

      expect(response).to have_http_status(:success)
      expect(response.parsed_body).to eq(
        agent.id.to_s => { 'open' => 3, 'waiting' => 2 },
        admin.id.to_s => { 'open' => 0, 'waiting' => 0 }
      )
    end

    it 'does not count conversations from other accounts' do
      other_account = create(:account)
      create(:account_user, account: other_account, user: agent)
      create(:conversation, account: other_account, assignee: agent, status: :open)

      get url, headers: admin.create_new_auth_token, as: :json

      expect(response.parsed_body[agent.id.to_s]).to eq('open' => 3, 'waiting' => 2)
    end
  end

  describe 'DELETE /api/v1/accounts/{account.id}/agents/:id' do
    let(:other_agent) { create(:user, account: account, role: :agent) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        delete "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      it 'returns unauthorized for agents' do
        delete "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}",
               headers: agent.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'deletes the agent and user object if associated with only one account' do
        expect(account.users).to include(other_agent)

        perform_enqueued_jobs(only: DeleteObjectJob) do
          delete "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}",
                 headers: admin.create_new_auth_token,
                 as: :json
        end

        expect(response).to have_http_status(:success)
        expect(account.reload.users).not_to include(other_agent)
      end

      it 'deletes only the agent object when user is associated with multiple accounts' do
        other_account = create(:account)
        create(:account_user, account_id: other_account.id, user_id: other_agent.id)

        perform_enqueued_jobs(only: DeleteObjectJob) do
          delete "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}",
                 headers: admin.create_new_auth_token,
                 as: :json
        end

        expect(response).to have_http_status(:success)
        expect(account.reload.users).not_to include(other_agent)
        expect(other_agent.account_users.count).to eq(1) # Should only be associated with other_account now
      end
    end
  end

  describe 'PUT /api/v1/accounts/{account.id}/agents/:id' do
    let(:other_agent) { create(:user, account: account, role: :agent) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        put "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      params = { name: 'TestUser' }

      it 'returns unauthorized for agents' do
        put "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}",
            params: params,
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'modifies an agent name' do
        put "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}",
            params: params,
            headers: admin.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(other_agent.reload.name).to eq(params[:name])
      end

      it 'modifies an agents account user attributes' do
        put "/api/v1/accounts/#{account.id}/agents/#{other_agent.id}",
            params: { role: 'administrator', availability: 'busy', auto_offline: false },
            headers: admin.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        response_data = response.parsed_body
        expect(response_data['role']).to eq('administrator')
        expect(response_data['availability_status']).to eq('busy')
        expect(response_data['auto_offline']).to be(false)
        expect(other_agent.account_users.first.role).to eq('administrator')
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/agents' do
    let(:other_agent) { create(:user, account: account, role: :agent) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        post "/api/v1/accounts/#{account.id}/agents"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      params = { name: 'NewUser', email: Faker::Internet.email, role: :agent }

      it 'returns unauthorized for agents' do
        post "/api/v1/accounts/#{account.id}/agents",
             params: params,
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'creates a new agent' do
        post "/api/v1/accounts/#{account.id}/agents",
             params: params,
             headers: admin.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(response.parsed_body['email']).to eq(params[:email])
        expect(account.users.last.name).to eq('NewUser')
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/agents/bulk_create' do
    let(:emails) { ['test1@example.com', 'test2@example.com', 'test3@example.com'] }
    let(:bulk_create_params) { { emails: emails } }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        post "/api/v1/accounts/#{account.id}/agents/bulk_create", params: bulk_create_params

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when authenticated as admin' do
      it 'creates multiple agents successfully' do
        expect do
          post "/api/v1/accounts/#{account.id}/agents/bulk_create", params: bulk_create_params, headers: admin.create_new_auth_token
        end.to change(User, :count).by(3)

        expect(response).to have_http_status(:ok)
      end

      it 'ignores errors if account_user already exists' do
        params = { emails: ['exists@example.com', 'test1@example.com', 'test2@example.com'] }

        expect do
          post "/api/v1/accounts/#{account.id}/agents/bulk_create", params: params,
                                                                    headers: admin.create_new_auth_token
        end.to change(User, :count).by(2)

        expect(response).to have_http_status(:ok)
      end
    end
  end
end
