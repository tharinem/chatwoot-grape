require 'rails_helper'

RSpec.describe 'Teams API', type: :request do
  let(:account) { create(:account) }
  let!(:team) { create(:team, account: account) }

  describe 'GET /api/v1/accounts/{account.id}/teams' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        get "/api/v1/accounts/#{account.id}/teams"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }

      it 'returns all the teams' do
        get "/api/v1/accounts/#{account.id}/teams",
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(response.parsed_body.first['id']).to eq(account.teams.first.id)
      end
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/teams/queue_counts' do
    let(:inbox) { create(:inbox, account: account) }
    let(:other_inbox) { create(:inbox, account: account) }
    let(:other_team) { create(:team, account: account) }
    let(:agent) { create(:user, account: account, role: :agent) }
    let(:admin) { create(:user, account: account, role: :administrator) }

    before do
      create(:inbox_member, user: agent, inbox: inbox)
      create(:team_member, user: agent, team: team)
      # fila do time: abertas + sem responsável
      create_list(:conversation, 2, account: account, inbox: inbox, team: team, assignee: nil, status: :open)
      create(:conversation, account: account, inbox: other_inbox, team: team, assignee: nil, status: :open)
      create(:conversation, account: account, inbox: inbox, team: other_team, assignee: nil, status: :open)
      # fora da fila
      create(:conversation, account: account, inbox: inbox, team: team, assignee: agent, status: :open)
      create(:conversation, account: account, inbox: inbox, team: team, assignee: nil, status: :resolved)
      create(:conversation, account: account, inbox: inbox, team: team, assignee: nil, status: :pending)
      create(:conversation, account: account, inbox: inbox, team: nil, assignee: nil, status: :open)
    end

    it 'returns unauthorized for unauthenticated users' do
      get "/api/v1/accounts/#{account.id}/teams/queue_counts"

      expect(response).to have_http_status(:unauthorized)
    end

    it 'counts open unassigned conversations per team across all inboxes for administrators' do
      get "/api/v1/accounts/#{account.id}/teams/queue_counts",
          headers: admin.create_new_auth_token,
          as: :json

      expect(response).to have_http_status(:success)
      expect(response.parsed_body).to eq(team.id.to_s => 3, other_team.id.to_s => 1)
    end

    it 'counts only conversations from inboxes the agent belongs to' do
      get "/api/v1/accounts/#{account.id}/teams/queue_counts",
          headers: agent.create_new_auth_token,
          as: :json

      expect(response).to have_http_status(:success)
      expect(response.parsed_body).to eq(team.id.to_s => 2, other_team.id.to_s => 1)
    end

    it 'does not count conversations from other accounts' do
      other_account = create(:account)
      foreign_team = create(:team, account: other_account)
      create(:conversation, account: other_account, team: foreign_team, assignee: nil, status: :open)

      get "/api/v1/accounts/#{account.id}/teams/queue_counts",
          headers: admin.create_new_auth_token,
          as: :json

      expect(response.parsed_body.keys).not_to include(foreign_team.id.to_s)
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/teams/{team_id}' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        get "/api/v1/accounts/#{account.id}/teams/#{team.id}"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }

      it 'returns all the teams' do
        get "/api/v1/accounts/#{account.id}/teams/#{team.id}",
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(response.parsed_body['id']).to eq(team.id)
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/teams' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        post "/api/v1/accounts/#{account.id}/teams"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }

      it 'returns unathorized for agent' do
        params = { name: 'Test Team' }

        post "/api/v1/accounts/#{account.id}/teams",
             params: params,
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'creates a new team when its administrator' do
        params = { name: 'test-team' }

        post "/api/v1/accounts/#{account.id}/teams",
             params: params,
             headers: administrator.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(Team.count).to eq(2)
      end
    end
  end

  describe 'PUT /api/v1/accounts/{account.id}/teams/:id' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        put "/api/v1/accounts/#{account.id}/teams/#{team.id}"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }

      it 'returns unauthorized for agent' do
        params = { name: 'new-team' }

        put "/api/v1/accounts/#{account.id}/teams/#{team.id}",
            params: params,
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'updates an existing team when its an administrator' do
        params = { name: 'new-team' }

        put "/api/v1/accounts/#{account.id}/teams/#{team.id}",
            params: params,
            headers: administrator.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(team.reload.name).to eq('new-team')
      end
    end
  end

  describe 'DELETE /api/v1/accounts/{account.id}/teams/:id' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        delete "/api/v1/accounts/#{account.id}/teams/#{team.id}"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user' do
      let(:agent) { create(:user, account: account, role: :agent) }
      let(:administrator) { create(:user, account: account, role: :administrator) }

      it 'return unauthorized for agent' do
        delete "/api/v1/accounts/#{account.id}/teams/#{team.id}",
               headers: agent.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it 'destroys the team when its administrator' do
        delete "/api/v1/accounts/#{account.id}/teams/#{team.id}",
               headers: administrator.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:success)
        expect(Team.count).to eq(0)
      end
    end
  end
end
