/**
 * The /vedic-signs/ page's calculation, on this device. The birth instant and
 * the ends of an untimed birth day come from the site's local-time resolver,
 * as the get_vedic_signs tool resolves them; the signs from
 * src/lib/vedic-signs/compute.ts, the same function the tool runs, in the
 * page's worker (./vedic.worker.ts). Nothing here leaves the browser.
 */
import type { VedicReading } from '../../lib/vedic-signs/reading';
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
  return inWorker({ birthUtc: birthUtc.toISOString(), timeKnown, latitude: round2(input.place.lat), longitude: round2(input.place.lon), ayanamsa: input.ayanamsa, dayEnds: dayEnds?.map((end) => end.toISOString()) });
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
