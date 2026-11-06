import {
  filterDuplicateSourceMessages,
  getLastMessage,
  getReadMessages,
  getUnreadMessages,
  isWaitingForReply,
} from '../conversationHelper';
import {
  conversationData,
  lastMessageData,
  readMessagesData,
  unReadMessagesData,
} from './fixtures/conversationFixtures';

describe('conversationHelper', () => {
  describe('#filterDuplicateSourceMessages', () => {
    it('returns messages without duplicate source_id and all messages without source_id', () => {
      const input = [
        { source_id: null, id: 1 },
        { source_id: '', id: 2 },
        { id: 3 },
        { source_id: 'wa_1', id: 4 },
        { source_id: 'wa_1', id: 5 },
        { source_id: 'wa_1', id: 6 },
        { source_id: 'wa_2', id: 7 },
        { source_id: 'wa_2', id: 8 },
        { source_id: 'wa_3', id: 9 },
      ];
      const expected = [
        { source_id: null, id: 1 },
        { source_id: '', id: 2 },
        { id: 3 },
        { source_id: 'wa_1', id: 4 },
        { source_id: 'wa_2', id: 7 },
        { source_id: 'wa_3', id: 9 },
      ];
      expect(filterDuplicateSourceMessages(input)).toEqual(expected);
    });
  });

  describe('#readMessages', () => {
    it('should return read messages if conversation is passed', () => {
      expect(
        getReadMessages(
          conversationData.messages,
          conversationData.agent_last_seen_at
        )
      ).toEqual(readMessagesData);
    });
  });

  describe('#unReadMessages', () => {
    it('should return unread messages if conversation is passed', () => {
      expect(
        getUnreadMessages(
          conversationData.messages,
          conversationData.agent_last_seen_at
        )
      ).toEqual(unReadMessagesData);
    });
  });

  describe('#lastMessage', () => {
    it("should return last activity message if both api and store doesn't have other messages", () => {
      const testConversation = {
        messages: [conversationData.messages[0]],
        last_non_activity_message: null,
      };
      expect(getLastMessage(testConversation)).toEqual(
        testConversation.messages[0]
      );
    });

    it('should return message from store if store has latest message', () => {
      const testConversation = {
        messages: [],
        last_non_activity_message: lastMessageData,
      };
      expect(getLastMessage(testConversation)).toEqual(lastMessageData);
    });

    it('should return last non activity message from store if api value is empty', () => {
      const testConversation = {
        messages: [conversationData.messages[0], conversationData.messages[1]],
        last_non_activity_message: null,
      };
      expect(getLastMessage(testConversation)).toEqual(
        testConversation.messages[1]
      );
    });

    it("should return last non activity message from store if store doesn't have any messages", () => {
      const testConversation = {
        messages: [conversationData.messages[1], conversationData.messages[2]],
        last_non_activity_message: conversationData.messages[0],
      };
      expect(getLastMessage(testConversation)).toEqual(
        testConversation.messages[1]
      );
    });
  });

  describe('#isWaitingForReply', () => {
    const incoming = { id: 1, message_type: 0, created_at: 100 };
    const outgoing = { id: 2, message_type: 1, created_at: 200 };
    const note = { id: 3, message_type: 1, private: true, created_at: 300 };
    const activity = { id: 4, message_type: 2, created_at: 400 };

    it('is true when the last public message came from the contact', () => {
      expect(
        isWaitingForReply({ status: 'open', messages: [outgoing, incoming] })
      ).toBe(false);
      expect(
        isWaitingForReply({
          status: 'open',
          messages: [{ ...incoming, created_at: 500 }, activity],
        })
      ).toBe(true);
    });

    it('ignores private notes and activity messages', () => {
      expect(
        isWaitingForReply({
          status: 'open',
          messages: [note, activity],
          last_non_activity_message: { ...incoming, created_at: 250 },
        })
      ).toBe(true);
    });

    it('uses the latest of the loaded messages and the API field', () => {
      expect(
        isWaitingForReply({
          status: 'open',
          messages: [incoming],
          last_non_activity_message: outgoing,
        })
      ).toBe(false);
    });

    it('is false for conversations that are not open or have no messages', () => {
      expect(
        isWaitingForReply({ status: 'resolved', messages: [incoming] })
      ).toBe(false);
      expect(isWaitingForReply({ status: 'open', messages: [] })).toBe(false);
      expect(isWaitingForReply()).toBe(false);
    });
  });
});
