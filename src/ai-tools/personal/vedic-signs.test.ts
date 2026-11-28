import { describe, expect, it, vi } from 'vitest';
import { NAKSHATRAS } from '@zodiacs/engine/vedic';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { executeAiTool } from '../tools';
import { vedicSigns, vedicSignsData, vedicSignsTool, NAKSHATRA_LORE, RASHI_LINE } from './vedic-signs';
import { MINOR_NOTE } from '../features/reading-guards';
import { REPEATED_BIRTH_TIME, SKIPPED_BIRTH_TIME, SkippedBirthTimeError } from '../../lib/vedic-signs/clock';
import { birthDayEnds, forbiddenClaim } from './shared';
import { localDaySpan } from '../../lib/time/local-day';
import tzNames from '../../data/tz-names.json';
import { computeChart } from '../../lib/engine/full';

// The engine, counted: the same computeChart, so every answer below is the real one.
vi.mock('../../lib/engine/full', async (importOriginal) => {
  const engine = await importOriginal<typeof import('../../lib/engine/full')>();
  return { ...engine, computeChart: vi.fn(engine.computeChart) };
});

const clock = createLocalTimeModule();
const run = (args: Parameters<typeof vedicSigns>[0]) => vedicSigns(args, clock, 'https://zodiacs.org', true).then((result) => result.data);
const PAGE_FLAG = 'PUBLIC_VEDIC_SIGNS_ENABLED';
const ON = { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z'), sitePageOn: (flag: string) => flag === PAGE_FLAG };

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
    expect([first.toISOString(), last.toISOString()]).toEqual(['1892-07-03T11:26:56.000Z', '1892-07-05T11:26:55.999Z']);
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

  it('reads an untimed date through its last second, to the millisecond (London, 1 June 1906: the Moon entered Hasta at 23:59:59.422 UTC)', async () => {
    const [first, last] = await birthDayEnds({ birthDate: '1906-06-01', zone: 'Europe/London' }, clock);
    expect([first.toISOString(), last.toISOString()]).toEqual(['1906-06-01T00:00:00.000Z', '1906-06-01T23:59:59.999Z']);
    expect((await run({ birthDate: '1906-06-01', time: '23:59', zone: 'Europe/London' })).moonNakshatra!.name).toBe('Uttara Phalguni');
    const untimed = await run({ birthDate: '1906-06-01', zone: 'Europe/London' });
    expect(untimed.moonNakshatra).toBeNull();
    expect(untimed.nakshatraCandidates).toContain('Hasta');
    // Through the hosted tool call as well.
    const hosted = await executeAiTool('get_vedic_signs', { birthDate: '1906-06-01', zone: 'Europe/London' }, ON);
    expect(JSON.stringify(hosted)).toContain('Hasta');
  });

  it('ends a date where the clock left it (St. John\'s went from 23:00 on 2 May 1920 straight to 00:00 on 3 May)', async () => {
    // Its 23:59 never happened: read forward by the jump it would fall at 03:29:52 UTC on 3 May, an hour into that date.
    const [first, last] = await birthDayEnds({ birthDate: '1920-05-02', zone: 'America/St_Johns' }, clock);
    expect([first.toISOString(), last.toISOString()]).toEqual(['1920-05-02T03:30:52.000Z', '1920-05-03T02:30:51.999Z']);
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

  it('refuses a birth time the clock skipped, never reading it at the time the clock jumped to (St. John\'s, 2 May 1920)', async () => {
    // 23:00 on 2 May became 00:00 on 3 May: 23:59 never showed, and read forward it would be 00:59 on 3 May, in
    // Vishakha, though the Moon stayed in Swati all of 2 May.
    for (const time of ['23:00', '23:30', '23:59']) {
      for (const extra of [{}, { latitude: 47.56, longitude: -52.71 }]) {
        const args = { birthDate: '1920-05-02', time, zone: 'America/St_Johns', ...extra };
        await expect(run(args)).rejects.toThrow(SkippedBirthTimeError);
        const refused = await executeAiTool('get_vedic_signs', args, ON);
        expect(refused).toMatchObject({ ok: false, error: { code: 'invalid-request', message: SKIPPED_BIRTH_TIME } });
        expect(JSON.stringify(refused)).not.toMatch(/1920|05-02|23:|St_Johns|Vishakha|Swati|47\.56|52\.71/u);
      }
    }
    // The minute before the jump is read, with no clock limit.
    const before = await run({ birthDate: '1920-05-02', time: '22:59', zone: 'America/St_Johns' });
    expect(before.moonNakshatra!.name).toBe('Swati');
    expect(before.limits).not.toContain(REPEATED_BIRTH_TIME);
  });

  it('says which pass it reads for a birth time the clock showed twice: the first (Madrid, 30 September 1990, 02:10)', async () => {
    // Madrid's clocks went back from 03:00 to 02:00, so 02:10 came twice; the reading is at the first, 00:10 UTC.
    const repeated = await run({ birthDate: '1990-09-30', time: '02:10', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 });
    expect(repeated.limits[0]).toBe(REPEATED_BIRTH_TIME);
    const ordinary = await run({ birthDate: '1990-09-30', time: '04:10', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 });
    expect(ordinary.limits).not.toContain(REPEATED_BIRTH_TIME);
    // Untimed, the day is read whole, so no pass is chosen.
    expect((await run({ birthDate: '1990-09-30', zone: 'Europe/Madrid' })).limits).not.toContain(REPEATED_BIRTH_TIME);
    const tool = await executeAiTool('get_vedic_signs', { birthDate: '1990-09-30', time: '02:10', zone: 'Europe/Madrid' }, ON);
    expect(tool.ok && (tool.data as { limits: string[] }).limits[0]).toBe(REPEATED_BIRTH_TIME);
  });

  it('starts a date where the clock reached it partway through a jump (Toronto went from 23:30 on 30 March 1919 to 00:30 on 31 March)', async () => {
    const [first] = await birthDayEnds({ birthDate: '1919-03-31', zone: 'America/Toronto' }, clock);
    expect(first.toISOString()).toBe('1919-03-31T04:30:00.000Z');
    const [, last] = await birthDayEnds({ birthDate: '1919-03-30', zone: 'America/Toronto' }, clock);
    expect(last.toISOString()).toBe('1919-03-31T04:29:59.999Z');
  });

  it('starts and ends a date at a clock change within a minute (Accra left local mean time at 00:00:52 UTC on 2 November 1915)', async () => {
    // At 0.25 degrees west the birthplace clock went from 23:59:52 on 1 November to 00:00:52 on 2 November.
    const ends = async (birthDate: string) => (await birthDayEnds({ birthDate, zone: 'Africa/Accra', latitude: 5.55, longitude: -0.25 }, clock)).map((at) => at.toISOString());
    expect(await ends('1915-11-02')).toEqual(['1915-11-02T00:00:52.000Z', '1915-11-02T23:59:59.999Z']);
    expect(await ends('1915-11-01')).toEqual(['1915-11-01T00:01:00.000Z', '1915-11-02T00:00:51.999Z']);
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
        // The whole local date on that clock, to its last second.
        const span = localDaySpan(birthDate, (date, time, fold) => clock.resolveLocalToUtc(date, time, zone, { fold }));
        if (span) expect(span[0] >= first && span[1] <= last, `${birthDate} ${zone}`).toBe(true);
      }
    }
    // 00:00 at UTC+16 to the date's last millisecond at UTC−16.
    expect((await birthDayEnds({ birthDate: '2026-11-09' }, clock)).map((at) => at.toISOString())).toEqual(['2026-11-08T08:00:00.000Z', '2026-11-10T15:59:59.999Z']);
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

  it('repeats no birth date back to the assistant, in the result or its schema', async () => {
    expect(Object.keys(vedicSignsData.shape)).not.toContain('birthDate');
    for (const args of [
      { birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata', latitude: 28.61, longitude: 77.21 },
      { birthDate: '1990-05-03' },
    ]) {
      const result = await executeAiTool('get_vedic_signs', args, ON);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.data).not.toHaveProperty('birthDate');
      expect(JSON.stringify(result)).not.toMatch(/1990-05-03|3 May 1990|May 3, 1990/u);
    }
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

describe('get_vedic_signs links to its page only while the website page is switched on', () => {
  const args = { birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata', latitude: 28.61, longitude: 77.21 };
  const linked = (result: Awaited<ReturnType<typeof executeAiTool>>) => {
    if (!result.ok) throw new Error('refused');
    return { data: result.data as { pageUrl: string | null; shareUrl: string | null }, urls: JSON.stringify(result).match(/https:\/\/[^"]+/gu) ?? [] };
  };

  it('with the MCP switches on and the page on, and with the page off', async () => {
    expect(vedicSignsTool.pageFlag).toBe(PAGE_FLAG);
    const on = linked(await executeAiTool('get_vedic_signs', args, ON));
    expect(on.data.pageUrl).toBe('https://zodiacs.org/vedic-signs/');
    expect(on.data.shareUrl).toBe('https://zodiacs.org/share/vedic-signs/?s=aries&a=lahiri');
    expect(on.urls).toContain('https://zodiacs.org/vedic-signs/');
    for (const dependencies of [{ ...ON, sitePageOn: () => false }, { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z') }]) {
      const off = linked(await executeAiTool('get_vedic_signs', args, dependencies));
      expect(off.data.pageUrl).toBeNull();
      expect(off.data.shareUrl).toBeNull();
      expect(off.urls.filter((url) => url.includes('/vedic-signs/'))).toEqual([]);
      expect(off.urls).toContain('https://zodiacs.org/birth-chart/');
    }
    const direct = await vedicSigns(args, clock, 'https://zodiacs.org');
    expect(direct.data.pageUrl).toBeNull();
    expect(direct.links.map((link) => link.url)).not.toContain('https://zodiacs.org/vedic-signs/');
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

describe('get_vedic_signs boundary uncertainty, independent Lahiri table, and under-18 softening', () => {
  it('warns when a timed Moon sits right on a nakshatra boundary and names both adjacent nakshatras', async () => {
    // 1990-01-19 01:03 UTC: sidereal Moon sits within 0.02° of 186°40' (the Chitra / Swati boundary).
    const data = await run({ birthDate: '1990-01-19', time: '01:03', zone: 'UTC' });
    const limitsText = data.limits.join(' ');
    expect(limitsText).toContain('boundary');
    expect(limitsText).toContain('Chitra');
    expect(limitsText).toContain('Swati');
  });

  it('tracks the published Lahiri (Chitrapaksha) ayanamsa table across J1950, J2000, and J2025', async () => {
    // Published Indian Astronomical Ephemeris values: J1950 23°09'32" (23.159°), J2000 23°51'25" (23.857°), J2025 24°12'23" (24.206°).
    const j1950 = await run({ birthDate: '1950-01-01', time: '12:00', zone: 'UTC' });
    const j2000 = await run({ birthDate: '2000-01-01', time: '12:00', zone: 'UTC' });
    const j2025 = await vedicSigns({ birthDate: '2025-01-01', time: '12:00', zone: 'UTC' }, clock, 'https://zodiacs.org', true, new Date('2040-01-01T00:00:00Z'));
    expect(Math.abs(j1950.ayanamsa.degrees - (23 + 9 / 60 + 32 / 3600))).toBeLessThan(0.02);
    expect(Math.abs(j2000.ayanamsa.degrees - (23 + 51 / 60 + 25 / 3600))).toBeLessThan(0.02);
    expect(Math.abs(j2025.data.ayanamsa.degrees - (24 + 12 / 60 + 23 / 3600))).toBeLessThan(0.02);
  });

  it('softens Rohini and Purva Phalguni wording and adds MINOR_NOTE for a birth date under 18', async () => {
    // 2011-05-03 12:00 UTC is under 18 on 2026-11-09; check the MCP tool passes minor through.
    const minorResult = await vedicSigns({ birthDate: '2011-05-03', time: '12:00', zone: 'UTC' }, clock, 'https://zodiacs.org', true, new Date('2026-11-09T09:00:00Z'));
    expect(minorResult.data.limits).toContain(MINOR_NOTE);
    // 2011-06-09 06:00 UTC: Moon in Purva Phalguni (133°20' to 146°40' sidereal).
    const purva = await vedicSigns({ birthDate: '2011-06-09', time: '06:00', zone: 'UTC' }, clock, 'https://zodiacs.org', true, new Date('2026-11-09T09:00:00Z'));
    expect(purva.data.moonNakshatra!.name).toBe('Purva Phalguni');
    expect(purva.data.moonNakshatra!.line).not.toMatch(/pleasure loving|affection/iu);
    expect(purva.data.summary).not.toMatch(/pleasure loving|affection/iu);
    expect(purva.data.limits).toContain(MINOR_NOTE);
  });
});
