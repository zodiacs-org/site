import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { personalDay } from '../../ai-tools/personal/personal-day';
import { forbiddenClaim, type PersonalToolContext } from '../../ai-tools/personal/shared';
import { computeYourDay } from '../../islands/your-day/compute';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { MINOR_LEFT_OUT_HOUSES, UNTIMED_LIMIT, minorLeftOut, settledSunSign, type DayClock } from './day';
import { NATAL_HOUSE_THEME } from '../natal';
import { softenHealth, softenMinor } from '../../ai-tools/features/reading-guards';
import { transitLine } from '../transits';
import { MAJOR_ASPECT_ORDER, TRANSIT_BODY_ORDER } from '../engine/transit-scan-shared';
import { pointName } from './score';
import { parseYourDayShare, yourDayQuery, yourDayShareUrl, YOUR_DAY_SHARE_KEYS } from './share';

const NOW = new Date('2026-11-09T09:00:00Z');
/** The ticket's appetite check, with the longing, heat and pleasure a review found too. */
const MINOR_CHECK = /loving|appetite|longing|heat|pleasure|romant|attract/iu;
const context: PersonalToolContext = { now: NOW, localTime: createLocalTimeModule(), resolveZone: async (name) => name, origin: 'https://zodiacs.org' };
const ADULT = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };

