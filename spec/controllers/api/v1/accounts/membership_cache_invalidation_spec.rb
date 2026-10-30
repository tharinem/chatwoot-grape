require 'rails_helper'

# Membership changes must bump the account cache key and broadcast
# account.cache_invalidated exactly once per request, so the dashboard refetches
# teams (is_member) and inboxes for the affected agents.
RSpec.describe 'Membership cache invalidation', type: :request do
  let(:account) { create(:account) }
  let(:administrator) { create(:user, account: account, role: :administrator) }
  let(:old_agent) { create(:user, account: account, role: :agent) }
  let(:new_agent) { create(:user, account: account, role: :agent) }

  def cache_invalidated_dispatches
    have_received(:dispatch).with(Events::Types::ACCOUNT_CACHE_INVALIDATED, anything, hash_including(account: account))
  end

  shared_examples 'invalidates the account cache once' do |cache_key|
    it "bumps the #{cache_key} cache key and broadcasts the invalidation once" do
      key_before = account.cache_keys[cache_key]
      allow(Rails.configuration.dispatcher).to receive(:dispatch)

      perform_request

      expect(response).to have_http_status(:success)
      expect(account.cache_keys[cache_key]).not_to eq(key_before)
      expect(Rails.configuration.dispatcher).to cache_invalidated_dispatches.once
    end
  end

  describe 'team members' do
    let(:team) { create(:team, account: account) }
    let(:url) { "/api/v1/accounts/#{account.id}/teams/#{team.id}/team_members" }

    before { create(:team_member, team: team, user: old_agent) }

    context 'when adding members' do
      let(:perform_request) do
        post url, params: { user_ids: [new_agent.id] }, headers: administrator.create_new_auth_token, as: :json
      end

      it_behaves_like 'invalidates the account cache once', :team
    end

    context 'when replacing the member list' do
      let(:perform_request) do
        patch url, params: { user_ids: [new_agent.id] }, headers: administrator.create_new_auth_token, as: :json
      end

      it_behaves_like 'invalidates the account cache once', :team

      it 'applies the additions and removals' do
        perform_request
        expect(team.reload.members).to contain_exactly(new_agent)
      end
    end

    context 'when removing members' do
      let(:perform_request) do
        delete url, params: { user_ids: [old_agent.id] }, headers: administrator.create_new_auth_token, as: :json
      end

      it_behaves_like 'invalidates the account cache once', :team
    end
  end

  describe 'inbox members' do
    let(:inbox) { create(:inbox, account: account) }
    let(:url) { "/api/v1/accounts/#{account.id}/inbox_members" }

    before { create(:inbox_member, inbox: inbox, user: old_agent) }

    context 'when adding members' do
      let(:perform_request) do
        post url, params: { inbox_id: inbox.id, user_ids: [old_agent.id, new_agent.id] },
                  headers: administrator.create_new_auth_token, as: :json
      end

      it_behaves_like 'invalidates the account cache once', :inbox
    end

    context 'when replacing the member list' do
      let(:perform_request) do
        patch url, params: { inbox_id: inbox.id, user_ids: [new_agent.id] },
                   headers: administrator.create_new_auth_token, as: :json
      end

      it_behaves_like 'invalidates the account cache once', :inbox

      it 'applies the additions and removals' do
        perform_request
        expect(inbox.reload.members).to contain_exactly(new_agent)
      end
    end

    context 'when removing members' do
      let(:perform_request) do
        delete url, params: { inbox_id: inbox.id, user_ids: [old_agent.id] },
                    headers: administrator.create_new_auth_token, as: :json
      end

      it_behaves_like 'invalidates the account cache once', :inbox
    end
  end
end
