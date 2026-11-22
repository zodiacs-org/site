import { beforeAll, describe, expect, it } from 'vitest';
import { NAKSHATRAS, siderealChart } from '@zodiacs/engine/vedic';
import { computeVedicSigns } from './compute';
import { UNDER_13_MESSAGE, forwardRun, isUnder13, listOr, vedicReading } from './reading';
import { parseVedicSignsShare, vedicSignsQuery, vedicSignsShareQuery, vedicSignsShareUrl, VEDIC_SIGNS_SHARE_KEYS } from './share';
import { AYANAMSA_NAME, NAKSHATRA_LORE, NAKSHATRA_NAMES, RASHIS, RASHI_LINE, VEDIC_AYANAMSAS, VEDIC_NOTE, nakshatraSigns } from './wording';
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
        expect(angle(sunIndex * 30 + ours.sun!.degree!, lon('Sun'))).toBeLessThan(0.01);
        expect(angle(moonIndex * 30 + ours.moon!.degree!, lon('Moon'))).toBeLessThan(0.01);
        const ascIndex = signIndexForLongitude(engine.ascendant!.lon);
        expect(angle(ascIndex * 30 + ours.rising!.degree!, engine.ascendant!.lon)).toBeLessThan(0.01);
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

  it('reads the Moon sign and nakshatra first, then the Sun, then the lagna (ZOD-18)', async () => {
    const timed = await computeVedicSigns({ birthUtc: new Date('2000-01-01T12:00:00Z'), timeKnown: true, latitude: 28.61, longitude: 77.21, ayanamsa: 'lahiri' });
    const order = [timed.moon!.line, timed.moonNakshatra!.line, timed.sun!.line, timed.rising!.line].map((line) => timed.summary.indexOf(line));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(timed.summary.startsWith(timed.moon!.line)).toBe(true);
    // Untimed, with the Moon held all day: still the Moon and its nakshatra before the Sun, and no lagna.
    const moment = (moonLon: number) => ({ ayanamsa: 24, sun: { lon: 100, tropical: 124 }, moon: { lon: moonLon, tropical: moonLon + 24 }, rising: null, nakshatra: { index: 14, pada: 2 as const, lord: 'Rahu' } });
    const untimed = vedicReading({ timeKnown: false, placed: false, ayanamsa: 'lahiri', at: moment(193), ends: [moment(188), moment(198)] });
    expect(untimed.summary.indexOf(untimed.moon!.line)).toBe(0);
    expect(untimed.summary.indexOf(untimed.moonNakshatra!.line)).toBeLessThan(untimed.summary.indexOf(untimed.sun!.line));
    expect(untimed.rising).toBeNull();
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

  it('gives no pada and no pada limit for an untimed day, and walks the Western sign over the day', () => {
    const moment = (moonLon: number, index: number, pada: 1 | 2 | 3 | 4) => ({ ayanamsa: 24, sun: { lon: 100, tropical: 124 }, moon: { lon: moonLon, tropical: moonLon + 24 }, rising: null, nakshatra: { index, pada, lord: 'Mars' } });
    const base = { timeKnown: false, placed: false, ayanamsa: 'lahiri' as const };
    const open = vedicReading({ ...base, at: moment(193, 14, 2), ends: [moment(188, 14, 1), moment(198, 14, 4)] });
    expect(open.moonNakshatra).toMatchObject({ name: 'Swati', pada: null });
    expect(open).not.toHaveProperty('padaCandidates');
    expect(open.limits.join(' ')).not.toMatch(/quarters|pada \d/u);
    // Sidereal Libra all day; Western 212 to 222 stays in Scorpio.
    expect(open.moon).toMatchObject({ sign: 'libra', tropicalSign: 'scorpio', tropicalCandidates: [] });
    // Sidereal Libra 182 to 194 all day; Western 206 to 218 crosses from Libra into Scorpio, so the noon value is not given.
    const crossed = vedicReading({ ...base, at: moment(188, 14, 1), ends: [moment(182, 13, 3), moment(194, 14, 2)] });
    expect(crossed.moon).toMatchObject({ sign: 'libra', tropicalSign: null, tropicalCandidates: ['libra', 'scorpio'] });
    expect(crossed.sun).toMatchObject({ tropicalSign: 'leo', tropicalCandidates: [] });
    // With a birth time the noon walk does not apply.
    const timed = vedicReading({ ...base, timeKnown: true, at: moment(188, 14, 1), ends: null });
    expect(timed.moon).toMatchObject({ tropicalSign: 'scorpio', tropicalCandidates: [] });
  });

  it('lists every nakshatra and sign the Moon passed through, not only those at the ends of the day', () => {
    const moment = (moonLon: number, index: number) => ({ ayanamsa: 24, sun: { lon: 100, tropical: 124 }, moon: { lon: moonLon, tropical: moonLon + 24 }, rising: null, nakshatra: { index, pada: 1 as const, lord: 'Mars' } });
    const base = { timeKnown: false, placed: false, ayanamsa: 'lahiri' as const };
    // Swati (186.67 to 200) to Anuradha (213.33 to 226.67) passes through Vishakha.
    const three = vedicReading({ ...base, at: moment(205, 15), ends: [moment(199, 14), moment(214, 16)] });
    expect(three.nakshatraCandidates).toEqual(['Swati', 'Vishakha', 'Anuradha']);
    // Across Pisces into Aries: Revati to Bharani passes through Ashwini, and the 50 hour no-zone day can touch three signs.
    const wrap = vedicReading({ ...base, at: moment(5, 0), ends: [moment(358, 26), moment(15, 1)] });
    expect(wrap.nakshatraCandidates).toEqual(['Revati', 'Ashwini', 'Bharani']);
    const signs = vedicReading({ ...base, at: moment(45, 3), ends: [moment(29.5, 2), moment(61, 4)] });
    expect(signs.moonCandidates).toEqual(['Aries (Mesha)', 'Taurus (Vrishabha)', 'Gemini (Mithuna)']);
    expect(forwardRun(26, 1, 27)).toEqual([26, 0, 1]);
    expect(forwardRun(5, 5, 12)).toEqual([5]);
  });

  it('is built from a reading the same way the tool builds it', () => {
    const reading = vedicReading({ timeKnown: false, placed: false, ayanamsa: 'yukteswar', at: { ayanamsa: 22.4, sun: { lon: 100, tropical: 124 }, moon: { lon: 200, tropical: 224 }, rising: null, nakshatra: { index: 14, pada: 3, lord: 'Rahu' } }, ends: null });
    expect(vedicSignsShareQuery(reading)).toBe('s=cancer&m=libra&n=15&a=yukteswar');
  });
});

