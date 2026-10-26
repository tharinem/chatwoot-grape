/**
 * Contact highlight (Grape)
 *
 * Decides how the contact panel toggle is highlighted and which contact
 * custom attributes are pinned at the top of the contact panel.
 *
 * Attribute names are configurable per account through
 * `account.settings.contact_highlight` (snake_case keys, all optional):
 *
 *   {
 *     "enabled": true,
 *     "exclusive_seller_attribute": "vendedor_exclusivo",
 *     "display_text_attribute": "texto_exibicao",
 *     "blocked_flag_attributes": ["bloqueado"],
 *     "blocked_text_attributes": ["texto_exibicao"],
 *     "blocked_text_terms": ["bloquead"],
 *     "extra_attributes": ["faturamento"]
 *   }
 *
 * `extra_attributes` lists other contact attribute keys pinned in the top
 * block (in that order, empty values skipped).
 *
 * Blocked text terms ignore negated forms, so "desbloqueado" does not count.
 *
 * Contacts without these attributes keep the default look.
 */

export const CONTACT_HIGHLIGHT_STATUS = {
  BLOCKED: 'blocked',
  EXCLUSIVE_SELLER: 'exclusive_seller',
  DEFAULT: 'default',
};

export const DEFAULT_CONTACT_HIGHLIGHT_CONFIG = Object.freeze({
  enabled: true,
  exclusiveSellerAttribute: 'vendedor_exclusivo',
  displayTextAttribute: 'texto_exibicao',
  blockedFlagAttributes: Object.freeze(['bloqueado']),
  blockedTextAttributes: Object.freeze(['texto_exibicao']),
  blockedTextTerms: Object.freeze(['bloquead']),
  extraAttributes: Object.freeze(['faturamento']),
});

// A term preceded by one of these prefixes in the same word is negated
// ("desbloqueado", "DESBLOQUEADA").
const NEGATION_PREFIXES = ['des'];

const TRUTHY_STRINGS = ['true', 'sim', 'yes', 's', 'y', '1'];

const toStringList = value => {
  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : [];
  }
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string' && item.trim())
      .map(item => item.trim());
  }
  return null;
};

const pickString = (value, fallback) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const pickList = (value, fallback) => {
  const list = toStringList(value);
  return list === null ? [...fallback] : list;
};

/**
 * Merges the account level override with the defaults.
 * @param {Object} [accountSettings] - `account.settings`
 * @returns {Object} resolved config
 */
export const resolveContactHighlightConfig = accountSettings => {
  const defaults = DEFAULT_CONTACT_HIGHLIGHT_CONFIG;
  const override = accountSettings?.contact_highlight;
  const custom = override && typeof override === 'object' ? override : {};

  return {
    enabled: custom.enabled === false ? false : defaults.enabled,
    exclusiveSellerAttribute: pickString(
      custom.exclusive_seller_attribute,
      defaults.exclusiveSellerAttribute
    ),
    displayTextAttribute: pickString(
      custom.display_text_attribute,
      defaults.displayTextAttribute
    ),
    blockedFlagAttributes: pickList(
      custom.blocked_flag_attributes,
      defaults.blockedFlagAttributes
    ),
    blockedTextAttributes: pickList(
      custom.blocked_text_attributes,
      defaults.blockedTextAttributes
    ),
    blockedTextTerms: pickList(
      custom.blocked_text_terms,
      defaults.blockedTextTerms
    ),
    extraAttributes: pickList(
      custom.extra_attributes,
      defaults.extraAttributes
    ),
  };
};

export const normalizeText = value =>
  String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export const isTruthyAttributeValue = value => {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    return TRUTHY_STRINGS.includes(normalizeText(value));
  }
  return false;
};

/**
 * Returns a printable value or null when the attribute is empty.
 * @param {*} value
 * @returns {string|null}
 */
export const formatAttributeValue = value => {
  if (value === null || value === undefined || value === false) return null;
  if (Array.isArray(value)) {
    const joined = value
      .map(item => formatAttributeValue(item))
      .filter(Boolean)
      .join(', ');
    return joined || null;
  }
  if (typeof value === 'object') return null;
  const text = String(value).trim();
  return text || null;
};

const hasBlockedTerm = (value, terms) => {
  const text = formatAttributeValue(value);
  if (!text || !terms.length) return false;
  const normalized = normalizeText(text);
  return terms.some(term => {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    let index = normalized.indexOf(normalizedTerm);
    while (index !== -1) {
      const wordPrefix = normalized.slice(0, index).match(/\p{L}*$/u)[0];
      const isNegated = NEGATION_PREFIXES.some(prefix =>
        wordPrefix.endsWith(prefix)
      );
      if (!isNegated) return true;
      index = normalized.indexOf(normalizedTerm, index + 1);
    }
    return false;
  });
};

/**
 * @param {Object} [customAttributes] - `contact.custom_attributes`
 * @param {Object} [config] - result of resolveContactHighlightConfig
 * @returns {{status: string, isBlocked: boolean, exclusiveSeller: (string|null), displayText: (string|null)}}
 */
export const getContactHighlight = (
  customAttributes,
  config = resolveContactHighlightConfig()
) => {
  const attributes =
    customAttributes && typeof customAttributes === 'object'
      ? customAttributes
      : {};

  if (!config.enabled) {
    return {
      status: CONTACT_HIGHLIGHT_STATUS.DEFAULT,
      isBlocked: false,
      exclusiveSeller: null,
      displayText: null,
    };
  }

  const exclusiveSeller = formatAttributeValue(
    attributes[config.exclusiveSellerAttribute]
  );
  const displayText = formatAttributeValue(
    attributes[config.displayTextAttribute]
  );

  const isBlocked =
    config.blockedFlagAttributes.some(key =>
      isTruthyAttributeValue(attributes[key])
    ) ||
    config.blockedTextAttributes.some(key =>
      hasBlockedTerm(attributes[key], config.blockedTextTerms)
    );

  let status = CONTACT_HIGHLIGHT_STATUS.DEFAULT;
  if (isBlocked) status = CONTACT_HIGHLIGHT_STATUS.BLOCKED;
  else if (exclusiveSeller) status = CONTACT_HIGHLIGHT_STATUS.EXCLUSIVE_SELLER;

  return { status, isBlocked, exclusiveSeller, displayText };
};

/**
 * Extra attributes pinned in the top block, in the configured order.
 * Skips empty values and the display text / exclusive seller keys.
 * @param {Object} [customAttributes] - `contact.custom_attributes`
 * @param {Object} [config] - result of resolveContactHighlightConfig
 * @returns {Array<{key: string, value: string}>}
 */
export const getExtraHighlights = (
  customAttributes,
  config = resolveContactHighlightConfig()
) => {
  if (!config.enabled) return [];
  const attributes =
    customAttributes && typeof customAttributes === 'object'
      ? customAttributes
      : {};
  const reserved = [
    config.displayTextAttribute,
    config.exclusiveSellerAttribute,
  ];

  return [...new Set(config.extraAttributes)]
    .filter(key => !reserved.includes(key))
    .map(key => ({ key, value: formatAttributeValue(attributes[key]) }))
    .filter(item => item.value);
};
