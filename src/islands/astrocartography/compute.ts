/**
 * The /astrocartography/ page's calculation, on this device. The birth instant
 * comes from the site's local-time resolver; positions from the chart engine
 * (src/lib/engine/full.ts), turned into right ascension and declination with
 * the obliquity, and Greenwich sidereal time from the chart's Midheaven at
 * longitude 0 (src/lib/astrocartography/lines.ts). The get_astrocartography
 * tool reads the same quantities from the engine's calc() on the server; a test
 * holds the two to 0.01 degrees. Nothing here leaves the browser.
 */
import { computeChart } from '../../lib/engine/full';
import { meanObliquity } from '../../lib/engine/houses';
import { ACG_BODIES, eclipticToEquatorial, lineDistances, mapLines, ramcFromMc, type BodyLines, type EquatorialBody, type GeoPoint, type LineDistance } from '../../lib/astrocartography/lines';
import { resolveLocalToUtc } from '../../lib/time/localToUtc';
import land from '../../data/astrocartography-land.json';

export { prepareLocalTime } from '../../lib/time/localToUtc';

export interface AcgInput { birthDate: string; birthTime: string; tz: string; longitude: number }
export interface AcgResult {
  utc: Date;
  gast: number;
  bodies: EquatorialBody[];
  lines: BodyLines[];
  land: { cellDegrees: number; cells: [number, number][] };
}

export function computeAstrocartography(input: AcgInput): AcgResult {
  const utc = resolveLocalToUtc(input.birthDate, input.birthTime, input.tz, { longitude: input.longitude }).utc;
  const chart = computeChart({ utc, latitude: 0, longitude: 0, houseSystem: 'whole', timeKnown: true });
  const centuries = (utc.getTime() / 86_400_000 + 2440587.5 - 2451545) / 36525;
  const obliquity = meanObliquity(centuries);
  const gast = ramcFromMc(chart.angles!.mc, obliquity);
  const bodies = ACG_BODIES.map((body) => {
    const row = chart.bodies.find((entry) => entry.body === body)!;
    return { body, ...eclipticToEquatorial(row.lon, row.lat, obliquity) };
  });
  return { utc, gast, bodies, lines: mapLines(bodies, gast), land: land as unknown as AcgResult["land"] };
}

export function nearestLines(place: GeoPoint, result: AcgResult): LineDistance[] {
  return lineDistances(place, result.bodies, result.gast);
}
