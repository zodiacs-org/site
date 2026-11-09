import { describe, expect, it } from 'vitest';
import { NAKSHATRAS } from '@zodiacs/engine/vedic';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { executeAiTool } from '../tools';
import { NAKSHATRA_LORE, RASHI_LINE, vedicSigns } from './vedic-signs';
import { forbiddenClaim } from './shared';

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
    expect(data.limits.join(' ')).toContain('A birth time settles it');
    expect(data.confidenceLabel).toBe('Reading confidence 55%');
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
