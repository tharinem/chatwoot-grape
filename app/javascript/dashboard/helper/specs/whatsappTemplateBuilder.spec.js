import {
  extractVariables,
  validateTemplateDraft,
  buildPreview,
  buildTemplatePayload,
} from '../whatsappTemplateBuilder';

const baseDraft = {
  name: 'boas_vindas',
  category: 'MARKETING',
  language: 'pt_BR',
  body: 'Oi! Temos novidades para você esta semana.',
  bodyExamples: [],
  headerText: '',
  headerExample: '',
  footer: '',
  buttons: [],
};

const codesFor = draft => validateTemplateDraft({ ...baseDraft, ...draft });

describe('#whatsappTemplateBuilder', () => {
  describe('extractVariables', () => {
    it('returns unique variable numbers in order of appearance', () => {
      expect(extractVariables('Oi {{1}}, pedido {{2}} de {{1}}')).toEqual([
        1, 2,
      ]);
    });

    it('returns an empty list for text without variables or empty input', () => {
      expect(extractVariables('Oi')).toEqual([]);
      expect(extractVariables(undefined)).toEqual([]);
    });
  });

  describe('validateTemplateDraft', () => {
    it('accepts a valid draft', () => {
      expect(validateTemplateDraft(baseDraft)).toEqual([]);
    });

    it('defaults the language to pt_BR', () => {
      expect(codesFor({ language: '' })).toEqual([]);
    });

    it.each([
      [{ name: 'Boas Vindas' }, 'name', 'invalid_format'],
      [{ name: '' }, 'name', 'invalid_format'],
      [{ category: 'AUTHENTICATION' }, 'category', 'invalid_value'],
      [{ language: 'portuguese' }, 'language', 'invalid_format'],
      [{ body: '   ' }, 'body', 'required'],
      [{ body: 'a'.repeat(1025) }, 'body', 'too_long'],
      [
        { body: 'Oi {{1}}, pedido {{3}} ok.', bodyExamples: ['a', 'b'] },
        'body',
        'non_sequential_variables',
      ],
      [
        { body: '{{1}}, seu pedido saiu.', bodyExamples: ['Maria'] },
        'body',
        'variable_at_edge',
      ],
      [
        { body: 'Seu pedido saiu, {{1}}', bodyExamples: ['Maria'] },
        'body',
        'variable_at_edge',
      ],
      [{ body: 'Oi {{1}}, tudo bem?' }, 'body_examples', 'missing_examples'],
      [
        { body: 'Oi {{1}}, tudo bem?', bodyExamples: [' '] },
        'body_examples',
        'missing_examples',
      ],
      [{ headerText: 'a'.repeat(61) }, 'header_text', 'too_long'],
      [
        { headerText: '{{1}} e {{2}}', headerExample: 'x' },
        'header_text',
        'too_many_variables',
      ],
      [{ headerText: 'Pedido de {{1}}' }, 'header_example', 'required'],
      [{ footer: 'a'.repeat(61) }, 'footer', 'too_long'],
      [{ footer: 'Até {{1}}' }, 'footer', 'variables_not_allowed'],
      [
        {
          buttons: Array.from({ length: 4 }, (_, i) => ({
            type: 'QUICK_REPLY',
            text: `Opção ${i}`,
          })),
        },
        'buttons',
        'too_many',
      ],
      [
        {
          buttons: [
            { type: 'URL', text: 'Site', url: 'https://loja.com' },
            { type: 'URL', text: 'Site 2', url: 'https://loja.com' },
          ],
        },
        'buttons',
        'too_many',
      ],
      [
        {
          buttons: [
            { type: 'QUICK_REPLY', text: 'Sim' },
            { type: 'URL', text: 'Site', url: 'https://loja.com' },
          ],
        },
        'buttons',
        'mixed_types',
      ],
      [
        { buttons: [{ type: 'PHONE_NUMBER', text: 'Ligar' }] },
        'buttons',
        'invalid_type',
      ],
      [
        { buttons: [{ type: 'QUICK_REPLY', text: 'a'.repeat(26) }] },
        'buttons.0.text',
        'too_long',
      ],
      [
        { buttons: [{ type: 'QUICK_REPLY', text: '' }] },
        'buttons.0.text',
        'required',
      ],
      [
        { buttons: [{ type: 'URL', text: 'Site', url: 'http://loja.com' }] },
        'buttons.0.url',
        'invalid_url',
      ],
      [
        {
          buttons: [
            {
              type: 'URL',
              text: 'Site',
              url: 'https://loja.com/{{1}}/x',
              example: 'a',
            },
          ],
        },
        'buttons.0.url',
        'invalid_url',
      ],
      [
        {
          buttons: [
            { type: 'URL', text: 'Site', url: 'https://loja.com/{{1}}' },
          ],
        },
        'buttons.0.example',
        'required',
      ],
    ])('rejects %j with %s / %s', (draft, field, code) => {
      expect(codesFor(draft)).toContainEqual({ field, code });
    });
  });

  describe('buildPreview', () => {
    it('replaces variables with examples and keeps unfilled ones', () => {
      const preview = buildPreview({
        ...baseDraft,
        headerText: 'Pedido de {{1}}',
        headerExample: 'Maria',
        body: 'Oi {{1}}, seu pedido {{2}} saiu.',
        bodyExamples: ['Maria'],
        footer: 'Feito com carinho',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Obrigado' },
          { type: 'QUICK_REPLY', text: '' },
        ],
      });

      expect(preview).toEqual({
        header: 'Pedido de Maria',
        body: 'Oi Maria, seu pedido {{2}} saiu.',
        footer: 'Feito com carinho',
        buttons: [{ type: 'QUICK_REPLY', text: 'Obrigado' }],
      });
    });
  });

  describe('buildTemplatePayload', () => {
    it('builds a minimal payload without optional fields', () => {
      expect(buildTemplatePayload(baseDraft)).toEqual({
        name: 'boas_vindas',
        category: 'MARKETING',
        language: 'pt_BR',
        body: 'Oi! Temos novidades para você esta semana.',
      });
    });

    it('includes examples only where variables exist', () => {
      const payload = buildTemplatePayload({
        ...baseDraft,
        body: 'Oi {{1}}, tudo bem?',
        bodyExamples: ['Maria'],
        headerText: 'Novidades',
        headerExample: 'ignored',
        footer: 'Rodapé',
        buttons: [
          {
            type: 'URL',
            text: 'Ver',
            url: 'https://loja.com/{{1}}',
            example: 'https://loja.com/1',
          },
        ],
      });

      expect(payload).toEqual({
        name: 'boas_vindas',
        category: 'MARKETING',
        language: 'pt_BR',
        body: 'Oi {{1}}, tudo bem?',
        body_examples: ['Maria'],
        header_text: 'Novidades',
        footer: 'Rodapé',
        buttons: [
          {
            type: 'URL',
            text: 'Ver',
            url: 'https://loja.com/{{1}}',
            example: 'https://loja.com/1',
          },
        ],
      });
    });
  });
});
