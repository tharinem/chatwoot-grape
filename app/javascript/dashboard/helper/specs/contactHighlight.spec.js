import {
  CONTACT_HIGHLIGHT_STATUS,
  DEFAULT_CONTACT_HIGHLIGHT_CONFIG,
  formatAttributeValue,
  getContactHighlight,
  getExtraHighlights,
  isTruthyAttributeValue,
  resolveContactHighlightConfig,
} from '../contactHighlight';

describe('contactHighlight', () => {
  describe('resolveContactHighlightConfig', () => {
    it('returns the defaults when the account has no override', () => {
      expect(resolveContactHighlightConfig()).toEqual({
        ...DEFAULT_CONTACT_HIGHLIGHT_CONFIG,
        blockedFlagAttributes: ['bloqueado'],
        blockedTextAttributes: ['texto_exibicao'],
        blockedTextTerms: ['bloquead'],
        extraAttributes: ['faturamento'],
      });
      expect(resolveContactHighlightConfig({})).toEqual(
        resolveContactHighlightConfig()
      );
    });

    it('applies the account override from settings.contact_highlight', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: {
          exclusive_seller_attribute: 'seller',
          display_text_attribute: 'popup',
          blocked_flag_attributes: 'credit_hold',
          blocked_text_attributes: ['popup', 'finance_note'],
          blocked_text_terms: ['hold'],
          extra_attributes: ['billing', 'region'],
        },
      });

      expect(config).toEqual({
        enabled: true,
        exclusiveSellerAttribute: 'seller',
        displayTextAttribute: 'popup',
        blockedFlagAttributes: ['credit_hold'],
        blockedTextAttributes: ['popup', 'finance_note'],
        blockedTextTerms: ['hold'],
        extraAttributes: ['billing', 'region'],
      });
    });

    it('ignores invalid override values', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: {
          exclusive_seller_attribute: '  ',
          blocked_flag_attributes: 42,
        },
      });
      expect(config.exclusiveSellerAttribute).toBe('vendedor_exclusivo');
      expect(config.blockedFlagAttributes).toEqual(['bloqueado']);
    });

    it('can be disabled per account', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: { enabled: false },
      });
      expect(config.enabled).toBe(false);
    });
  });

  describe('isTruthyAttributeValue', () => {
    it.each([true, 1, 'true', 'TRUE', 'sim', 'Sim', 'yes', '1'])(
      'treats %p as truthy',
      value => {
        expect(isTruthyAttributeValue(value)).toBe(true);
      }
    );

    it.each([false, 0, 'false', 'não', 'nao', '', null, undefined, {}])(
      'treats %p as falsy',
      value => {
        expect(isTruthyAttributeValue(value)).toBe(false);
      }
    );
  });

  describe('formatAttributeValue', () => {
    it('returns null for empty values', () => {
      expect(formatAttributeValue(undefined)).toBeNull();
      expect(formatAttributeValue(null)).toBeNull();
      expect(formatAttributeValue(false)).toBeNull();
      expect(formatAttributeValue('   ')).toBeNull();
      expect(formatAttributeValue([])).toBeNull();
      expect(formatAttributeValue({ a: 1 })).toBeNull();
    });

    it('stringifies scalar and list values', () => {
      expect(formatAttributeValue(' Jenifer ')).toBe('Jenifer');
      expect(formatAttributeValue(123)).toBe('123');
      expect(formatAttributeValue(['Ana', '', 'Bia'])).toBe('Ana, Bia');
    });
  });

  describe('getContactHighlight', () => {
    it('returns the default status for contacts without the attributes', () => {
      expect(getContactHighlight(undefined)).toEqual({
        status: CONTACT_HIGHLIGHT_STATUS.DEFAULT,
        isBlocked: false,
        exclusiveSeller: null,
        displayText: null,
      });
      expect(getContactHighlight({ other: 'x' }).status).toBe(
        CONTACT_HIGHLIGHT_STATUS.DEFAULT
      );
    });

    it('flags an exclusive seller', () => {
      const result = getContactHighlight({
        vendedor_exclusivo: 'Jenifer',
        texto_exibicao: 'Entrega só pela manhã',
      });
      expect(result).toEqual({
        status: CONTACT_HIGHLIGHT_STATUS.EXCLUSIVE_SELLER,
        isBlocked: false,
        exclusiveSeller: 'Jenifer',
        displayText: 'Entrega só pela manhã',
      });
    });

    it('flags a blocked contact from the boolean attribute', () => {
      const result = getContactHighlight({ bloqueado: true });
      expect(result.status).toBe(CONTACT_HIGHLIGHT_STATUS.BLOCKED);
      expect(result.isBlocked).toBe(true);
    });

    it('flags a blocked contact from the display text, ignoring case and accents', () => {
      expect(
        getContactHighlight({
          texto_exibicao: 'Cliente BLOQUEADO no financeiro',
        }).status
      ).toBe(CONTACT_HIGHLIGHT_STATUS.BLOCKED);
      expect(
        getContactHighlight({ texto_exibicao: 'Conta bloqueada' }).status
      ).toBe(CONTACT_HIGHLIGHT_STATUS.BLOCKED);
    });

    it.each(['desbloqueado', 'Desbloqueada', 'Cliente DESBLOQUEADA em 10/10'])(
      'does not flag the negated form %p',
      text => {
        expect(getContactHighlight({ texto_exibicao: text }).status).toBe(
          CONTACT_HIGHLIGHT_STATUS.DEFAULT
        );
      }
    );

    it.each(['cliente bloqueado', 'BLOQUEADA p/ compra', 'Bloqueado'])(
      'flags %p as blocked',
      text => {
        expect(getContactHighlight({ texto_exibicao: text }).status).toBe(
          CONTACT_HIGHLIGHT_STATUS.BLOCKED
        );
      }
    );

    it('flags the text when a non negated occurrence also exists', () => {
      expect(
        getContactHighlight({
          texto_exibicao: 'Desbloqueado em março, bloqueado de novo em maio',
        }).status
      ).toBe(CONTACT_HIGHLIGHT_STATUS.BLOCKED);
    });

    it('gives priority to the blocked status over the exclusive seller', () => {
      const result = getContactHighlight({
        vendedor_exclusivo: 'Jenifer',
        bloqueado: 'sim',
      });
      expect(result.status).toBe(CONTACT_HIGHLIGHT_STATUS.BLOCKED);
      expect(result.exclusiveSeller).toBe('Jenifer');
    });

    it('does not flag bloqueado=false', () => {
      expect(getContactHighlight({ bloqueado: false }).status).toBe(
        CONTACT_HIGHLIGHT_STATUS.DEFAULT
      );
    });

    it('uses the configured attribute names', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: {
          exclusive_seller_attribute: 'seller',
          display_text_attribute: 'popup',
          blocked_flag_attributes: ['credit_hold'],
          blocked_text_attributes: [],
        },
      });

      expect(
        getContactHighlight({ vendedor_exclusivo: 'Jenifer' }, config).status
      ).toBe(CONTACT_HIGHLIGHT_STATUS.DEFAULT);
      expect(getContactHighlight({ seller: 'John' }, config)).toEqual({
        status: CONTACT_HIGHLIGHT_STATUS.EXCLUSIVE_SELLER,
        isBlocked: false,
        exclusiveSeller: 'John',
        displayText: null,
      });
      expect(getContactHighlight({ popup: 'bloqueado' }, config).status).toBe(
        CONTACT_HIGHLIGHT_STATUS.DEFAULT
      );
      expect(getContactHighlight({ credit_hold: 1 }, config).status).toBe(
        CONTACT_HIGHLIGHT_STATUS.BLOCKED
      );
    });

    it('returns the default status when disabled', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: { enabled: false },
      });
      expect(
        getContactHighlight(
          { bloqueado: true, vendedor_exclusivo: 'Jenifer' },
          config
        )
      ).toEqual({
        status: CONTACT_HIGHLIGHT_STATUS.DEFAULT,
        isBlocked: false,
        exclusiveSeller: null,
        displayText: null,
      });
    });
  });

  describe('getExtraHighlights', () => {
    it('shows faturamento by default when filled', () => {
      expect(getExtraHighlights({ faturamento: 'Fat 30/60dd' })).toEqual([
        { key: 'faturamento', value: 'Fat 30/60dd' },
      ]);
    });

    it('skips empty values', () => {
      expect(getExtraHighlights({ faturamento: '  ' })).toEqual([]);
      expect(getExtraHighlights({})).toEqual([]);
      expect(getExtraHighlights(undefined)).toEqual([]);
    });

    it('respects the configured order', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: {
          extra_attributes: ['razao_social', 'faturamento', 'codigo_cliente'],
        },
      });
      const result = getExtraHighlights(
        {
          codigo_cliente: '123',
          faturamento: 'Fat 30/60dd',
          razao_social: 'Doces LTDA',
        },
        config
      );
      expect(result.map(item => item.key)).toEqual([
        'razao_social',
        'faturamento',
        'codigo_cliente',
      ]);
    });

    it('ignores duplicated keys and the display text / seller keys', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: {
          extra_attributes: ['faturamento', 'texto_exibicao', 'faturamento'],
        },
      });
      expect(
        getExtraHighlights(
          { faturamento: 'Fat 30dd', texto_exibicao: 'Aviso' },
          config
        )
      ).toEqual([{ key: 'faturamento', value: 'Fat 30dd' }]);
    });

    it('returns nothing when disabled', () => {
      const config = resolveContactHighlightConfig({
        contact_highlight: { enabled: false },
      });
      expect(getExtraHighlights({ faturamento: 'Fat 30dd' }, config)).toEqual(
        []
      );
    });
  });
});
