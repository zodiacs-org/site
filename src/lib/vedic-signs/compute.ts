/**
 * The Vedic signs, from birth instants: the chart engine's tropical positions
 * (../engine/full), made sidereal at the boundary in ../engine/vedic, then the
 * reading (./reading). The get_vedic_signs tool runs this on the server; the
 * /vedic-signs/ page runs the same two halves in the browser, the tropical one
 * (./tropical) on the main thread and the sidereal one (./sidereal) in its
 * worker, with the same instants, so their answers are the same. Pure: no
 * network, storage or logging.
 */
import type { VedicReading } from './reading';
import { vedicFromTropical } from './sidereal';
import { tropicalMoments } from './tropical';
import type { VedicAyanamsa } from './wording';

export interface VedicSignsInstants {
  /** The birth instant, or local noon (UTC noon without a zone) for an untimed birth. */
  birthUtc: Date;
  timeKnown: boolean;
  /** The birthplace; with a birth time it adds the rising sign. */
  latitude?: number | undefined;
  longitude?: number | undefined;
  /** For an untimed birth, the two ends of the birth day; ignored with a birth time. */
  dayEnds?: readonly Date[] | undefined;
  ayanamsa: VedicAyanamsa;
}

/** Both halves at once, as the get_vedic_signs tool runs them; the page runs the same two halves split across its worker. */
export function computeVedicSigns(input: VedicSignsInstants): VedicReading {
  return vedicFromTropical(tropicalMoments(input), input.ayanamsa);
}
