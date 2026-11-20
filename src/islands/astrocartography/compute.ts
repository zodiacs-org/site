/**
 * The /astrocartography/ page's calculation, on this device. The birth instant
 * comes from the site's local-time resolver; right ascension, declination
 * and Greenwich sidereal time from the chart engine
 * (src/lib/astrocartography/positions.ts), which the get_astrocartography tool
 * reads too. Nothing here leaves the browser.
 */
import { lineDistances, mapLines, type BodyLines, type EquatorialBody, type GeoPoint, type LineDistance } from '../../lib/astrocartography/lines';
import { equatorialMoment } from '../../lib/astrocartography/positions';
import { prepareLocalTime, resolveLocalToUtc, type LocalTimeResolution } from '../../lib/time/localToUtc';

type LocalTimeFlag = LocalTimeResolution['flags'][number];
import land from '../../data/astrocartography-land.json';

export interface AcgInput { birthDate: string; birthTime: string; place: { tz: string; lon: number } }
export interface AcgResult {
  utc: Date;
  gast: number;
  bodies: EquatorialBody[];
  lines: BodyLines[];
  land: { cellDegrees: number; cells: [number, number][] };
  /** The resolver's flags for the birth time: dst-fold for an hour the clocks repeated, dst-gap for one they skipped. */
  flags: readonly LocalTimeFlag[];
  /** With dst-fold or dst-gap: the size of the clock change, minutes. */
  jumpMinutes: number | null;
}

export async function computeAstrocartography(input: AcgInput): Promise<AcgResult> {
  await prepareLocalTime(input.birthDate, input.place.tz);
  const resolved = resolveLocalToUtc(input.birthDate, input.birthTime, input.place.tz, { longitude: input.place.lon });
  const utc = resolved.utc;
  const { gast, bodies } = equatorialMoment(utc);
  return { utc, gast, bodies, lines: mapLines(bodies, gast), land: land as unknown as AcgResult["land"], flags: [...resolved.flags], jumpMinutes: resolved.jumpMinutes ?? null };
}

export function nearestLines(place: GeoPoint, result: AcgResult): LineDistance[] {
  return lineDistances(place, result.bodies, result.gast);
}
