import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { FUTURE_BIRTH_DATE_SENTENCE } from '../lib/birth-date-policy';
import { UNDER_13, yourDayRefusal } from './YourDay';

describe('the Your day page reads the birth date by the shared policy', () => {
  const zone = process.env.TZ;
  afterEach(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  // At 2026-11-09T02:00Z it is already the 9th in Madrid (03:00), but still the 8th at UTC-12.
  it.each(['Europe/Madrid', 'Pacific/Kiritimati', 'Asia/Bangkok', 'UTC', 'America/New_York', 'Pacific/Pago_Pago'])(
    'refuses the 13th birthday until it has begun everywhere, on a device in %s',
    (deviceZone) => {
      process.env.TZ = deviceZone;
      expect(yourDayRefusal('2013-11-09', new Date('2026-11-09T02:00:00Z'))).toBe(UNDER_13);
      expect(yourDayRefusal('2013-11-09', new Date('2026-11-09T11:59:59Z'))).toBe(UNDER_13);
      expect(yourDayRefusal('2013-11-09', new Date('2026-11-09T12:00:00Z'))).toBeNull();
      expect(yourDayRefusal('2013-11-08', new Date('2026-11-09T02:00:00Z'))).toBeNull();
    },
  );

  it('calls a date the future only past the calendar date at UTC+14', () => {
    expect(yourDayRefusal('2026-11-10', new Date('2026-11-09T09:59:59Z'))).toBe(FUTURE_BIRTH_DATE_SENTENCE);
    expect(yourDayRefusal('2026-11-10', new Date('2026-11-09T10:00:00Z'))).toBe(UNDER_13);
    expect(yourDayRefusal('1990-05-03', new Date('2026-11-09T02:00:00Z'))).toBeNull();
  });

  it('checks the converted date before it loads the calculation, not on the device clock', () => {
    const source = readFileSync(new URL('./YourDay.tsx', import.meta.url), 'utf8');
    const read = source.slice(source.indexOf('async function read('));
    const check = read.indexOf('yourDayRefusal(birthDate)');
    expect(check).toBeGreaterThan(read.indexOf('birthDate = entry.date'));
    expect(check).toBeLessThan(read.indexOf("import('./your-day/compute')"));
    expect(check).toBeLessThan(read.indexOf('computeYourDay('));
    expect(source).toMatch(/birthDateRefusal\(birthDate, now\)/u);
    expect(source).not.toMatch(/under13\(/u);
  });
});
