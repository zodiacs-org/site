import { describe, expect, it, vi } from 'vitest';
import { NAKSHATRAS } from '@zodiacs/engine/vedic';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { executeAiTool } from '../tools';
import { NAKSHATRA_LORE, RASHI_LINE, vedicSigns } from './vedic-signs';
import { forbiddenClaim } from './shared';
import { computeChart } from '../../lib/engine/full';

// The engine, counted: the same computeChart, so every answer below is the real one.
vi.mock('../../lib/engine/full', async (importOriginal) => {
  const engine = await importOriginal<typeof import('../../lib/engine/full')>();
  return { ...engine, computeChart: vi.fn(engine.computeChart) };
});

const clock = createLocalTimeModule();
const run = (args: Parameters<typeof vedicSigns>[0]) => vedicSigns(args, clock, 'https://zodiacs.org').then((result) => result.data);
const ON = { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z') };

describe('get_vedic_signs against known answers', () => {
  it('gives the Lahiri ayanamsa at J2000 as published (23 degrees 51 minutes) and the J2000 Sun and Moon', async () => {
    // 2000-01-01 12:00 UTC: tropical Sun 280.37 (Capricorn), sidereal 256.52 (Dhanu); Moon tropical 223.32, sidereal 199.47 in Swati pada 4.
    const data = await run({ birthDate: '2000-01-01', time: '12:00', zone: 'UTC', latitude: 28.61, longitude: 77.21 });
    expect(data.ayanamsa.degrees).toBeCloseTo(23.853, 2);
    expect(data.sun).toMatchObject({ sign: 'sagittarius', rashi: 'Dhanu', tropicalSign: 'capricorn' });
    expect(data.sun!.degree).toBeCloseTo(16.52, 1);
    expect(data.moon).toMatchObject({ sign: 'libra', rashi: 'Tula', tropicalSign: 'scorpio' });
    expect(data.moonNakshatra).toMatchObject({ name: 'Swati', number: 15, pada: 4, lord: 'Rahu' });
    expect(data.rising).not.toBeNull();
    expect(data.pageUrl).toBe('https://zodiacs.org/vedic-signs/');
    expect(data.shareUrl).toBe(`https://zodiacs.org/share/vedic-signs/?s=sagittarius&m=libra&r=${data.rising!.sign}&n=15&a=lahiri`);
  });

  it('puts the sidereal Sun into Makara around Makar Sankranti (14 to 15 January) and into Mesha around Mesha Sankranti (14 April)', async () => {
    expect((await run({ birthDate: '2001-01-12', time: '12:00', zone: 'UTC' })).sun!.rashi).toBe('Dhanu');
    expect((await run({ birthDate: '2001-01-17', time: '12:00', zone: 'UTC' })).sun!.rashi).toBe('Makara');
    expect((await run({ birthDate: '1995-04-12', time: '12:00', zone: 'UTC' })).sun!.rashi).toBe('Meena');
    expect((await run({ birthDate: '1995-04-16', time: '12:00', zone: 'UTC' })).sun!.rashi).toBe('Mesha');
  });

  it('keeps sidereal equal to tropical less the ayanamsa, and other ayanamsas within their published offsets of Lahiri', async () => {
    const lahiri = await run({ birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata' });
    const fagan = await run({ birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata', ayanamsa: 'fagan-bradley' });
    const raman = await run({ birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata', ayanamsa: 'raman' });
    // Fagan and Bradley runs about 0.88 degrees ahead of Lahiri; Raman about 1.45 degrees behind it.
    expect(fagan.ayanamsa.degrees - lahiri.ayanamsa.degrees).toBeCloseTo(0.88, 1);
    expect(lahiri.ayanamsa.degrees - raman.ayanamsa.degrees).toBeCloseTo(1.45, 1);
    expect(lahiri.ayanamsa.label).toBe('Lahiri (Chitrapaksha)');
  });

  it('places nakshatras on 13 degree 20 minute boundaries, every one with its lore', () => {
    expect(NAKSHATRAS).toHaveLength(27);
    for (const name of NAKSHATRAS) expect(NAKSHATRA_LORE[name], name).toBeDefined();
    expect(RASHI_LINE).toHaveLength(12);
    for (const text of [...RASHI_LINE, ...Object.values(NAKSHATRA_LORE).map((lore) => `${lore.deity} ${lore.symbol} ${lore.line}`)]) expect(forbiddenClaim(text), text).toBeNull();
  });
});

describe('get_vedic_signs without a birth time', () => {
  it('gives no rising sign, and lists both Moon signs and nakshatras when the Moon changed that day', async () => {
    // 2000-01-02: the Moon crosses from sidereal Tula into Vrishchika during the day.
    const data = await run({ birthDate: '2000-01-02', zone: 'UTC' });
    expect(data.rising).toBeNull();
    expect(data.timeKnown).toBe(false);
    expect(data.moon).toBeNull();
    expect(data.moonCandidates).toEqual(['Libra (Tula)', 'Scorpio (Vrishchika)']);
    expect(data.nakshatraCandidates).toEqual(['Vishakha', 'Anuradha']);
    // With no zone the day runs about 50 hours, and the Moon passes from Swati through Vishakha into Anuradha.
    expect((await run({ birthDate: '2000-01-02' })).nakshatraCandidates).toEqual(['Swati', 'Vishakha', 'Anuradha']);
    expect(data.limits.join(' ')).toContain('A birth time settles it');
    expect(data.confidenceLabel).toBe('Reading confidence 55%');
    // The share link leaves out the Moon sign the day did not settle, and has no rising sign.
    expect(data.shareUrl).not.toMatch(/[?&](?:m|r)=/u);
  });

  it('leaves the pada open, with its candidates, when the day keeps the nakshatra but not the pada', async () => {
    // 1990-01-18 UTC: the Moon stays in Chitra all day but crosses padas 1 to 4. 2000-01-05 UTC: it stays in Mula, padas 1 to 4.
    for (const [birthDate, name] of [['1990-01-18', 'Chitra'], ['2000-01-05', 'Mula']] as const) {
      const data = await run({ birthDate, zone: 'UTC' });
      expect(data.moonNakshatra, birthDate).toMatchObject({ name, pada: null });
      expect(data.padaCandidates, birthDate).toEqual([1, 2, 3, 4]);
      expect(data.nakshatraCandidates, birthDate).toEqual([]);
      expect(data.limits.join(' '), birthDate).toContain(`The Moon stayed in ${name} that day but moved through more than one of its quarters (padas): pada 1, 2, 3 or 4. A birth time settles it.`);
      expect(data.summary, birthDate).not.toMatch(/pada \d/u);
    }
    // With a birth time the same day gives one pada and no candidates.
    const timed = await run({ birthDate: '1990-01-18', time: '12:00', zone: 'UTC' });
    expect(timed.moonNakshatra!.pada).toBeGreaterThanOrEqual(1);
    expect(timed.padaCandidates).toEqual([]);
  });

  it('gives the Sun sign alone when the day keeps it, with no place given', async () => {
    const data = await run({ birthDate: '1990-05-03' });
    expect(data.sun).toMatchObject({ rashi: 'Mesha', tropicalSign: 'taurus' });
    expect(data.placed).toBe(false);
  });
});

describe('get_vedic_signs privacy and refusals', () => {
  it('is not offered with the switch off, refuses a child, and puts no birth detail in a link', async () => {
    expect((await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03' }, { occasions: true, coverage: true })).ok).toBe(false);
    expect(await executeAiTool('get_vedic_signs', { birthDate: '2020-05-03' }, ON)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    const result = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata', latitude: 28.61, longitude: 77.21 }, ON);
    expect(result.ok).toBe(true);
    const text = JSON.stringify(result);
    for (const url of text.match(/https:\/\/[^"]+/gu) ?? []) expect(url).not.toMatch(/1990|08:30|28\.61|77\.21|Kolkata/u);
    expect(forbiddenClaim(text)).toBeNull();
  });

  it('refuses a time without a zone, naming the field rule, and an unknown ayanamsa', async () => {
    expect(await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', time: '08:30' }, ON)).toMatchObject({ ok: false, error: { message: 'A birth time or a place needs its time zone.' } });
    expect(await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', ayanamsa: 'galactic' }, ON)).toMatchObject({ ok: false, error: { message: expect.stringContaining('ayanamsa must be one of') } });
  });
});

describe('get_vedic_signs casts each chart once', () => {
  it('runs the engine once for a timed birth, and once at noon and at each end of the day for an untimed one', async () => {
    const charts = vi.mocked(computeChart);
    charts.mockClear();
    await run({ birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata', latitude: 28.61, longitude: 77.21 });
    expect(charts).toHaveBeenCalledTimes(1);
    charts.mockClear();
    await run({ birthDate: '1990-05-03', zone: 'Asia/Kolkata' });
    expect(charts).toHaveBeenCalledTimes(3);
  });
});
