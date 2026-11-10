/**
 * Each body's right ascension and declination, and Greenwich sidereal time,
 * at one instant, from the site's chart engine (../engine/full): the chart's
 * ecliptic positions turned equatorial with the obliquity, and sidereal time
 * from the chart's Midheaven at longitude 0. The /astrocartography/ page and
 * the get_astrocartography tool both read them here, so they draw the same
 * lines. It uses the engine's root entry, as the rest of the site does, never
 * @zodiacs/engine/calc (scripts/engine-entry-imports.test.mjs).
 */
import { computeChart } from '../engine/full';
import { meanObliquity } from '../engine/houses';
import { ACG_BODIES, eclipticToEquatorial, ramcFromMc, type EquatorialBody } from './lines';

export interface EquatorialMoment {
  /** Greenwich sidereal time, degrees. */
  gast: number;
  bodies: EquatorialBody[];
}

export function equatorialMoment(utc: Date): EquatorialMoment {
  const chart = computeChart({ utc, latitude: 0, longitude: 0, houseSystem: 'whole', timeKnown: true });
  const centuries = (utc.getTime() / 86_400_000 + 2440587.5 - 2451545) / 36525;
  const obliquity = meanObliquity(centuries);
  const gast = ramcFromMc(chart.angles!.mc, obliquity);
  const bodies = ACG_BODIES.map((body) => {
    const row = chart.bodies.find((entry) => entry.body === body)!;
    return { body, ...eclipticToEquatorial(row.lon, row.lat, obliquity) };
  });
  return { gast, bodies };
}
