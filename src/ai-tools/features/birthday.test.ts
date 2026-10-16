import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { birthdayData, birthdayInput, getBirthday, getSkyCalendar, skyCalendarData } from './birthday';

const localTime = createLocalTimeModule();
afterAll(() => localTime.dispose());
const NOW = new Date('2026-10-14T09:00:00Z');
const BANNED = /\blucky\b|best day|will bring|destin(?:y|ed)|\bfated?\b|you will\b/i;

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}
function expectPlain(value: unknown) {
  for (const text of strings(value)) expect(text).not.toMatch(BANNED);
}

describe('get_birthday', () => {
  it('states a mid-sign day as the page does', async () => {
    const { data, links } = await getBirthday({ date: '05-03' }, localTime, NOW);
    expect(birthdayData.parse(data)).toEqual(data);
    expect(data.label).toBe('3 May');
    expect(data.sign?.slug).toBe('taurus');
    expect(data.sign?.meaning.length).toBeGreaterThan(40);
    expect(data.signFrom).toBe('date');
    expect(data.cusp).toBeNull();
    expect(data.decan?.first).toBe(2);
    expect(data.decan?.rulers).toEqual(['Mercury']);
    expect(data.pageUrl).toBe('https://zodiacs.org/birthday/may-3/');
    expect(data.solarReturn).toBeNull();
    expect(links).toEqual([{ title: '3 May birthdays on Zodiacs', url: 'https://zodiacs.org/birthday/may-3/' }]);
    expectPlain({ data, links });
  });

  it('leaves the sign open on a cusp day without a year', async () => {
    const { data } = await getBirthday({ date: '03-20' }, localTime, NOW);
    expect(data.sign).toBeNull();
    expect(data.decan).toBeNull();
    expect(data.cusp?.signs).toEqual(['pisces', 'aries']);
    expect(data.cusp?.reading).toBeNull();
    expect(data.cusp?.splitYears).toBeGreaterThan(0);
    expect(data.cusp?.summary).toMatch(/Pisces or Aries/);
    expectPlain(data);
  });

  it('reads the birth year on a cusp day', async () => {
    const whole = await getBirthday({ birthDate: '1942-03-20' }, localTime, NOW);
    expect(whole.data.cusp?.reading).toMatchObject({ year: 1942, kind: 'whole', sign: 'pisces' });
    expect(whole.data.sign?.slug).toBe('pisces');
    expect(whole.data.signFrom).toBe('birth-year');

    const split = await getBirthday({ birthDate: '1945-03-20' }, localTime, NOW);
    expect(split.data.cusp?.reading).toMatchObject({ kind: 'split', before: 'pisces', after: 'aries', atUtc: '23:37' });
    expect(split.data.sign).toBeNull();

    // A birth time settles a split year from the computed degree: 23:37 UTC is the ingress.
    const before = await getBirthday({ birthDate: '1945-03-20', time: '20:00', zone: 'UTC' }, localTime, NOW);
    expect(before.data.sign?.slug).toBe('pisces');
    expect(before.data.signFrom).toBe('birth-time');
    const after = await getBirthday({ birthDate: '1945-03-20', time: '23:50', zone: 'UTC' }, localTime, NOW);
    expect(after.data.sign?.slug).toBe('aries');
  });

  it('handles 29 February', async () => {
    const { data } = await getBirthday({ date: '02-29' }, localTime, NOW);
    expect(data.label).toBe('29 February');
    expect(data.sign?.slug).toBe('pisces');
    expect(data.pageUrl).toBe('https://zodiacs.org/birthday/february-29/');

    const leap = await getBirthday({ birthDate: '2000-02-29' }, localTime, NOW);
    const sr = leap.data.solarReturn!;
    expect(sr.year).toBe(2026);
    expect(sr.instant.utc.slice(0, 7)).toMatch(/^2026-0[23]$/);
    await expect(getBirthday({ birthDate: '2001-02-29' }, localTime, NOW)).rejects.toThrow(RangeError);
  });

  it('gives a timed solar return on the birthplace clock', async () => {
    const { data, links } = await getBirthday({ birthDate: '1990-05-03', time: '14:30', zone: 'europe/london' }, localTime, NOW);
    const sr = data.solarReturn!;
    expect(sr.year).toBe(2026);
    expect(sr.timeKnown).toBe(true);
    expect(sr.range).toBeNull();
    const at = new Date(sr.instant.utc);
    expect(at.getUTCFullYear()).toBe(2026);
    expect(Math.abs(at.getTime() - Date.UTC(2026, 4, 3, 13, 30))).toBeLessThan(2 * 86_400_000);
    expect(sr.instant.local).toMatch(/^\w{3} \d May 2026, \d\d:\d\d$/);
    expect(sr.note).toMatch(/Europe\/London/);
    expect(data.sunAtBirth?.timeKnown).toBe(true);
    expect(links.map((link) => link.url)).toEqual(['https://zodiacs.org/birthday/may-3/', 'https://zodiacs.org/solar-return/']);
    expectPlain(data);
  });

  it('uses longitude to resolve historical local mean time', async () => {
    const west = await getBirthday({ birthDate: '1800-05-03', time: '12:00', zone: 'Europe/London', longitude: -3 }, localTime, NOW);
    const east = await getBirthday({ birthDate: '1800-05-03', time: '12:00', zone: 'Europe/London', longitude: 3 }, localTime, NOW);
    expect(west.data.sunAtBirth!.longitude).toBeGreaterThan(east.data.sunAtBirth!.longitude);
    expect(birthdayInput.safeParse({ birthDate: '1800-05-03', longitude: -3 }).success).toBe(false);
  });

  it('gives an untimed solar return with its range', async () => {
    const { data } = await getBirthday({ birthDate: '1990-05-03', year: 2030 }, localTime, NOW);
    const sr = data.solarReturn!;
    expect(sr.year).toBe(2030);
    expect(sr.timeKnown).toBe(false);
    expect(sr.instant.local).toMatch(/ UTC$/);
    expect(new Date(sr.instant.utc).getUTCFullYear()).toBe(2030);
    const { earliest, latest } = sr.range!;
    expect(Date.parse(earliest.utc)).toBeLessThan(Date.parse(sr.instant.utc));
    expect(Date.parse(latest.utc)).toBeGreaterThan(Date.parse(sr.instant.utc));
    expect(sr.note).toMatch(/noon UTC/);

    const zoned = await getBirthday({ birthDate: '1990-05-03', zone: 'Asia/Tokyo' }, localTime, NOW);
    expect(zoned.data.solarReturn!.instant.local).not.toMatch(/UTC$/);
    expect(zoned.data.solarReturn!.note).toMatch(/local noon/);
    const span = Date.parse(zoned.data.solarReturn!.range!.latest.utc) - Date.parse(zoned.data.solarReturn!.range!.earliest.utc);
    expect(span).toBeGreaterThan(20 * 3_600_000);
    expect(span).toBeLessThan(28 * 3_600_000);
  });

  it('refuses dates that do not exist and inputs that do not fit', async () => {
    await expect(getBirthday({ date: '02-30' }, localTime, NOW)).rejects.toThrow(RangeError);
    await expect(getBirthday({ date: '13-01' }, localTime, NOW)).rejects.toThrow(/not a calendar date/);
    await expect(getBirthday({ birthDate: '1990-04-31' }, localTime, NOW)).rejects.toThrow(RangeError);
    await expect(getBirthday({ birthDate: '1990-05-03', year: 1990 }, localTime, NOW)).rejects.toThrow(RangeError);
    await expect(getBirthday({ birthDate: '1990-05-03', time: '10:00', zone: 'Mars/Olympus' }, localTime, NOW)).rejects.toThrow(RangeError);
    expect(birthdayInput.safeParse({}).success).toBe(false);
    expect(birthdayInput.safeParse({ date: '05-03', birthDate: '1990-05-03' }).success).toBe(false);
    expect(birthdayInput.safeParse({ date: '05-03', year: 2027 }).success).toBe(false);
    expect(birthdayInput.safeParse({ birthDate: '1990-05-03', time: '10:00' }).success).toBe(false);
  });
});

