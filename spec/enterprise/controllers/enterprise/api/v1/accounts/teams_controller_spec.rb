require 'rails_helper'

RSpec.describe 'Teams API queue_counts enterprise', type: :request do
  let(:account) { create(:account) }
  let(:inbox) { create(:inbox, account: account) }
  let(:team) { create(:team, account: account) }
  let(:agent_with_custom_role) { create(:user, account: account, role: :agent) }
  let(:custom_role) { create(:custom_role, account: account) }

  before do
    create(:inbox_member, user: agent_with_custom_role, inbox: inbox)
    create_list(:conversation, 2, account: account, inbox: inbox, team: team, assignee: nil, status: :open)
    AccountUser.find_by(user: agent_with_custom_role, account: account)
               .update!(role: :agent, custom_role: custom_role)
  end

  it 'counts the queue for agents with conversation_unassigned_manage' do
    custom_role.update!(permissions: %w[conversation_unassigned_manage])

    get "/api/v1/accounts/#{account.id}/teams/queue_counts",
        headers: agent_with_custom_role.create_new_auth_token,
        as: :json

    expect(response).to have_http_status(:success)
    expect(response.parsed_body).to eq(team.id.to_s => 2)
  end

  it 'returns an empty queue for agents restricted to participating conversations' do
    custom_role.update!(permissions: %w[conversation_participating_manage])

    get "/api/v1/accounts/#{account.id}/teams/queue_counts",
        headers: agent_with_custom_role.create_new_auth_token,
        as: :json

    expect(response).to have_http_status(:success)
    expect(response.parsed_body).to eq({})
  end
end
