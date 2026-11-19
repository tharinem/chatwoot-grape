require 'rails_helper'

describe MessageTemplates::Template::AgentAway do
  let(:conversation) { create(:conversation) }

  describe '#perform' do
    it 'creates a marked template message with the default text' do
      described_class.new(conversation: conversation).perform

      message = conversation.messages.last
      expect(message.message_type).to eq('template')
      expect(message.sender).to be_nil
      expect(message.content).to eq(described_class::DEFAULT_MESSAGE)
      expect(message.content_attributes['template_kind']).to eq('agent_away')
    end

    it 'uses AGENT_AWAY_NOTICE_MESSAGE when it is set' do
      with_modified_env(AGENT_AWAY_NOTICE_MESSAGE: 'Back in a moment') do
        described_class.new(conversation: conversation).perform
      end

      expect(conversation.messages.last.content).to eq('Back in a moment')
    end
  end

  describe '.enabled_for?' do
    it 'is true only for inboxes listed in AGENT_AWAY_NOTICE_INBOX_IDS' do
      other_inbox = create(:inbox)

      with_modified_env(AGENT_AWAY_NOTICE_INBOX_IDS: " #{conversation.inbox_id} ,42") do
        expect(described_class.enabled_for?(conversation.inbox)).to be(true)
        expect(described_class.enabled_for?(other_inbox)).to be(false)
      end
    end

    it 'is false when the variable is not set' do
      with_modified_env(AGENT_AWAY_NOTICE_INBOX_IDS: nil) do
        expect(described_class.enabled_for?(conversation.inbox)).to be(false)
      end
    end
  end
end
