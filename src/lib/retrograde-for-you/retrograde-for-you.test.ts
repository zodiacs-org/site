import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { retrogradeForMe } from '../../ai-tools/personal/retrograde-for-me';
import { forbiddenClaim } from '../../ai-tools/personal/shared';
import { computeRetrogradeForYou, prepareLocalTime, type RetrogradeForYouInput } from '../../islands/retrograde-for-you/compute';
import sky from '../../data/sky.json';
import { CONTACT_LINE, RETROGRADE_ASK, RETROGRADE_LINE } from './reading';
import { loopsFromSky } from './sky';
import { parseRetrogradeForYouShare, publishedRetrogradeDate, retrogradeForYouQuery, retrogradeTablePath } from './share';

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
    { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org' },
  );
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

  it('refuses a birth date less than 13 years ago and computes nothing', async () => {
    await prepareLocalTime('2016-05-03', MADRID.tz);
    expect(computeRetrogradeForYou({ birthDate: '2016-05-03', birthTime: null, place: MADRID, planets: ['Mercury'], now: new Date('2026-11-09T09:00:00Z'), zone: 'UTC' })).toEqual({ refused: 'under-13' });
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
    expect(venus.nextLine).toMatch(/^Next retrograde: Thu 11 May 2028 to /u);
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
    expect(page.periods.find((period) => period.planet === 'Mercury')!.nextLine).toBeNull();
  });

  it('lists an untimed natal point near a loop’s edge only as a possible contact', async () => {
    // Natal Mercury for 23 Oct 1964 in Madrid: about 215.16° at noon, 214.35° and 215.97° at the ends of the day,
    // across the 2026 loop's direct station at about 215.03° (5°02' Scorpio).
    const { mcp, page } = await both({ birthDate: '1964-10-23' }, new Date('2026-11-09T09:00:00Z'), 'Europe/Madrid');
    for (const result of [page, mcp]) {
      const mercury = result.periods.find((period) => period.planet === 'Mercury')!;
      expect(mercury.contacts.map((entry) => entry.point)).not.toContain('Mercury');
      expect(mercury.possibleContacts.map((entry) => entry.point)).toContain('Mercury');
      expect(mercury.reading).toContain('The loop may also pass over your natal Mercury; a birth time settles it.');
      for (const period of result.periods) {
        for (const entry of period.contacts) expect(entry.position).toMatch(/^about \d{1,2}° [A-Z][a-z]+$/u);
      }
    }
  });

  it('links Venus and Mars to their row in the retrogrades table, as the page does', async () => {
    const { mcp, page } = await bothWithLinks(TIMED, new Date('2026-11-20T12:00:00Z'), 'Europe/Madrid');
    const urls = mcp.links.map((link) => new URL(link.url));
    for (const planet of ['Venus', 'Mars'] as const) {
      const link = mcp.links.find((entry) => entry.title === `${planet} retrograde`)!;
      const url = new URL(link.url);
      expect(`${url.pathname}${url.hash}`.startsWith('/retrogrades/#retrograde-')).toBe(true);
      const ours = page.periods.find((period) => period.planet === planet)!;
      expect(`${url.pathname}${url.hash}`).toBe(retrogradeTablePath(planet, ours.skyDate));
    }
    expect(mcp.links.find((entry) => entry.title === 'Venus retrograde')!.url).toBe('https://zodiacs.org/retrogrades/#retrograde-venus-2026-10-03');
    expect(urls.some((url) => /^\/(?:venus|mars)-retrograde\/$/u.test(url.pathname))).toBe(false);
    expect(mcp.links.find((entry) => entry.title === 'Mercury retrograde')!.url).toBe('https://zodiacs.org/mercury-retrograde/');
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
    // At 02:50 both passes give Leo rising, and an ordinary time is no fold at all: no limit.
    for (const time of ['02:50', '04:10']) {
      const same = await both({ birthDate: '1990-09-30', time }, now, 'Europe/Madrid');
      expect(same.page.limits.some((entry) => entry.startsWith('Clocks repeated'))).toBe(false);
      expect(same.mcp.limits.some((entry) => entry.startsWith('Clocks repeated'))).toBe(false);
    }
  });
});

describe('the retrograde-for-you share link', () => {
  it('carries only the planet, a published start date, the house, its basis and the confidence', () => {
    const share = parseRetrogradeForYouShare(new URLSearchParams('p=mercury&s=2026-10-24&h=7&b=rising&c=70'));
    expect(share).toEqual({ planet: 'mercury', date: '2026-10-24', house: 7, basis: 'rising', confidence: 70, ref: null });
    expect(retrogradeForYouQuery(share!)).toBe('p=mercury&s=2026-10-24&h=7&b=rising&c=70');
    expect(parseRetrogradeForYouShare(new URLSearchParams('p=venus&s=2026-10-03&c=55'))).toMatchObject({ house: null, basis: null });
    for (const bad of [
      'p=jupiter&s=2026-10-24&c=55', 'p=mercury&s=2026-13-40&c=55', 'p=mercury&s=2026-10-24&h=13&b=sun&c=55',
      'p=mercury&s=2026-10-24&h=7&c=55', 'p=mercury&s=2026-10-24&b=sun&c=55', 'p=mercury&s=2026-10-24&h=7&b=rising&c=55',
      'p=mercury&s=2026-10-24&h=7&b=sun&c=70', 'p=mercury&s=2026-10-24&c=60', 'p=mercury&s=2026-10-24&c=55&d=1990-05-03',
      'p=mercury&s=2026-10-24&c=55&p=venus', 'p=mercury&s=2026-10-24&c=55&ref=other', 'p=mercury&s=2026-10-24',
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
});
