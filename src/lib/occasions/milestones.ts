/**
 * Astrology's own life milestones from a birth instant: Jupiter returns
 * (about every 12 years), Saturn returns (about 29, 58 and 88), the Uranus
 * opposition (about 42), and "sky numbers" lived through so far. Every date
 * is a computed crossing; a return with a retrograde loop has every pass.
 */
import { moonPhase } from '@zodiacs/engine';
import { bodyLongitude, longitudeSpeed } from '../engine/full.js';
import { clipToReferenceSpan } from '../engine/reference-span.js';
import { findLongitudeCrossings, groupIntoSeasons, saturnReturns, type ReturnSeason } from '../engine/returns.js';
import type { BodyName } from '../engine/types';

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;
/** Mean synodic month, days. */
const SYNODIC_MONTH = 29.530588;
/** Mercury's retrograde periods last about three weeks, so a four-day step cannot miss one. */
const MERCURY_STEP_DAYS = 4;

export type MilestoneKind = 'jupiter-return' | 'saturn-return' | 'uranus-opposition';

export interface Milestone {
  kind: MilestoneKind;
  /** 1 = first return… For the Uranus opposition, always 1. */
  index: number;
  /** Every exact pass, in time order: one, or three with a retrograde loop. */
  passes: { at: string; retrograde: boolean }[];
  first: string;
  last: string;
  /** Age in whole years at the first pass. */
  age: number;
}

export interface LifeMilestones {
  birth: string;
  asOf: string;
  milestones: Milestone[];
  /** The milestone with the soonest pass on or after `asOf`, or null. */
  next: Milestone | null;
  numbers: {
    fullMoons: number;
    mercuryRetrogrades: number;
    jupiterReturns: number;
  };
}

function ageAt(birth: Date, at: Date): number {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const before = at.getUTCMonth() < birth.getUTCMonth()
    || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate());
  if (before) age -= 1;
  return age;
}

function toMilestone(kind: MilestoneKind, season: ReturnSeason, birth: Date, index = season.index): Milestone {
  return {
    kind,
    index,
    passes: season.crossings.map((crossing) => ({ at: crossing.at.toISOString(), retrograde: crossing.retrograde })),
    first: season.first.toISOString(),
    last: season.last.toISOString(),
    age: ageAt(birth, season.first),
  };
}

function seasonsOf(body: BodyName, target: number, birth: Date, fromYears: number, toYears: number): ReturnSeason[] {
  const window = clipToReferenceSpan(new Date(birth.getTime() + fromYears * YEAR), new Date(birth.getTime() + toYears * YEAR));
  if (!window) return [];
  return groupIntoSeasons(findLongitudeCrossings(body, ((target % 360) + 360) % 360, window.from, window.to));
}

/** Full moons in (from, to]: crossings of 180° elongation, counted from the total elongation gained. */
export function fullMoonsBetween(from: Date, to: Date): number {
  if (!(to.getTime() > from.getTime())) return 0;
  const start = moonPhase(from).angle;
  const end = moonPhase(to).angle;
  const days = (to.getTime() - from.getTime()) / DAY;
  const remainder = ((end - start) % 360 + 360) % 360;
  // The true elongation strays from its mean by well under 180°, so rounding
  // the mean count of whole turns is exact.
  const turns = Math.round((days * 360 / SYNODIC_MONTH - remainder) / 360);
  const gained = turns * 360 + remainder;
  const offset = start - 180;
  return Math.floor((offset + gained) / 360) - Math.floor(offset / 360);
}

/** Mercury's retrograde stations in (from, to], sampled every four days. */
export function mercuryRetrogradesBetween(from: Date, to: Date): number {
  let count = 0;
  let previous = longitudeSpeed('Mercury', from);
  for (let t = from.getTime() + MERCURY_STEP_DAYS * DAY; ; t += MERCURY_STEP_DAYS * DAY) {
    const at = Math.min(t, to.getTime());
    const speed = longitudeSpeed('Mercury', new Date(at));
    if (previous >= 0 && speed < 0) count += 1;
    previous = speed;
    if (at >= to.getTime()) break;
  }
  return count;
}

/** The milestone with the soonest pass on or after `asOf`; a return season under way counts by its next pass. */
export function nextMilestone(milestones: Milestone[], asOf: Date): Milestone | null {
  let best: { milestone: Milestone; at: number } | null = null;
  for (const milestone of milestones) {
    const at = milestone.passes.map((pass) => Date.parse(pass.at)).find((time) => time >= asOf.getTime());
    if (at !== undefined && (!best || at < best.at)) best = { milestone, at };
  }
  return best?.milestone ?? null;
}

export function lifeMilestones(birth: Date, asOf: Date): LifeMilestones {
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) {
    throw new RangeError('lifeMilestones needs valid instants.');
  }
  if (asOf.getTime() < birth.getTime()) throw new RangeError('The as-of date is before the birth.');

  // Through age 100, or one Jupiter cycle past `asOf` for anyone older.
  const jupiterYears = Math.max(100, (asOf.getTime() - birth.getTime()) / YEAR + 13);
  const jupiter = seasonsOf('Jupiter', bodyLongitude('Jupiter', birth), birth, 5, jupiterYears)
    .map((season) => toMilestone('jupiter-return', season, birth));
  const saturn = saturnReturns(birth).seasons.map((season) => toMilestone('saturn-return', season, birth));
  const uranus = seasonsOf('Uranus', bodyLongitude('Uranus', birth) + 180, birth, 30, 55)
    .slice(0, 1)
    .map((season) => toMilestone('uranus-opposition', season, birth, 1));

  const milestones = [...jupiter, ...saturn, ...uranus]
    .sort((a, b) => Date.parse(a.first) - Date.parse(b.first));
  const next = nextMilestone(milestones, asOf);

  return {
    birth: birth.toISOString(),
    asOf: asOf.toISOString(),
    milestones,
    next,
    numbers: {
      fullMoons: fullMoonsBetween(birth, asOf),
      mercuryRetrogrades: mercuryRetrogradesBetween(birth, asOf),
      jupiterReturns: jupiter.filter((milestone) => Date.parse(milestone.first) <= asOf.getTime()).length,
    },
  };
}
