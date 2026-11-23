import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { mapBirthDate, under18 } from './AstrocartographyMap';
import { FUTURE_BIRTH_DATE_SENTENCE, UNDER_13_SENTENCE } from '../lib/birth-date-policy';

describe('the astrocartography page', () => {
  it('draws no map for a birth date less than 13 years before today, or still to come', async () => {
    const now = new Date('2026-11-09T12:00:00Z');
    expect(await mapBirthDate('2013-11-10', 'gregorian', now)).toEqual({ error: UNDER_13_SENTENCE });
    expect(await mapBirthDate('2027-01-01', 'gregorian', now)).toEqual({ error: FUTURE_BIRTH_DATE_SENTENCE });
    expect(await mapBirthDate('2013-11-09', 'gregorian', now)).toEqual({ date: '2013-11-09' });
    expect(await mapBirthDate('1990-05-03', 'gregorian', now)).toEqual({ date: '1990-05-03' });
  });

  describe('reads today as the shared policy does, at UTC-12, whatever the device says', () => {
    const zone = process.env.TZ;
    afterEach(() => {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    });

    // At 2026-11-10T02:00Z it is already the 10th at UTC+14, but still the 9th at UTC-12.
    it.each(['Pacific/Kiritimati', 'Asia/Bangkok', 'Europe/Madrid', 'UTC', 'America/New_York', 'Pacific/Pago_Pago'])('refuses the 13th birthday until it has begun everywhere, on a device in %s', async (deviceZone) => {
      process.env.TZ = deviceZone;
      expect(await mapBirthDate('2013-11-10', 'gregorian', new Date('2026-11-10T02:00:00Z'))).toEqual({ error: UNDER_13_SENTENCE });
      expect(await mapBirthDate('2013-11-10', 'gregorian', new Date('2026-11-10T11:59:59Z'))).toEqual({ error: UNDER_13_SENTENCE });
      expect(await mapBirthDate('2013-11-10', 'gregorian', new Date('2026-11-10T12:00:00Z'))).toEqual({ date: '2013-11-10' });
      expect(await mapBirthDate('2013-11-09', 'gregorian', new Date('2026-11-10T02:00:00Z'))).toEqual({ date: '2013-11-09' });
    });

    it('calls a date the future only once it is past the calendar date at UTC+14', async () => {
      process.env.TZ = 'Pacific/Pago_Pago';
      expect(await mapBirthDate('2026-11-11', 'gregorian', new Date('2026-11-10T09:59:59Z'))).toEqual({ error: FUTURE_BIRTH_DATE_SENTENCE });
      expect(await mapBirthDate('2026-11-11', 'gregorian', new Date('2026-11-10T10:00:00Z'))).toEqual({ error: UNDER_13_SENTENCE });
    });

    it('keeps the under-18 care until the 18th birthday has begun everywhere', () => {
      process.env.TZ = 'Pacific/Kiritimati';
      expect(under18('2008-11-10', new Date('2026-11-10T02:00:00Z'))).toBe(true);
      expect(under18('2008-11-10', new Date('2026-11-10T12:00:00Z'))).toBe(false);
    });
  });

  it('checks the converted Gregorian date at the boundary, for a typed date and an Old Style one', async () => {
    // Old Style is converted only before 1924, so a typed date stands for the modern case.
    expect(await mapBirthDate(' 2013-11-10', 'gregorian', new Date('2026-11-10T11:59:59Z'))).toEqual({ error: UNDER_13_SENTENCE });
    expect(await mapBirthDate(' 2013-11-10', 'gregorian', new Date('2026-11-10T12:00:00Z'))).toEqual({ date: '2013-11-10' });
    expect(await mapBirthDate('1900-01-01', 'julian', new Date('2026-11-10T12:00:00Z'))).toEqual({ date: '1900-01-13' });
  });

  it('reads the age on the date the map is drawn for, after a typed date is converted', async () => {
    const now = new Date('2026-11-09T12:00:00Z');
    // A leading space was compared as text before the date was converted, so it passed the check and drew a child's map.
    for (const typed of [' 2020-01-01', '  2020-01-01', '2020-01-01 ', '2020-1-1', '2020/01/01']) {
      expect(await mapBirthDate(typed, 'gregorian', now), typed).toEqual({ error: UNDER_13_SENTENCE });
    }
    expect(await mapBirthDate('2020-01-01', 'gregorian', now)).toEqual({ error: UNDER_13_SENTENCE });
    expect(await mapBirthDate(' 1990-05-03', 'gregorian', now)).toEqual({ date: '1990-05-03' });
    expect(await mapBirthDate('2013-11-09', 'gregorian', now)).toEqual({ date: '2013-11-09' });
  });

  it('checks the converted date before it loads the calculation', () => {
    const source = readFileSync(new URL('./AstrocartographyMap.tsx', import.meta.url), 'utf8');
    const draw = source.slice(source.indexOf('async function draw('));
    expect(draw.indexOf('mapBirthDate(date, calendar)')).toBeGreaterThan(0);
    expect(draw.indexOf('mapBirthDate(date, calendar)')).toBeLessThan(draw.indexOf("import('./astrocartography/compute')"));
    expect(draw.indexOf('mapBirthDate(date, calendar)')).toBeLessThan(draw.indexOf('computeAstrocartography('));
    expect(draw.slice(0, draw.indexOf('mapBirthDate(date, calendar)'))).not.toMatch(/birthDateRefusal\(date\)/u);
    expect(source).toMatch(/birthDateRefusal\(birthDate, now\)/u);
    expect(source).not.toMatch(/getFullYear|getMonth|getDate\(/u);
  });
});
