/**
 * Each body's right ascension and declination, and Greenwich sidereal time,
 * at one instant, from the site's chart engine (../engine/full): the chart's
 * apparent ecliptic positions turned equatorial with the engine's true
 * obliquity of date (../engine/full), and sidereal time from the chart's
 * Midheaven at longitude 0. Both the /astrocartography/ page (astronomy-engine
 * in the browser) and the get_astrocartography tool (DE440 on the server) read
 * them here, keeping all engine time/ephemeris code behind ../engine/full.
 */
import { computeChart } from '../engine/full';
import { trueObliquity } from '../engine/obliquity';
import { ACG_BODIES, eclipticToEquatorial, ramcFromMc, type EquatorialBody } from './lines';

export interface EquatorialMoment {
  /** Greenwich sidereal time, degrees. */
  gast: number;
  bodies: EquatorialBody[];
}

export function equatorialMoment(utc: Date): EquatorialMoment {
  const chart = computeChart({ utc, latitude: 0, longitude: 0, houseSystem: 'whole', timeKnown: true });
  const obliquity = trueObliquity(utc);
  const gast = ramcFromMc(chart.angles!.mc, obliquity);
  const bodies = ACG_BODIES.map((body) => {
    const row = chart.bodies.find((entry) => entry.body === body)!;
    return { body, ...eclipticToEquatorial(row.lon, row.lat, obliquity) };
  });
  return { gast, bodies };
}
