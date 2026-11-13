/**
 * "Coming up for your chart": future eclipses that land on a natal
 * point, and the shape of a cached Saturn-return window. Engine-free —
 * eclipses arrive precomputed with longitudes (build-eclipses.mjs),
 * natal longitudes come from the saved chart, and the only math here
 * is angular separation. The Saturn window itself is computed by
 * engine/returns.ts (lazy); this module only defines how the dashboard
 * stores and phrases it.
 */
import { BODY_ROLE } from './compat';

export interface EclipseRecord {
  type: 'solar' | 'lunar';
  kind: string;
  peak: string;
  sign: string;
  lon: number;
  degree: number;
}

export interface EclipseHit {
  eclipse: EclipseRecord;
  /** Natal body the eclipse lands on. */
  body: string;
  /** Natal longitude of that body. */
  natalLon: number;
  /** Angular distance eclipse ↔ natal point, degrees (conjunction or opposition). */
  orb: number;
  /** 'conjunction' when on the point, 'opposition' when across from it. */
  contact: 'conjunction' | 'opposition';
}

const shortest = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Future eclipses within `orb` degrees of a natal body — by conjunction
 * or opposition (an eclipse opposite your Sun is as much yours as one
 * on it). Sorted soonest-first, tightest contact per eclipse.
 */
export function eclipseHits(
  eclipses: EclipseRecord[],
  natal: { body: string; lon: number }[],
  now: Date,
  orb = 3,
): EclipseHit[] {
  const hits: EclipseHit[] = [];
  for (const e of eclipses) {
    if (new Date(e.peak) <= now) continue;
    let best: EclipseHit | null = null;
    for (const n of natal) {
      if (!(n.body in BODY_ROLE)) continue; // planets only; nodes sit out
      const conj = shortest(e.lon, n.lon);
      const opp = Math.abs(180 - shortest(e.lon, n.lon));
      const contact: 'conjunction' | 'opposition' = conj <= opp ? 'conjunction' : 'opposition';
      const d = Math.min(conj, opp);
      if (d <= orb && (!best || d < best.orb)) {
        best = { eclipse: e, body: n.body, natalLon: n.lon, orb: +d.toFixed(1), contact };
      }
    }
    if (best) hits.push(best);
  }
  return hits.sort((a, b) => a.eclipse.peak.localeCompare(b.eclipse.peak));
}

export function nextEclipseHit(
  eclipses: EclipseRecord[],
  natal: { body: string; lon: number }[],
  now: Date,
  orb = 3,
): EclipseHit | null {
  return eclipseHits(eclipses, natal, now, orb)[0] ?? null;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const monthDay = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One sentence for an eclipse hit, in the transit register. */
export function eclipseHitLine(hit: EclipseHit): string {
  const e = hit.eclipse;
  const where =
    hit.contact === 'conjunction'
      ? `lands on your ${hit.body}`
      : `lands directly across from your ${hit.body}`;
  const role = BODY_ROLE[hit.body] ?? hit.body.toLowerCase();
  return `The ${e.kind} ${e.type} eclipse of ${monthDay(e.peak)} (${e.degree.toFixed(1)}° ${cap(e.sign)}) ${where}. Eclipses tend to fast-forward whatever house your ${role} runs.`;
}

/** Cached Saturn-return window shape, stored per chart id. */
export interface SaturnWindowCache {
  engineVersion: string;
  computedAt: string;
  seasons: { index: number; from: string; to: string }[];
}

export const DASHBOARD_CACHE_KEY = 'zodiacs.dashboard.v1';

/** Phrase a Saturn season list relative to now. */
export function saturnWindowLine(seasons: SaturnWindowCache['seasons'], now: Date): string | null {
  if (!seasons.length) return null;
  const ord = ['', 'first', 'second', 'third'];
  const active = seasons.find((s) => new Date(s.from) <= now && now <= new Date(s.to));
  if (active) {
    return `Your ${ord[active.index] ?? `${active.index}th`} Saturn return is running now. It opened ${monthDay(active.from)} and closes ${monthDay(active.to)}.`;
  }
  const next = seasons.find((s) => new Date(s.from) > now);
  if (next) {
    const label = ord[next.index] ?? `${next.index}th`;
    // A single clean crossing gives a one-day "window" — phrase it as a date.
    if (monthDay(next.from) === monthDay(next.to)) {
      return `Your ${label} Saturn return arrives around ${monthDay(next.from)}.`;
    }
    return `Your ${label} Saturn return runs ${monthDay(next.from)} to ${monthDay(next.to)}.`;
  }
  const last = seasons[seasons.length - 1];
  return `Your last Saturn return closed ${monthDay(last.to)}; the next lies beyond this chart's horizon.`;
}
