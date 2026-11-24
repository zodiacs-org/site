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
import { roundPlace } from '../../lib/vedic-signs/place';
import { SkippedBirthDateError, SkippedBirthTimeError, birthTimeOnClock, withClockLimit } from '../../lib/vedic-signs/clock';
import { untimedInstant } from '../../lib/vedic-signs/untimed';

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
 * 2011) rejects with SkippedBirthDateError, which the page answers with its
 * own sentence, rather than being read as the next date.
 */
export function computeVedicFromForm(input: VedicFormInput): Promise<VedicReading> {
  const timeKnown = input.birthTime !== null;
  // The birthplace rounded to two decimals, as every tool rounds a place it is
  // given (get_vedic_signs through roundCoordinate; roundPlace is the same), before any clock reads
  // it: before a zone's local mean time era ended, the clock is the
  // longitude's own (240 s per degree), so the raw longitude would move the
  // birth instant by up to 1.2 seconds and a rising degree on a sign boundary
  // with it (New York, 11 May 1880, 03:34 at 74.006 degrees west).
  const rounded = { lat: roundPlace(input.place.lat), lon: roundPlace(input.place.lon) };
  const dayStart = resolveLocalToUtc(input.birthDate, '00:00', input.place.tz, { longitude: rounded.lon });
  if (!readsOnDate(input.birthDate, dayStart)) return Promise.reject(new SkippedBirthDateError());
  const birth = resolveLocalToUtc(input.birthDate, input.birthTime ?? '12:00', input.place.tz, { longitude: rounded.lon });
  // A birth time the clock skipped is refused, never read at the time the clock jumped to; a repeated one is read at
  // its first pass, and the limits say so (src/lib/vedic-signs/clock.ts, as get_vedic_signs does).
  const onClock = birthTimeOnClock(birth.flags, timeKnown);
  if (onClock.skipped) return Promise.reject(new SkippedBirthTimeError());
  // An untimed birth is read at local noon, and a placement holds only if both
  // ends of the local date keep it: from where the clock first reaches its
  // 00:00 to where it last leaves the date, so a date the clock showed twice
  // (Apia, 4 July 1892) is covered whole and one it left early (St. John's,
  // 2 May 1920, when 23:00 became 00:00) ends there, to the second. The
  // resolver reads the day after too, which the birth date's preparation
  // covers: the engine loads a zone's whole history for any date up to 1970.
  const dayEnds = timeKnown ? undefined : localDaySpan(input.birthDate,
    (date, time, fold) => resolveLocalToUtc(date, time, input.place.tz, { longitude: rounded.lon, fold })) ?? undefined;
  // Untimed, local noon only when the clock showed it on the date; else the middle of the date (./untimed.ts).
  const birthUtc = dayEnds ? untimedInstant(birth.utc, dayEnds) : birth.utc;
  return import('../../lib/vedic-signs/tropical').then(({ tropicalMoments }) => {
    const moments = tropicalMoments({ birthUtc, timeKnown, latitude: rounded.lat, longitude: rounded.lon, dayEnds });
    const wire = (moment: TropicalMoment) => ({ ...moment, utc: moment.utc.toISOString() });
    return inWorker({ ...moments, at: wire(moments.at), ends: moments.ends ? moments.ends.map(wire) : null, ayanamsa: input.ayanamsa });
  }).then((reading) => withClockLimit(reading, onClock.limit));
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
