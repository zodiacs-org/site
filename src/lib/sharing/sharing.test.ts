import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHARING_COPY, sharingText } from './copy';
import { groupReading, validGroupSize } from './group';
import { matchTwins, twinSigns } from './twins';
import { privateInviteToken, readPrivateInvite } from './private-invite';
import { computeBodies, computeChart } from '../engine/full';
import { ENGINE_VERSION, type Chart } from '../engine/types';
import { isAstrologyToolPath } from '../trust-boundary';

const bodies = ['Sun', 'Mercury', 'Venus', 'Mars', 'Moon'].map((body, i) => ({ body, lon: i * 30 + 15 })) as Chart['bodies'];
const chart = (known: boolean) => ({ input: { timeKnown: known }, bodies, angles: { asc: 15 } }) as Chart;

describe('group interpretation bounds', () => {
  it('requires three to eight people', () => {
    for (const n of [3,4,5,6,7,8]) expect(validGroupSize(n)).toBe(true);
    for (const n of [0,2,9,3.5,NaN]) expect(validGroupSize(n)).toBe(false);
  });
  it('gives tied elements a blend, and never uses unknown-time Moon or angles', () => {
    const unknown = groupReading(chart(false));
    expect(unknown.role).toBe('blend'); expect(unknown.total).toBe(4);
    expect(unknown.placements.map((p) => p.body)).not.toContain('Moon');
    expect(unknown.placements.map((p) => p.body)).not.toContain('Rising');
    const known = groupReading(chart(true));
    expect(known.role).toBe('fire'); expect(known.total).toBe(6);
    expect(known.counts).toEqual({ fire: 3, earth: 1, air: 1, water: 1 });
  });
});
describe('chart twin truthfulness', () => {
  const people = [
    { slug: 'a', name: 'A', sun: 'aries', moon: 'leo' },
    { slug: 'b', name: 'B', sun: 'aries', moon: null },
    { slug: 'c', name: 'C', sun: 'taurus', moon: 'leo' },
  ];
  it('ranks both signs first and never treats an unverified Moon as a match', () => {
    expect(matchTwins({ sun: 'aries', moon: 'leo' }, people).map((m) => [m.person.slug,m.count])).toEqual([['a',2],['b',1],['c',1]]);
    expect(matchTwins({ sun: null, moon: null }, people)).toEqual([]);
    expect(matchTwins({ sun: 'aries', moon: null }, people).every((m) => m.count === 1 && !m.moon)).toBe(true);
  });
  it('omits the user’s unknown-time Moon and boundary Sun', () => {
    expect(twinSigns({ ...chart(false), bodies: [{ body: 'Sun', lon: 0 }] } as Chart)).toEqual({ sun: null, moon: null });
    expect(twinSigns({ ...chart(false), bodies: [{ body: 'Sun', lon: 15 }, { body: 'Moon', lon: 125 }] } as Chart)).toEqual({ sun: 'aries', moon: null });
  });
});
describe('fragment-only compatibility invitations', () => {
  it('exports no birth inputs, rounds angles, and uses minute-safe timed positions', async () => {
    const utc = new Date('1880-04-11T08:30:22.000Z');
    const computed = computeChart({ utc, latitude: 27.72, longitude: 85.32, houseSystem: 'whole', timeKnown: true });
    const token = await privateInviteToken({ bodies: computed.bodies, angles: computed.angles, houseSystem: 'whole', engineVersion: ENGINE_VERSION }, { utc });
    const decoded = readPrivateInvite(`#p=${token}`)!;
    expect(decoded.angles!.asc % 1).toBe(.5);
    const expected = computeBodies(new Date('1880-04-11T08:30:00.000Z'));
    expect(decoded.bodies.find((b) => b.body === 'Moon')!.lon).toBeCloseTo(expected.find((b) => b.body === 'Moon')!.lon, 2);
    const wire = JSON.parse(atob(token.slice(2).replace(/-/g,'+').replace(/_/g,'/')));
    expect(Object.keys(wire).sort()).toEqual(['a','b','h','v']);
    expect(JSON.stringify(wire)).not.toMatch(/birth|date|time|place|latitude|longitude|name|email/i);
  });
  it('unknown time carries noon UTC, never the birthplace’s noon or angles', async () => {
    const input = { bodies: computeBodies(new Date('1990-01-01T06:15:00Z')), angles: null, houseSystem: 'whole' as const, engineVersion: ENGINE_VERSION };
    const token = await privateInviteToken(input, { birthDate: '1990-01-01' });
    const result = readPrivateInvite(`p=${token}`)!;
    expect(result.angles).toBeNull();
    expect(result.bodies.find((b) => b.body === 'Moon')!.lon).toBeCloseTo(computeBodies(new Date('1990-01-01T12:00:00Z')).find((b) => b.body === 'Moon')!.lon, 2);
    for (const fragment of [`p=${token}&p=${token}`, `p=${token}&date=1990-01-01`, '#p=bad', `#p=${'x'.repeat(300)}`]) expect(readPrivateInvite(fragment)).toBeNull();
    await expect(privateInviteToken(input, { birthDate: '1990-02-30' })).rejects.toThrow();
  });
});
describe('six-language sharing copy and tool boundaries', () => {
  it('uses the existing third-party-script boundary on sharing and compatibility forms', () => {
    const pages = ['components/sharing/SharingToolPage.astro', 'pages/big-three/index.astro',
      ...['', 'es/', 'pt/', 'fr/', 'it/', 'ru/'].map((locale) => `pages/${locale}compatibility/index.astro`)];
    for (const page of pages) {
      const source = readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8');
      expect(source, page).toMatch(/<Base\s+privateSurface\b/);
    }
  });
  it('has exact keys and interpolation placeholders in all six languages', () => {
    const keys = Object.keys(SHARING_COPY.en).sort();
    for (const [locale,catalog] of Object.entries(SHARING_COPY)) {
      expect(Object.keys(catalog).sort()).toEqual(keys);
      for (const key of keys as (keyof typeof SHARING_COPY.en)[]) {
        expect(catalog[key].trim(), `${locale}.${key}`).not.toBe('');
        expect(catalog[key].match(/\{\w+\}/g) ?? [], `${locale}.${key}`).toEqual(SHARING_COPY.en[key].match(/\{\w+\}/g) ?? []);
      }
    }
    expect(sharingText('en','groupCount',{n:2,total:4})).toBe('2 of 4 counted placements');
  });
  it('suppresses collection branding on every new route, including localized ones', () => {
    for (const locale of ['','/es','/pt','/fr','/it','/ru']) for (const route of ['/big-three/','/compatibility/invite/','/group-charts/','/chart-twins/']) expect(isAstrologyToolPath(`${locale}${route}`)).toBe(true);
  });
});