describe('get_sky_calendar', () => {
  it('gives the English feed with what it contains and the next events', () => {
    const { data, links } = getSkyCalendar({}, NOW);
    expect(skyCalendarData.parse(data)).toEqual(data);
    expect(data.feedUrl).toBe('https://zodiacs.org/sky-calendar.ics');
    expect(data.subscribeUrl).toBe('webcal://zodiacs.org/sky-calendar.ics');
    expect(data.pageUrl).toBe('https://zodiacs.org/sky-calendar/');
    expect(data.contains.join(' ')).toMatch(/New moons.*Full moons.*eclipse.*Retrograde windows for Mercury/);
    expect(data.next).toHaveLength(3);
    const starts = data.next.map((event) => Date.parse(event.start));
    for (const start of starts) expect(start).toBeGreaterThan(NOW.getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(data.howTo.google).toContain(data.feedUrl);
    expect(data.howTo.apple).toContain(data.subscribeUrl);
    expect(links).toEqual([{ title: 'Sky calendar on Zodiacs', url: 'https://zodiacs.org/sky-calendar/' }]);
    expectPlain({ data, links });
  });

  it('gives a localized feed', () => {
    const { data } = getSkyCalendar({ language: 'es' }, NOW, 'https://zodiacs.org');
    expect(skyCalendarData.parse(data)).toEqual(data);
    expect(data.feedUrl).toBe('https://zodiacs.org/es/sky-calendar.ics');
    expect(data.subscribeUrl).toBe('webcal://zodiacs.org/es/sky-calendar.ics');
    expect(data.pageUrl).toBe('https://zodiacs.org/es/sky-calendar/');
    expect(data.next.every((event) => Date.parse(event.start) > NOW.getTime())).toBe(true);
    expect(data.next.some((event) => /Luna|retrógrado|eclipse/i.test(event.title))).toBe(true);
    expect(() => getSkyCalendar({ language: 'de' as never }, NOW)).toThrow();
  });
});

describe('a timed birth on a cusp date (review)', () => {
  it('takes the sign from the birth instant when the local date reaches into the next UTC date', async () => {
    // 23:00 on 19 January 2006 in Adak is 09:00 UTC on the 20th, after that day's ingress into Aquarius.
    const { data } = await getBirthday({ birthDate: '2006-01-19', time: '23:00', zone: 'America/Adak' }, localTime, NOW);
    expect(data.sign?.slug).toBe('aquarius');
    expect(data.signFrom).toBe('birth-time');
  });
});
