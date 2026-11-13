/**
 * Planetary returns: when a transiting body comes back to its natal
 * longitude. Built for Saturn (the ~29.4-year cycle) but generic over
 * any slow body. Retrograde triple passes are real events — crossings
 * are grouped into "seasons" so a return with three exact hits reads as
 * one season with three dates, not three separate returns.
 *
 * Lives beside full.ts and is only ever lazy-loaded with it — the
 * ephemeris stays out of every eager bundle.
 */
import { findLongitudeCrossingsWith, type LongitudeCrossing } from '@zodiacs/engine/crossings';
import { bodyLongitude, longitudeSpeed } from './full.js';
import { clipToReferenceSpan } from './reference-span.js';
import type { BodyName } from './types';

const DAY = 86400_000;

export type Crossing = LongitudeCrossing;

export interface ReturnSeason {
  /** 1 = first return (~29), 2 = second (~58)… */
  index: number;
  crossings: Crossing[];
  first: Date;
  last: Date;
}

/**
 * Every instant in (from, to] when `body` sits exactly on `targetLon`.
 * Coarse scan at `stepDays`, then 24-iteration bisection per crossing.
 * A 5-day grid by itself can miss both passes of a pair that fall inside one
 * step: a station that takes the body less than |f″|h²/8 past the natal
 * degree, with f″ the second derivative of its longitude and h the step. At
 * the stations of 2019 to 2024 that is up to 0.0056° (about 20″) for Saturn
 * and 0.011° (about 40″) for Jupiter (engine 1.1.0-rc.2,
 * docs/evidence/1.1.0-rc.2-20261102/f89/blind-band.json). The shared solver
 * re-examines every sampled turn within reach of the target, so such grazing
 * pairs are kept (@zodiacs/engine/crossings, the one solver the site and the
 * package run):
 * 4,941 of 4,941 station-graze cases 2020–2030 matched a fine-step reference
 * (docs/platform/evidence/phase1-events/). That is a tested property of the
 * corpus, not a proof of completeness.
 */
export function findLongitudeCrossings(
  body: BodyName,
  targetLon: number,
  from: Date,
  to: Date,
  stepDays = 5,
): Crossing[] {
  // The site's windows are (from, to]; an empty or inverted one has no crossing.
  if (!(to.getTime() > from.getTime())) return [];
  return findLongitudeCrossingsWith(bodyLongitude, body, targetLon, from, to, stepDays);
}

/**
 * Group a body's crossings of one natal degree into return seasons.
 * Crossings within `gapDays` of each other belong to the same season
 * (a Saturn triple pass spans ≤ ~11 months; successive returns are
 * ~29 years apart, so any sane gap separates them).
 */
export function groupIntoSeasons(crossings: Crossing[], gapDays = 400): ReturnSeason[] {
  const seasons: ReturnSeason[] = [];
  for (const c of crossings) {
    const cur = seasons[seasons.length - 1];
    if (cur && c.at.getTime() - cur.last.getTime() <= gapDays * DAY) {
      cur.crossings.push(c);
      cur.last = c.at;
    } else {
      seasons.push({ index: seasons.length + 1, crossings: [c], first: c.at, last: c.at });
    }
  }
  return seasons;
}

export interface SaturnReturnResult {
  /** Natal Saturn longitude, degrees. */
  natalLon: number;
  natalRetrograde: boolean;
  seasons: ReturnSeason[];
  /** True when the scan stopped at the end of 2199, so later passes are not shown. */
  rangeClipped: boolean;
  /** The window actually searched, or null when none of it was in range. */
  searched: { from: Date; to: Date } | null;
}

/**
 * Natal Saturn plus every return season through the third (~age 90).
 * ~6,600 single-body samples ≈ well under a second in the browser.
 */
export function saturnReturns(birthUtc: Date): SaturnReturnResult {
  const natalLon = bodyLongitude('Saturn', birthUtc);
  // The chart's own speed, so the two never disagree about the direction
  // near a station.
  const speed = longitudeSpeed('Saturn', birthUtc);

  // Scan +26y..+92y: the first return can't land before ~28y, but a
  // retrograde first pass can lead the exact-age mark by many months.
  const window = clipToReferenceSpan(
    new Date(birthUtc.getTime() + 26 * 365.25 * DAY),
    new Date(birthUtc.getTime() + 92 * 365.25 * DAY),
  );
  const crossings = window ? findLongitudeCrossings('Saturn', natalLon, window.from, window.to) : [];

  return {
    natalLon,
    natalRetrograde: speed < 0,
    seasons: groupIntoSeasons(crossings),
    rangeClipped: !window || window.clipped,
    searched: window ? { from: window.from, to: window.to } : null,
  };
}
