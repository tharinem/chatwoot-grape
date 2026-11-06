/* global axios */

import ApiClient from './ApiClient';

class Agents extends ApiClient {
  constructor() {
    super('agents', { accountScoped: true });
  }

  // Admin only: { [agentId]: { open, waiting } } for agents with an inbox.
  getConversationCounts() {
    return axios.get(`${this.url}/conversation_counts`);
  }

  bulkInvite({ emails }) {
    return axios.post(`${this.url}/bulk_create`, {
      emails,
    });
  }
}

export default new Agents();
