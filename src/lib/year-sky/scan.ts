/**
 * The engine-bound half of "Your 2027 sky": exact dates for one chart in one
 * calendar year. Runs in a worker beside full.ts (YearSky.worker.ts) and in
 * the tests; nothing here is sent anywhere, stored, or phrased. The words are
 * written on the main thread by moments.ts, which is engine-free.
 *
 * It finds:
 * - the solar return(s) inside the year;
 * - Jupiter and Saturn returns and the Uranus opposition (lifeMilestones);
 * - Jupiter to Pluto making a conjunction, square, trine or opposition to the
 *   natal Sun, and with a birth time the Moon, rising degree and midheaven,
 *   with every pass of a retrograde loop numbered, even passes outside the year;
 * - Venus and Mars crossing the natal Sun;
 * - where each Mercury, Venus and Mars retrograde of the year stations, so the
 *   page can tell which placements the loop goes back over.
 */
import { bodyLongitude } from '../engine/full';
import { solarReturnInstant } from '../engine/solar-return';
import { clipToReferenceSpan } from '../engine/reference-span';
import { scanTransitContacts, type NatalPoint, type NatalTransitChart, type TransitContact } from '../engine/transit-scan';
import { lifeMilestones, type MilestoneKind } from '../occasions/milestones';
import { inYear, yearWindow } from './edition';

const DAY = 86_400_000;
/** Scanned on each side of the year so a slow loop's passes are counted in full. */
const SLOW_MARGIN_DAYS = 420;
/** Mars's retrograde loop spans about seven months; Venus's about five. */
const FAST_MARGIN_DAYS = 240;

export const YEAR_SLOW_BODIES = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export const YEAR_SLOW_ASPECTS = ['conjunction', 'square', 'trine', 'opposition'] as const;
export const YEAR_PASS_BODIES = ['Venus', 'Mars'] as const;
export const YEAR_STATION_BODIES = ['Mercury', 'Venus', 'Mars'] as const;

/** What the worker is given: longitudes and the birth instant, never a place or a name. */
export interface YearSkyNatal {
  bodies: { body: string; lon: number }[];
  asc: number | null;
  mc: number | null;
  /** The chart's UTC instant (noon at the birthplace when the time is unknown). */
  utc: string;
  timeKnown: boolean;
}

/** A retrograde of the year, as the committed sky table lists it. */
export interface YearRetrogradeInput {
  planet: string;
  from: string;
  to: string;
  preShadowStart: string | null;
  postShadowEnd: string | null;
}

export interface YearStation extends YearRetrogradeInput {
  /** Longitude where the planet turns retrograde. */
  retroLon: number;
  /** Longitude where it turns direct. */
  directLon: number;
}

export interface YearMilestonePass {
  kind: MilestoneKind;
  index: number;
  at: string;
  retrograde: boolean;
  pass: number;
  passCount: number;
}

export interface YearSkyScan {
  year: number;
  timeKnown: boolean;
  solarReturns: string[];
  milestones: YearMilestonePass[];
  /** Jupiter to Pluto, every exact pass from a year and a bit either side. */
  slow: TransitContact[];
  /** Venus and Mars conjunct the natal Sun, every exact pass near the year. */
  passes: TransitContact[];
  stations: YearStation[];
}

function natalPoints(natal: YearSkyNatal): NatalPoint[] {
  return natal.timeKnown
    ? ['Sun', 'Moon', ...(natal.asc != null ? ['ASC' as const] : []), ...(natal.mc != null ? ['MC' as const] : [])]
    : ['Sun'];
}

function margin(from: Date, to: Date, days: number): { from: Date; to: Date } {
  const window = clipToReferenceSpan(new Date(from.getTime() - days * DAY), new Date(to.getTime() + days * DAY));
  if (!window) throw new RangeError('The year is outside the supported span.');
  return window;
}

export function scanYearSky(natal: YearSkyNatal, year: number, retrogrades: readonly YearRetrogradeInput[]): YearSkyScan {
  const { from, to } = yearWindow(year);
  const birth = new Date(natal.utc);
  if (!Number.isFinite(birth.getTime())) throw new RangeError('The chart needs a valid instant.');
  if (birth.getTime() >= to.getTime()) throw new RangeError('The birth is after the year.');
  const sun = natal.bodies.find((body) => body.body === 'Sun');
  if (!sun || !Number.isFinite(sun.lon)) throw new RangeError('The chart has no Sun.');
  const chart = {
    bodies: natal.bodies.filter((body) => Number.isFinite(body.lon)) as NatalTransitChart['bodies'],
    angles: natal.timeKnown && natal.asc != null && natal.mc != null ? { asc: natal.asc, mc: natal.mc } : null,
  };

  // The return nearest each birthday the year touches; one, rarely two.
  const solar = new Set<number>();
  for (const y of [year - 1, year, year + 1]) {
    const near = new Date(Date.UTC(y, birth.getUTCMonth(), Math.min(birth.getUTCDate(), 28), 12));
    if (near.getTime() <= birth.getTime()) continue;
    const at = solarReturnInstant(sun.lon, near).toISOString();
    if (inYear(at, year)) solar.add(Date.parse(at));
  }

  const milestones = birth.getTime() < from.getTime()
    ? lifeMilestones(birth, from).milestones.flatMap((milestone) => milestone.passes.map((pass, i) => ({
      kind: milestone.kind,
      index: milestone.index,
      at: pass.at,
      retrograde: pass.retrograde,
      pass: i + 1,
      passCount: milestone.passes.length,
    }))).filter((pass) => inYear(pass.at, year))
    : [];

  const slowWindow = margin(from, to, SLOW_MARGIN_DAYS);
  const slow = scanTransitContacts(chart, slowWindow.from, slowWindow.to, {
    transitBodies: YEAR_SLOW_BODIES,
    natalPoints: natalPoints(natal),
    aspects: YEAR_SLOW_ASPECTS,
  });

  const fastWindow = margin(from, to, FAST_MARGIN_DAYS);
  const passes = scanTransitContacts(chart, fastWindow.from, fastWindow.to, {
    transitBodies: YEAR_PASS_BODIES,
    natalPoints: ['Sun'],
    aspects: ['conjunction'],
  });

  const stations = retrogrades
    .filter((r) => (YEAR_STATION_BODIES as readonly string[]).includes(r.planet))
    .filter((r) => Date.parse(r.to) >= from.getTime() && Date.parse(r.from) < to.getTime())
    .map((r) => ({
      ...r,
      retroLon: bodyLongitude(r.planet as 'Mercury', new Date(r.from)),
      directLon: bodyLongitude(r.planet as 'Mercury', new Date(r.to)),
    }));

  return {
    year,
    timeKnown: natal.timeKnown,
    solarReturns: [...solar].sort((a, b) => a - b).map((at) => new Date(at).toISOString()),
    milestones: milestones.sort((a, b) => a.at.localeCompare(b.at)),
    slow,
    passes,
    stations,
  };
}
