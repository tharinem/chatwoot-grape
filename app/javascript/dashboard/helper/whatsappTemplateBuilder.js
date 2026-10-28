// Pure helpers for the WhatsApp template builder.
// Validation rules mirror Whatsapp::TemplateDraftValidator on the backend.

export const TEMPLATE_LIMITS = {
  NAME: 512,
  BODY: 1024,
  HEADER: 60,
  FOOTER: 60,
  BUTTON_TEXT: 25,
  QUICK_REPLIES: 3,
};

export const ALLOWED_CATEGORIES = ['MARKETING', 'UTILITY'];
export const BUTTON_TYPES = { QUICK_REPLY: 'QUICK_REPLY', URL: 'URL' };
export const DEFAULT_TEMPLATE_LANGUAGE = 'pt_BR';

const NAME_FORMAT = /^[a-z0-9_]{1,512}$/;
const LANGUAGE_FORMAT = /^[a-z]{2}(_[A-Z]{2})?$/;
const VARIABLE_PATTERN = /\{\{(\d+)\}\}/g;
const URL_TRAILING_VARIABLE = '{{1}}';

const asString = value =>
  value === null || value === undefined ? '' : String(value);

export const extractVariables = text => {
  const matches = asString(text).matchAll(VARIABLE_PATTERN);
  return [...new Set([...matches].map(match => Number(match[1])))];
};

const isSequential = variables =>
  [...variables]
    .sort((a, b) => a - b)
    .every((value, index) => value === index + 1);

const hasVariableAtEdge = text => {
  const stripped = asString(text).trim();
  return /^\{\{\d+\}\}/.test(stripped) || /\{\{\d+\}\}$/.test(stripped);
};

const isHttpsUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch (error) {
    return false;
  }
};

const validateBody = (draft, errors) => {
  const body = asString(draft.body);
  if (!body.trim()) {
    errors.push({ field: 'body', code: 'required' });
    return;
  }
  if (body.length > TEMPLATE_LIMITS.BODY) {
    errors.push({ field: 'body', code: 'too_long' });
    return;
  }

  const variables = extractVariables(body);
  if (!variables.length) return;

  if (!isSequential(variables)) {
    errors.push({ field: 'body', code: 'non_sequential_variables' });
  }
  if (hasVariableAtEdge(body)) {
    errors.push({ field: 'body', code: 'variable_at_edge' });
  }
  const examples = (draft.bodyExamples || []).map(asString);
  const examplesComplete =
    examples.length === variables.length &&
    examples.every(example => example.trim());
  if (!examplesComplete) {
    errors.push({ field: 'body_examples', code: 'missing_examples' });
  }
};

const validateHeader = (draft, errors) => {
  const header = asString(draft.headerText);
  if (!header.trim()) return;
  if (header.length > TEMPLATE_LIMITS.HEADER) {
    errors.push({ field: 'header_text', code: 'too_long' });
    return;
  }

  const matches = [...header.matchAll(VARIABLE_PATTERN)];
  if (!matches.length) return;
  if (matches.length > 1 || Number(matches[0][1]) !== 1) {
    errors.push({ field: 'header_text', code: 'too_many_variables' });
    return;
  }
  if (!asString(draft.headerExample).trim()) {
    errors.push({ field: 'header_example', code: 'required' });
  }
};

const validateFooter = (draft, errors) => {
  const footer = asString(draft.footer);
  if (!footer.trim()) return;
  if (footer.length > TEMPLATE_LIMITS.FOOTER) {
    errors.push({ field: 'footer', code: 'too_long' });
  }
  if (footer.includes('{{')) {
    errors.push({ field: 'footer', code: 'variables_not_allowed' });
  }
};

const validateButtonUrl = (button, index, errors) => {
  const url = asString(button.url);
  const hasTrailingVariable = url.endsWith(URL_TRAILING_VARIABLE);
  const baseUrl = hasTrailingVariable
    ? url.slice(0, -URL_TRAILING_VARIABLE.length)
    : url;

  if (!isHttpsUrl(baseUrl) || baseUrl.includes('{{')) {
    errors.push({ field: `buttons.${index}.url`, code: 'invalid_url' });
    return;
  }
  if (hasTrailingVariable && !asString(button.example).trim()) {
    errors.push({ field: `buttons.${index}.example`, code: 'required' });
  }
};

