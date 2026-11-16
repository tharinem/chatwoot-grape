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

  // payload: { name, language, header_image } (signed blob id) or
  // { name, language, from_template: true } to copy the image Meta keeps
  setHeaderImage(inboxId, payload) {
    return axios.patch(
      `${this.url}/${inboxId}/message_templates/header_image`,
      payload
    );
  }
}

export default new WhatsappMessageTemplatesAPI();
