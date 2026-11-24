import { afterEach, describe, expect, it, vi } from 'vitest';
import { vedicFromTropical } from './sidereal';
import type { TropicalMoment } from './tropical';
import { computeVedicFromForm, prepareLocalTime, type VedicFormInput } from '../../islands/vedic-signs/compute';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { vedicSigns } from '../../ai-tools/personal/vedic-signs';
import { birthDayEnds } from '../../ai-tools/personal/shared';
import { roundCoordinate } from '../../ai-tools/plain-text';
import { roundPlace } from './place';
import { REPEATED_BIRTH_TIME, SKIPPED_BIRTH_DATE, SkippedBirthDateError, SkippedBirthTimeError } from './clock';
import { untimedInstant } from './untimed';
import { executeAiTool } from '../../ai-tools/tools';

/** The instants get_vedic_signs casts its chart at, recorded on the way through to the real calculation. */
const toolInstants = vi.hoisted(() => [] as Date[]);
vi.mock('./compute', async (original) => {
  const real = await original<typeof import('./compute')>();
  return { ...real, computeVedicSigns: (input: Parameters<typeof real.computeVedicSigns>[0]) => { toolInstants.push(input.birthUtc); return real.computeVedicSigns(input); } };
});

/**
 * The page's worker, run in this thread: the same sidereal half
 * (src/islands/vedic-signs/vedic.worker.ts posts vedicFromTropical's reading back), so the test
 * reads the instants the page hands it.
 */
const posted: { ends: { utc: string }[] | null }[] = [];
class InlineWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(message: { ayanamsa: VedicFormInput['ayanamsa']; at: { utc: string }; ends: { utc: string }[] | null }) {
    posted.push(message);
    const moment = (wire: { utc: string }) => ({ ...wire, utc: new Date(wire.utc) }) as unknown as TropicalMoment;
    const { ayanamsa, at, ends, ...rest } = message;
    const reading = vedicFromTropical({ ...(rest as object), at: moment(at), ends: ends ? ends.map(moment) : null } as never, ayanamsa);
    queueMicrotask(() => this.onmessage?.({ data: { reading } }));
  }
  terminate() {}
}

afterEach(() => { vi.unstubAllGlobals(); posted.length = 0; toolInstants.length = 0; });

const APIA = { tz: 'Pacific/Apia', lat: -13.83, lon: -171.76 };
const ST_JOHNS = { tz: 'America/St_Johns', lat: 47.56, lon: -52.71 };
async function form(birthDate: string, birthTime: string | null, place: VedicFormInput['place'] = APIA) {
  vi.stubGlobal('Worker', InlineWorker);
  const input: VedicFormInput = { birthDate, birthTime, place, ayanamsa: 'lahiri' };
  await prepareLocalTime(input.birthDate, input.place.tz);
  return computeVedicFromForm(input);
}

describe('the /vedic-signs/ page on a clock that repeated or skipped a date', () => {
  it('reads the whole of a date the clock showed twice (Apia, 4 July 1892), as the tool does', async () => {
    const reading = await form('1892-07-04', null);
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(['1892-07-03T11:27:02.000Z', '1892-07-05T11:27:01.999Z']);
    expect(reading.moonNakshatra).toBeNull();
    expect(reading.nakshatraCandidates).toEqual(['Chitra', 'Swati', 'Vishakha']);
  });

  it('ends a date where the clock left it (St. John\'s, 23:00 on 2 May 1920 became 00:00 on 3 May), as the tool does', async () => {
    const reading = await form('1920-05-02', null, ST_JOHNS);
    // Not 03:30:51 UTC, where its skipped 23:59 read forward by the jump would end it.
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(['1920-05-02T03:30:52.000Z', '1920-05-03T02:30:51.999Z']);
    expect(reading.moonNakshatra?.name).toBe('Swati');
    expect(reading.nakshatraCandidates).toEqual([]);
  });

  it('starts and ends a date at a clock change within a minute (Accra, 2 November 1915), as the tool does', async () => {
    // At 0.25 degrees west the birthplace clock went from 23:59:52 on 1 November to 00:00:52 on 2 November.
    const accra = { tz: 'Africa/Accra', lat: 5.55, lon: -0.25 };
    await form('1915-11-02', null, accra);
    await form('1915-11-01', null, accra);
    expect(posted.map((message) => message.ends!.map((end) => end.utc))).toEqual([
      ['1915-11-02T00:00:52.000Z', '1915-11-02T23:59:59.999Z'],
      ['1915-11-01T00:01:00.000Z', '1915-11-02T00:00:51.999Z'],
    ]);
  });

  it('reads an untimed date to its last millisecond (London, 1 June 1906: the Moon entered Hasta at 23:59:59.422 UTC), as the tool does', async () => {
    const LONDON = { tz: 'Europe/London', lat: 51.51, lon: -0.13 };
    const page = await form('1906-06-01', null, LONDON);
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(['1906-06-01T00:00:00.000Z', '1906-06-01T23:59:59.999Z']);
    expect(page.moonNakshatra).toBeNull();
    expect(page.nakshatraCandidates).toContain('Hasta');
    const answer = (await vedicSigns({ birthDate: '1906-06-01', zone: LONDON.tz, latitude: LONDON.lat, longitude: LONDON.lon }, createLocalTimeModule(), 'https://zodiacs.org')).data;
    expect(answer.moonNakshatra).toBeNull();
    expect(answer.nakshatraCandidates).toEqual(page.nakshatraCandidates);
    // The Moon was still in Uttara Phalguni a second earlier: the last second of the date decides it.
    const before = (await vedicSigns({ birthDate: '1906-06-01', time: '23:59', zone: LONDON.tz }, createLocalTimeModule(), 'https://zodiacs.org')).data;
    expect(before.moonNakshatra!.name).toBe('Uttara Phalguni');
  });

  it('refuses a date the clock never showed (Apia, 30 December 2011) before anything is worked out, timed or not', async () => {
    for (const time of [null, '12:00']) {
      await expect(form('2011-12-30', time)).rejects.toThrow(RangeError);
      expect(posted).toHaveLength(0);
    }
    await expect(form('2011-12-31', null)).resolves.toBeTruthy();
  });
});

