/**
 * Synastry: aspects between two charts. Deliberately engine-free — it
 * accepts plain {body, lon} lists, so saved charts (whose summaries
 * already carry longitudes) compare without ever loading the ephemeris.
 * Applying/separating is omitted on purpose: between two natal charts
 * nothing is moving.
 */
import { ASPECT_BODIES, matchAspect } from './aspects';
import type { AspectType } from './types';
import { signForLongitude } from '../signs';
import type { Element, Modality } from '../signs';
import { isGenerationalContact } from '../generational-contact';

export interface MinimalBody {
  body: string;
  /** Tropical ecliptic longitude, degrees 0–360. */
  lon: number;
}

export interface InterAspect {
  /** Body in chart A. */
  a: string;
  aLon: number;
  /** Body in chart B. */
  b: string;
  bLon: number;
  type: AspectType;
  /** Deviation from exact, degrees (unsigned). */
  orb: number;
}

/**
 * Every major aspect between chart A's bodies and chart B's bodies —
 * the full cross product (up to 10×10), never intra-chart pairs.
 * Sorted tightest first.
 */
export function findInterAspects(a: MinimalBody[], b: MinimalBody[]): InterAspect[] {
  const listA = a.filter((x) => ASPECT_BODIES.has(x.body));
  const listB = b.filter((x) => ASPECT_BODIES.has(x.body));
  const out: InterAspect[] = [];

  for (const A of listA) {
    for (const B of listB) {
      const best = matchAspect(A.body, A.lon, B.body, B.lon);
      if (!best) continue;
      out.push({
        a: A.body, aLon: A.lon, b: B.body, bLon: B.lon,
        type: best.def.type, orb: best.orb,
      });
    }
  }

  return out.sort((x, y) => x.orb - y.orb);
}

/** Count of a chart's ten aspect bodies by element (sums to 10). */
export function elementBalance(bodies: MinimalBody[]): Record<Element, number> {
  const out: Record<Element, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const b of bodies) {
    if (!ASPECT_BODIES.has(b.body)) continue;
    out[signForLongitude(b.lon).element] += 1;
  }
  return out;
}

/** Count of a chart's ten aspect bodies by modality (sums to 10). */
export function modalityBalance(bodies: MinimalBody[]): Record<Modality, number> {
  const out: Record<Modality, number> = { cardinal: 0, fixed: 0, mutable: 0 };
  for (const b of bodies) {
    if (!ASPECT_BODIES.has(b.body)) continue;
    out[signForLongitude(b.lon).modality] += 1;
  }
  return out;
}

export { isGenerationalContact } from '../generational-contact';

/**
 * Contacts ordered by how much they say about this particular pair: orb
 * first, as before, with the generational contacts moved behind everything
 * else, so a personal contact always opens the list when there is one.
 *
 * Demoted rather than dropped. A pair whose only tight contacts are
 * generational still gets shown something true — it simply does not lead
 * with a fact that would be equally true of any two strangers born the
 * same season.
 */
export function rankedContacts(aspects: readonly InterAspect[]): InterAspect[] {
  return [...aspects].sort((one, other) => (
    Number(isGenerationalContact(one)) - Number(isGenerationalContact(other))
    || one.orb - other.orb
  ));
}

export interface PairSummary {
  aspects: InterAspect[];
  /** The tightest few, for display. */
  top: InterAspect[];
  counts: Record<AspectType, number>;
  /** Easeful (trine/sextile) vs charged (square/opposition) tally. */
  easeful: number;
  charged: number;
  elements: { a: Record<Element, number>; b: Record<Element, number> };
  modalities: { a: Record<Modality, number>; b: Record<Modality, number> };
}

export function summarizePair(a: MinimalBody[], b: MinimalBody[], topN = 8): PairSummary {
  const aspects = findInterAspects(a, b);
  const counts: Record<AspectType, number> = {
    conjunction: 0, sextile: 0, square: 0, trine: 0, opposition: 0,
  };
  for (const asp of aspects) counts[asp.type] += 1;
  return {
    aspects,
    top: rankedContacts(aspects).slice(0, topN),
    counts,
    easeful: counts.trine + counts.sextile,
    charged: counts.square + counts.opposition,
    elements: { a: elementBalance(a), b: elementBalance(b) },
    modalities: { a: modalityBalance(a), b: modalityBalance(b) },
  };
}
