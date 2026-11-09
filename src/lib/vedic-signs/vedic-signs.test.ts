import { beforeAll, describe, expect, it } from 'vitest';
import { NAKSHATRAS, siderealChart } from '@zodiacs/engine/vedic';
import { computeVedicSigns } from './compute';
import { UNDER_13_MESSAGE, isUnder13, vedicReading } from './reading';
import { parseVedicSignsShare, vedicSignsQuery, vedicSignsShareQuery, vedicSignsShareUrl, VEDIC_SIGNS_SHARE_KEYS } from './share';
import { AYANAMSA_NAME, NAKSHATRA_LORE, NAKSHATRA_NAMES, RASHI_LINE, VEDIC_AYANAMSAS, VEDIC_NOTE, nakshatraSigns } from './wording';
import { forbiddenClaim } from '../../ai-tools/personal/shared';
import { softenMinor } from '../../ai-tools/features/reading-guards';
import { signIndexForLongitude } from '../signs';

const angle = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('the Vedic signs the page and the tool share', () => {
  it('match the engine’s own siderealChart within 0.01 degrees, for every ayanamsa', async () => {
    const births = [
      { utc: new Date('2000-01-01T12:00:00Z'), latitude: 28.61, longitude: 77.21 },
      { utc: new Date('1990-05-03T03:00:00Z'), latitude: 19.08, longitude: 72.88 },
      { utc: new Date('1975-11-22T21:40:00Z'), latitude: 51.51, longitude: -0.13 },
      { utc: new Date('2012-07-14T08:05:00Z'), latitude: -33.87, longitude: 151.21 },
    ];
    for (const birth of births) {
      for (const ayanamsa of VEDIC_AYANAMSAS) {
        const ours = await computeVedicSigns({ birthUtc: birth.utc, timeKnown: true, latitude: birth.latitude, longitude: birth.longitude, ayanamsa });
        const engine = siderealChart({ utc: birth.utc, latitude: birth.latitude, longitude: birth.longitude, houseSystem: 'whole', timeKnown: true }, ayanamsa);
        const lon = (name: string) => engine.bodies.find((row) => row.body === name)!.lon;
        expect(Math.abs(ours.ayanamsa.degrees - engine.ayanamsaValue.true), ayanamsa).toBeLessThan(0.0001);
        const sunIndex = signIndexForLongitude(lon('Sun'));
        const moonIndex = signIndexForLongitude(lon('Moon'));
        expect(angle(sunIndex * 30 + ours.sun!.degree, lon('Sun'))).toBeLessThan(0.01);
        expect(angle(moonIndex * 30 + ours.moon!.degree, lon('Moon'))).toBeLessThan(0.01);
        const ascIndex = signIndexForLongitude(engine.ascendant!.lon);
        expect(angle(ascIndex * 30 + ours.rising!.degree, engine.ascendant!.lon)).toBeLessThan(0.01);
        expect(ours.moonNakshatra!.number).toBe(Math.floor(lon('Moon') / (40 / 3)) + 1);
      }
    }
  });

  it('keeps the engine’s nakshatra names, and every nakshatra lies in one or two signs', () => {
    expect([...NAKSHATRA_NAMES]).toEqual([...NAKSHATRAS]);
    expect(nakshatraSigns(0)).toEqual([0]);
    expect(nakshatraSigns(2)).toEqual([0, 1]); // Krittika: Aries into Taurus
    expect(nakshatraSigns(26)).toEqual([11]);
    expect(NAKSHATRA_NAMES.flatMap((_, index) => nakshatraSigns(index)).filter((sign, index, all) => all.indexOf(sign) === index)).toHaveLength(12);
  });

  it('says nothing the site does not say, and frames nothing as romance', () => {
    const texts = [...RASHI_LINE, VEDIC_NOTE, UNDER_13_MESSAGE, ...Object.values(AYANAMSA_NAME), ...Object.values(NAKSHATRA_LORE).flatMap((lore) => [lore.deity, lore.symbol, lore.line])];
    for (const text of texts) {
      expect(forbiddenClaim(text), text).toBeNull();
      expect(softenMinor(text), text).toBe(text);
      expect(text, text).not.toMatch(/[–—]/u);
    }
  });

  it('refuses a birth date under 13 years old', () => {
    expect(isUnder13('2014-11-10', '2026-11-09')).toBe(true);
    expect(isUnder13('2013-11-09', '2026-11-09')).toBe(false);
  });

  it('gives an untimed day’s Moon as candidates when it changed sign, and no rising sign', async () => {
    const reading = await computeVedicSigns({ birthUtc: new Date('2000-01-02T12:00:00Z'), timeKnown: false, ayanamsa: 'lahiri', dayEnds: [new Date('2000-01-01T10:00:00Z'), new Date('2000-01-03T11:59:00Z')] });
    expect(reading.moon).toBeNull();
    expect(reading.rising).toBeNull();
    expect(reading.moonCandidates.length).toBeGreaterThan(1);
    expect(reading.confidenceLabel).toBe('Reading confidence 55%');
  });
});

