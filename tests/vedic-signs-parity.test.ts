import { afterEach, describe, expect, it, vi } from 'vitest';
import { vedicFromTropical } from '../src/lib/vedic-signs/sidereal';
import type { TropicalMoment } from '../src/lib/vedic-signs/tropical';
import { computeVedicFromForm, prepareLocalTime, type VedicFormInput } from '../src/islands/vedic-signs/compute';
import { createLocalTimeModule } from '../api/_compute/local-time.mjs';
import { vedicSigns } from '../src/ai-tools/personal/vedic-signs';
import { birthDayEnds } from '../src/ai-tools/personal/shared';

/**
 * The page's worker, run in this thread: the same sidereal half
 * (./vedic.worker.ts posts vedicFromTropical's reading back), so the test
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

afterEach(() => { vi.unstubAllGlobals(); posted.length = 0; });

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
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(['1892-07-03T11:27:02.000Z', '1892-07-05T11:27:01.000Z']);
    expect(reading.moonNakshatra).toBeNull();
    expect(reading.nakshatraCandidates).toEqual(['Chitra', 'Swati', 'Vishakha']);
  });

  it('ends a date where the clock left it (St. John\'s, 23:00 on 2 May 1920 became 00:00 on 3 May), as the tool does', async () => {
    const reading = await form('1920-05-02', null, ST_JOHNS);
    // Not 03:30:51 UTC, where its skipped 23:59 read forward by the jump would end it.
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(['1920-05-02T03:30:52.000Z', '1920-05-03T02:30:51.000Z']);
    expect(reading.moonNakshatra?.name).toBe('Swati');
    expect(reading.nakshatraCandidates).toEqual([]);
  });

  it('starts and ends a date at a clock change within a minute (Accra, 2 November 1915), as the tool does', async () => {
    // At 0.25 degrees west the birthplace clock went from 23:59:52 on 1 November to 00:00:52 on 2 November.
    const accra = { tz: 'Africa/Accra', lat: 5.55, lon: -0.25 };
    await form('1915-11-02', null, accra);
    await form('1915-11-01', null, accra);
    expect(posted.map((message) => message.ends!.map((end) => end.utc))).toEqual([
      ['1915-11-02T00:00:52.000Z', '1915-11-02T23:59:59.000Z'],
      ['1915-11-01T00:01:00.000Z', '1915-11-02T00:00:51.000Z'],
    ]);
  });

  it('refuses a date the clock never showed (Apia, 30 December 2011) before anything is worked out, timed or not', async () => {
    for (const time of [null, '12:00']) {
      await expect(form('2011-12-30', time)).rejects.toThrow(RangeError);
      expect(posted).toHaveLength(0);
    }
    await expect(form('2011-12-31', null)).resolves.toBeTruthy();
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

  it('gives the same answer on a modern date (Kolkata, 3 May 1990, 08:30)', async () => {
    const kolkata = { tz: 'Asia/Kolkata', lat: 22.5726, lon: 88.3639 };
    const page = await form('1990-05-03', '08:30', kolkata);
    const answer = await tool('1990-05-03', '08:30', kolkata);
    expect(answer.rising).not.toBeNull();
    expect(signs(page)).toEqual(signs(answer));
  });
});
