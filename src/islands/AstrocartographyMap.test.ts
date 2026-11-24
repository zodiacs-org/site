import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';
import AstrocartographyMap, { AcgBirthFields, mapBirthDate, quickDateCheck, under18, type DateCheck } from './AstrocartographyMap';
import { under18At } from '../lib/astrocartography/meanings';
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

  describe('asks for no birth time or birthplace until the date has passed the age check', () => {
    const fields = (check: DateCheck, extra: Record<string, unknown> = {}) => render(h('div', null, h(AcgBirthFields, {
      date: '2020-01-01', calendar: 'gregorian', check, time: '08:30',
      city: { name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal', lat: 38.72, lon: -9.14, tz: 'Europe/Lisbon' } as never,
      onDateChange: () => {}, onCalendarChange: () => {}, onTimeChange: () => {}, onCityChange: () => {}, ...extra,
    })));
    const input = (markup: string, id: string) => markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 'u'))?.[0] ?? '';

    it('locks the time and offers no birthplace search for a date under 13, and shows why at the date', () => {
      for (const check of [{ error: UNDER_13_SENTENCE }, { error: FUTURE_BIRTH_DATE_SENTENCE }, null] as ({ error: string } | null)[]) {
        const markup = fields(check);
        expect(input(markup, 'acg-time'), JSON.stringify(check)).toMatch(/\sdisabled(?:=""|\s|>)/u);
        expect(input(markup, 'acg-time')).not.toContain('08:30');
        expect(input(markup, 'acg-place')).toMatch(/\sdisabled(?:=""|\s|>)/u);
        // No combobox, no place list, and no birthplace held: the search never runs for a refused date.
        expect(markup).not.toContain('role="combobox"');
        expect(markup).not.toContain('Lisbon');
        // The reason is shown at the date field, as an alert (the sentence's first words: render escapes its apostrophe).
        if (check) expect(markup).toMatch(new RegExp(`class="field__error" role="alert">${check.error.split(/[’']/u)[0]}`, 'u'));
      }
    });

    it('opens the time and the birthplace search once the converted date is accepted', () => {
      const markup = fields({ date: '1990-05-03' }, { city: null, time: '' });
      expect(input(markup, 'acg-time')).not.toMatch(/\sdisabled/u);
      expect(markup).toContain('role="combobox"');
      expect(markup).not.toContain(UNDER_13_SENTENCE);
    });

    it('starts with the time and birthplace locked', () => {
      const markup = render(h(AstrocartographyMap, {}));
      expect(input(markup, 'acg-time')).toMatch(/\sdisabled/u);
      expect(markup).not.toContain('role="combobox"');
    });

    it('checks a Gregorian date at once, on the shared policy\'s UTC-12 day, and leaves a date written another way to be converted', async () => {
      expect(quickDateCheck('', 'gregorian')).toBeNull();
      expect(quickDateCheck('2013-11-10', 'gregorian', new Date('2026-11-10T11:59:59Z'))).toEqual({ error: UNDER_13_SENTENCE });
      expect(quickDateCheck('2013-11-10', 'gregorian', new Date('2026-11-10T12:00:00Z'))).toEqual({ date: '2013-11-10' });
      expect(quickDateCheck('2027-01-01', 'gregorian', new Date('2026-11-09T12:00:00Z'))).toEqual({ error: FUTURE_BIRTH_DATE_SENTENCE });
      for (const typed of [' 2020-01-01', '2020-1-1', '1900-01-01']) expect(quickDateCheck(typed, 'gregorian'), typed).toBeUndefined();
      expect(quickDateCheck('1990-05-03', 'julian')).toBeUndefined();
      // What is left to conversion is refused there, before the fields open.
      expect(await mapBirthDate(' 2020-01-01', 'gregorian', new Date('2026-11-09T12:00:00Z'))).toEqual({ error: UNDER_13_SENTENCE });
    });

    it('opens the fields only on the date check, and clears a time and birthplace when the date is refused', () => {
      const source = readFileSync(new URL('./AstrocartographyMap.tsx', import.meta.url), 'utf8');
      expect(source).not.toMatch(/<BirthFields\b/u);
      const fieldsSource = source.slice(source.indexOf('export function AcgBirthFields('), source.indexOf('export default function'));
      expect(fieldsSource).toMatch(/\{open\s*\?\s*<PlaceSearch id="acg-place"/u);
      expect(fieldsSource).toMatch(/disabled=\{!open\}/u);
      const component = source.slice(source.indexOf('export default function'));
      expect(component).toMatch(/if \(!refused\) return;\s*if \(time\) setTime\(''\);\s*if \(city\) setCity\(null\);/u);
      expect(component).toMatch(/disabled=\{!dateOpen \|\| !time \|\| !city \|\| busy\}/u);
    });
  });

  it('describes the map without saying the table lists every line, since the table gives only the Midheaven and IC', () => {
    const source = readFileSync(new URL('./AstrocartographyMap.tsx', import.meta.url), 'utf8');
    const map = /<svg\b[^>]*role="img"[^>]*aria-label="([^"]*)"/u.exec(source)?.[1];
    expect(map).toBe('World map with your planetary lines');
    const header = /<thead>(.*?)<\/thead>/su.exec(source)?.[1] ?? '';
    expect((header.match(/<th scope="col">/gu) ?? []).length).toBe(3);
    expect(header).toMatch(/Midheaven \(overhead\).*Lower heaven \(underfoot\)/su);
  });

  it('searches places over the whole index, so no request carries a letter of the birthplace or a checked town', () => {
    const source = readFileSync(new URL('./AstrocartographyMap.tsx', import.meta.url), 'utf8');
    const searches = source.match(/<PlaceSearch\b[^>]*>/gu) ?? [];
    expect(searches).toHaveLength(2);
    for (const search of searches) expect(search).toMatch(/\swholeIndex\s/u);
  });

  it('reads the under-18 care on the same day as the get_astrocartography tool', () => {
    for (const iso of ['2026-11-10T02:00:00Z', '2026-11-10T11:59:59Z', '2026-11-10T12:00:00Z']) {
      expect(under18('2008-11-10', new Date(iso)), iso).toBe(under18At('2008-11-10', new Date(iso)));
    }
  });
});
