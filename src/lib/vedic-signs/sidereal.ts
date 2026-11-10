/**
 * The second half of the Vedic signs: the tropical moments from ./tropical
 * made sidereal at the boundary in ../engine/vedic, then the reading
 * (./reading). It holds no chart calculation of its own, so the
 * /vedic-signs/ page's worker, which runs it, carries none either: the page
 * serves the engine's one natal calculation, as tests/chart-ownership-drive.mjs
 * requires. Pure: no network, storage or logging.
 */
import { siderealMoment } from '../engine/vedic';
import { vedicReading, type VedicReading } from './reading';
import type { TropicalMoment, TropicalMoments } from './tropical';
import type { VedicAyanamsa } from './wording';

const sidereal = (moment: TropicalMoment, ayanamsa: VedicAyanamsa) =>
  siderealMoment(moment.utc, { sun: moment.sun, moon: moment.moon, asc: moment.asc }, ayanamsa);

export function vedicFromTropical(moments: TropicalMoments, ayanamsa: VedicAyanamsa): VedicReading {
  return vedicReading({
    timeKnown: moments.timeKnown,
    placed: moments.placed,
    ayanamsa,
    at: sidereal(moments.at, ayanamsa),
    ends: moments.ends ? moments.ends.map((end) => sidereal(end, ayanamsa)) : null,
  });
}
