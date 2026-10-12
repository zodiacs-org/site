/**
 * The sky across a due-date window, for a baby-shower card: which signs the
 * Sun is in across the window and the day it changes, and the full and new
 * moons inside it. Facts only: no "most likely" sign and nothing about the
 * baby. Days are UTC civil days. A sign change is given to the minute,
 * because a baby born on that day can be either sign depending on the hour.
 */
import { moonPhase } from '@zodiacs/engine';
import { validOccasionDate } from './card';
import { skyAt } from './sky';

const DAY = 86_400_000;
/** How far either side of the due date the window reaches, days. */
export const DUE_WINDOW_DAYS = 14;

export interface SunSpan {
  sign: string;
  /** First and last UTC days of the window with the Sun in this sign at noon. */
  from: string;
  to: string;
  /** When the Sun entered this sign, for every span after the first. */
  enters: string | null;
}

export interface DueWindow {
  due: string;
  from: string;
  to: string;
  sunSpans: SunSpan[];
  /** Exact instants of full and new moons inside the window. */
  lunations: { kind: 'full' | 'new'; at: string }[];
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The instant in (lo, hi] when the elongation crosses `target` (0 or 180), by bisection. */
function crossing(lo: number, hi: number, target: number): number {
  const past = (ms: number) => ((moonPhase(new Date(ms)).angle - target + 540) % 360) - 180 >= 0;
  while (hi - lo > 60_000) {
    const mid = (lo + hi) / 2;
    if (past(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** The instant in (lo, hi] when the Sun enters `sign`, by bisection. */
function signEntry(lo: number, hi: number, sign: string): number {
  while (hi - lo > 60_000) {
    const mid = (lo + hi) / 2;
    if (skyAt(new Date(mid)).bodies[0]!.sign === sign) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function dueWindow(due: string, days = DUE_WINDOW_DAYS): DueWindow {
  if (!validOccasionDate(due)) throw new RangeError('The due date must be a real date from 1800 to 2199.');
  const [year, month, day] = due.split('-').map(Number);
  const dueNoon = Date.UTC(year, month - 1, day, 12);
  const start = dueNoon - days * DAY;
  const end = dueNoon + days * DAY;

  const sunSpans: SunSpan[] = [];
  for (let t = start; t <= end; t += DAY) {
    const sign = skyAt(new Date(t)).bodies[0]!.sign;
    const last = sunSpans[sunSpans.length - 1];
    if (last && last.sign === sign) last.to = isoDay(t);
    else sunSpans.push({ sign, from: isoDay(t), to: isoDay(t), enters: last ? new Date(signEntry(t - DAY, t, sign)).toISOString() : null });
  }

  const lunations: DueWindow['lunations'] = [];
  let previous = moonPhase(new Date(start)).angle;
  for (let t = start + DAY / 4; t <= end; t += DAY / 4) {
    const angle = moonPhase(new Date(t)).angle;
    if (previous < 180 && angle >= 180) lunations.push({ kind: 'full', at: new Date(crossing(t - DAY / 4, t, 180)).toISOString() });
    if (angle < previous - 180) lunations.push({ kind: 'new', at: new Date(crossing(t - DAY / 4, t, 0)).toISOString() });
    previous = angle;
  }

  return { due, from: isoDay(start), to: isoDay(end), sunSpans, lunations };
}
