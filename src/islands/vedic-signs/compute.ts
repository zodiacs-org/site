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
import { resolveLocalToUtc } from '../../lib/time/localToUtc';

export { prepareLocalTime } from '../../lib/time/localToUtc';

export interface VedicFormInput {
  birthDate: string;
  /** HH:MM, or null when the birth time is not known. */
  birthTime: string | null;
  /** The birthplace the person chose: its zone and coordinates. */
  place: { tz: string; lat: number; lon: number };
  ayanamsa: VedicAyanamsa;
}

/** Call only after `await prepareLocalTime(input.birthDate, input.place.tz)`. */
export function computeVedicFromForm(input: VedicFormInput): Promise<VedicReading> {
  const timeKnown = input.birthTime !== null;
  const birthUtc = resolveLocalToUtc(input.birthDate, input.birthTime ?? '12:00', input.place.tz, { longitude: input.place.lon }).utc;
  // An untimed birth is read at local noon, and a placement holds only if both ends of the local day keep it.
  const dayEnds = timeKnown ? undefined : [
    resolveLocalToUtc(input.birthDate, '00:00', input.place.tz, { longitude: input.place.lon }).utc,
    resolveLocalToUtc(input.birthDate, '23:59', input.place.tz, { longitude: input.place.lon }).utc,
  ];
  // The birthplace rounded to two decimals, as every tool rounds a place it is given.
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return import('../../lib/vedic-signs/tropical').then(({ tropicalMoments }) => {
    const moments = tropicalMoments({ birthUtc, timeKnown, latitude: round2(input.place.lat), longitude: round2(input.place.lon), dayEnds });
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
