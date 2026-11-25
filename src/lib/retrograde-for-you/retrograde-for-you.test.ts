import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { retrogradeForMe } from '../../ai-tools/personal/retrograde-for-me';
import { forbiddenClaim } from '../../ai-tools/personal/shared';
import { PeriodCard, notCoveredSentence } from '../../islands/RetrogradeForYou';
import { computeRetrogradeForYou, prepareLocalTime, retrogradeForYouRefusal, type RetrogradeForYouInput } from '../../islands/retrograde-for-you/compute';
import sky from '../../data/sky.json';
import { retrogradeForYouCardModel, skyEvents } from '../../server/result-preview-model';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { CONTACT_LINE, POINT_NAMES, RETROGRADE_ASK, RETROGRADE_LINE, dayTurns, natalBasis, retrogradePeriod } from './reading';
import { bodyLongitude, longitudeSpeed } from '../engine/full';
import { birthDaySpan } from '../time/birth-day-span';
import { resolveLocalToUtc } from '../time/localToUtc';
import { loopsFromSky, skyCoverageStart } from './sky';
import { parseRetrogradeForYouShare, publishedRetrogradeDate, retrogradeForYouQuery } from './share';
import { REPEATED_BIRTH_TIME, SKIPPED_BIRTH_DATE, SKIPPED_BIRTH_TIME, SkippedBirthDateError, SkippedBirthTimeError } from '../vedic-signs/clock';
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

  it('gives the page and the tool the same status a second either side of every station and shadow edge', async () => {
    // The page's windows (sky.json). Mercury turned direct at 19:33:23 on 20 Mar 2026; NASA gives 19:32:50, and the
    // engine's own search lands near that, so at 19:33:00 an engine-read tool and the page disagreed.
    const window = sky.retrogrades.find((entry) => entry.planet === 'Mercury' && entry.from.startsWith('2026-02-26'))!;
    // The first published window's pre-shadow is where the data starts to settle Mercury's status (skyCoverageStart):
    // a second before it the page says the data cannot place Mercury, and the tool reads the engine.
    const second = sky.retrogrades.find((entry) => entry.planet === 'Mercury' && entry.from.startsWith('2026-06-29'))!;
    const edges: [string, string, string][] = [
      [second.preShadowStart!, 'direct', 'pre-shadow'],
      [window.preShadowStart!, 'not covered', 'pre-shadow'],
      [window.from, 'pre-shadow', 'retrograde'],
      [window.to!, 'retrograde', 'post-shadow'],
      [window.postShadowEnd!, 'post-shadow', 'direct'],
    ];
    const status = async (at: Date) => {
      const { mcp, page } = await both({ birthDate: '1990-05-03' }, at, 'UTC');
      const pick = (result: { periods: { planet: string; status: string; retrogradeNow: boolean; stationDirect: { utc: string } }[] }) => result.periods.find((period) => period.planet === 'Mercury')!;
      return { mcp: pick(mcp), page: pick(page), notCovered: page.notCovered };
    };
    for (const [edge, before, after] of edges) {
      for (const [at, expected] of [[new Date(Date.parse(edge) - 1_000), before], [new Date(Date.parse(edge) + 1_000), after]] as const) {
        const { mcp, page, notCovered } = await status(at);
        if (expected === 'not covered') {
          expect(page, `page at ${at.toISOString()}`).toBeUndefined();
          expect(notCovered).toContain('Mercury');
          expect(mcp.status, `tool at ${at.toISOString()}`).toBe('direct');
          continue;
        }
        expect(notCovered).not.toContain('Mercury');
        expect(page.status, `page at ${at.toISOString()}`).toBe(expected);
        expect(mcp.status, `tool at ${at.toISOString()}`).toBe(page.status);
        expect(mcp.retrogradeNow, `tool at ${at.toISOString()}`).toBe(page.retrogradeNow);
        expect(mcp.stationDirect.utc).toBe(page.stationDirect.utc);
      }
    }
    // The reviewed instant itself.
    const reviewed = await status(new Date('2026-03-20T19:33:00Z'));
    expect(reviewed.page.status).toBe('retrograde');
    expect(reviewed.mcp.status).toBe('retrograde');
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

  it('reads where an untimed natal planet turned that day, not only the two ends, before calling a contact definite', async () => {
    // Mercury turned retrograde in the evening of 21 March 1926 (UTC, the Madrid clock that day): at about 14.7434°
    // at the end of the day, 14.7382° at its start, and about 14.7575° where it turned in between.
    await prepareLocalTime('1926-03-21', MADRID.tz);
    const [start, end] = birthDaySpan('1926-03-21', MADRID.tz, MADRID.lon, resolveLocalToUtc);
    const lonAt = (body: string, at: Date) => bodyLongitude(body as (typeof POINT_NAMES)[number], at);
    const turns = dayTurns(lonAt, start, end);
    expect(turns.map((row) => row.body)).toEqual(['Mercury']);
    const ends = [lonAt('Mercury', start), lonAt('Mercury', end)];
    expect(turns[0].lon).toBeGreaterThan(Math.max(...ends));
    expect(turns[0].lon).toBeCloseTo(14.7575, 3);
    // The page's ephemeris and the tool's find the same turn.
    const { positions } = await import('@zodiacs/engine');
    const toolTurns = dayTurns((body, at) => positions(at).find((row) => row.body === body)!.lon, start, end);
    expect(toolTurns.map((row) => row.body)).toEqual(['Mercury']);
    expect(toolTurns[0].lon).toBeCloseTo(turns[0].lon, 6);
    // An ordinary day: nothing turns.
    expect(dayTurns(lonAt, new Date('1926-03-10T00:00:00Z'), new Date('1926-03-10T23:59:59.999Z'))).toEqual([]);

    // A loop whose retrograde station lies between the day's later end and the turn: Mercury is on its degrees at both
    // ends of the day and off them in the evening, so it is a possible contact only.
    const rows = (at: Date) => POINT_NAMES.map((body) => ({ body, lon: lonAt(body, at) }));
    const bodies = rows(new Date('1926-03-21T12:00:00Z'));
    const edge = (Math.max(...ends) + turns[0].lon) / 2;
    const loop = {
      planet: 'Mercury' as const,
      stationRetrograde: { at: new Date('2026-06-29T17:00:00Z'), lon: edge },
      stationDirect: { at: new Date('2026-07-23T21:00:00Z'), lon: edge - 12 },
      preShadowStart: null, postShadowEnd: null,
    };
    const basis = (dayTurnsRows?: { body: string; lon: number }[]) => natalBasis({
      timeKnown: false, placed: true, angles: null, bodies, sunHeld: true, birthDate: '1926-03-21', now: new Date('2026-06-01T00:00:00Z'),
      dayEnds: [rows(start), rows(end)], ...(dayTurnsRows ? { dayTurns: dayTurnsRows } : {}),
    });
    const read = (dayTurnsRows?: { body: string; lon: number }[]) => retrogradePeriod('Mercury', { current: loop, previous: null, retrogradeNow: false }, new Date('2026-06-01T00:00:00Z'), 'UTC', basis(dayTurnsRows)).period;
    // The two ends alone call it definite.
    expect(read().contacts.map((entry) => entry.point)).toContain('Mercury');
    const period = read(turns);
    expect(period.contacts.map((entry) => entry.point)).not.toContain('Mercury');
    expect(period.possibleContacts.map((entry) => entry.point)).toContain('Mercury');
    // A loop that ends just past the turn holds every degree of the day, yet a planet that turned within an untimed birth
    // day is never a definite contact: possible only.
    const wide = { ...loop, stationRetrograde: { ...loop.stationRetrograde, lon: turns[0].lon + 0.01 } };
    const widePeriod = retrogradePeriod('Mercury', { current: wide, previous: null, retrogradeNow: false }, new Date('2026-06-01T00:00:00Z'), 'UTC', basis(turns)).period;
    expect(widePeriod.contacts.map((entry) => entry.point)).not.toContain('Mercury');
    expect(widePeriod.possibleContacts.map((entry) => entry.point)).toContain('Mercury');
    // A loop that misses every degree of the day is no contact at all.
    const clear = { ...loop, stationRetrograde: { ...loop.stationRetrograde, lon: Math.min(...ends) - 1 }, stationDirect: { ...loop.stationDirect, lon: Math.min(...ends) - 13 } };
    const clearPeriod = retrogradePeriod('Mercury', { current: clear, previous: null, retrogradeNow: false }, new Date('2026-06-01T00:00:00Z'), 'UTC', basis(turns)).period;
    expect([...clearPeriod.contacts, ...clearPeriod.possibleContacts].map((entry) => entry.point)).not.toContain('Mercury');
  });

  it('calls natal Mercury only a possible contact when it turned on the birth day just past the loop’s station, on the page and in the tool', async () => {
    // Mercury turned retrograde on 20 September 1824 at about 198.598°, past the 2028 loop's retrograde station at
    // about 198.594°, and was back on the loop's degrees (about 198.589° and 198.578°) at both ends of the Madrid day.
    const { mcp, page } = await both({ birthDate: '1824-09-20' }, new Date('2028-09-01T12:00:00Z'), 'Europe/Madrid');
    for (const result of [page, mcp]) {
      const mercury = result.periods.find((period) => period.planet === 'Mercury')!;
      expect(mercury.stationRetrograde.date).toBe('2028-09-19');
      expect(mercury.contacts.map((entry) => entry.point)).not.toContain('Mercury');
      expect(mercury.possibleContacts.map((entry) => entry.point)).toContain('Mercury');
    }
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
    // The earlier pass is Cancer rising, where Scorpio falls in the fifth house.
    for (const result of [split.page, split.mcp]) {
      expect(result.periods.find((period) => period.planet === 'Mercury')?.houses).toMatchObject([{ sign: 'scorpio', house: 5 }]);
    }
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

  it('refuses a birth date the birthplace clock skipped whole on the page and in the tool, never reading the next day', async () => {
    // Kwajalein went from 23:59:59 on 20 August 1993 (UTC-12) straight to 00:00 on 22 August (UTC+12): 21 August never
    // showed there. Read at local noon, the resolver would move the birth onto 22 August.
    const KWAJALEIN = { lat: 9.19, lon: 167.42, tz: 'Pacific/Kwajalein' };
    const now = new Date('2026-11-09T09:00:00Z');
    const ON = { occasions: true, coverage: true, personal: true, now: () => now };
    await prepareLocalTime('1993-08-21', KWAJALEIN.tz);
    expect(() => computeRetrogradeForYou({ birthDate: '1993-08-21', birthTime: null, place: KWAJALEIN, planets: ['Mercury'], now, zone: 'UTC' })).toThrow(SkippedBirthDateError);
    for (const placed of [{ latitude: KWAJALEIN.lat, longitude: KWAJALEIN.lon }, {}]) {
      const args = { birthDate: '1993-08-21', zone: KWAJALEIN.tz, ...placed, currentZone: 'UTC' };
      await expect(retrogradeForMe(args, { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true })).rejects.toThrow(SkippedBirthDateError);
      const refused = await executeAiTool('get_retrograde_for_me', args, ON);
      expect(refused, JSON.stringify(placed)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: SKIPPED_BIRTH_DATE } });
      expect(JSON.stringify(refused)).not.toMatch(/1993|08-21|Kwajalein|9\.19|167/u);
    }
    // The days either side showed, and are read on the page and in the tool alike.
    for (const birthDate of ['1993-08-20', '1993-08-22']) {
      await prepareLocalTime(birthDate, KWAJALEIN.tz);
      const page = computeRetrogradeForYou({ birthDate, birthTime: null, place: KWAJALEIN, planets: ['Mercury'], now, zone: 'UTC' });
      expect(page.refused, birthDate).toBeUndefined();
      const mcp = await retrogradeForMe({ birthDate, zone: KWAJALEIN.tz, latitude: KWAJALEIN.lat, longitude: KWAJALEIN.lon, currentZone: 'UTC', planets: ['Mercury'] }, { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true });
      expect('refused' in mcp, birthDate).toBe(false);
    }
    // An ordinary spring-forward date (Madrid, 25 Mar 1990) loses an hour, not the day: still read.
    await prepareLocalTime('1990-03-25', MADRID.tz);
    expect(computeRetrogradeForYou({ birthDate: '1990-03-25', birthTime: null, place: MADRID, planets: ['Mercury'], now, zone: 'UTC' }).refused).toBeUndefined();
  });

  it('reads an untimed birth date over its whole day when the clocks repeat its last hour, on the page and in the tool', async () => {
    // Gaza went back from 00:00 on 17 October 2003 to 23:00 on the 16th, so the 16th's 23:59 showed twice. Jupiter
    // stood at 160.427 degrees at the first 23:59 (inside the January 2027 Mars loop, which turns at about 160.429) and
    // at 160.435 at the second, outside it: over the real day the contact is possible, never definite.
    const GAZA = { lat: 31.5, lon: 34.47, tz: 'Asia/Gaza' };
    const now = new Date('2026-11-24T09:00:00Z');
    await prepareLocalTime('2003-10-16', GAZA.tz);
    const page = computeRetrogradeForYou({ birthDate: '2003-10-16', birthTime: null, place: GAZA, planets: ['Mars'], now, zone: 'UTC' });
    if (page.refused) throw new Error(page.refused);
    const pagePeriod = page.periods[0];
    expect(pagePeriod.stationRetrograde.utc.slice(0, 10)).toBe('2027-01-10');
    expect(pagePeriod.contacts.map((entry) => entry.point)).not.toContain('Jupiter');
    expect(pagePeriod.possibleContacts.map((entry) => entry.point)).toContain('Jupiter');
    for (const placed of [{ latitude: GAZA.lat, longitude: GAZA.lon }, {}]) {
      const result = await retrogradeForMe({ birthDate: '2003-10-16', zone: GAZA.tz, ...placed, planets: ['Mars'], currentZone: 'UTC' }, { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true });
      if ('refused' in result) throw new Error(result.refused);
      const period = result.data.periods[0];
      expect(period.contacts.map((entry) => entry.point), JSON.stringify(placed)).not.toContain('Jupiter');
      expect(period.possibleContacts.map((entry) => entry.point), JSON.stringify(placed)).toContain('Jupiter');
      expect(period.contacts).toEqual(pagePeriod.contacts);
      expect(period.possibleContacts).toEqual(pagePeriod.possibleContacts);
    }
  });

  it('leaves the Sun sign and houses unset for a day the Sun changed sign in its last minute: Lagos, 20 May 1972', async () => {
    // The Sun entered Gemini at 23:59:28 on the Lagos clock: the day runs up to the next midnight, so it holds both signs.
    const LAGOS = { lat: 6.45, lon: 3.4, tz: 'Africa/Lagos' };
    const now = new Date('2026-11-24T09:00:00Z');
    await prepareLocalTime('1972-05-20', LAGOS.tz);
    const page = computeRetrogradeForYou({ birthDate: '1972-05-20', birthTime: null, place: LAGOS, planets: ['Mercury', 'Venus', 'Mars'], now, zone: 'UTC' });
    if (page.refused) throw new Error(page.refused);
    expect(page.periods.length).toBeGreaterThan(0);
    for (const period of page.periods) {
      expect(period.housesCountedFrom).toBeNull();
      expect(period.houses).toEqual([]);
      expect(period.shareQuery).not.toBeNull();
      expect(period.shareQuery).not.toMatch(/(?:^|&)sun=/);
    }
    for (const placed of [{ latitude: LAGOS.lat, longitude: LAGOS.lon }, {}]) {
      const result = await retrogradeForMe({ birthDate: '1972-05-20', zone: LAGOS.tz, ...placed, planets: ['Mercury', 'Venus', 'Mars'], currentZone: 'UTC' }, { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true });
      if ('refused' in result) throw new Error(result.refused);
      for (const period of result.data.periods) {
        expect(period.housesCountedFrom, JSON.stringify(placed)).toBeNull();
        expect(period.houses).toEqual([]);
        expect(period.shareUrl).not.toBeNull();
        expect(new URL(period.shareUrl!).searchParams.has('sun')).toBe(false);
      }
    }
  });

  it('reads an untimed day the clocks left within its last minute alike on the page and in the tool: Heiligensee, 31 March 1893', async () => {
    // Heiligensee's own mean time ran 53 minutes ahead of UTC until 23:06:32 UTC, when its clock went from 23:59:32
    // straight to 00:06:32 on 1 April: both paths read the day as ending at 23:06:31.999 UTC, never into 1 April.
    const HEILIGENSEE = { lat: 52.61, lon: 13.25, tz: 'Europe/Berlin' };
    const now = new Date('2026-11-24T12:00:00Z');
    await prepareLocalTime('1893-03-31', HEILIGENSEE.tz);
    expect(birthDaySpan('1893-03-31', HEILIGENSEE.tz, HEILIGENSEE.lon, resolveLocalToUtc)[1].toISOString()).toBe('1893-03-31T23:06:31.999Z');
    const page = computeRetrogradeForYou({ birthDate: '1893-03-31', birthTime: null, place: HEILIGENSEE, planets: ['Mercury', 'Venus', 'Mars'], now, zone: 'UTC' });
    if (page.refused) throw new Error(page.refused);
    expect(page.periods.length).toBeGreaterThan(0);
    const result = await retrogradeForMe({ birthDate: '1893-03-31', zone: HEILIGENSEE.tz, latitude: HEILIGENSEE.lat, longitude: HEILIGENSEE.lon, planets: ['Mercury', 'Venus', 'Mars'], currentZone: 'UTC' }, { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true });
    if ('refused' in result) throw new Error(result.refused);
    expect(result.data.periods.map((period) => [period.contacts, period.possibleContacts, period.houses, period.housesCountedFrom]))
      .toEqual(page.periods.map((period) => [period.contacts, period.possibleContacts, period.houses, period.housesCountedFrom]));
  });

  it('softens an untimed sixth-house reading and keeps its house details off the share card', async () => {
    const { page, mcp } = await both({ birthDate: '2010-06-05' }, new Date('2026-11-09T09:00:00Z'), 'UTC');
    const theme = 'routines, craft, and the shape of the day';
    const pageVenus = page.periods.find((period) => period.planet === 'Venus')!;
    const toolVenus = mcp.periods.find((period) => period.planet === 'Venus')!;
    for (const venus of [pageVenus, toolVenus]) {
      expect(venus.houses.find((entry) => entry.house === 6)).toMatchObject({ sign: 'scorpio', theme });
      expect(venus.reading).toContain(theme);
      expect(JSON.stringify(venus)).not.toMatch(/health/iu);
    }
    expect(toolVenus.shareUrl).toBe(`https://zodiacs.org/share/retrograde-for-you/?${pageVenus.shareQuery}`);
    const share = parseRetrogradeForYouShare(new URLSearchParams(pageVenus.shareQuery!));
    expect(share).toEqual({ planet: 'venus', date: pageVenus.skyDate, sun: 'gemini', ref: null });
    const events = skyEvents({ retrogrades: sky.retrogrades, moons: [], eclipses: [] });
    const card = retrogradeForYouCardModel(share!, events);
    expect(card?.line).toMatch(/^Venus retrograde /u);
    expect(card?.line).not.toMatch(/house/iu);
    expect(JSON.stringify(card)).not.toMatch(/health/iu);
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

describe('stations within an untimed birth day (dayTurns)', () => {
  const SECOND = 1_000;
  // The Madrid day of 3 May 1990, from local midnight to the instant before the next one.
  const span = async () => {
    await prepareLocalTime('1990-05-03', MADRID.tz);
    return birthDaySpan('1990-05-03', MADRID.tz, MADRID.lon, resolveLocalToUtc);
  };
  /**
   * Mercury stationing at `turn`, a parabola in time with Mercury's real curvature at a station (about 2e-11 degrees
   * per second squared); every other planet moving forward at a steady rate.
   */
  const synthetic = (turn: number) => (body: string, at: Date) => {
    const seconds = (at.getTime() - turn) / SECOND;
    return body === 'Mercury' ? 100 + 1e-11 * seconds * seconds : 200 + 1e-5 * (at.getTime() - Date.UTC(1990, 0, 1)) / SECOND;
  };

  for (const [label, offset] of [
    ['ten seconds after local midnight', (start: number) => start + 10 * SECOND],
    ['ten seconds before the next local midnight', (_start: number, end: number) => end + 1 - 10 * SECOND],
    ['inside the day', (start: number) => start + 9 * 3_600_000 + 17 * 60_000 + 23_456],
  ] as const) {
    it(`finds a station ${label}, to within a second`, async () => {
      const [start, end] = await span();
      const turn = offset(start.getTime(), end.getTime());
      const turns = dayTurns(synthetic(turn), start, end);
      expect(turns.map((row) => row.body)).toEqual(['Mercury']);
      expect(Math.abs(turns[0].at.getTime() - turn)).toBeLessThanOrEqual(SECOND);
      expect(turns[0].lon).toBeCloseTo(100, 9);
    });
  }

  it('makes a planet that turned that day only a possible contact, even with every degree of the day inside the loop', async () => {
    const [start, end] = await span();
    for (const turn of [start.getTime() + 10 * SECOND, end.getTime() + 1 - 10 * SECOND]) {
      const lonAt = synthetic(turn);
      const rows = (at: Date) => POINT_NAMES.map((body) => ({ body, lon: lonAt(body, at) }));
      const basis = natalBasis({
        timeKnown: false, placed: true, angles: null, bodies: rows(new Date((start.getTime() + end.getTime()) / 2)), sunHeld: true,
        birthDate: '1990-05-03', now: new Date('2026-06-01T00:00:00Z'), dayEnds: [rows(start), rows(end)], dayTurns: dayTurns(lonAt, start, end),
      });
      const loop = {
        planet: 'Mercury' as const,
        stationRetrograde: { at: new Date('2026-06-29T17:00:00Z'), lon: 110 },
        stationDirect: { at: new Date('2026-07-23T21:00:00Z'), lon: 90 },
        preShadowStart: null, postShadowEnd: null,
      };
      const period = retrogradePeriod('Mercury', { current: loop, previous: null, retrogradeNow: false }, new Date('2026-06-01T00:00:00Z'), 'UTC', basis).period;
      expect(period.contacts.map((entry) => entry.point)).not.toContain('Mercury');
      expect(period.possibleContacts.map((entry) => entry.point)).toContain('Mercury');
    }
  });

  it('finds Mercury’s real turn on 21 March 1926 within a second of the station bisected on the engine’s speed', async () => {
    await prepareLocalTime('1926-03-21', MADRID.tz);
    const [start, end] = birthDaySpan('1926-03-21', MADRID.tz, MADRID.lon, resolveLocalToUtc);
    const turns = dayTurns((body, at) => bodyLongitude(body as (typeof POINT_NAMES)[number], at), start, end);
    expect(turns.map((row) => row.body)).toEqual(['Mercury']);
    // The station itself: where the engine's longitude speed changes sign, halved to a millisecond.
    let lo = start.getTime();
    let hi = end.getTime();
    const opening = Math.sign(longitudeSpeed('Mercury', start));
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (Math.sign(longitudeSpeed('Mercury', new Date(mid))) === opening) lo = mid;
      else hi = mid;
    }
    expect(Math.abs(turns[0].at.getTime() - hi)).toBeLessThanOrEqual(SECOND);
    expect(turns[0].lon).toBeCloseTo(bodyLongitude('Mercury', new Date(hi)), 8);
  });

  it('finds nothing on a day no planet turned', async () => {
    const [start, end] = await span();
    expect(dayTurns((body, at) => bodyLongitude(body as (typeof POINT_NAMES)[number], at), start, end)).toEqual([]);
  });
});

describe('dates the published retrograde data does not cover', () => {
  const span = sky as Parameters<typeof loopsFromSky>[2];

  it('settles a planet only from its first published pre-shadow, never before the data begins', () => {
    expect(skyCoverageStart('Mercury', span)?.toISOString()).toBe('2026-02-11T22:12:14.682Z');
    expect(skyCoverageStart('Venus', span)?.toISOString()).toBe('2026-08-31T14:45:38.367Z');
    expect(skyCoverageStart('Mars', span)?.toISOString()).toBe('2026-11-05T15:33:42.445Z');
    for (const planet of ['Mercury', 'Venus', 'Mars'] as const) {
      expect(loopsFromSky(planet, new Date('2025-03-20T12:00:00Z'), span, () => 0), planet).toBeNull();
      expect(loopsFromSky(planet, new Date('2025-12-31T23:59:59Z'), span, () => 0), planet).toBeNull();
      expect(loopsFromSky(planet, new Date('2031-06-01T00:00:00Z'), span, () => 0), planet).toBeNull();
    }
    expect(loopsFromSky('Venus', new Date('2026-08-31T14:45:39Z'), span, () => 0)?.current?.stationRetrograde.at.toISOString()).toBe('2026-10-03T07:15:41.747Z');
  });

  it('never calls Venus direct with the clock at 20 March 2025, when it was retrograde: the page says it is not covered, the tool reads the engine', async () => {
    const now = new Date('2025-03-20T12:00:00Z');
    const { mcp, page } = await both({ birthDate: '1990-05-03', time: '08:30' }, now, 'Europe/Madrid');
    expect(page.periods.map((period) => period.planet)).not.toContain('Venus');
    expect(page.notCovered).toEqual(['Mercury', 'Venus', 'Mars']);
    expect(page.unavailable).toEqual([]);
    expect(page.dataStarts).toBe('Thu 1 Jan 2026');
    expect(JSON.stringify(page)).not.toMatch(/Venus is not retrograde|Direct now/u);
    expect(notCoveredSentence(page.notCovered, page.dataStarts)).toBe('Mercury and Venus and Mars: the sky data this page uses starts on Thu 1 Jan 2026 and cannot place them on today\'s date on this device, so they are not shown here.');
    expect(notCoveredSentence(['Venus'], page.dataStarts)).toBe('Venus: the sky data this page uses starts on Thu 1 Jan 2026 and cannot place it on today\'s date on this device, so it is not shown here.');
    // The tool's engine fallback: Venus turned retrograde on 1 or 2 March 2025 and was retrograde that day.
    const venus = mcp.periods.find((period) => period.planet === 'Venus')!;
    expect(venus).toMatchObject({ status: 'retrograde', retrogradeNow: true });
    expect(venus.stationRetrograde.utc.startsWith('2025-03-0')).toBe(true);
    expect(venus.shareUrl).toBeNull();
  });
});
