require 'rails_helper'

# End-to-end checks for the automatic notices: messages are created for real
# (no template doubles) so the daily limit and the away period are exercised
# against what is stored in the conversation.
describe MessageTemplates::HookExecutionService do
  # Wednesday; the default working hours are Mon-Fri 09:00-17:00 in the inbox timezone (UTC)
  let(:business_hours) { Time.zone.parse('2026-11-18 10:00') }
  let(:after_hours) { Time.zone.parse('2026-11-18 20:00') }
  let(:out_of_office_notice) { 'Our hours are Mon-Fri 9h-18h. We will reply when we are back.' }
  let(:out_of_office_menu) { "To reach the right team, type an option:\n1) Store A\n2) Store B" }
  let(:account) { create(:account) }
  let(:inbox) do
    create(:inbox, account: account, working_hours_enabled: true,
                   greeting_enabled: true, greeting_message: 'Hi! How can we help?',
                   out_of_office_message: "#{out_of_office_notice}\n\n#{out_of_office_menu}")
  end
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:conversation) { create(:conversation, account: account, inbox: inbox) }

  def incoming_message(**attrs)
    create(:message, conversation: conversation, account: account, inbox: inbox, message_type: :incoming, **attrs)
  end

  def agent_reply
    create(:message, conversation: conversation, account: account, inbox: inbox, message_type: :outgoing, sender: agent, content: 'Agent reply')
  end

  def notices_of_kind(kind)
    conversation.messages.template.reload.select { |message| message.content_attributes['template_kind'] == kind }
  end

  def out_of_office_notices
    notices_of_kind('out_of_office')
  end

  def away_notices
    notices_of_kind('agent_away')
  end

  def set_availability(availability, auto_offline: false)
    account.account_users.find_by(user_id: agent.id).update!(availability: availability, auto_offline: auto_offline)
  end

  describe 'out-of-office notice' do
    it 'is sent after hours even when the greeting was sent earlier the same day' do
      travel_to(business_hours) { incoming_message }
      expect(conversation.messages.template.where(content: 'Hi! How can we help?')).to exist

      travel_to(after_hours) { incoming_message }

      expect(out_of_office_notices.size).to eq(1)
    end

    it 'sends only the first paragraph to a routed conversation that got the greeting in the morning' do
      travel_to(business_hours) do
        incoming_message
        conversation.update!(assignee: agent)
      end

      travel_to(after_hours) { incoming_message }

      expect(out_of_office_notices.map(&:content)).to eq([out_of_office_notice])
    end

    it 'is sent at most once a day' do
      travel_to(after_hours) do
        incoming_message
        incoming_message
      end
      expect(out_of_office_notices.size).to eq(1)

      travel_to(after_hours + 1.day) { incoming_message }
      expect(out_of_office_notices.size).to eq(2)
    end

    it 'is not sent when an agent replied in the last 5 minutes' do
      travel_to(after_hours) do
        conversation.update!(assignee: agent)
        incoming_message
      end
      expect(out_of_office_notices.size).to eq(1)

      travel_to(after_hours + 1.day) do
        agent_reply
        travel 2.minutes
        incoming_message
      end
      expect(out_of_office_notices.size).to eq(1)
    end

    it 'marks the notice so it can be told apart from other templates' do
      travel_to(after_hours) { incoming_message }

      expect(conversation.messages.template.last.content_attributes['template_kind']).to eq('out_of_office')
    end
  end

  describe 'agent away notice' do
    around do |example|
      with_modified_env(AGENT_AWAY_NOTICE_INBOX_IDS: "999999, #{inbox.id}") { example.run }
    end

    before do
      travel_to(business_hours - 1.hour) { conversation.update!(assignee: agent) }
    end

    %w[busy offline].each do |availability|
      it "is sent during business hours when the assignee is #{availability}" do
        set_availability(availability)

        travel_to(business_hours) { incoming_message }

        expect(away_notices.size).to eq(1)
        notice = away_notices.first
        expect(notice.content).to eq(MessageTemplates::Template::AgentAway::DEFAULT_MESSAGE)
        expect(notice.sender).to be_nil
        expect(notice.message_type).to eq('template')
      end
    end

    it 'still sends the greeting first on the first message of an assigned conversation' do
      set_availability(:busy)

      travel_to(business_hours) { incoming_message }

      expect(conversation.messages.template.reload.map(&:content)).to eq(
        ['Hi! How can we help?', MessageTemplates::Template::AgentAway::DEFAULT_MESSAGE]
      )
    end

    it 'treats an online agent without a live session as offline when auto offline is on' do
      set_availability(:online, auto_offline: true)

      travel_to(business_hours) { incoming_message }

      expect(away_notices.size).to eq(1)
    end

    it 'is not sent when the assignee is online with a live session' do
      set_availability(:online, auto_offline: true)

      travel_to(business_hours) do
        OnlineStatusTracker.update_presence(account.id, 'User', agent.id)
        incoming_message
      end

      expect(away_notices).to be_empty
    end

    it 'is not sent when the assignee is online and auto offline is off' do
      set_availability(:online)

      travel_to(business_hours) { incoming_message }

      expect(away_notices).to be_empty
    end

    it 'is not sent when the conversation is unassigned' do
      set_availability(:offline)
      conversation.update!(assignee: nil)

      travel_to(business_hours) { incoming_message }

      expect(away_notices).to be_empty
    end

    it 'is not sent when the inbox is not listed' do
      set_availability(:offline)

      with_modified_env(AGENT_AWAY_NOTICE_INBOX_IDS: '999999') do
        travel_to(business_hours) { incoming_message }
      end

      expect(away_notices).to be_empty
    end

    it 'is not sent after hours, where the out-of-office notice applies' do
      set_availability(:offline)

      travel_to(after_hours) { incoming_message }

      expect(away_notices).to be_empty
      expect(out_of_office_notices.size).to eq(1)
    end

    it 'is sent when working hours are disabled' do
      set_availability(:busy)
      inbox.update!(working_hours_enabled: false)

      travel_to(after_hours) { incoming_message }

      expect(away_notices.size).to eq(1)
    end

    it 'is not sent for outgoing, private or activity messages' do
      set_availability(:offline)

      travel_to(business_hours) do
        incoming_message
        conversation.messages.template.destroy_all
        create(:message, conversation: conversation, account: account, inbox: inbox, message_type: :outgoing, content: 'bot reply')
        create(:message, conversation: conversation, account: account, inbox: inbox, message_type: :incoming, private: true)
        create(:message, conversation: conversation, account: account, inbox: inbox, message_type: :activity, content: 'Status changed')
      end

      expect(away_notices).to be_empty
    end

    it 'is not sent on campaign conversations' do
      set_availability(:offline)
      conversation.update!(campaign: create(:campaign, account: account, inbox: inbox))

      travel_to(business_hours) { incoming_message }

      expect(away_notices).to be_empty
    end

    it 'uses the text from AGENT_AWAY_NOTICE_MESSAGE when set' do
      set_availability(:busy)

      with_modified_env(AGENT_AWAY_NOTICE_MESSAGE: 'Back soon!') do
        travel_to(business_hours) { incoming_message }
      end

      expect(away_notices.map(&:content)).to eq(['Back soon!'])
    end

    it 'is sent once per away period and again after the agent replies and leaves again' do
      set_availability(:busy)

      travel_to(business_hours) do
        incoming_message
        travel 1.minute
        incoming_message
      end
      expect(away_notices.size).to eq(1)

      travel_to(business_hours + 10.minutes) do
        set_availability(:online)
        agent_reply
        travel 1.minute
        incoming_message
      end
      expect(away_notices.size).to eq(1)

      travel_to(business_hours + 30.minutes) do
        set_availability(:offline)
        incoming_message
        travel 1.minute
        incoming_message
      end
      expect(away_notices.size).to eq(2)
    end
  end
end
