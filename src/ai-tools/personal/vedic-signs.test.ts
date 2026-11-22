import { describe, expect, it, vi } from 'vitest';
import { NAKSHATRAS } from '@zodiacs/engine/vedic';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { executeAiTool } from '../tools';
import { NAKSHATRA_LORE, RASHI_LINE, vedicSigns, vedicSignsData } from './vedic-signs';
import { birthDayEnds, forbiddenClaim } from './shared';
import tzNames from '../../data/tz-names.json';
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
    expect(data.shareUrl).toBe('https://zodiacs.org/share/vedic-signs/?s=sagittarius&a=lahiri');
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

  it('gives no pada when the day keeps the nakshatra, and no pada limit', async () => {
    // 1990-01-18 UTC: the Moon stays in Chitra all day but crosses padas 1 to 4. 2000-01-05 UTC: it stays in Mula, padas 1 to 4.
    for (const [birthDate, name] of [['1990-01-18', 'Chitra'], ['2000-01-05', 'Mula']] as const) {
      const data = await run({ birthDate, zone: 'UTC' });
      expect(data.moonNakshatra, birthDate).toMatchObject({ name, pada: null });
      expect(data, birthDate).not.toHaveProperty('padaCandidates');
      expect(data.nakshatraCandidates, birthDate).toEqual([]);
      expect(data.limits.join(' '), birthDate).not.toMatch(/quarters|pada \d/u);
      expect(data.summary, birthDate).not.toMatch(/pada \d/u);
    }
    // With a birth time the same day gives one pada.
    const timed = await run({ birthDate: '1990-01-18', time: '12:00', zone: 'UTC' });
    expect(timed.moonNakshatra!.pada).toBeGreaterThanOrEqual(1);
  });

  it('gives the Western sign only where the whole birth day keeps it', async () => {
    // 2000-03-20 UTC: the Sun stays in sidereal Meena but enters Western Aries at the equinox, 07:35 UTC.
    const equinox = await run({ birthDate: '2000-03-20', zone: 'UTC' });
    expect(equinox.sun).toMatchObject({ rashi: 'Meena', tropicalSign: null, tropicalCandidates: ['pisces', 'aries'] });
    expect(vedicSignsData.safeParse(equinox).success).toBe(true);
    // 2000-02-09 in Kolkata: the Moon stays in sidereal Meena while it moves from Western Pisces into Aries.
    const moon = await run({ birthDate: '2000-02-09', zone: 'Asia/Kolkata' });
    expect(moon.moon).toMatchObject({ rashi: 'Meena', tropicalSign: null, tropicalCandidates: ['pisces', 'aries'] });
    // 2000-02-12 in Kolkata: the Moon stays in sidereal Mesha and in Western Taurus all day, so both are given.
    const held = await run({ birthDate: '2000-02-12', zone: 'Asia/Kolkata' });
    expect(held.moon).toMatchObject({ rashi: 'Mesha', tropicalSign: 'taurus', tropicalCandidates: [] });
    // A timed birth on the equinox has one Western sign.
    const timed = await run({ birthDate: '2000-03-20', time: '12:00', zone: 'UTC' });
    expect(timed.sun).toMatchObject({ tropicalSign: 'aries', tropicalCandidates: [] });
  });

  it('gives the Sun sign alone when the day keeps it, with no place given', async () => {
    const data = await run({ birthDate: '1990-05-03' });
    expect(data.sun).toMatchObject({ rashi: 'Mesha', tropicalSign: 'taurus', degree: null });
    expect(data.placed).toBe(false);
    // Without a birth time the output parses with no degree and no pada, and the timed call still prints both.
    expect(vedicSignsData.safeParse(data).success).toBe(true);
    const held = await run({ birthDate: '2000-01-05', zone: 'UTC' });
    expect(held.moon!.degree).toBeNull();
    expect(held.moonNakshatra!.pada).toBeNull();
    const timed = await run({ birthDate: '1990-01-18', time: '12:00', zone: 'UTC' });
    expect(typeof timed.sun!.degree).toBe('number');
    expect(typeof timed.moon!.degree).toBe('number');
    expect(typeof timed.moonNakshatra!.pada).toBe('number');
  });

  it('settles nothing without a zone that a historical clock could unsettle (Manila kept the American date until 1845)', async () => {
    // 1844-01-07 on Manila's clock was UTC−15:56:08: the Moon was in Karka at its 00:00 and in Simha at its 23:59.
    const early = await run({ birthDate: '1844-01-07', time: '00:00', zone: 'Asia/Manila' });
    const late = await run({ birthDate: '1844-01-07', time: '23:59', zone: 'Asia/Manila' });
    expect([early.moon!.rashi, late.moon!.rashi]).toEqual(['Karka', 'Simha']);
    const untimed = await run({ birthDate: '1844-01-07' });
    expect(untimed.moon).toBeNull();
    expect(untimed.moonCandidates.join(' ')).toMatch(/Karka/u);
    expect(untimed.moonCandidates.join(' ')).toMatch(/Simha/u);
    // Anything the untimed answer does settle is what every clock's version of the day gives.
    if (untimed.sun) for (const timed of [early, late]) expect(timed.sun!.rashi).toBe(untimed.sun.rashi);
  });

  it('covers the whole of a date the clock showed twice (Apia lived 4 July 1892 twice, moving to the American date)', async () => {
    // Its first 00:00 was 1892-07-03T11:26:56Z on UTC+12:33:04; its second 23:59 ended 1892-07-05T11:26:55Z on UTC−11:26:56.
    const [first, last] = await birthDayEnds({ birthDate: '1892-07-04', zone: 'Pacific/Apia' }, clock);
    expect([first.toISOString(), last.toISOString()]).toEqual(['1892-07-03T11:26:56.000Z', '1892-07-05T11:26:55.000Z']);
    // The Moon was in Chitra at the first 00:00, in Swati at the first 23:59 and in Vishakha by the second.
    expect((await run({ birthDate: '1892-07-04', time: '00:00', zone: 'Pacific/Apia' })).moonNakshatra!.name).toBe('Chitra');
    expect((await run({ birthDate: '1892-07-04', time: '23:59', zone: 'Pacific/Apia' })).moonNakshatra!.name).toBe('Swati');
    expect((await run({ birthDate: '1892-07-05', time: '00:00', zone: 'Pacific/Apia' })).moonNakshatra!.name).toBe('Vishakha');
    const untimed = await run({ birthDate: '1892-07-04', zone: 'Pacific/Apia' });
    expect(untimed.moonNakshatra).toBeNull();
    expect(untimed.nakshatraCandidates).toEqual(['Chitra', 'Swati', 'Vishakha']);
    // The same with the birthplace's own mean time.
    expect((await run({ birthDate: '1892-07-04', zone: 'Pacific/Apia', latitude: -13.83, longitude: -171.76 })).nakshatraCandidates).toEqual(['Chitra', 'Swati', 'Vishakha']);
  });

  it('ends a date where the clock left it (St. John\'s went from 23:00 on 2 May 1920 straight to 00:00 on 3 May)', async () => {
    // Its 23:59 never happened: read forward by the jump it would fall at 03:29:52 UTC on 3 May, an hour into that date.
    const [first, last] = await birthDayEnds({ birthDate: '1920-05-02', zone: 'America/St_Johns' }, clock);
    expect([first.toISOString(), last.toISOString()]).toEqual(['1920-05-02T03:30:52.000Z', '1920-05-03T02:30:51.000Z']);
    // The Moon stayed in Swati the whole local date and reached Vishakha only in the hour the old span ran on into.
    expect((await run({ birthDate: '1920-05-02', time: '00:00', zone: 'America/St_Johns' })).moonNakshatra!.name).toBe('Swati');
    expect((await run({ birthDate: '1920-05-02', time: '22:59', zone: 'America/St_Johns' })).moonNakshatra!.name).toBe('Swati');
    expect((await run({ birthDate: '1920-05-03', time: '00:59', zone: 'America/St_Johns' })).moonNakshatra!.name).toBe('Vishakha');
    for (const extra of [{}, { latitude: 47.56, longitude: -52.71 }]) {
      const untimed = await run({ birthDate: '1920-05-02', zone: 'America/St_Johns', ...extra });
      expect(untimed.moonNakshatra?.name).toBe('Swati');
      expect(untimed.nakshatraCandidates).toEqual([]);
      const tool = await executeAiTool('get_vedic_signs', { birthDate: '1920-05-02', zone: 'America/St_Johns', ...extra }, ON);
      expect(tool.ok).toBe(true);
      expect(JSON.stringify(tool)).not.toMatch(/Vishakha/u);
    }
  });

  it('starts a date where the clock reached it partway through a jump (Toronto went from 23:30 on 30 March 1919 to 00:30 on 31 March)', async () => {
    const [first] = await birthDayEnds({ birthDate: '1919-03-31', zone: 'America/Toronto' }, clock);
    expect(first.toISOString()).toBe('1919-03-31T04:30:00.000Z');
    const [, last] = await birthDayEnds({ birthDate: '1919-03-30', zone: 'America/Toronto' }, clock);
    expect(last.toISOString()).toBe('1919-03-31T04:29:59.000Z');
  });

  it('refuses a date the clock never showed (Apia went from 29 to 31 December 2011) without repeating it, timed or not', async () => {
    for (const extra of [{}, { time: '12:00' }, { time: '12:00', latitude: -13.83, longitude: -171.76 }]) {
      const args = { birthDate: '2011-12-30', zone: 'Pacific/Apia', ...extra };
      await expect(run(args)).rejects.toThrow(RangeError);
      const refused = await executeAiTool('get_vedic_signs', args, ON);
      expect(refused).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
      expect(JSON.stringify(refused)).not.toMatch(/2011|12-30|Apia|13\.83|171\.76/u);
    }
    await expect(birthDayEnds({ birthDate: '2011-12-30', zone: 'Pacific/Apia' }, clock)).rejects.toThrow(RangeError);
    // The dates either side, and the same date on another clock, are answered.
    for (const args of [{ birthDate: '2011-12-29', zone: 'Pacific/Apia' }, { birthDate: '2011-12-31', zone: 'Pacific/Apia' }, { birthDate: '2011-12-30', zone: 'Pacific/Pago_Pago' }, { birthDate: '2011-12-30' }])
      expect((await executeAiTool('get_vedic_signs', args, ON)).ok, JSON.stringify(args)).toBe(true);
  });

  it('takes every clock in tzdb since 1800 into the window of a date given without a zone', async () => {
    // The names the runtime's own time zone data knows: a name it does not know is refused before any clock reads it.
    const zones = tzNames.names.filter((zone) => { try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; } });
    expect(zones.length).toBeGreaterThan(400);
    expect(zones).toEqual(expect.arrayContaining(['Asia/Manila', 'America/Metlakatla', 'Pacific/Kiritimati']));
    for (const birthDate of ['1800-01-01', '1844-01-07', '1866-06-01', '2026-11-09']) {
      const [first, last] = await birthDayEnds({ birthDate }, clock);
      for (const zone of zones) {
        await clock.prepareLocalTime(birthDate, zone);
        for (const time of ['00:00', '23:59']) {
          const at = clock.resolveLocalToUtc(birthDate, time, zone).utc.getTime();
          expect(at >= first.getTime() && at <= last.getTime(), `${birthDate} ${time} ${zone}`).toBe(true);
        }
      }
    }
  }, 60_000);
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

  it('checks the zone before any clock reads it, refusing an unknown one without repeating it and taking a known one in any letter case', async () => {
    const refused = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', zone: 'Mars/Olympus_Mons' }, ON);
    expect(refused).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(JSON.stringify(refused)).not.toMatch(/Mars|Olympus/u);
    const lower = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', time: '08:30', zone: 'asia/kolkata' }, ON);
    const exact = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata' }, ON);
    expect(lower.ok).toBe(true);
    expect(lower).toEqual(exact);
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
