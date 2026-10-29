import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  currentLocalDateTimeInput,
  formatToUTCString,
  isAtLeastMinutesAhead,
  toLocalDateTimeInput,
} from '../scheduledAtHelper';

const HELPER_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../scheduledAtHelper.js'
);

// 2026-10-30 09:30 in America/Sao_Paulo (UTC-3) = 12:30 UTC.
const SAO_PAULO_SCHEDULED_AT = Date.UTC(2026, 9, 30, 12, 30) / 1000;

// Vitest workers ignore a runtime change of process.env.TZ, so the
// conversion runs in a separate node process started with the wanted TZ.
const runInTimeZone = (timeZone, code) => {
  const source = readFileSync(HELPER_PATH, 'utf8');
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `${source}\n${code}`],
    { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' }
  );
  return JSON.parse(output);
};

describe('scheduledAtHelper', () => {
  describe('prefill round trip', () => {
    it('keeps the same instant in America/Sao_Paulo', () => {
      const result = runInTimeZone(
        'America/Sao_Paulo',
        `const input = toLocalDateTimeInput(${SAO_PAULO_SCHEDULED_AT});
         console.log(JSON.stringify({
           offset: new Date(${SAO_PAULO_SCHEDULED_AT} * 1000).getTimezoneOffset(),
           input,
           utc: formatToUTCString(input),
         }));`
      );

      expect(result.offset).toBe(180);
      expect(result.input).toBe('2026-10-30T09:30');
      expect(result.utc).toBe('2026-10-30T12:30:00.000Z');
      expect(Date.parse(result.utc) / 1000).toBe(SAO_PAULO_SCHEDULED_AT);
    });

    it('keeps the same instant in the test TZ', () => {
      const input = toLocalDateTimeInput(SAO_PAULO_SCHEDULED_AT);
      expect(Date.parse(formatToUTCString(input)) / 1000).toBe(
        SAO_PAULO_SCHEDULED_AT
      );
    });

    it('returns null for empty values', () => {
      expect(toLocalDateTimeInput(null)).toBeNull();
      expect(formatToUTCString('')).toBeNull();
    });
  });

  describe('isAtLeastMinutesAhead', () => {
    const now = Date.parse('2026-10-29T12:00:00.000Z');
    const localInput = offsetMinutes =>
      currentLocalDateTimeInput(now + offsetMinutes * 60000);

    it('accepts a time beyond the lead time', () => {
      expect(isAtLeastMinutesAhead(localInput(5), 2, now)).toBe(true);
      expect(isAtLeastMinutesAhead(localInput(2), 2, now)).toBe(true);
    });

    it('refuses a time inside the lead time or in the past', () => {
      expect(isAtLeastMinutesAhead(localInput(1), 2, now)).toBe(false);
      expect(isAtLeastMinutesAhead(localInput(0), 2, now)).toBe(false);
      expect(isAtLeastMinutesAhead(localInput(-60 * 26), 2, now)).toBe(false);
    });

    it('refuses empty or invalid values', () => {
      expect(isAtLeastMinutesAhead('', 2, now)).toBe(false);
      expect(isAtLeastMinutesAhead('not-a-date', 2, now)).toBe(false);
    });
  });
});
