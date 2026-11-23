import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { personalDay } from '../../ai-tools/personal/personal-day';
import { birthDayEnds, forbiddenClaim, type PersonalToolContext } from '../../ai-tools/personal/shared';
import { computeYourDay } from '../../islands/your-day/compute';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { MINOR_LEFT_OUT_HOUSES, UNTIMED_LIMIT, castDayNatal, localDayBounds, minorLeftOut, readPersonalDay, settledSunSign, type DayClock } from './day';
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { NATAL_HOUSE_THEME } from '../natal';
import { softenHealth, softenMinor } from '../../ai-tools/features/reading-guards';
import { transitLine } from '../transits';
import { MAJOR_ASPECT_ORDER, TRANSIT_BODY_ORDER } from '../engine/transit-scan-shared';
import { pointName } from './score';
import { parseYourDayShare, yourDayQuery, yourDayShareUrl, YOUR_DAY_SHARE_KEYS } from './share';

const NOW = new Date('2026-11-09T09:00:00Z');
/** The ticket's appetite check, with the longing, heat and pleasure a review found too. */
const MINOR_CHECK = /loving|appetite|longing|heat|pleasure|romant|attract/iu;
const context: PersonalToolContext = { now: NOW, localTime: createLocalTimeModule(), resolveZone: async (name) => name, origin: 'https://zodiacs.org', pageOn: true };
const ADULT = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };

/**
 * A clock that changes once, at `change`, from `before` to `after` minutes east, resolved as the site's resolver
 * resolves: a wall time it showed twice at the pass asked for, one it skipped moved forward by the jump. `calls`
 * collects the pass asked for on each call.
 */
function steppedClock(change: string, before: number, after: number, calls: unknown[] = []): DayClock {
  const at = Date.parse(change);
  return {
    prepareLocalTime: async () => {},
    resolveLocalToUtc: (date, time, _zone, options) => {
      calls.push(options?.fold ?? 'earlier');
      const wall = Date.parse(`${date}T${time}:00Z`);
      const passes = [wall - before * 60_000, wall - after * 60_000].filter((utc, index) => (index === 0 ? utc < at : utc >= at));
      // A skipped or repeated wall time carries the change behind it, as the engine's does.
      const transition = { at: new Date(at).toISOString(), offsetBeforeMinutes: before, offsetAfterMinutes: after };
      if (passes.length === 0) return { utc: new Date(wall - before * 60_000), offsetMinutes: after, flags: ['dst-gap'], transition };
      const utc = options?.fold === 'later' ? Math.max(...passes) : Math.min(...passes);
      return { utc: new Date(utc), offsetMinutes: utc < at ? before : after, flags: passes.length > 1 ? ['dst-fold'] : [], ...(passes.length > 1 ? { transition } : {}) };
    },
  };
}

