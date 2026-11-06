require 'rails_helper'

describe MessageTemplates::Template::OutOfOffice do
  context 'when this hook is called' do
    let(:conversation) { create(:conversation) }

    it 'creates the out of office messages' do
      described_class.new(conversation: conversation).perform
      expect(conversation.messages.template.count).to eq(1)
      expect(conversation.messages.template.first.content).to eq(conversation.inbox.out_of_office_message)
    end

    it 'creates the out of office messages with template variable' do
      conversation.inbox.update!(out_of_office_message: 'Hey, {{contact.name}} we are unavailable at the moment.')
      described_class.new(conversation: conversation).perform
      expect(conversation.messages.count).to eq(1)
      expect(conversation.messages.last.content).to eq("Hey, #{conversation.contact.name} we are unavailable at the moment.")
    end

    it 'creates the out of office messages with more than one variable strings' do
      conversation.inbox.update!(out_of_office_message:
        'Hey, {{contact.name}} we are unavailable at the moment. - from {{account.name}}')
      described_class.new(conversation: conversation).perform
      expect(conversation.messages.count).to eq(1)
      expect(conversation.messages.last.content).to eq(
        "Hey, #{conversation.contact.name} we are unavailable at the moment. - from #{conversation.account.name}"
      )
    end

    context 'when the out of office message has more than one paragraph' do
      let(:notice) { 'Our hours are Mon-Fri 9h-18h. We will reply when we are back.' }
      let(:menu) { "To reach the right team, type an option:\n1) Store A\n2) Store B" }

      before { conversation.inbox.update!(out_of_office_message: "#{notice}\r\n\r\n#{menu}") }

      it 'sends the full message when the conversation has no team and no assignee' do
        described_class.new(conversation: conversation).perform
        expect(conversation.messages.template.last.content).to eq("#{notice}\r\n\r\n#{menu}")
      end

      it 'sends only the first paragraph when the conversation has a team' do
        conversation.update!(team: create(:team, account: conversation.account))
        described_class.new(conversation: conversation).perform
        expect(conversation.messages.template.last.content).to eq(notice)
      end

      it 'sends only the first paragraph when the conversation has an assignee' do
        conversation.update!(assignee: create(:user, account: conversation.account, role: :agent))
        described_class.new(conversation: conversation).perform
        expect(conversation.messages.template.last.content).to eq(notice)
      end
    end

    it 'sends the whole message to a routed conversation when there is no blank line' do
      conversation.inbox.update!(out_of_office_message: "Our hours are Mon-Fri.\nWe will reply soon.")
      conversation.update!(team: create(:team, account: conversation.account))
      described_class.new(conversation: conversation).perform
      expect(conversation.messages.template.last.content).to eq("Our hours are Mon-Fri.\nWe will reply soon.")
    end
  end
end
