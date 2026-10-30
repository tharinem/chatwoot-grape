require 'rails_helper'

RSpec.describe Team do
  describe 'associations' do
    it { is_expected.to belong_to(:account) }
    it { is_expected.to have_many(:conversations) }
    it { is_expected.to have_many(:team_members) }
  end

  describe '#add_members' do
    let(:team) { FactoryBot.create(:team) }

    before do
      allow(Rails.configuration.dispatcher).to receive(:dispatch)
    end

    it 'handles adds all members and resets cache keys' do
      users = FactoryBot.create_list(:user, 3)
      team.add_members(users.map(&:id))
      expect(team.reload.team_members.size).to eq(3)

      expect(Rails.configuration.dispatcher).to have_received(:dispatch).at_least(:once)
                                                                        .with(
                                                                          'account.cache_invalidated',
                                                                          kind_of(Time),
                                                                          account: team.account,
                                                                          cache_keys: team.account.cache_keys
                                                                        )
    end
  end

  describe '#remove_members' do
    let(:team) { FactoryBot.create(:team) }
    let(:users) { FactoryBot.create_list(:user, 3) }

    before do
      team.add_members(users.map(&:id))
      allow(Rails.configuration.dispatcher).to receive(:dispatch)
    end

    it 'removes the members and resets cache keys' do
      expect(team.reload.team_members.size).to eq(3)

      team.remove_members(users.map(&:id))
      expect(team.reload.team_members.size).to eq(0)

      expect(Rails.configuration.dispatcher).to have_received(:dispatch).at_least(:once)
                                                                        .with(
                                                                          'account.cache_invalidated',
                                                                          kind_of(Time),
                                                                          account: team.account,
                                                                          cache_keys: team.account.cache_keys
                                                                        )
    end
  end

  describe '#update_members' do
    let(:team) { FactoryBot.create(:team) }
    let(:old_users) { FactoryBot.create_list(:user, 2) }
    let(:new_users) { FactoryBot.create_list(:user, 2) }

    before do
      team.add_members(old_users.map(&:id))
      allow(Rails.configuration.dispatcher).to receive(:dispatch)
    end

    it 'adds and removes members and invalidates the account cache once' do
      team.update_members(new_users.map(&:id), [old_users.first.id])

      expect(team.reload.members).to match_array([old_users.last] + new_users)
      expect(Rails.configuration.dispatcher).to have_received(:dispatch)
        .with('account.cache_invalidated', kind_of(Time), account: team.account, cache_keys: team.account.cache_keys)
        .once
    end

    it 'bumps the cache key only after the membership transaction is committed' do
      baseline = ActiveRecord::Base.connection.open_transactions
      open_transactions_at_bump = nil
      allow(team.account).to receive(:update_cache_key) do
        open_transactions_at_bump = ActiveRecord::Base.connection.open_transactions
      end

      team.update_members(new_users.map(&:id), [old_users.first.id])

      expect(team.account).to have_received(:update_cache_key).with('team').once
      expect(open_transactions_at_bump).to eq(baseline)
    end
  end
end
