/**
 * The /vedic-signs/ page's calculation, on this device. The birth instant and
 * the ends of an untimed birth day come from the site's local-time resolver,
 * as the get_vedic_signs tool resolves them; the tropical Sun, Moon and
 * rising degree from the site's chart engine here on the main thread
 * (src/lib/vedic-signs/tropical.ts, loaded as every chart page loads the
 * engine), then the sidereal reading in the page's worker (./vedic.worker.ts),
 * the same two halves the tool runs. Nothing here leaves the browser.
 */
import type { VedicReading } from '../../lib/vedic-signs/reading';
import type { TropicalMoment } from '../../lib/vedic-signs/tropical';
import type { VedicAyanamsa } from '../../lib/vedic-signs/wording';
import { localDaySpan, readsOnDate } from '../../lib/time/local-day';
import { resolveLocalToUtc } from '../../lib/time/localToUtc';

/**
 * Two decimals, as every tool rounds a place it is given
 * (src/ai-tools/plain-text.ts, roundCoordinate). Restated here because no
 * browser module imports src/ai-tools/ (the compute API privacy test);
 * src/lib/vedic-signs/page.test.ts holds the page to the tool's answer.
 */
const roundCoordinate = (value: number): number => Math.round(value * 100) / 100;

export { prepareLocalTime } from '../../lib/time/localToUtc';

export interface VedicFormInput {
  birthDate: string;
  /** HH:MM, or null when the birth time is not known. */
  birthTime: string | null;
  /** The birthplace the person chose: its zone and coordinates. */
  place: { tz: string; lat: number; lon: number };
  ayanamsa: VedicAyanamsa;
}

/**
 * Call only after `await prepareLocalTime(input.birthDate, input.place.tz)`.
 * A date the birthplace clock never showed (Apia went from 29 to 31 December
 * 2011) rejects with a RangeError, which the page answers with its general
 * message, rather than being read as the next date.
 */
export function computeVedicFromForm(input: VedicFormInput): Promise<VedicReading> {
  const timeKnown = input.birthTime !== null;
  // The birthplace rounded to two decimals, as every tool rounds a place it is
  // given (get_vedic_signs through roundCoordinate), before any clock reads
  // it: before a zone's local mean time era ended, the clock is the
  // longitude's own (240 s per degree), so the raw longitude would move the
  // birth instant by up to 1.2 seconds and a rising degree on a sign boundary
  // with it (New York, 11 May 1880, 03:34 at 74.006 degrees west).
  const rounded = { lat: roundCoordinate(input.place.lat), lon: roundCoordinate(input.place.lon) };
  const dayStart = resolveLocalToUtc(input.birthDate, '00:00', input.place.tz, { longitude: rounded.lon });
  if (!readsOnDate(input.birthDate, dayStart)) return Promise.reject(new RangeError('The birth date was not on the birthplace clock.'));
  const birthUtc = resolveLocalToUtc(input.birthDate, input.birthTime ?? '12:00', input.place.tz, { longitude: rounded.lon }).utc;
  // An untimed birth is read at local noon, and a placement holds only if both
  // ends of the local date keep it: from where the clock first reaches its
  // 00:00 to where it last leaves the date, so a date the clock showed twice
  // (Apia, 4 July 1892) is covered whole and one it left early (St. John's,
  // 2 May 1920, when 23:00 became 00:00) ends there, to the second. The
  // resolver reads the day after too, which the birth date's preparation
  // covers: the engine loads a zone's whole history for any date up to 1970.
  const dayEnds = timeKnown ? undefined : localDaySpan(input.birthDate,
    (date, time, fold) => resolveLocalToUtc(date, time, input.place.tz, { longitude: rounded.lon, fold })) ?? undefined;
  return import('../../lib/vedic-signs/tropical').then(({ tropicalMoments }) => {
    const moments = tropicalMoments({ birthUtc, timeKnown, latitude: rounded.lat, longitude: rounded.lon, dayEnds });
    const wire = (moment: TropicalMoment) => ({ ...moment, utc: moment.utc.toISOString() });
    return inWorker({ ...moments, at: wire(moments.at), ends: moments.ends ? moments.ends.map(wire) : null, ayanamsa: input.ayanamsa });
  });
}

function inWorker(message: object): Promise<VedicReading> {
  const worker = new Worker(new URL('./vedic.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onerror = () => { worker.terminate(); reject(new Error('The calculation could not start.')); };
    worker.onmessage = (event: MessageEvent<{ reading?: VedicReading; error?: boolean }>) => {
      worker.terminate();
      if (event.data.reading) resolve(event.data.reading);
      else reject(new Error('The calculation failed.'));
    };
    worker.postMessage(message);
  });
}
