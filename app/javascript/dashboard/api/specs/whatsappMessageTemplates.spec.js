import whatsappMessageTemplatesAPI from '../whatsappMessageTemplates';
import ApiClient from '../ApiClient';

describe('#WhatsappMessageTemplatesAPI', () => {
  it('creates correct instance', () => {
    expect(whatsappMessageTemplatesAPI).toBeInstanceOf(ApiClient);
    expect(whatsappMessageTemplatesAPI).toHaveProperty('create');
  });

  describe('API calls', () => {
    const originalAxios = window.axios;
    const axiosMock = {
      post: vi.fn(() => Promise.resolve()),
    };

    beforeEach(() => {
      window.axios = axiosMock;
    });

    afterEach(() => {
      window.axios = originalAxios;
    });

    it('#create posts the template to the inbox message templates endpoint', () => {
      const template = { name: 'boas_vindas', category: 'MARKETING' };
      whatsappMessageTemplatesAPI.create(2, template);
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/inboxes/2/message_templates',
        { template }
      );
    });
  });
});
