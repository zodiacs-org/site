/**
 * The brute force the election search is held to (PREREGISTRATION.md): every
 * condition read at every 10 seconds of the window, straight from the
 * engine's positions(), natalChart(), houseOf() and moonPhase(), with a
 * reading of its own of the Moon void of course. It shares nothing with
 * src/lib/compute-api/elections.ts, nor with the engine's voidOfCourseWindows,
 * but the engine's positions.
 */
import { houseOf, moonPhase, natalChart, positions, type BodyPosition } from '@zodiacs/engine';
import type { Condition, Query } from './draw';

export const STEP_MS = 10_000;
const HALF_STEP_MS = STEP_MS / 2;
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
/** The modern bodies of the engine's void-of-course convention, and the Ptolemaic aspects, each both ways round. */
const VOID_BODIES = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const OFFSETS = [0, 60, 90, 120, 180, 240, 270, 300];
/** The Moon stays in a sign under three days: reading this far past the window always finds its next sign. */
const REACH_MS = 3 * 86_400_000;

export interface Span {
  from: number;
  to: number;
}

const norm = (lon: number) => ((lon % 360) + 360) % 360;
const signOf = (lon: number) => Math.floor(norm(lon) / 30);
/** Signed degrees in (−180, 180]. */
const wrap = (degrees: number) => {
  const d = norm(degrees);
  return d > 180 ? d - 360 : d;
};
const rowOf = (rows: readonly BodyPosition[], body: string) => rows.find((row) => row.body === body)!;

/**
 * Whether the Moon is void of course at each instant of `rows`: no exact
 * Ptolemaic aspect to a modern body between that instant and the Moon's
 * entry into its next sign. Each aspect and each entry is placed inside its
 * 10-second step by linear interpolation, which only decides their order
 * when both fall in the same step. The last step must hold an entry.
 */
function voidStates(times: readonly number[], rows: readonly BodyPosition[][]): boolean[] {
  const moon = rows.map((row) => rowOf(row, 'Moon').lon);
  const states = new Array<boolean>(times.length).fill(false);
  let voidAfter = false;
  for (let k = times.length - 2; k >= 0; k -= 1) {
    const s0 = signOf(moon[k]);
    const s1 = signOf(moon[k + 1]);
    // Where in the step the Moon reaches its next sign, as a fraction, or none.
    let entry: number | null = null;
    if (s0 !== s1) {
      const boundary = s1 * 30;
      const run = wrap(moon[k + 1] - moon[k]);
      entry = Math.min(1, Math.max(0, wrap(boundary - moon[k]) / run));
    }
    // The exact aspects in the step, as fractions of it.
    const aspects: number[] = [];
    for (const body of VOID_BODIES) {
      const b0 = rowOf(rows[k], body).lon;
      const b1 = rowOf(rows[k + 1], body).lon;
      for (const offset of OFFSETS) {
        const d0 = wrap(moon[k] - b0 - offset);
        const d1 = wrap(moon[k + 1] - b1 - offset);
        if (Math.abs(d0) >= 90 || Math.abs(d1) >= 90) continue;
        if (d0 < 0 && d1 >= 0) aspects.push(-d0 / (d1 - d0));
      }
    }
    if (entry !== null) {
      // Only an aspect before the entry is this sign's; one after it is the next sign's.
      states[k] = !aspects.some((fraction) => fraction < entry!);
    } else {
      states[k] = aspects.length === 0 && voidAfter;
    }
    voidAfter = states[k];
  }
  return states;
}

function holds(condition: Condition, k: number, read: { rows: BodyPosition[][]; houses: Map<string, number[]>; phases: number[]; voids: boolean[] }): boolean {
  let value: boolean;
  switch (condition.kind) {
    case 'phase': value = (read.phases[k] < 180) === (condition.phase === 'waxing'); break;
    case 'void-of-course': value = read.voids[k]; break;
    case 'sign': value = SIGNS[signOf(rowOf(read.rows[k], condition.body!).lon)] === condition.sign; break;
    case 'retrograde': value = rowOf(read.rows[k], condition.body!).speed < 0; break;
    case 'angular': value = [1, 4, 7, 10].includes(read.houses.get(condition.body!)![k]); break;
  }
  return condition.not ? !value : value;
}

/** The windows of [from, to) in which every condition holds, each end the middle of the 10-second step in which the state changes. */
export function bruteForce(query: Query): { windows: Span[]; instants: number } {
  const from = Date.parse(query.from);
  const to = Date.parse(query.to);
  const kinds = new Set(query.conditions.map((condition) => condition.kind));
  const times: number[] = [];
  for (let t = from; t < to; t += STEP_MS) times.push(t);
  const rows: BodyPosition[][] = [];
  const houses = new Map<string, number[]>();
  const angularBodies = [...new Set(query.conditions.filter((condition) => condition.kind === 'angular').map((condition) => condition.body!))];
  for (const body of angularBodies) houses.set(body, []);
  const needsRows = [...kinds].some((kind) => kind !== 'phase');
  if (needsRows) {
    for (const t of times) {
      if (angularBodies.length > 0) {
        const chart = natalChart({ utc: new Date(t), latitude: query.place!.latitude, longitude: query.place!.longitude, houseSystem: query.place!.houseSystem as never });
        if (!chart.houses || chart.flags.includes('polar-fallback')) throw new Error(`the houses fell back at ${new Date(t).toISOString()}`);
        rows.push(chart.bodies as BodyPosition[]);
        for (const body of angularBodies) houses.get(body)!.push(houseOf(rowOf(chart.bodies as BodyPosition[], body).lon, chart.houses.cusps));
      } else {
        rows.push(positions(new Date(t)));
      }
    }
  }
  const phases = kinds.has('phase') ? times.map((t) => moonPhase(new Date(t)).angle) : [];
  let voids: boolean[] = [];
  let instants = times.length;
  if (kinds.has('void-of-course')) {
    // Read on past the window to the Moon's next sign, so the last instants know whether an aspect is still to come.
    const extended = [...times];
    const extendedRows = [...rows];
    const lastSign = signOf(rowOf(rows[rows.length - 1], 'Moon').lon);
    for (let t = times[times.length - 1] + STEP_MS; ; t += STEP_MS) {
      if (t > to + REACH_MS) throw new Error('the Moon did not change sign within three days of the window');
      const row = positions(new Date(t));
      extended.push(t);
      extendedRows.push(row);
      if (signOf(rowOf(row, 'Moon').lon) !== lastSign) break;
    }
    instants = extended.length;
    voids = voidStates(extended, extendedRows).slice(0, times.length);
  }
  const read = { rows, houses, phases, voids };
  const state = times.map((_, k) => query.conditions.every((condition) => holds(condition, k, read)));
  const windows: Span[] = [];
  let start: number | null = null;
  state.forEach((value, k) => {
    if (value && start === null) start = k === 0 ? from : times[k] - HALF_STEP_MS;
    if (!value && start !== null) {
      windows.push({ from: start, to: times[k] - HALF_STEP_MS });
      start = null;
    }
  });
  if (start !== null) windows.push({ from: start, to });
  return { windows, instants };
}
