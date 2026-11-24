import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { retrogradeForMe } from '../../ai-tools/personal/retrograde-for-me';
import { forbiddenClaim } from '../../ai-tools/personal/shared';
import { PeriodCard } from '../../islands/RetrogradeForYou';
import { computeRetrogradeForYou, prepareLocalTime, retrogradeForYouRefusal, type RetrogradeForYouInput } from '../../islands/retrograde-for-you/compute';
import sky from '../../data/sky.json';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { CONTACT_LINE, POINT_NAMES, RETROGRADE_ASK, RETROGRADE_LINE, natalBasis } from './reading';
import { loopsFromSky } from './sky';
import { parseRetrogradeForYouShare, publishedRetrogradeDate, retrogradeForYouQuery } from './share';
import { REPEATED_BIRTH_TIME, SKIPPED_BIRTH_TIME, SkippedBirthTimeError } from '../vedic-signs/clock';
import { executeAiTool } from '../../ai-tools/tools';

const clock = createLocalTimeModule();
const MINUTES = 60_000;
const MADRID = { lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' };

async function both(birth: { birthDate: string; time?: string }, now: Date, zone: string) {
  const { mcp, page } = await bothWithLinks(birth, now, zone);
  return { mcp: mcp.data, page };
}

async function bothWithLinks(birth: { birthDate: string; time?: string }, now: Date, zone: string) {
  const mcp = await retrogradeForMe(
    { birthDate: birth.birthDate, ...(birth.time ? { time: birth.time } : {}), zone: MADRID.tz, latitude: MADRID.lat, longitude: MADRID.lon, currentZone: zone },
    { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true },
  );
  if ('refused' in mcp) throw new Error(mcp.refused);
  await prepareLocalTime(birth.birthDate, MADRID.tz);
  const input: RetrogradeForYouInput = { birthDate: birth.birthDate, birthTime: birth.time ?? null, place: MADRID, planets: ['Mercury', 'Venus', 'Mars'], now, zone };
  const page = computeRetrogradeForYou(input);
  if (page.refused) throw new Error('refused');
  return { mcp, page };
}

describe('the /retrogrades/for-you/ page and get_retrograde_for_me', () => {
  for (const [label, birth, now, zone] of [
    ['a timed chart with Mercury and Venus retrograde', { birthDate: '1990-05-03', time: '08:30' }, new Date('2026-11-09T09:00:00Z'), 'Europe/Madrid'],
    ['an untimed chart in a post-shadow', { birthDate: '1990-05-03' }, new Date('2026-11-20T12:00:00Z'), 'Asia/Bangkok'],
    ['a timed chart with every planet direct', { birthDate: '1984-12-14', time: '23:10' }, new Date('2028-03-20T00:00:00Z'), 'America/New_York'],
  ] as const) {
    it(`give the same periods for ${label}`, async () => {
      const { mcp, page } = await both(birth, now, zone);
      expect(page.unavailable).toEqual([]);
      expect(page.periods).toHaveLength(mcp.periods.length);
      page.periods.forEach((ours, index) => {
        const theirs = mcp.periods[index];
        for (const key of ['stationRetrograde', 'stationDirect', 'preShadowStart', 'postShadowEnd'] as const) {
          expect(Math.abs(Date.parse(ours[key]!.utc) - Date.parse(theirs[key]!.utc)), `${ours.planet} ${key}`).toBeLessThanOrEqual(5 * MINUTES);
        }
        expect(ours.stationRetrograde.degree).toBeCloseTo(theirs.stationRetrograde.degree, 1);
        expect(ours.stationDirect.degree).toBeCloseTo(theirs.stationDirect.degree, 1);
        const same = ({ planet, status, retrogradeNow, signs, housesCountedFrom, houses, contacts, possibleContacts, reading, confidenceLabel }: typeof ours | typeof theirs) =>
          ({ planet, status, retrogradeNow, signs, housesCountedFrom, houses, contacts, possibleContacts, reading, confidenceLabel });
        expect(same(ours)).toEqual(same(theirs));
        expect(ours.next === null).toBe(theirs.next === null);
        if (ours.next && theirs.next) {
          expect(Math.abs(Date.parse(ours.next.stationRetrograde) - Date.parse(theirs.next.stationRetrograde))).toBeLessThanOrEqual(5 * MINUTES);
          expect(Math.abs(Date.parse(ours.next.stationDirect) - Date.parse(theirs.next.stationDirect))).toBeLessThanOrEqual(5 * MINUTES);
        }
        expect(ours.shareQuery).not.toBeNull();
        expect(theirs.shareUrl).toBe(`https://zodiacs.org/share/retrograde-for-you/?${ours.shareQuery}`);
      });
      expect(page.summary).toBe(mcp.summary);
      expect(page.limits).toEqual(mcp.limits.filter((line) => !line.startsWith('Today is read')));
    });
  }

  it('says when the committed sky data does not reach a planet’s next loop', () => {
    // Mars's last window in the data runs February to May 2029; its next starts past 2030.
    const span = sky as Parameters<typeof loopsFromSky>[2];
    expect(loopsFromSky('Mars', new Date('2030-06-01T00:00:00Z'), span, () => 0)).toBeNull();
    expect(loopsFromSky('Mercury', new Date('2030-06-01T00:00:00Z'), span, () => 0)).not.toBeNull();
  });

  it('still shows the post-shadow of a planet’s last published loop when no later loop is in the data', async () => {
    // Mars's last published loop: 2029-02-14 to 2029-05-05, post-shadow to 2029-07-09. Venus's: 2029-12-16 to 2030-01-26, post-shadow to 2030-02-27.
    const span = sky as Parameters<typeof loopsFromSky>[2];
    for (const [planet, now, retro, postShadowEnd] of [
      ['Mars', '2029-06-01T00:00:00Z', '2029-02-14', '2029-07-09'],
      ['Venus', '2030-02-01T00:00:00Z', '2029-12-16', '2030-02-27'],
    ] as const) {
      const loops = loopsFromSky(planet, new Date(now), span, () => 0);
      expect(loops, `${planet} ${now}`).not.toBeNull();
      expect(loops!.retrogradeNow).toBe(false);
      expect(loops!.current).toBeNull();
      expect(loops!.previous!.stationRetrograde.at.toISOString().slice(0, 10)).toBe(retro);
      expect(loops!.previous!.postShadowEnd!.toISOString().slice(0, 10)).toBe(postShadowEnd);
      await prepareLocalTime('1990-05-03', MADRID.tz);
      const page = computeRetrogradeForYou({ birthDate: '1990-05-03', birthTime: '08:30', place: MADRID, planets: [planet], now: new Date(now), zone: 'UTC' });
      if (page.refused) throw new Error('refused');
      expect(page.unavailable).toEqual([]);
      expect(page.periods).toHaveLength(1);
      expect(page.periods[0]).toMatchObject({ planet, status: 'post-shadow', retrogradeNow: false, next: null, nextLine: null });
      expect(page.periods[0].stationRetrograde.date).toBe(retro);
      expect(page.periods[0].postShadowEnd!.date).toBe(postShadowEnd);
      expect(page.periods[0].reading).toContain(`is in the post-shadow until`);
      expect(page.periods[0].shareQuery).toContain(`s=${retro}`);
    }
    // Once the last loop's post-shadow is over, the page says the data ends rather than guess.
    expect(loopsFromSky('Mars', new Date('2029-07-10T00:00:00Z'), span, () => 0)).toBeNull();
  });

  it('refuses a birth date less than 13 years ago and computes nothing', async () => {
    await prepareLocalTime('2016-05-03', MADRID.tz);
    expect(computeRetrogradeForYou({ birthDate: '2016-05-03', birthTime: null, place: MADRID, planets: ['Mercury'], now: new Date('2026-11-09T09:00:00Z'), zone: 'UTC' })).toEqual({ refused: 'under-13' });
  });

  // The shared policy reads today at UTC-12: at 2026-11-09T09:00Z it is the 9th in UTC and in
  // every zone the page might be told it is in, but still the 8th at UTC-12.
  it.each(['UTC', 'Pacific/Kiritimati', 'Asia/Bangkok', 'Europe/Madrid', 'America/New_York', 'Pacific/Pago_Pago'])(
    'refuses the 13th birthday until it has begun everywhere, read in %s',
    async (zone) => {
      await prepareLocalTime('2013-11-09', MADRID.tz);
      const page = (now: string) => computeRetrogradeForYou({ birthDate: '2013-11-09', birthTime: null, place: MADRID, planets: ['Mercury'], now: new Date(now), zone });
      expect(page('2026-11-09T09:00:00Z')).toEqual({ refused: 'under-13' });
      expect(page('2026-11-09T11:59:59Z')).toEqual({ refused: 'under-13' });
      expect(page('2026-11-09T12:00:00Z').refused).toBeUndefined();
      expect(retrogradeForYouRefusal('2013-11-09', new Date('2026-11-09T11:59:59Z'))).toEqual({ refused: 'under-13' });
      expect(retrogradeForYouRefusal('2013-11-08', new Date('2026-11-09T09:00:00Z'))).toBeNull();
    },
  );

  it('calls a date the future only past the calendar date at UTC+14, and calculates nothing for it', () => {
    expect(retrogradeForYouRefusal('2026-11-10', new Date('2026-11-09T09:59:59Z'))).toEqual({ refused: 'future-birth-date' });
    expect(retrogradeForYouRefusal('2026-11-10', new Date('2026-11-09T10:00:00Z'))).toEqual({ refused: 'under-13' });
    expect(computeRetrogradeForYou({ birthDate: '2027-01-01', birthTime: null, place: MADRID, planets: ['Mercury'], now: new Date('2026-11-09T09:00:00Z'), zone: 'UTC' })).toEqual({ refused: 'future-birth-date' });
  });

  it('checks the shared policy before it resolves the birth time or builds a chart', () => {
    const source = readFileSync(new URL('../../islands/retrograde-for-you/compute.ts', import.meta.url), 'utf8');
    const body = source.slice(source.indexOf('export function computeRetrogradeForYou('));
    expect(body.indexOf('retrogradeForYouRefusal(input.birthDate, input.now)')).toBeGreaterThan(0);
    expect(body.indexOf('retrogradeForYouRefusal(input.birthDate, input.now)')).toBeLessThan(body.indexOf('resolveLocalToUtc('));
    expect(body.indexOf('retrogradeForYouRefusal(input.birthDate, input.now)')).toBeLessThan(body.indexOf('computeChart('));
    expect(source).not.toMatch(/isUnder13/u);
    const island = readFileSync(new URL('../../islands/RetrogradeForYou.tsx', import.meta.url), 'utf8');
    const calculate = island.slice(island.indexOf('async function calculate('));
    // The converted date is checked (checkedBirthDate with the page's refusal) before the calculation module loads.
    const check = calculate.indexOf('checkedBirthDate(date, calendar, retrogradeFormRefusal)');
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(calculate.indexOf("import('./retrograde-for-you/compute')"));
    expect(check).toBeLessThan(calculate.indexOf('prepareLocalTime('));
    expect(island).toMatch(/birthDateRefusal\(birthDate, now\)/u);
  });
});

describe('a planet in the post-shadow, untimed contacts and links (ZOD-20)', () => {
  const TIMED = { birthDate: '1990-05-03', time: '08:30' };

  it('builds the Venus card from the loop that just ended while Venus is in its post-shadow, with the next loop on one line', async () => {
    const { mcp, page } = await both(TIMED, new Date('2026-11-20T12:00:00Z'), 'Europe/Madrid');
    // The same chart while Venus was still retrograde in that loop.
    const during = await both(TIMED, new Date('2026-11-09T09:00:00Z'), 'Europe/Madrid');
    for (const [result, inside] of [[page, during.page], [mcp, during.mcp]] as const) {
      const venus = result.periods.find((period) => period.planet === 'Venus')!;
      const loop = inside.periods.find((period) => period.planet === 'Venus')!;
      expect(venus.status).toBe('post-shadow');
      expect(venus.retrogradeNow).toBe(false);
      expect(venus.stationRetrograde.date).toBe('2026-10-03');
      expect(venus.signs).toEqual(loop.signs);
      expect(venus.houses).toEqual(loop.houses);
      expect(venus.contacts).toEqual(loop.contacts);
      expect(venus.next!.stationRetrograde.startsWith('2028-05-10')).toBe(true);
      expect(venus.reading.match(/post-shadow/gu)).toHaveLength(1);
      expect(venus.reading).toContain('Venus turned direct on Sat 14 Nov 2026 at');
      expect(venus.reading).not.toContain(venus.confidenceLabel);
    }
    const venus = page.periods.find((period) => period.planet === 'Venus')!;
    expect(venus.shareQuery).toContain('s=2026-10-03');
    const card = render(h(PeriodCard, { period: venus, now: Date.parse(page.now) }));
    expect(card).toContain('retrograde from Sat 3 Oct 2026 to Sat 14 Nov 2026');
    expect(card).toContain('class="rfy__now"');
    expect(card).toContain('Next retrograde: Thu 11 May 2028 to Fri 23 Jun 2028.');
    expect(card.match(/Next retrograde:/gu)).toHaveLength(1);
    expect(card.match(/Reading confidence 70%/gu)).toHaveLength(1);
  });

  it('leaves a planet inside its retrograde as it was, with no next line', async () => {
    const { mcp, page } = await both(TIMED, new Date('2026-11-09T09:00:00Z'), 'Europe/Madrid');
    for (const result of [page, mcp]) {
      const mercury = result.periods.find((period) => period.planet === 'Mercury')!;
      expect(mercury).toMatchObject({ status: 'retrograde', retrogradeNow: true, next: null });
      expect(mercury.stationRetrograde.date).toBe('2026-10-24');
      expect(mercury.reading.startsWith('Mercury is retrograde now. It turned retrograde on Sat 24 Oct 2026')).toBe(true);
      expect(mercury.reading).toContain('The post-shadow runs until');
    }
    const mercury = page.periods.find((period) => period.planet === 'Mercury')!;
    const card = render(h(PeriodCard, { period: mercury, now: Date.parse(page.now) }));
    expect(card).toContain('This retrograde: Sat 24 Oct 2026');
    expect(card).not.toContain('Next retrograde:');
  });

  it('lists an untimed natal point near a loop’s edge only as a possible contact', async () => {
    // Natal Mercury for 23 Oct 1964 in Madrid: about 215.16° at noon, 214.35° and 215.97° at the ends of the day,
    // across the 2026 loop's direct station at about 215.03° (5°02' Scorpio).
    const { mcp, page } = await both({ birthDate: '1964-10-23' }, new Date('2026-11-09T09:00:00Z'), 'Europe/Madrid');
    const possible = 'The loop may also pass over your natal Mercury; a birth time settles it.';
    for (const result of [page, mcp]) {
      const mercury = result.periods.find((period) => period.planet === 'Mercury')!;
      expect(mercury.contacts.map((entry) => entry.point)).not.toContain('Mercury');
      expect(mercury.possibleContacts.map((entry) => entry.point)).toContain('Mercury');
      expect(mercury.reading.split('\n')).toContain(possible);
      for (const period of result.periods) {
        for (const entry of period.contacts) expect(entry.position).toMatch(/^about \d{1,2}° [A-Z][a-z]+$/u);
      }
    }
    const mercury = page.periods.find((period) => period.planet === 'Mercury')!;
    const card = render(h(PeriodCard, { period: mercury, now: Date.parse(page.now) }));
    expect(card).toContain(`>${possible}</p>`);
    expect(card.match(/may also pass over your natal Mercury/gu)).toHaveLength(1);
  });

  it('links Venus and Mars to their row in the retrogrades table, as the page does', async () => {
    const { mcp, page } = await bothWithLinks(TIMED, new Date('2026-11-20T12:00:00Z'), 'Europe/Madrid');
    for (const [planet, path] of [
      ['Mercury', '/mercury-retrograde/'],
      ['Venus', '/retrogrades/#retrograde-venus-2026-10-03'],
      ['Mars', '/retrogrades/#retrograde-mars-2027-01-10'],
    ] as const) {
      const link = mcp.links.find((entry) => entry.title === `${planet} retrograde`)!;
      expect(link.url).toBe(`https://zodiacs.org${path}`);
      const period = page.periods.find((entry) => entry.planet === planet)!;
      const card = render(h(PeriodCard, { period, now: Date.parse(page.now) }));
      expect(card).toContain(`href="${path}"`);
    }
  });
});

describe('the reading guards on Retrogrades for you (ZOD-26)', () => {
  it('never reads the sixth house as health beside a dated window, on the page or in the tool', async () => {
    const { mcp, page } = await both({ birthDate: '1990-05-03', time: '08:30' }, new Date('2026-11-09T09:00:00Z'), 'Europe/Madrid');
    expect(page.periods.some((period) => period.houses.some((entry) => entry.house === 6))).toBe(true);
    expect(mcp.periods.some((period) => period.houses.some((entry) => entry.house === 6))).toBe(true);
    expect(JSON.stringify(page)).not.toMatch(/health/iu);
    expect(JSON.stringify(mcp)).not.toMatch(/health/iu);
    expect(JSON.stringify(page)).toContain('routines, craft, and the shape of the day');
  });

  it('adds a limit for a birth time the clocks showed twice only when the rising sign differs between the passes', async () => {
    const now = new Date('2026-11-09T09:00:00Z');
    // Madrid, 30 Sep 1990: clocks went back from 03:00 to 02:00. At 02:10 the passes give Cancer and Leo rising.
    const split = await both({ birthDate: '1990-09-30', time: '02:10' }, now, 'Europe/Madrid');
    const line = 'Clocks repeated that hour where you were born. This reading uses the earlier pass, with Cancer rising; the later pass would give Leo rising and change every house.';
    expect(split.page.limits).toContain(line);
    expect(split.mcp.limits).toContain(line);
    expect(split.page.limits).toEqual(split.mcp.limits.filter((entry) => !entry.startsWith('Today is read')));
    // Every repeated time says first which pass it reads, the sentence the other personal pages use.
    expect(split.page.limits[0]).toBe(REPEATED_BIRTH_TIME);
    expect(split.mcp.limits[0]).toBe(REPEATED_BIRTH_TIME);
    // At 02:50 both passes give Leo rising: no rising-sign limit, but the pass is still named.
    const same = await both({ birthDate: '1990-09-30', time: '02:50' }, now, 'Europe/Madrid');
    for (const limits of [same.page.limits, same.mcp.limits]) {
      expect(limits.some((entry) => entry.startsWith('Clocks repeated'))).toBe(false);
      expect(limits[0]).toBe(REPEATED_BIRTH_TIME);
    }
    // An ordinary time is no fold at all: neither limit.
    const ordinary = await both({ birthDate: '1990-09-30', time: '04:10' }, now, 'Europe/Madrid');
    for (const limits of [ordinary.page.limits, ordinary.mcp.limits]) {
      expect(limits.some((entry) => entry.startsWith('Clocks repeated'))).toBe(false);
      expect(limits).not.toContain(REPEATED_BIRTH_TIME);
    }
  });

  it('refuses a birth time the clocks skipped on the page and in the tool, never reading it an hour on', async () => {
    // Madrid, 25 Mar 1990: clocks went from 02:00 straight to 03:00. 02:30 never showed; read forward it is 03:30,
    // which moves the rising sign and every house with no notice.
    const now = new Date('2026-11-09T09:00:00Z');
    const ON = { occasions: true, coverage: true, personal: true, now: () => now };
    for (const time of ['02:00', '02:30', '02:59']) {
      await prepareLocalTime('1990-03-25', MADRID.tz);
      expect(() => computeRetrogradeForYou({ birthDate: '1990-03-25', birthTime: time, place: MADRID, planets: ['Mercury'], now, zone: 'UTC' })).toThrow(SkippedBirthTimeError);
      const args = { birthDate: '1990-03-25', time, zone: MADRID.tz, latitude: MADRID.lat, longitude: MADRID.lon, currentZone: 'UTC' };
      await expect(retrogradeForMe(args, { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true })).rejects.toThrow(SkippedBirthTimeError);
      const refused = await executeAiTool('get_retrograde_for_me', args, ON);
      expect(refused).toMatchObject({ ok: false, error: { code: 'invalid-request', message: SKIPPED_BIRTH_TIME } });
      expect(JSON.stringify(refused)).not.toMatch(/1990|03-25|02:|Madrid|40\.42|3\.7/u);
    }
    // The minutes either side are read as given, with no clock limit; a date with no birth time reads its day whole.
    for (const birth of [{ birthDate: '1990-03-25', time: '01:59' }, { birthDate: '1990-03-25', time: '03:00' }, { birthDate: '1990-03-25' }]) {
      const read = await both(birth, now, 'UTC');
      expect(read.page.limits).not.toContain(REPEATED_BIRTH_TIME);
      expect(read.page.limits).toEqual(read.mcp.limits.filter((entry) => !entry.startsWith('Today is read')));
    }
  });

  it('takes the later pass the real size of the change on: half an hour on Lord Howe Island', async () => {
    // 15 Mar 1987, 01:30: the clocks went back 30 minutes, and both passes give Capricorn rising. An hour on would give Aquarius.
    const place = { lat: -31.55, lon: 159.08, tz: 'Australia/Lord_Howe' };
    const now = new Date('2026-11-09T09:00:00Z');
    const result = await retrogradeForMe(
      { birthDate: '1987-03-15', time: '01:30', zone: place.tz, latitude: place.lat, longitude: place.lon, currentZone: 'Europe/Madrid' },
      { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true },
    );
    if ('refused' in result) throw new Error(result.refused);
    const mcp = result.data;
    await prepareLocalTime('1987-03-15', place.tz);
    const page = computeRetrogradeForYou({ birthDate: '1987-03-15', birthTime: '01:30', place, planets: ['Mercury', 'Venus', 'Mars'], now, zone: 'Europe/Madrid' });
    if (page.refused) throw new Error('refused');
    expect(mcp.periods[0].houses.length).toBeGreaterThan(0);
    expect(page.limits.some((entry) => entry.startsWith('Clocks repeated'))).toBe(false);
    expect(mcp.limits.some((entry) => entry.startsWith('Clocks repeated'))).toBe(false);
    expect(page.limits[0]).toBe(REPEATED_BIRTH_TIME);
    expect(page.limits).toEqual(mcp.limits.filter((entry) => !entry.startsWith('Today is read')));
  });

  it('keeps 29 February as 29 February for the under-18 rule: born 1 March 2010 is still a minor that day', async () => {
    // Madrid, 1 Mar 2010 at 07:15 gives Aquarius rising, so Venus's 2028 loop in Gemini falls in the fifth house,
    // whose theme names romance. A Date cutoff rolls 29 Feb 2010 over to 1 Mar and read this person as 18.
    const birth = { birthDate: '2010-03-01', time: '07:15' };
    const fifth = (periods: readonly { planet: string; houses: readonly { house: number; theme: string; line: string }[]; reading: string }[]) => {
      const venus = periods.find((period) => period.planet === 'Venus')!;
      expect(venus.houses[0]).toMatchObject({ house: 5 });
      return [venus.houses[0].theme, venus.houses[0].line, venus.reading].join(' ');
    };
    const leap = await both(birth, new Date('2028-02-29T12:00:00Z'), 'UTC');
    for (const result of [leap.page, leap.mcp]) {
      expect(result.limits).toContain(MINOR_NOTE);
      expect(fifth(result.periods)).not.toMatch(/romance|romantic/iu);
      expect(JSON.stringify([result.periods, result.summary])).not.toMatch(/romance|romantic|attraction/iu);
    }
    const birthday = await both(birth, new Date('2028-03-01T12:00:00Z'), 'UTC');
    for (const result of [birthday.page, birthday.mcp]) {
      expect(result.limits).not.toContain(MINOR_NOTE);
      expect(fifth(result.periods)).toContain('romance');
    }
  });

  it('reads the under-18 rule on the civil date at UTC-12, leap day included', () => {
    const bodies = POINT_NAMES.map((body, index) => ({ body, lon: index * 30 }));
    // Noon UTC is the start of that calendar date at UTC-12.
    const minor = (birthDate: string, now: string) => natalBasis({
      timeKnown: true, placed: true, angles: { asc: 0, mc: 270 }, bodies, sunHeld: true, birthDate, now: new Date(now),
    }).minor;
    expect(minor('2010-03-01', '2028-02-28T12:00:00Z')).toBe(true);
    expect(minor('2010-03-01', '2028-02-29T12:00:00Z')).toBe(true);
    expect(minor('2010-03-01', '2028-03-01T12:00:00Z')).toBe(false);
    // Already 1 March from UTC+0 east, but still 29 February at UTC-12: still a minor.
    expect(minor('2010-03-01', '2028-03-01T02:00:00Z')).toBe(true);
    expect(minor('2010-03-01', '2028-03-01T11:59:59Z')).toBe(true);
    // Born on 29 February: under 18 until the calendar reaches 1 March in a common year.
    expect(minor('2008-02-29', '2026-02-28T12:00:00Z')).toBe(true);
    expect(minor('2008-02-29', '2026-03-01T12:00:00Z')).toBe(false);
  });

  describe('keeps the under-18 care until the 18th birthday has begun everywhere, whatever clock the dates are shown on', () => {
    // Born 1 March 2010 at 07:15 in Madrid. At 2028-03-01T02:00Z it is already 1 March in Madrid and Kiritimati but
    // still 29 February in Los Angeles and at UTC-12: the person may live where they are still 17.
    const birth = { birthDate: '2010-03-01', time: '07:15', zone: MADRID.tz, latitude: MADRID.lat, longitude: MADRID.lon };
    const toolAt = async (now: string, extra: { currentZone?: string; hostZone?: string } = {}) => {
      const { hostZone, ...args } = extra;
      const result = await retrogradeForMe({ ...birth, ...args }, { now: new Date(now), localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true, ...(hostZone ? { hostZone } : {}) });
      if ('refused' in result) throw new Error(result.refused);
      return result.data;
    };
    const pageAt = async (now: string, zone: string) => {
      await prepareLocalTime(birth.birthDate, MADRID.tz);
      const page = computeRetrogradeForYou({ birthDate: birth.birthDate, birthTime: birth.time, place: MADRID, planets: ['Mercury', 'Venus', 'Mars'], now: new Date(now), zone });
      if (page.refused) throw new Error('refused');
      return page;
    };
    const romance = (result: { periods: unknown; summary: string }) => /romance|romantic|attraction/iu.test(JSON.stringify([result.periods, result.summary]));

    it('get_retrograde_for_me with no current zone and no host zone, so the dates fall on the birthplace clock', async () => {
      const early = await toolAt('2028-03-01T02:00:00Z');
      expect(early.timeZone).toBe('Europe/Madrid');
      expect(early.limits).toContain(MINOR_NOTE);
      expect(romance(early)).toBe(false);
      expect((await toolAt('2028-03-01T11:59:59Z')).limits).toContain(MINOR_NOTE);
      const adult = await toolAt('2028-03-01T12:00:00Z');
      expect(adult.limits).not.toContain(MINOR_NOTE);
      expect(romance(adult)).toBe(true);
    });

    it('get_retrograde_for_me with a current zone or a host zone east of UTC-12', async () => {
      for (const extra of [{ currentZone: 'Pacific/Kiritimati' }, { currentZone: 'Europe/Madrid' }, { currentZone: 'America/Los_Angeles' }, { hostZone: 'Pacific/Kiritimati' }]) {
        const result = await toolAt('2028-03-01T02:00:00Z', extra);
        expect(result.limits, JSON.stringify(extra)).toContain(MINOR_NOTE);
        expect(romance(result), JSON.stringify(extra)).toBe(false);
      }
    });

    it('the page, on a device in any zone', async () => {
      for (const zone of ['Pacific/Kiritimati', 'Europe/Madrid', 'Asia/Bangkok', 'UTC', 'America/Los_Angeles']) {
        const early = await pageAt('2028-03-01T02:00:00Z', zone);
        expect(early.limits, zone).toContain(MINOR_NOTE);
        expect(romance(early), zone).toBe(false);
        expect((await pageAt('2028-03-01T12:00:00Z', zone)).limits, zone).not.toContain(MINOR_NOTE);
      }
    });
  });
});

describe('the retrograde-for-you share link', () => {
  it('carries only the planet, a published start date, and the Sun sign when settled', () => {
    const share = parseRetrogradeForYouShare(new URLSearchParams('p=mercury&s=2026-10-24&sun=taurus'));
    expect(share).toEqual({ planet: 'mercury', date: '2026-10-24', sun: 'taurus', ref: null });
    expect(retrogradeForYouQuery(share!)).toBe('p=mercury&s=2026-10-24&sun=taurus');
    expect(parseRetrogradeForYouShare(new URLSearchParams('p=venus&s=2026-10-03'))).toEqual({ planet: 'venus', date: '2026-10-03', sun: null, ref: null });
    for (const bad of [
      'p=jupiter&s=2026-10-24&sun=taurus', 'p=mercury&s=2026-13-40&sun=taurus', 'p=mercury&s=2026-10-24&sun=ophiuchus',
      'p=mercury&s=2026-10-24&h=7&b=rising&c=70', 'p=mercury&s=2026-10-24&h=7&b=sun&c=55', 'p=mercury&s=2026-10-24&c=55',
      'p=mercury&s=2026-10-24&m=leo', 'p=mercury&s=2026-10-24&r=libra', 'p=mercury&s=2026-10-24&sun=taurus&d=1990-05-03',
      'p=mercury&s=2026-10-24&sun=taurus&p=venus', 'p=mercury&s=2026-10-24&sun=taurus&ref=other', 'p=mercury',
    ]) expect(parseRetrogradeForYouShare(new URLSearchParams(bad)), bad).toBeNull();
  });

  it('names only a retrograde window the sky data lists', () => {
    expect(publishedRetrogradeDate('Mercury', '2026-10-24T07:12:00Z', sky.retrogrades)).toBe('2026-10-24');
    expect(publishedRetrogradeDate('Mercury', '2026-10-27T07:12:00Z', sky.retrogrades)).toBeNull();
  });
});

describe('the page’s words', () => {
  it('keep clear of forbidden claims and dashes', () => {
    const page = readFileSync(new URL('../../pages/retrogrades/for-you/index.astro', import.meta.url), 'utf8');
    const island = readFileSync(new URL('../../islands/RetrogradeForYou.tsx', import.meta.url), 'utf8');
    for (const text of [page, island, CONTACT_LINE, ...Object.values(RETROGRADE_LINE), ...Object.values(RETROGRADE_ASK)]) {
      expect(forbiddenClaim(text.replace(/<!--[\s\S]*?-->/gu, ''))).toBeNull();
    }
  });
  it('reflect on values and spending for Venus without advising when to buy (owner wording, 24 Nov)', () => {
    expect(RETROGRADE_LINE.Venus).toBe('Venus retrograde traditionally asks you to revisit what you value: relationships, money and what you find beautiful. It is read as a time to reflect on what you spend on and why, to look again at old ties, and to notice what still feels like you.');
    // No planet's words say when to make a purchase, a sale or an investment, or call a stretch good or poor for one.
    const TIMING = /\b(?:purchas\w*|buy\w*|sell\w*|invest\w*)\b|\b(?:good|poor|bad|best|worst|right|wrong)\s+(?:window|time|moment)\b/iu;
    for (const text of [CONTACT_LINE, ...Object.values(RETROGRADE_LINE), ...Object.values(RETROGRADE_ASK)]) expect(text).not.toMatch(TIMING);
  });
});
