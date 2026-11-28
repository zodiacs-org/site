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
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

export function vedicFromTropical(moments: TropicalMoments, ayanamsa: VedicAyanamsa, minor = false): VedicReading {
  const at = sidereal(moments.at, ayanamsa);
  return vedicReading({
    timeKnown: moments.timeKnown,
    placed: moments.placed,
    atGeographicPole: moments.atGeographicPole,
    ayanamsa,
    minor,
    at,
    risingBracket: moments.risingBracket
      ? {
          samples: moments.risingBracket.samples.map((asc) => norm360(asc - at.ayanamsa)),
          polarCircle: moments.risingBracket.polarCircle,
        }
      : null,
    ends: moments.ends ? moments.ends.map((end) => sidereal(end, ayanamsa)) : null,
  });
}
