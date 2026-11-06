import {
  getUndefinedVariablesInMessage,
  replaceVariablesInMessage,
} from '@chatwoot/utils';
import {
  addGreetingVariables,
  getGreeting,
  getGreetingForHour,
  getHourInTimezone,
  getMessageVariables,
  replaceGreetingVariables,
  resolveGreetingTimezone,
} from '../messageVariables';

const SAO_PAULO = 'America/Sao_Paulo';
// Sao Paulo is UTC-3 (no DST since 2019), so local HH:MM = (HH+3):MM UTC.
const spTime = (hh, mm) =>
  new Date(Date.UTC(2026, 10, 6, hh + 3, mm, 0)); /* 2026-11-06 */

const conversation = {
  id: 42,
  meta: {
    sender: { id: 7, name: 'maria silva', email: 'maria@example.com' },
    assignee: { id: 1, name: 'joana souza', email: 'joana@example.com' },
  },
};
const inbox = { id: 3, name: 'WhatsApp Feito', timezone: SAO_PAULO };

describe('getGreetingForHour', () => {
  it.each([
    [0, 'Boa noite'],
    [4, 'Boa noite'],
    [5, 'Bom dia'],
    [11, 'Bom dia'],
    [12, 'Boa tarde'],
    [17, 'Boa tarde'],
    [18, 'Boa noite'],
    [23, 'Boa noite'],
  ])('hour %i -> %s', (hour, expected) => {
    expect(getGreetingForHour(hour)).toBe(expected);
  });
});

describe('getGreeting boundaries in America/Sao_Paulo', () => {
  it.each([
    [4, 59, 'Boa noite'],
    [5, 0, 'Bom dia'],
    [11, 59, 'Bom dia'],
    [12, 0, 'Boa tarde'],
    [17, 59, 'Boa tarde'],
    [18, 0, 'Boa noite'],
    [0, 0, 'Boa noite'],
  ])('%i:%i -> %s', (hh, mm, expected) => {
    expect(getGreeting({ date: spTime(hh, mm), timezone: SAO_PAULO })).toBe(
      expected
    );
  });
});

describe('getHourInTimezone', () => {
  const date = new Date(Date.UTC(2026, 10, 6, 14, 30)); // 14:30 UTC

  it('converts to the given timezone', () => {
    expect(getHourInTimezone(date, SAO_PAULO)).toBe(11);
    expect(getHourInTimezone(date, 'Asia/Tokyo')).toBe(23);
    expect(getHourInTimezone(date, 'UTC')).toBe(14);
  });

  it('returns 0 (not 24) at midnight', () => {
    expect(
      getHourInTimezone(new Date(Date.UTC(2026, 10, 6, 3, 0)), SAO_PAULO)
    ).toBe(0);
  });

  it('falls back to browser local time for missing/invalid timezone', () => {
    expect(getHourInTimezone(date, undefined)).toBe(date.getHours());
    expect(getHourInTimezone(date, 'Not/AZone')).toBe(date.getHours());
  });
});

describe('resolveGreetingTimezone', () => {
  it('prefers the account timezone', () => {
    expect(
      resolveGreetingTimezone({
        account: { custom_attributes: { timezone: 'Europe/Lisbon' } },
        inbox,
      })
    ).toBe('Europe/Lisbon');
  });

  it('falls back to the inbox timezone', () => {
    expect(
      resolveGreetingTimezone({ account: { custom_attributes: {} }, inbox })
    ).toBe(SAO_PAULO);
  });

  it('ignores invalid account timezone', () => {
    expect(
      resolveGreetingTimezone({
        account: { custom_attributes: { timezone: 'bogus' } },
        inbox,
      })
    ).toBe(SAO_PAULO);
  });

  it('treats the default UTC inbox timezone as unset (browser time)', () => {
    expect(
      resolveGreetingTimezone({ inbox: { timezone: 'UTC' } })
    ).toBeUndefined();
    expect(resolveGreetingTimezone({})).toBeUndefined();
  });
});

describe('getMessageVariables (fork wrapper)', () => {
  const now = () => spTime(9, 15);

  it('keeps the standard variables and adds saudacao/greeting', () => {
    const variables = getMessageVariables({
      conversation,
      contact: {},
      inbox,
      now,
    });
    expect(variables['agent.name']).toBe('Joana Souza');
    expect(variables['contact.first_name']).toBe('Maria');
    expect(variables.saudacao).toBe('Bom dia');
    expect(variables.greeting).toBe('Bom dia');
  });

  it('computes the greeting when read, not when created', () => {
    let current = spTime(11, 59);
    const variables = getMessageVariables({
      conversation,
      contact: {},
      inbox,
      now: () => current,
    });
    expect(variables.saudacao).toBe('Bom dia');
    current = spTime(12, 0);
    expect(variables.saudacao).toBe('Boa tarde');
  });

  it('uses account timezone over inbox timezone', () => {
    // 09:15 in Sao Paulo = 21:15 in Tokyo
    const variables = getMessageVariables({
      conversation,
      contact: {},
      inbox,
      account: { custom_attributes: { timezone: 'Asia/Tokyo' } },
      now,
    });
    expect(variables.saudacao).toBe('Boa noite');
  });
});

describe('canned response replacement', () => {
  const cannedMessage =
    '{{saudacao}}, tudo bem? Aqui é a {{agent.name}} da Feito Chocolate.';

  it.each([
    [8, 0, 'Bom dia'],
    [14, 0, 'Boa tarde'],
    [20, 0, 'Boa noite'],
  ])('at %i:%i renders %s', (hh, mm, greeting) => {
    const variables = getMessageVariables({
      conversation,
      contact: {},
      inbox,
      now: () => spTime(hh, mm),
    });
    expect(
      replaceVariablesInMessage({ message: cannedMessage, variables })
    ).toBe(`${greeting}, tudo bem? Aqui é a Joana Souza da Feito Chocolate.`);
  });

  it('supports the {{greeting}} alias and inner spaces', () => {
    const variables = addGreetingVariables(
      {},
      { timezone: SAO_PAULO, now: () => spTime(15, 0) }
    );
    expect(
      replaceVariablesInMessage({
        message: '{{ greeting }}! {{saudacao}}!',
        variables,
      })
    ).toBe('Boa tarde! Boa tarde!');
  });

  it('does not flag saudacao/greeting as undefined variables', () => {
    const variables = getMessageVariables({ conversation, contact: {}, inbox });
    expect(
      getUndefinedVariablesInMessage({
        message: '{{saudacao}} {{greeting}} {{agent.name}} {{foo.bar}}',
        variables,
      })
    ).toEqual(['foo.bar']);
  });
});

describe('replaceGreetingVariables (on send)', () => {
  const variables = addGreetingVariables(
    { 'agent.name': 'Joana' },
    { timezone: SAO_PAULO, now: () => spTime(19, 0) }
  );

  it('replaces only greeting variables and keeps the others for the backend', () => {
    expect(
      replaceGreetingVariables({
        message: '{{Saudacao}}, sou {{agent.name}}. {{ greeting }}!',
        variables,
      })
    ).toBe('Boa noite, sou {{agent.name}}. Boa noite!');
  });

  it('handles empty messages', () => {
    expect(replaceGreetingVariables({ message: '', variables })).toBe('');
  });
});