describe('the /your-day/ page and get_personal_day', () => {
  it('give the same ranked list, Moon and theme for a fixed chart and day', async () => {
    for (const [date, zone] of [['2026-11-09', 'Europe/Madrid'], ['2026-11-12', 'Asia/Bangkok'], ['2027-02-01', 'America/New_York']] as const) {
      const tool = (await personalDay({ ...ADULT, currentZone: zone, date }, context)).data;
      const page = await computeYourDay({ birthDate: ADULT.birthDate, time: ADULT.time, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date, zone, today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
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
    const page = await computeYourDay({ birthDate: ADULT.birthDate, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date: '2026-11-10', zone: 'Europe/London', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
    expect(page.contacts).toEqual(tool.contacts);
    expect(page.theme).toBe(tool.theme);
    expect(page.limits).toEqual(tool.limits);
    expect(page.points).not.toContain('Moon');
    expect(page.theme).toMatch(/^The strongest contact on Tue 10 Nov 2026 is /u);
    const today = await computeYourDay({ birthDate: ADULT.birthDate, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date: '2026-11-09', zone: 'Europe/London', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
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
  const PLACE = { birthZone: 'Pacific/Apia', latitude: -13.83, longitude: -171.76, date: '2026-11-09', zone: 'Europe/Madrid', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') };

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
    // A clock that turned back from 00:00 on 22 December to 00:00 on the 21st, so it showed the 21st twice, with the
    // Sun entering Capricorn (2026-12-21T20:50:14Z) during the second pass: the first pass alone would settle
    // Sagittarius; the whole date leaves it open.
    const D = '2026-12-21';
    const natal = { bodies: [{ body: 'Sun', lon: 269 }], timeKnown: false };
    const calls: unknown[] = [];
    const repeating = steppedClock('2026-12-21T14:00:00Z', 600, -840, calls);
    expect(await settledSunSign(natal, { birthDate: D, zone: 'Etc/Repeating' }, repeating)).toBeNull();
    expect(calls).toContain('later');
    // The same date on a clock that kept UTC+10 settles Sagittarius.
    expect(await settledSunSign(natal, { birthDate: D, zone: 'Etc/Steady' }, steppedClock('2026-12-21T14:00:00Z', 600, 600))).toBe('sagittarius');
  });

  it('end a birth date where the clock jumped out of it, not partway into the next date', async () => {
    // St. John's went from 23:00 on 2 May 1920 straight to 00:00 on 3 May: the page and the tool read the date to
    // 02:30:51 UTC, not to its skipped 23:59 read forward by the jump (03:30:51 UTC).
    const page = await computeYourDay({ ...PLACE, birthZone: 'America/St_Johns', latitude: 47.56, longitude: -52.71, birthDate: '1920-05-02' });
    const tool = (await personalDay({ birthDate: '1920-05-02', zone: 'America/St_Johns', latitude: 47.56, longitude: -52.71, currentZone: 'Europe/Madrid', date: '2026-11-09' }, context)).data;
    expect(page.sunSign).toBe('taurus');
    expect(tool.shareUrl).toBe('https://zodiacs.org/share/your-day/?day=2026-11-09&s=taurus');
    const ends = await birthDayEnds({ birthDate: '1920-05-02', zone: 'America/St_Johns' }, context.localTime);
    expect(ends.map((end) => end.toISOString())).toEqual(['1920-05-02T03:30:52.000Z', '1920-05-03T02:30:51.000Z']);
    // The same jump with the Sun entering Capricorn (2026-12-21T20:50:14Z) in the hour after it: 23:00 on the 21st
    // became 00:00 on the 22nd at 20:30 UTC, so the whole date is Sagittarius. Read to its skipped 23:59, it was not.
    const natal = { bodies: [{ body: 'Sun', lon: 269 }], timeKnown: false };
    expect(await settledSunSign(natal, { birthDate: '2026-12-21', zone: 'Etc/Jump' }, steppedClock('2026-12-21T20:30:00Z', 150, 210))).toBe('sagittarius');
  });

  it('start a birth date where the clock jumped into it, when its 00:00 was skipped partway through the jump', async () => {
    // As Toronto went from 23:30 on 30 March 1919 to 00:30 on 31 March: here 23:30 on 21 December became 00:30 on
    // the 22nd at 20:30 UTC, before the Sun entered Capricorn at 20:50:14 UTC, so the 22nd began in Sagittarius.
    // Read from its skipped 00:00 moved forward by the jump (21:00 UTC), it would settle Capricorn.
    const natal = { bodies: [{ body: 'Sun', lon: 271 }], timeKnown: false };
    expect(await settledSunSign(natal, { birthDate: '2026-12-22', zone: 'Etc/Jump' }, steppedClock('2026-12-21T20:30:00Z', 180, 240))).toBeNull();
    const ends = await birthDayEnds({ birthDate: '1919-03-31', zone: 'America/Toronto' }, context.localTime);
    expect(ends[0].toISOString()).toBe('1919-03-31T04:30:00.000Z');
  });

  it('start and end a birth date at a clock change within a minute, to the second', async () => {
    // Accra left local mean time at 00:00:52 UTC on 2 November 1915: at 0.25 degrees west the birthplace clock went
    // from 23:59:52 on 1 November to 00:00:52 on 2 November, so the 2nd starts and the 1st ends there, not at 00:01.
    const accra = async (birthDate: string) => (await birthDayEnds({ birthDate, zone: 'Africa/Accra', latitude: 5.55, longitude: -0.25 }, context.localTime)).map((end) => end.toISOString());
    expect(await accra('1915-11-02')).toEqual(['1915-11-02T00:00:52.000Z', '1915-11-02T23:59:59.000Z']);
    expect(await accra('1915-11-01')).toEqual(['1915-11-01T00:01:00.000Z', '1915-11-02T00:00:51.000Z']);
    // The same kind of change four seconds before the Sun entered Capricorn (20:50:14 UTC): at 20:50:10 UTC 23:59:50
    // on 21 December became 00:00:50 on the 22nd. The 21st is Sagittarius to its end and the 22nd begins in it; read
    // to whole minutes, both ends fall after the ingress.
    const clock = steppedClock('2026-12-21T20:50:10Z', 189 + 40 / 60, 190 + 40 / 60);
    expect(await settledSunSign({ bodies: [{ body: 'Sun', lon: 269 }], timeKnown: false }, { birthDate: '2026-12-21', zone: 'Etc/Jump' }, clock)).toBe('sagittarius');
    expect(await settledSunSign({ bodies: [{ body: 'Sun', lon: 271 }], timeKnown: false }, { birthDate: '2026-12-22', zone: 'Etc/Jump' }, clock)).toBeNull();
  });

  it('read a birth date given without a zone from 00:00 at UTC+16 to 23:59:59 at UTC-16', async () => {
    const ends = await birthDayEnds({ birthDate: '2026-11-09' }, context.localTime);
    expect(ends.map((end) => end.toISOString())).toEqual(['2026-11-08T08:00:00.000Z', '2026-11-10T15:59:59.000Z']);
  });
});

describe('the reading guards on the /your-day/ page and get_personal_day', () => {
  it('take the age on today, not on the day read, and leave the natal Venus out for someone under 18', async () => {
    // Born 17 years and 6 months before today (2026-11-09), reading a day 7 months ahead, when they are 18.
    const minor = { birthDate: '2009-05-09', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    for (const date of ['2027-06-09', '2027-06-01', '2027-06-17']) {
      const tool = (await personalDay({ ...minor, currentZone: 'Europe/Madrid', date }, context)).data;
      const page = await computeYourDay({ birthDate: minor.birthDate, time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
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
    const adult = await computeYourDay({ birthDate: '1990-05-03', time: '08:30', birthZone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, date: '2027-06-09', zone: 'Europe/Madrid', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
    expect(adult.under18).toBe(false);
  }, 60_000);

  it('keep someone born on 1 March under 18 on 29 February of the year they turn 18', async () => {
    const leapDay = new Date('2028-02-29T12:00:00Z');
    const born = { birthDate: '2010-03-01', time: '08:30', zone: 'UTC', latitude: 40.42, longitude: -3.7 };
    const tool = (await personalDay({ ...born, currentZone: 'UTC' }, { ...context, now: leapDay })).data;
    const page = await computeYourDay({ birthDate: born.birthDate, time: born.time, birthZone: born.zone, latitude: born.latitude, longitude: born.longitude, date: '2028-02-29', zone: 'UTC', today: '2028-02-29', now: new Date('2028-02-29T12:00:00Z') });
    for (const reading of [tool, page]) {
      expect(reading.under18).toBe(true);
      expect(reading.limits).toContain(MINOR_NOTE);
    }
    // The next day, 1 March, they are 18.
    const birthday = await computeYourDay({ birthDate: born.birthDate, time: born.time, birthZone: born.zone, latitude: born.latitude, longitude: born.longitude, date: '2028-03-01', zone: 'UTC', today: '2028-03-01', now: new Date('2028-03-01T12:00:00Z') });
    expect(birthday.under18).toBe(false);
  });

  describe('take the age on the calendar date at UTC-12, whatever clock the day is read on', () => {
    // Born 10 November 2008 in Madrid. At 2026-11-10T02:00Z it is already the 10th in Kiritimati (UTC+14) and Madrid,
    // but still the 9th in Los Angeles and at UTC-12: they may live where they are 17, so the care holds everywhere.
    const born = { birthDate: '2008-11-10', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    const EARLY = new Date('2026-11-10T02:00:00Z');
    const LATE = new Date('2026-11-10T12:00:00Z');
    const tool = async (now: Date, currentZone: string) => (await personalDay({ ...born, currentZone, date: '2026-11-10' }, { ...context, now })).data;
    const page = (now: Date, zone: string, today: string) => computeYourDay({ birthDate: born.birthDate, time: born.time, birthZone: born.zone, latitude: born.latitude, longitude: born.longitude, date: '2026-11-10', zone, today, now });

    it('in get_personal_day, from Los Angeles and from Kiritimati alike', async () => {
      const losAngeles = await tool(EARLY, 'America/Los_Angeles');
      const kiritimati = await tool(EARLY, 'Pacific/Kiritimati');
      for (const reading of [losAngeles, kiritimati]) {
        expect(reading.under18).toBe(true);
        expect(reading.limits).toContain(MINOR_NOTE);
        expect(reading.contacts.some((contact) => minorLeftOut(contact.planet, contact.point))).toBe(false);
      }
      expect((await tool(new Date('2026-11-10T11:59:59Z'), 'Pacific/Kiritimati')).under18).toBe(true);
      expect((await tool(LATE, 'Pacific/Kiritimati')).under18).toBe(false);
      expect((await tool(LATE, 'America/Los_Angeles')).under18).toBe(false);
    }, 60_000);

    it('on the page, on a device in any zone', async () => {
      for (const [zone, today] of [['Pacific/Kiritimati', '2026-11-10'], ['Europe/Madrid', '2026-11-10'], ['America/Los_Angeles', '2026-11-09'], ['UTC', '2026-11-10']] as const) {
        const early = await page(EARLY, zone, today);
        expect(early.under18, zone).toBe(true);
        expect(early.contacts.some((contact) => minorLeftOut(contact.planet, contact.point)), zone).toBe(false);
        expect((await page(LATE, zone, today)).under18, zone).toBe(false);
      }
    }, 60_000);
  });

  it('read a day whose midnight the clock jumped over from the jump, on both resolvers', async () => {
    // Toronto, 31 March 1919: the clocks went from 23:30 EST on the 30th to 00:30 EDT on the 31st (04:30 UTC). The
    // resolver moves the skipped 00:00 to 00:30 EDT (05:00 UTC); the civil day began half an hour before that.
    const site: DayClock = { prepareLocalTime, resolveLocalToUtc };
    const natal = castDayNatal({ birthDate: '1900-01-01', zone: 'America/Toronto' }, context.localTime);
    for (const clock of [context.localTime, site]) {
      const bounds = await localDayBounds('1919-03-31', 'America/Toronto', clock);
      expect(bounds!.map((at) => at.toISOString())).toEqual(['1919-03-31T04:30:00.000Z', '1919-04-01T04:00:00.000Z']);
      const day = await readPersonalDay(natal, { birthDate: '1900-01-01', date: '1919-03-31', zone: 'America/Toronto', now: new Date('1919-03-31T12:00:00Z') }, clock);
      expect(day.middayUtc).toBe('1919-03-31T16:15:00.000Z');
    }
    // An ordinary day keeps its two midnights, and a day the clock skipped (Apia, 30 December 2011) is refused.
    expect((await localDayBounds('2026-11-09', 'Europe/Madrid', site))!.map((at) => at.toISOString())).toEqual(['2026-11-08T23:00:00.000Z', '2026-11-09T23:00:00.000Z']);
    expect(await localDayBounds('2011-12-30', 'Pacific/Apia', site)).toBeNull();
    await expect(readPersonalDay(natal, { birthDate: '1900-01-01', date: '2011-12-30', zone: 'Pacific/Apia', now: NOW }, site)).rejects.toThrow(RangeError);
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
      const adult = await computeYourDay({ birthDate: '1990-05-03', time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
      const page = await computeYourDay({ birthDate: minor.birthDate, time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
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
      const page = await computeYourDay({ birthDate: ADULT.birthDate, time: ADULT.time, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09', now: new Date('2026-11-09T12:00:00Z') });
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
