import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { retrogradeForMe } from '../../ai-tools/personal/retrograde-for-me';
import { forbiddenClaim } from '../../ai-tools/personal/shared';
import { computeRetrogradeForYou, prepareLocalTime, type RetrogradeForYouInput } from '../../islands/retrograde-for-you/compute';
import sky from '../../data/sky.json';
import { CONTACT_LINE, RETROGRADE_ASK, RETROGRADE_LINE } from './reading';
import { loopsFromSky } from './sky';
import { parseRetrogradeForYouShare, publishedRetrogradeDate, retrogradeForYouQuery } from './share';

const clock = createLocalTimeModule();
const MINUTES = 60_000;
const MADRID = { lat: 40.42, lon: -3.7, tz: 'Europe/Madrid' };

async function both(birth: { birthDate: string; time?: string }, now: Date, zone: string) {
  const mcp = await retrogradeForMe(
    { birthDate: birth.birthDate, ...(birth.time ? { time: birth.time } : {}), zone: MADRID.tz, latitude: MADRID.lat, longitude: MADRID.lon, currentZone: zone },
    { now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org' },
  );
  await prepareLocalTime(birth.birthDate, MADRID.tz);
  const input: RetrogradeForYouInput = { birthDate: birth.birthDate, birthTime: birth.time ?? null, place: MADRID, planets: ['Mercury', 'Venus', 'Mars'], now, zone };
  const page = computeRetrogradeForYou(input);
  if (page.refused) throw new Error('refused');
  return { mcp: mcp.data, page };
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
        const same = ({ planet, status, retrogradeNow, signs, housesCountedFrom, houses, contacts, reading, confidenceLabel }: typeof ours | typeof theirs) =>
          ({ planet, status, retrogradeNow, signs, housesCountedFrom, houses, contacts, reading, confidenceLabel });
        expect(same(ours)).toEqual(same(theirs));
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
