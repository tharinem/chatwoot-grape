/* global axios */
import ApiClient from './ApiClient';

class WhatsappMessageTemplatesAPI extends ApiClient {
  constructor() {
    super('inboxes', { accountScoped: true });
  }

  create(inboxId, template) {
    return axios.post(`${this.url}/${inboxId}/message_templates`, {
      template,
    });
  }
}

export default new WhatsappMessageTemplatesAPI();