describe('the /vedic-signs/ page on a birth time the clock skipped or repeated, as the tool reads it', () => {
  it('refuses a skipped time before anything is worked out (St. John\'s, 23:59 on 2 May 1920)', async () => {
    for (const time of ['23:00', '23:59']) {
      await expect(form('1920-05-02', time, ST_JOHNS)).rejects.toThrow(SkippedBirthTimeError);
      expect(posted).toHaveLength(0);
    }
    expect((await form('1920-05-02', '22:59', ST_JOHNS)).moonNakshatra!.name).toBe('Swati');
  });

  it('reads a repeated time at its first pass and says so, with the tool\'s limits (Madrid, 02:10 on 30 September 1990)', async () => {
    const MADRID = { tz: 'Europe/Madrid', lat: 40.42, lon: -3.7 };
    const page = await form('1990-09-30', '02:10', MADRID);
    expect(page.limits[0]).toBe(REPEATED_BIRTH_TIME);
    const tool = (await vedicSigns({ birthDate: '1990-09-30', time: '02:10', zone: MADRID.tz, latitude: MADRID.lat, longitude: MADRID.lon }, createLocalTimeModule(), 'https://zodiacs.org')).data;
    expect(page.limits).toEqual(tool.limits);
    expect(page.rising).toEqual(tool.rising);
    expect((await form('1990-09-30', '04:10', MADRID)).limits).not.toContain(REPEATED_BIRTH_TIME);
  });
});