describe('birth time and Vedic placements (ZOD-18)', () => {
  const base = { timeKnown: false, placed: false, ayanamsa: 'lahiri' as const };
  const moment = (moonLon: number, index: number, pada: 1 | 2 | 3 | 4 = 1) => ({
    ayanamsa: 24,
    sun: { lon: 100, tropical: 124 },
    moon: { lon: moonLon, tropical: (moonLon + 24) % 360 },
    rising: null,
    nakshatra: { index, pada, lord: 'Rahu' },
  });

  it('includes Bharani between Ashwini and Krittika', () => {
    const fast = vedicReading({ ...base, at: moment(20, 1), ends: [moment(12, 0), moment(27.5, 2)] });
    expect(fast.moonNakshatra).toBeNull();
    expect(fast.nakshatraCandidates).toEqual(['Ashwini', 'Bharani', 'Krittika']);
    expect(fast.limits).toContain('The Moon changed nakshatra that day: it was in Ashwini, Bharani or Krittika. A birth time settles it.');
  });

  it('includes Ashwini between Revati and Bharani across the zodiac boundary', () => {
    const wrap = vedicReading({ ...base, at: moment(5, 0), ends: [moment(358, 26), moment(15, 1)] });
    expect(wrap.moonNakshatra).toBeNull();
    expect(wrap.nakshatraCandidates).toEqual(['Revati', 'Ashwini', 'Bharani']);
  });

  it('includes Aries between Pisces and Taurus across the zodiac boundary', () => {
    const signs = vedicReading({ ...base, at: moment(10, 0), ends: [moment(359, 26), moment(31, 2)] });
    expect(signs.moon).toBeNull();
    expect(signs.moonCandidates).toEqual([`Pisces (${RASHIS[11]})`, `Aries (${RASHIS[0]})`, `Taurus (${RASHIS[1]})`]);
    expect(signs.limits).toContain(`The Moon changed sign that day: it was in Pisces (${RASHIS[11]}), Aries (${RASHIS[0]}) or Taurus (${RASHIS[1]}). A birth time settles it.`);
  });

  it('omits degrees, pada and rising for held untimed placements', () => {
    const untimed = vedicReading({ ...base, at: moment(193, 14, 2), ends: [moment(188, 14, 1), moment(198, 14, 4)] });
    expect(untimed.sun).toMatchObject({ sign: 'cancer', degree: null });
    expect(untimed.moon).toMatchObject({ sign: 'libra', degree: null });
    expect(untimed.moonNakshatra).toMatchObject({ name: 'Swati', pada: null });
    expect(untimed.rising).toBeNull();
    expect(untimed.limits[0]).toBe('No birth time was given, so there is no rising sign (lagna), no degree and no pada, and the Moon sign and nakshatra are given only where the whole birth day keeps them.');
  });

  it('gives numeric degrees and pada at a known birth time', () => {
    const timed = vedicReading({ ...base, timeKnown: true, at: moment(193, 14, 2), ends: null });
    expect(timed.sun).toMatchObject({ degree: 10 });
    expect(timed.moon).toMatchObject({ degree: 13 });
    expect(timed.moonNakshatra).toMatchObject({ pada: 2 });
  });

  it('joins candidate names with a final or', () => {
    expect(listOr(['A'])).toBe('A');
    expect(listOr(['A', 'B'])).toBe('A or B');
    expect(listOr(['A', 'B', 'C', 'D'])).toBe('A, B, C or D');
  });
});