describe('the Vedic signs share link', () => {
  let timed: Awaited<ReturnType<typeof computeVedicSigns>>;
  beforeAll(async () => { timed = await computeVedicSigns({ birthUtc: new Date('2000-01-01T12:00:00Z'), timeKnown: true, latitude: 28.61, longitude: 77.21, ayanamsa: 'lahiri' }); });

  it('carries only the signs, the nakshatra number and the ayanamsa', () => {
    const query = vedicSignsShareQuery(timed)!;
    const params = new URLSearchParams(query);
    expect([...params.keys()].every((key) => VEDIC_SIGNS_SHARE_KEYS.includes(key))).toBe(true);
    expect(Object.fromEntries(params)).toEqual({ s: 'sagittarius', m: 'libra', r: timed.rising!.sign, n: '15', a: 'lahiri' });
    expect(query).not.toMatch(/2000|12:00|28\.61|77\.21/u);
    expect(vedicSignsShareUrl('https://zodiacs.org', timed)).toBe(`https://zodiacs.org/share/vedic-signs/?${query}`);
    expect(parseVedicSignsShare(params)).toEqual({ sun: 'sagittarius', moon: 'libra', rising: timed.rising!.sign, nakshatra: 15, ayanamsa: 'lahiri', ref: null });
  });

  it('makes no link when the Sun’s sign is open, and leaves out what an untimed day leaves open', () => {
    const at = timed;
    expect(vedicSignsShareQuery({ ...at, sun: null })).toBeNull();
    expect(vedicSignsShareQuery({ ...at, moon: null, rising: null, moonNakshatra: null })).toBe('s=sagittarius&a=lahiri');
    expect(vedicSignsQuery({ sun: 'leo', moon: null, rising: 'aries', nakshatra: 10, ayanamsa: 'raman', ref: 'chatgpt' }, true)).toBe('s=leo&n=10&a=raman&ref=chatgpt');
  });

  it('opens only a strict query', () => {
    const ok = (query: string) => parseVedicSignsShare(new URLSearchParams(query));
    expect(ok('s=leo&a=lahiri')).toMatchObject({ sun: 'leo', moon: null, nakshatra: null });
    expect(ok('s=leo&n=3&a=lahiri')).toMatchObject({ moon: null, nakshatra: 3 }); // Krittika runs from Aries into Taurus
    expect(ok('s=leo&m=aries&n=2&a=fagan-bradley&ref=assistant')).toMatchObject({ moon: 'aries', nakshatra: 2, ref: 'assistant' });
    expect(ok('s=leo&m=taurus&n=3&r=virgo&a=lahiri')).toMatchObject({ rising: 'virgo' });
    for (const bad of [
      's=leo', 'a=lahiri', 's=leo&a=galactic-center', 's=lion&a=lahiri', 's=leo&n=0&a=lahiri', 's=leo&n=28&a=lahiri', 's=leo&n=07&a=lahiri',
      's=leo&m=aries&n=10&a=lahiri', // Magha is in Leo, not Aries
      's=leo&n=10&a=lahiri', // a day that keeps the Moon in Magha keeps it in Leo

      's=leo&r=virgo&a=lahiri', 's=leo&m=aries&r=virgo&a=lahiri', // a rising sign takes a settled Moon and nakshatra
      's=leo&a=lahiri&d=1990-08-01', 's=leo&a=lahiri&lat=28.6', 's=leo&s=leo&a=lahiri', 's=leo&a=lahiri&ref=other',
    ]) expect(ok(bad), bad).toBeNull();
  });

  it('is built from a reading the same way the tool builds it', () => {
    const reading = vedicReading({ timeKnown: false, placed: false, ayanamsa: 'yukteswar', at: { ayanamsa: 22.4, sun: { lon: 100, tropical: 124 }, moon: { lon: 200, tropical: 224 }, rising: null, nakshatra: { index: 14, pada: 3, lord: 'Rahu' } }, ends: null });
    expect(vedicSignsShareQuery(reading)).toBe('s=cancer&m=libra&n=15&a=yukteswar');
  });
});
