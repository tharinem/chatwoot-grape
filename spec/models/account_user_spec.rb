# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AccountUser do
  include ActiveJob::TestHelper

  let!(:account_user) { create(:account_user) }
  let!(:inbox) { create(:inbox, account: account_user.account) }

  describe 'notification_settings' do
    it 'gets created with the right default settings' do
      expect(account_user.user.notification_settings).not_to be_nil

      expect(account_user.user.notification_settings.first.email_conversation_creation?).to be(false)
      expect(account_user.user.notification_settings.first.email_conversation_assignment?).to be(true)
    end
  end

  describe 'permissions' do
    it 'returns the right permissions' do
      expect(account_user.permissions).to eq(['agent'])
    end

    it 'returns the right permissions for administrator' do
      account_user.administrator!
      expect(account_user.permissions).to eq(['administrator'])
    end

    it 'adds campaign_manage for agents listed in CAMPAIGN_AGENT_IDS' do
      with_modified_env('CAMPAIGN_AGENT_IDS' => "1, #{account_user.user_id}") do
        expect(account_user.permissions).to eq(%w[agent campaign_manage])
        expect(account_user.campaign_manager?).to be(true)
      end
    end

    it 'does not grant campaigns to agents outside CAMPAIGN_AGENT_IDS' do
      with_modified_env('CAMPAIGN_AGENT_IDS' => '') do
        expect(account_user.permissions).to eq(['agent'])
        expect(account_user.campaign_manager?).to be(false)
      end
    end

    it 'keeps administrators as plain administrators even when listed' do
      account_user.administrator!
      with_modified_env('CAMPAIGN_AGENT_IDS' => account_user.user_id.to_s) do
        expect(account_user.permissions).to eq(['administrator'])
        expect(account_user.campaign_manager?).to be(true)
      end
    end
  end

  describe 'destroy call agent::destroy service' do
    it 'gets created with the right default settings' do
      create(:conversation, account: account_user.account, assignee: account_user.user, inbox: inbox)
      user = account_user.user

      expect(user.assigned_conversations.count).to eq(1)

      perform_enqueued_jobs do
        account_user.destroy!
      end

      expect(user.assigned_conversations.count).to eq(0)
    end
  end
end
