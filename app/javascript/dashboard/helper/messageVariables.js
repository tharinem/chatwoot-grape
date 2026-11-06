import { getMessageVariables as getBaseMessageVariables } from '@chatwoot/utils';

// Time-of-day greeting variables (Grape fork).
// `{{saudacao}}` is the primary name, `{{greeting}}` is an alias.
export const GREETING_VARIABLE_KEYS = ['saudacao', 'greeting'];

const GREETING_VARIABLES_REGEX = /{{\s*(saudacao|greeting)\s*}}/gi;

// Chatwoot stores UTC as the default inbox timezone, so a UTC inbox usually
// means "not configured" and we fall back to the browser's local time.
const UNCONFIGURED_TIMEZONES = ['UTC', 'Etc/UTC'];

export const GREETINGS = {
  MORNING: 'Bom dia',
  AFTERNOON: 'Boa tarde',
  EVENING: 'Boa noite',
};

/**
 * Bom dia: 05:00-11:59, Boa tarde: 12:00-17:59, Boa noite: 18:00-04:59.
 * @param {number} hour - Hour of the day (0-23).
 * @returns {string}
 */
export const getGreetingForHour = hour => {
  if (hour >= 5 && hour < 12) return GREETINGS.MORNING;
  if (hour >= 12 && hour < 18) return GREETINGS.AFTERNOON;
  return GREETINGS.EVENING;
};

const isValidTimezone = timezone => {
  if (!timezone || typeof timezone !== 'string') return false;
  try {
    return !!new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch (error) {
    return false;
  }
};

/**
 * Returns the hour (0-23) of `date` in `timezone`, or in the browser's local
 * time when the timezone is missing or invalid.
 */
export const getHourInTimezone = (date, timezone) => {
  if (!isValidTimezone(timezone)) return date.getHours();
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find(part => part.type === 'hour');
  return Number(hourPart.value) % 24;
};

/**
 * Picks the timezone used for the greeting: account timezone, then inbox
 * timezone (ignoring the UTC default), then undefined (browser local time).
 */
export const resolveGreetingTimezone = ({ account, inbox } = {}) => {
  const accountTimezone = account?.custom_attributes?.timezone;
  if (isValidTimezone(accountTimezone)) return accountTimezone;

  const inboxTimezone = inbox?.timezone;
  if (
    isValidTimezone(inboxTimezone) &&
    !UNCONFIGURED_TIMEZONES.includes(inboxTimezone)
  ) {
    return inboxTimezone;
  }
  return undefined;
};

export const getGreeting = ({ date = new Date(), timezone } = {}) =>
  getGreetingForHour(getHourInTimezone(date, timezone));

/**
 * Adds `saudacao` / `greeting` to a variables object. They are defined as
 * getters so the greeting is computed at the moment it is read (a cached
 * variables object does not keep "Bom dia" after noon).
 */
export const addGreetingVariables = (variables, { timezone, now } = {}) => {
  const getNow = now || (() => new Date());
  GREETING_VARIABLE_KEYS.forEach(key => {
    Object.defineProperty(variables, key, {
      get: () => getGreeting({ date: getNow(), timezone }),
      enumerable: true,
      configurable: true,
    });
  });
  return variables;
};

/**
 * Wraps `getMessageVariables` from `@chatwoot/utils` and adds the greeting
 * variables.
 */
export const getMessageVariables = ({
  conversation,
  contact,
  inbox,
  account,
  now,
}) => {
  const variables = getBaseMessageVariables({ conversation, contact, inbox });
  return addGreetingVariables(variables, {
    timezone: resolveGreetingTimezone({ account, inbox }),
    now,
  });
};

/**
 * Replaces only the greeting variables. Used right before sending, so a
 * `{{saudacao}}` typed by hand (not via canned response) is not rendered as
 * an empty string by the backend Liquid processing.
 */
export const replaceGreetingVariables = ({ message, variables }) => {
  if (!message) return message;
  return message.replace(GREETING_VARIABLES_REGEX, (match, key) => {
    const value = variables?.[key.toLowerCase()];
    return value || match;
  });
};
