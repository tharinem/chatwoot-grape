/**
 * Determines the last non-activity message between store and API messages.
 * @param {Object} messageInStore - The last non-activity message from the store.
 * @param {Object} messageFromAPI - The last non-activity message from the API.
 * @returns {Object} The latest non-activity message.
 */
const getLastNonActivityMessage = (messageInStore, messageFromAPI) => {
  // If both API value and store value for last non activity message
  // are available, then return the latest one.
  if (messageInStore && messageFromAPI) {
    return messageInStore.created_at >= messageFromAPI.created_at
      ? messageInStore
      : messageFromAPI;
  }
  // Otherwise, return whichever is available
  return messageInStore || messageFromAPI;
};

/**
 * Filters out duplicate source messages from an array of messages.
 * @param {Array} messages - The array of messages to filter.
 * @returns {Array} An array of messages without duplicates.
 */
export const filterDuplicateSourceMessages = (messages = []) => {
  const messagesWithoutDuplicates = [];
  // We cannot use Map or any short hand method as it returns the last message with the duplicate ID
  // We should return the message with smaller id when there is a duplicate
  messages.forEach(m1 => {
    if (m1.source_id) {
      const index = messagesWithoutDuplicates.findIndex(
        m2 => m1.source_id === m2.source_id
      );

      if (index < 0) {
        messagesWithoutDuplicates.push(m1);
      }
    } else {
      messagesWithoutDuplicates.push(m1);
    }
  });
  return messagesWithoutDuplicates;
};

/**
 * Retrieves the last message from a conversation, prioritizing non-activity messages.
 * @param {Object} m - The conversation object containing messages.
 * @returns {Object} The last message of the conversation.
 */
export const getLastMessage = m => {
  const lastMessageIncludingActivity = m.messages[m.messages.length - 1];

  const nonActivityMessages = m.messages.filter(
    message => message.message_type !== 2
  );
  const lastNonActivityMessageInStore =
    nonActivityMessages[nonActivityMessages.length - 1];

  const lastNonActivityMessageFromAPI = m.last_non_activity_message;

  // If API value and store value for last non activity message
  // is empty, then return the last activity message
  if (!lastNonActivityMessageInStore && !lastNonActivityMessageFromAPI) {
    return lastMessageIncludingActivity;
  }

  return getLastNonActivityMessage(
    lastNonActivityMessageInStore,
    lastNonActivityMessageFromAPI
  );
};

/**
 * Filters messages that have been read by the agent.
 * @param {Array} messages - The array of messages to filter.
 * @param {number} agentLastSeenAt - The timestamp of when the agent last saw the messages.
 * @returns {Array} An array of read messages.
 */
export const getReadMessages = (messages, agentLastSeenAt) => {
  return messages.filter(
    message => message.created_at * 1000 <= agentLastSeenAt * 1000
  );
};

/**
 * Filters messages that have not been read by the agent.
 * @param {Array} messages - The array of messages to filter.
 * @param {number} agentLastSeenAt - The timestamp of when the agent last saw the messages.
 * @returns {Array} An array of unread messages.
 */
export const getUnreadMessages = (messages, agentLastSeenAt) => {
  return messages.filter(
    message => message.created_at * 1000 > agentLastSeenAt * 1000
  );
};

const MESSAGE_TYPE_INCOMING = 0;
const MESSAGE_TYPE_OUTGOING = 1;
const BOT_SENDER_TYPES = ['AgentBot', 'Captain::Assistant'];

/**
 * Mirrors the backend rule for what ends the wait (Message#update_waiting_since):
 * a person replying from Chatwoot (sender is a User) or from the channel's
 * native app (external echo), or an agent bot. Automation rule messages,
 * campaigns and templates (greeting, out of office, agent away) do not count.
 */
const isReply = message => {
  if (message.message_type !== MESSAGE_TYPE_OUTGOING) return false;

  const contentAttributes = message.content_attributes || {};
  const additionalAttributes = message.additional_attributes || {};
  if (contentAttributes.automation_rule_id) return false;
  if (additionalAttributes.campaign_id) return false;

  return (
    message.sender_type === 'User' ||
    BOT_SENDER_TYPES.includes(message.sender_type) ||
    Boolean(contentAttributes.external_echo)
  );
};

const countsForWaiting = message =>
  Boolean(message) &&
  !message.private &&
  (message.message_type === MESSAGE_TYPE_INCOMING || isReply(message));

const isNewerMessage = (candidate, current) => {
  if (candidate.created_at !== current.created_at) {
    return candidate.created_at > current.created_at;
  }
  return (candidate.id || 0) > (current.id || 0);
};

/**
 * An open conversation is "waiting for a reply" when the contact wrote and
 * nobody has replied since. Automatic messages (automation rules, greeting,
 * out of office, agent away) do not count as a reply.
 *
 * The API sends `waiting_since` (cleared only by replies) and
 * `waiting_for_reply` (Conversation#waiting_for_reply?: waiting_since is set
 * and the contact has written) in the list payload and in conversation events.
 * A contact message that arrives while waiting_since is already set does not
 * update the conversation, so a contact message loaded in the store also
 * counts. Without those fields, falls back to the loaded messages, skipping
 * automatic ones.
 * @param {Object} conversation - Conversation from the store.
 * @returns {Boolean}
 */
export const isWaitingForReply = (conversation = {}) => {
  if (conversation.status !== 'open') return false;

  const loadedMessages = [
    ...(conversation.messages || []),
    conversation.last_non_activity_message,
  ];
  if (typeof conversation.waiting_for_reply === 'boolean') {
    if (!conversation.waiting_since) return false;
    return (
      conversation.waiting_for_reply ||
      loadedMessages.some(
        message => message && message.message_type === MESSAGE_TYPE_INCOMING
      )
    );
  }

  const candidates = loadedMessages.filter(countsForWaiting);
  if (!candidates.length) return false;

  const latest = candidates.reduce((current, candidate) =>
    isNewerMessage(candidate, current) ? candidate : current
  );
  return latest.message_type === MESSAGE_TYPE_INCOMING;
};