describe('the /vedic-signs/ page and the get_vedic_signs tool on the same birth', () => {
  // The tool's resolver, as the hosted tools run it; the page uses the site's.
  const tool = (birthDate: string, time: string | undefined, place: VedicFormInput['place']) => vedicSigns(
    { birthDate, ...(time ? { time } : {}), zone: place.tz, latitude: place.lat, longitude: place.lon },
    createLocalTimeModule(), 'https://zodiacs.org',
  ).then((result) => result.data);
  const NEW_YORK = { tz: 'America/New_York', lat: 40.7128, lon: -74.006 };
  const signs = (reading: { sun: { sign: string; degree: number | null } | null; moon: { sign: string; degree: number | null } | null; rising: { sign: string; degree: number | null } | null; moonNakshatra: { name: string; pada: number | null } | null; sunCandidates: string[]; moonCandidates: string[]; nakshatraCandidates: string[] }) => ({
    sun: reading.sun, moon: reading.moon, rising: reading.rising, moonNakshatra: reading.moonNakshatra,
    sunCandidates: reading.sunCandidates, moonCandidates: reading.moonCandidates, nakshatraCandidates: reading.nakshatraCandidates,
  });

  it('reads local mean time at the rounded longitude, as the tool does (New York, 11 May 1880, 03:34)', async () => {
    // Before 18 November 1883 New York kept its own mean time: 74.006 degrees
    // west is 4h56m01.44s behind UTC, 74.01 is 4h56m02.4s. That second puts
    // the rising degree on the Pisces to Aries boundary, so the page must
    // read the clock at the longitude the tool reads it at.
    const page = await form('1880-05-11', '03:34', NEW_YORK);
    const answer = await tool('1880-05-11', '03:34', NEW_YORK);
    expect(answer.rising?.sign).toBe('aries');
    expect(signs(page)).toEqual(signs(answer));
  });

  it('reads the same untimed day ends as the tool before 1883 (New York, 11 May 1880)', async () => {
    const page = await form('1880-05-11', null, NEW_YORK);
    const answer = await tool('1880-05-11', undefined, NEW_YORK);
    const ends = await birthDayEnds({ birthDate: '1880-05-11', zone: NEW_YORK.tz, latitude: NEW_YORK.lat, longitude: NEW_YORK.lon }, createLocalTimeModule());
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(ends.map((end) => end.toISOString()));
    expect(signs(page)).toEqual(signs(answer));
  });

  it('names an untimed reading from inside the date when the clock left it before noon (Manila, 31 December 1844), as the tool does', async () => {
    // Manila moved to the Asian side of the date line at the end of 1844 and kept 31 December for about three seconds.
    // Its local noon resolves onto 1 January, where the Moon was in Hasta; both ends of the date, and so the reading,
    // have it in Uttara Phalguni.
    const MANILA = { tz: 'Asia/Manila', lat: 14.6, lon: 120.98 };
    const page = await form('1844-12-31', null, MANILA);
    const ends = posted[0].ends!.map((end) => Date.parse(end.utc));
    expect(ends[1] - ends[0]).toBeLessThan(60_000);
    // The instant the page read the names at lies inside the date's span.
    const at = Date.parse((posted[0] as unknown as { at: { utc: string } }).at.utc);
    expect(at).toBeGreaterThanOrEqual(ends[0]);
    expect(at).toBeLessThanOrEqual(ends[1]);
    expect(page.nakshatraCandidates).toEqual([]);
    expect(page.moonNakshatra?.name).toBe('Uttara Phalguni');
    const answer = await tool('1844-12-31', undefined, MANILA);
    expect(answer.moonNakshatra?.name).toBe('Uttara Phalguni');
    expect(signs(page)).toEqual(signs(answer));
    // An ordinary date keeps local noon.
    const noon = new Date('2026-11-09T05:00:00Z');
    expect(untimedInstant(noon, [new Date('2026-11-08T17:00:00Z'), new Date('2026-11-09T16:59:59Z')], [])).toBe(noon);
  });

  it('reads an untimed birth at the middle of the date when the clock skipped noon on it (Khartoum, 15 January 2000), as the tool does', async () => {
    // Sudan moved from UTC+2 to UTC+3 at noon on 15 January 2000: 12:00 became 13:00, so the date never showed
    // noon. The resolver reads that noon at 10:00 UTC (13:00 on the new clock), still inside the date; neither the
    // page nor the tool reads there, but at the middle of the date's span.
    const KHARTOUM = { tz: 'Africa/Khartoum', lat: 15.55, lon: 32.53 };
    const middle = '2000-01-15T09:29:59.999Z';
    const page = await form('2000-01-15', null, KHARTOUM);
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(['2000-01-14T22:00:00.000Z', '2000-01-15T20:59:59.999Z']);
    expect((posted[0] as unknown as { at: { utc: string } }).at.utc).toBe(middle);
    const answer = await tool('2000-01-15', undefined, KHARTOUM);
    expect(toolInstants.map((at) => at.toISOString())).toEqual([middle]);
    expect(signs(page)).toEqual(signs(answer));
    // The flag alone decides it: a skipped noon that still lies inside the date takes the middle too.
    const span = [new Date('2000-01-14T22:00:00Z'), new Date('2000-01-15T20:59:59.999Z')] as const;
    expect(untimedInstant(new Date('2000-01-15T10:00:00Z'), span, ['dst-gap']).toISOString()).toBe(middle);
    expect(untimedInstant(new Date('2000-01-15T10:00:00Z'), span, []).toISOString()).toBe('2000-01-15T10:00:00.000Z');
  });

  it('refuses a date the clock never showed with its own sentence, on the page and in the tool (Apia, 30 December 2011)', async () => {
    await expect(form('2011-12-30', null)).rejects.toThrow(SkippedBirthDateError);
    await expect(form('2011-12-30', null)).rejects.toThrow(SKIPPED_BIRTH_DATE);
    for (const placed of [{ latitude: APIA.lat, longitude: APIA.lon }, {}]) {
      const args = { birthDate: '2011-12-30', zone: APIA.tz, ...placed };
      await expect(vedicSigns(args, createLocalTimeModule(), 'https://zodiacs.org')).rejects.toThrow(SkippedBirthDateError);
      const refused = await executeAiTool('get_vedic_signs', args, { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z') });
      expect(refused, JSON.stringify(placed)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: SKIPPED_BIRTH_DATE } });
      expect(JSON.stringify(refused)).not.toMatch(/2011|12-30|Apia|13\.83|171/u);
    }
  });

  it('gives the same answer on a modern date (Kolkata, 3 May 1990, 08:30)', async () => {
    const kolkata = { tz: 'Asia/Kolkata', lat: 22.5726, lon: 88.3639 };
    const page = await form('1990-05-03', '08:30', kolkata);
    const answer = await tool('1990-05-03', '08:30', kolkata);
    expect(answer.rising).not.toBeNull();
    expect(signs(page)).toEqual(signs(answer));
  });
});

describe('the page rounds a birthplace as the tools do', () => {
  it('gives roundCoordinate\'s answer for every coordinate, so the page and get_vedic_signs read the same place', () => {
    for (const value of [-74.006, 74.005, -0.005, 0.015, 1.005, -52.715, 179.995, -180, 40.7128, 28.6139, 77.209]) expect(roundPlace(value), String(value)).toBe(roundCoordinate(value));
    for (let step = -18_000_00; step <= 18_000_00; step += 997) {
      const value = step / 10_000 + 0.00005;
      expect(roundPlace(value), String(value)).toBe(roundCoordinate(value));
    }
  });
});