describe('the /your-day/ page and get_personal_day', () => {
  it('give the same ranked list, Moon and theme for a fixed chart and day', async () => {
    for (const [date, zone] of [['2026-11-09', 'Europe/Madrid'], ['2026-11-12', 'Asia/Bangkok'], ['2027-02-01', 'America/New_York']] as const) {
      const tool = (await personalDay({ ...ADULT, currentZone: zone, date }, context)).data;
      const page = await computeYourDay({ birthDate: ADULT.birthDate, time: ADULT.time, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date, zone, today: '2026-11-09' });
      expect(page.contacts.length).toBeGreaterThan(0);
      expect(page.contacts).toEqual(tool.contacts);
      expect(page.moon).toEqual(tool.moon);
      expect(page.theme).toBe(tool.theme);
      expect(page.points).toEqual(tool.points);
      expect(page.middayUtc).toBe(tool.middayUtc);
      expect(page.limits).toEqual(tool.limits);
    }
  });

  it('agree without a birth time too, and say "today" only for today', async () => {
    const tool = (await personalDay({ birthDate: ADULT.birthDate, zone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, currentZone: 'Europe/London', date: '2026-11-10' }, context)).data;
    const page = await computeYourDay({ birthDate: ADULT.birthDate, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date: '2026-11-10', zone: 'Europe/London', today: '2026-11-09' });
    expect(page.contacts).toEqual(tool.contacts);
    expect(page.theme).toBe(tool.theme);
    expect(page.limits).toEqual(tool.limits);
    expect(page.points).not.toContain('Moon');
    expect(page.theme).toMatch(/^The strongest contact on Tue 10 Nov 2026 is /u);
    const today = await computeYourDay({ birthDate: ADULT.birthDate, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date: '2026-11-09', zone: 'Europe/London', today: '2026-11-09' });
    expect(today.theme).toMatch(/^Today's strongest contact is /u);
  });

  it('shares only the sky date and Sun sign, and nothing else about the birth', async () => {
    const tool = (await personalDay({ ...ADULT, currentZone: 'Europe/Madrid', date: '2026-11-09' }, context)).data;
    expect(tool.pageUrl).toBe('https://zodiacs.org/your-day/');
    expect(tool.shareUrl).toBe('https://zodiacs.org/share/your-day/?day=2026-11-09&s=taurus');
    const url = new URL(tool.shareUrl!);
    expect([...url.searchParams.keys()].every((key) => YOUR_DAY_SHARE_KEYS.includes(key))).toBe(true);
    expect(decodeURIComponent(url.href)).not.toMatch(/1990|05-03|08:30|40\.42|3\.7|Madrid/u);
    expect(parseYourDayShare(url.searchParams)).toEqual({ date: '2026-11-09', sun: 'taurus', ref: null });
  });
});

describe('a birth date the clock repeated or skipped, on the /your-day/ page and get_personal_day', () => {
  const PLACE = { birthZone: 'Pacific/Apia', latitude: -13.83, longitude: -171.76, date: '2026-11-09', zone: 'Europe/Madrid', today: '2026-11-09' };

  it('refuses a date the clock never showed (Apia, 30 December 2011) before anything is worked out, timed or not', async () => {
    for (const time of [undefined, '12:00']) await expect(computeYourDay({ ...PLACE, birthDate: '2011-12-30', time })).rejects.toThrow(RangeError);
    expect((await computeYourDay({ ...PLACE, birthDate: '2011-12-31' })).contacts.length).toBeGreaterThan(0);
  });

  it('reads the Sun over every pass of a date the clock showed twice before settling it', async () => {
    // Apia lived 4 July 1892 twice; the page and the tool read both passes and agree.
    const page = await computeYourDay({ ...PLACE, birthDate: '1892-07-04' });
    const tool = (await personalDay({ birthDate: '1892-07-04', zone: 'Pacific/Apia', latitude: -13.83, longitude: -171.76, currentZone: 'Europe/Madrid', date: '2026-11-09' }, context)).data;
    expect(page.sunSign).toBe('cancer');
    expect(tool.shareUrl).toBe('https://zodiacs.org/share/your-day/?day=2026-11-09&s=cancer');
    // A clock that showed its 23:59 twice, with the Sun entering Capricorn (2026-12-21T20:50:14Z) between the two
    // passes: the first pass alone would settle Sagittarius; the whole date leaves it open.
    const D = '2026-12-21';
    const at = (wall: string, utc: string) => ({ utc: new Date(utc), offsetMinutes: (Date.parse(`${D}T${wall}:00Z`) - Date.parse(utc)) / 60_000 });
    const calls: unknown[] = [];
    const repeating: DayClock = {
      prepareLocalTime: async () => {},
      resolveLocalToUtc: (_date, time, _zone, options) => {
        calls.push(options?.fold ?? 'earlier');
        if (time === '00:00') return at('00:00', '2026-12-20T14:00:00Z');
        return options?.fold === 'later' ? at('23:59', '2026-12-22T13:59:00Z') : at('23:59', '2026-12-21T13:59:00Z');
      },
    };
    const natal = { bodies: [{ body: 'Sun', lon: 269 }], timeKnown: false };
    expect(await settledSunSign(natal, { birthDate: D, zone: 'Etc/Repeating' }, repeating)).toBeNull();
    expect(calls).toEqual(['earlier', 'later']);
    // The same clock without the repeat settles Sagittarius.
    const once: DayClock = { ...repeating, resolveLocalToUtc: (date, time, zone) => repeating.resolveLocalToUtc(date, time, zone, {}) };
    expect(await settledSunSign(natal, { birthDate: D, zone: 'Etc/Repeating' }, once)).toBe('sagittarius');
  });
});

describe('the reading guards on the /your-day/ page and get_personal_day', () => {
  it('take the age on today, not on the day read, and leave the natal Venus out for someone under 18', async () => {
    // Born 17 years and 6 months before today (2026-11-09), reading a day 7 months ahead, when they are 18.
    const minor = { birthDate: '2009-05-09', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    for (const date of ['2027-06-09', '2027-06-01', '2027-06-17']) {
      const tool = (await personalDay({ ...minor, currentZone: 'Europe/Madrid', date }, context)).data;
      const page = await computeYourDay({ birthDate: minor.birthDate, time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      for (const reading of [tool, page]) {
        expect(reading.under18).toBe(true);
        expect(reading.limits).toContain(MINOR_NOTE);
        expect(reading.contacts.some((contact) => minorLeftOut(contact.planet, contact.point))).toBe(false);
        expect(JSON.stringify({ ...reading, limits: [] })).not.toMatch(MINOR_CHECK);
      }
      expect(page.contacts).toEqual(tool.contacts);
      expect(page.limits).toEqual(tool.limits);
    }
    // The same day read for an adult still lists the natal Venus when it is touched.
    const adult = await computeYourDay({ birthDate: '1990-05-03', time: '08:30', birthZone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, date: '2027-06-09', zone: 'Europe/Madrid', today: '2026-11-09' });
    expect(adult.under18).toBe(false);
  }, 60_000);

  it('keep someone born on 1 March under 18 on 29 February of the year they turn 18', async () => {
    const leapDay = new Date('2028-02-29T12:00:00Z');
    const born = { birthDate: '2010-03-01', time: '08:30', zone: 'UTC', latitude: 40.42, longitude: -3.7 };
    const tool = (await personalDay({ ...born, currentZone: 'UTC' }, { ...context, now: leapDay })).data;
    const page = await computeYourDay({ birthDate: born.birthDate, time: born.time, birthZone: born.zone, latitude: born.latitude, longitude: born.longitude, date: '2028-02-29', zone: 'UTC', today: '2028-02-29' });
    for (const reading of [tool, page]) {
      expect(reading.under18).toBe(true);
      expect(reading.limits).toContain(MINOR_NOTE);
    }
    // The next day, 1 March, they are 18.
    const birthday = await computeYourDay({ birthDate: born.birthDate, time: born.time, birthZone: born.zone, latitude: born.latitude, longitude: born.longitude, date: '2028-03-01', zone: 'UTC', today: '2028-03-01' });
    expect(birthday.under18).toBe(false);
  });

  it('leave out every contact and house line a minor could see that the check catches', () => {
    let kept = 0;
    for (const mover of TRANSIT_BODY_ORDER) for (const point of [...TRANSIT_BODY_ORDER, 'ASC', 'MC'] as const) for (const aspect of MAJOR_ASPECT_ORDER) {
      if (minorLeftOut(mover, point)) continue;
      kept += 1;
      expect(softenHealth(softenMinor(transitLine(mover, aspect, pointName(point)))), `${mover} ${aspect} ${point}`).not.toMatch(MINOR_CHECK);
    }
    expect(kept).toBeGreaterThan(250);
    for (let house = 1; house <= 12; house += 1) {
      if (MINOR_LEFT_OUT_HOUSES.includes(house)) continue;
      expect(softenHealth(softenMinor(NATAL_HOUSE_THEME[house])), `house ${house}`).not.toMatch(MINOR_CHECK);
    }
  });

  it('leave the Moon\'s fifth-house line out for a minor, on the page and in the tool', async () => {
    const minor = { birthDate: '2010-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    let fifth = 0;
    for (let day = 1; day <= 30; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const adult = await computeYourDay({ birthDate: '1990-05-03', time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      const page = await computeYourDay({ birthDate: minor.birthDate, time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      const tool = (await personalDay({ ...minor, currentZone: 'Europe/Madrid', date }, context)).data;
      expect(page.moon).toEqual(tool.moon);
      expect(page.moon.line).not.toMatch(MINOR_CHECK);
      if (adult.moon.house?.number === 5) { fifth += 1; expect(page.moon.house).toBeNull(); }
    }
    expect(fifth).toBeGreaterThan(0);
  }, 60_000);

  it('never read the sixth house as health', async () => {
    let sixth = 0;
    for (let day = 1; day <= 30; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const page = await computeYourDay({ birthDate: ADULT.birthDate, time: ADULT.time, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      if (page.moon.house?.number !== 6) continue;
      sixth += 1;
      const tool = (await personalDay({ ...ADULT, currentZone: 'Europe/Madrid', date }, context)).data;
      expect(page.moon).toEqual(tool.moon);
      expect(page.moon.house.line).toBe('The Moon is passing through your sixth house: routines, craft, and the shape of the day.');
      expect(JSON.stringify(page)).not.toMatch(/health/iu);
      expect(JSON.stringify(tool)).not.toMatch(/health/iu);
    }
    expect(sixth).toBeGreaterThan(0);
  }, 60_000);
});

describe('the your-day share link', () => {
  const ok = { day: '2026-11-09', s: 'taurus' };
  it('reads only its own keys (day, s, optional ref), each once, from fixed vocabularies', () => {
    expect(parseYourDayShare(new URLSearchParams(ok))).toEqual({ date: '2026-11-09', sun: 'taurus', ref: null });
    expect(parseYourDayShare(new URLSearchParams({ ...ok, ref: 'chatgpt' }))?.ref).toBe('chatgpt');
    for (const bad of [
      { ...ok, day: '2026-02-30' }, { ...ok, day: '1990-5-3' }, { ...ok, s: 'ophiuchus' }, { ...ok, s: 'Taurus' },
      { ...ok, p: 'mars', a: 'square', n: 'asc', c: '75' }, { ...ok, m: 'leo' }, { ...ok, r: 'libra' },
      { ...ok, ref: 'x' }, { ...ok, t: '08:30' }, { ...ok, lat: '40' },
    ]) expect(parseYourDayShare(new URLSearchParams(bad)), JSON.stringify(bad)).toBeNull();
    expect(parseYourDayShare(new URLSearchParams({ day: '2026-11-09' }))).toBeNull();
    expect(parseYourDayShare(new URLSearchParams('day=2026-11-09&day=2026-11-10&s=taurus'))).toBeNull();
  });

  it('round-trips and refuses values outside the vocabularies', () => {
    const share = parseYourDayShare(new URLSearchParams(ok))!;
    expect(parseYourDayShare(new URLSearchParams(yourDayQuery(share)))).toEqual(share);
    expect(yourDayShareUrl('https://zodiacs.org', { date: '2026-11-09', sun: 'ophiuchus' })).toBeNull();
    expect(yourDayShareUrl('https://zodiacs.org', { date: '2026-11-09', sun: null })).toBeNull();
    expect(yourDayShareUrl('https://zodiacs.org', { date: '2026-05-03', sun: 'taurus' })).toBe('https://zodiacs.org/share/your-day/?day=2026-05-03&s=taurus');
  });
});

describe('the /your-day/ page copy', () => {
  it('passes the copy rule and has no dashes', () => {
    const text = ['src/pages/your-day/index.astro', 'src/islands/YourDay.tsx'].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(text).toContain(UNTIMED_LIMIT);
    expect(forbiddenClaim(text.replace(/<style[\s\S]*?<\/style>/gu, ''))).toBeNull();
    expect(text).not.toMatch(/crypto|token|blockchain|market|invest|stock/iu);
  });
});