const validateButtons = (draft, errors) => {
  const buttons = draft.buttons || [];
  if (!buttons.length) return;

  const types = [...new Set(buttons.map(button => button.type))];
  if (types.length > 1) {
    errors.push({ field: 'buttons', code: 'mixed_types' });
    return;
  }
  const [type] = types;
  if (!Object.values(BUTTON_TYPES).includes(type)) {
    errors.push({ field: 'buttons', code: 'invalid_type' });
    return;
  }
  const tooMany =
    (type === BUTTON_TYPES.QUICK_REPLY &&
      buttons.length > TEMPLATE_LIMITS.QUICK_REPLIES) ||
    (type === BUTTON_TYPES.URL && buttons.length > 1);
  if (tooMany) {
    errors.push({ field: 'buttons', code: 'too_many' });
  }

  buttons.forEach((button, index) => {
    const text = asString(button.text);
    if (!text.trim()) {
      errors.push({ field: `buttons.${index}.text`, code: 'required' });
    }
    if (text.length > TEMPLATE_LIMITS.BUTTON_TEXT) {
      errors.push({ field: `buttons.${index}.text`, code: 'too_long' });
    }
    if (button.type === BUTTON_TYPES.URL) {
      validateButtonUrl(button, index, errors);
    }
  });
};

export const validateTemplateDraft = (draft = {}) => {
  const errors = [];
  const language = asString(draft.language) || DEFAULT_TEMPLATE_LANGUAGE;

  if (!NAME_FORMAT.test(asString(draft.name))) {
    errors.push({ field: 'name', code: 'invalid_format' });
  }
  if (!ALLOWED_CATEGORIES.includes(draft.category)) {
    errors.push({ field: 'category', code: 'invalid_value' });
  }
  if (!LANGUAGE_FORMAT.test(language)) {
    errors.push({ field: 'language', code: 'invalid_format' });
  }
  validateBody(draft, errors);
  validateHeader(draft, errors);
  validateFooter(draft, errors);
  validateButtons(draft, errors);

  return errors;
};

const replaceVariables = (text, examples = []) =>
  asString(text).replace(VARIABLE_PATTERN, (match, number) => {
    const example = asString(examples[Number(number) - 1]).trim();
    return example || match;
  });

export const buildPreview = (draft = {}) => ({
  header: replaceVariables(draft.headerText, [draft.headerExample]),
  body: replaceVariables(draft.body, draft.bodyExamples),
  footer: asString(draft.footer),
  buttons: (draft.buttons || [])
    .filter(button => asString(button.text).trim())
    .map(button => ({ type: button.type, text: button.text })),
});

export const buildTemplatePayload = (draft = {}) => {
  const payload = {
    name: asString(draft.name).trim(),
    category: draft.category,
    language: asString(draft.language) || DEFAULT_TEMPLATE_LANGUAGE,
    body: asString(draft.body),
  };
  if (extractVariables(draft.body).length) {
    payload.body_examples = (draft.bodyExamples || []).map(asString);
  }
  if (asString(draft.headerText).trim()) {
    payload.header_text = asString(draft.headerText);
    if (extractVariables(draft.headerText).length) {
      payload.header_example = asString(draft.headerExample);
    }
  }
  if (asString(draft.footer).trim()) {
    payload.footer = asString(draft.footer);
  }
  if ((draft.buttons || []).length) {
    payload.buttons = draft.buttons.map(button => {
      if (button.type !== BUTTON_TYPES.URL) {
        return { type: button.type, text: button.text };
      }
      const urlButton = {
        type: button.type,
        text: button.text,
        url: button.url,
      };
      if (asString(button.url).endsWith(URL_TRAILING_VARIABLE)) {
        urlButton.example = button.example;
      }
      return urlButton;
    });
  }
  return payload;
};
