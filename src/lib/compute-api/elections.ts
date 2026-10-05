/**
 * The election search (the brief's B5.b): the windows of time in [from, to)
 * in which every condition of a request holds. Five kinds of condition:
 *
 *   phase           the Moon waxing, its elongation from the Sun of
 *                   moonPhase() in [0°, 180°), or waning, in [180°, 360°)
 *   void-of-course  the Moon void of course, under the engine's
 *                   VOID_OF_COURSE_CONVENTION with its modern bodies: from
 *                   its last exact Ptolemaic aspect in a sign to its entry
 *                   into the next
 *   sign            a body in a sign of the tropical zodiac
 *   retrograde      a planet whose longitude speed is below zero
 *   angular         a body in the 1st, 4th, 7th or 10th house at a place,
 *                   as natalChart's cusps and houseOf place it
 *
 * Any condition can be negated with `not`. Each compiles to the instants at
 * which it starts or stops holding:
 *
 *   - sign changes, stations and the Moon's new and full phases by the
 *     crossing search the events endpoint uses;
 *   - void periods by the engine's rule, from the Moon's sign changes and,
 *     scanning back from each in 3-hour steps, its last exact aspect before
 *     it, narrowed to a second (a test holds the periods to the engine's
 *     own voidOfCourseWindows, which this bundle does not include);
 *   - house changes by natalChart, sampled every hour inside the windows
 *     the other conditions leave, more finely wherever a body passes more
 *     than one house between samples, and narrowed to a second.
 *
 * The search is sampled, not proven, and the receipt says so;
 * docs/platform/evidence/election-search-v0/ holds it to a scan every
 * 10 seconds. Nothing here keeps anything once the request is answered.
 */
import {
  houseOf,
  moonPhase,
  natalChart,
  outsideReferenceSpan,
  positions,
  type BodyPosition,
} from '@zodiacs/engine';
import {
  ANGULAR_HOUSES,
  ELECTION_STEPS,
  FULL_CALCULATION_COST,
  PHASES,
  SEARCH_STEP_DAYS,
  SIGN_SLUGS,
  type EventBody,
  type SignSlug,
} from './constants.js';
import {
  SampleBudget,
  iso,
  phaseCrossings,
  rowOf,
  signCrossings,
  stationCrossings,
} from './endpoints.js';
import { computeReceipt, successBody, type ElectionSearchFacts } from './receipt.js';
import type { ElectionCondition, ElectionPlace, ElectionsRequest } from './validate.js';

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Rounds of interpolation before a crossing is narrowed by halves instead. */
const SECANT_ROUNDS = 6;

export type { ElectionCondition, ElectionPlace, ElectionsRequest };

/** A half-open stretch of time [from, to), in milliseconds. */
export interface Span {
  from: number;
  to: number;
}

// ---------- spans ----------

/** Joins touching or overlapping spans and drops empty ones; the input in any order. */
export function normalizeSpans(spans: readonly Span[]): Span[] {
  const sorted = spans.filter((span) => span.to > span.from).sort((a, b) => a.from - b.from);
  const out: Span[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else out.push({ ...span });
  }
  return out;
}

/** Where both lists hold; each list normalized. */
export function intersectSpans(a: readonly Span[], b: readonly Span[]): Span[] {
  const out: Span[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const from = Math.max(a[i].from, b[j].from);
    const to = Math.min(a[i].to, b[j].to);
    if (to > from) out.push({ from, to });
    if (a[i].to < b[j].to) i += 1;
    else j += 1;
  }
  return out;
}

/** Where a normalized list does not hold, within `within`. */
export function complementSpans(spans: readonly Span[], within: Span): Span[] {
  const out: Span[] = [];
  let cursor = within.from;
  for (const span of spans) {
    if (span.to <= within.from || span.from >= within.to) continue;
    if (span.from > cursor) out.push({ from: cursor, to: span.from });
    cursor = Math.max(cursor, span.to);
  }
  if (cursor < within.to) out.push({ from: cursor, to: within.to });
  return out;
}

/**
 * The spans with every gap shorter than `ms` closed, then every span shorter
 * than `ms` dropped: two boundaries that close may be one instant, such as the
 * Moon's entry into a sign, found by two searches.
 */
export function resolveSpans(spans: readonly Span[], ms: number): Span[] {
  const joined: Span[] = [];
  for (const span of normalizeSpans(spans)) {
    const last = joined[joined.length - 1];
    if (last && span.from - last.to < ms) last.to = span.to;
    else joined.push({ ...span });
  }
  return joined.filter((span) => span.to - span.from >= ms);
}

/**
 * The spans of [from, to) in which a state holds, given the state at `from`
 * and every instant in (from, to) at which it becomes true or false. Each
 * change sets the state rather than flipping it, so a change the state
 * already had is harmless.
 */
export function spansFromChanges(initial: boolean, changes: ReadonlyArray<{ at: number; to: boolean }>, window: Span): Span[] {
  const out: Span[] = [];
  let state = initial;
  let since = window.from;
  for (const change of [...changes].sort((a, b) => a.at - b.at)) {
    if (change.at <= window.from || change.at >= window.to) continue;
    if (change.to === state) continue;
    if (state) out.push({ from: since, to: change.at });
    state = change.to;
    since = change.at;
  }
  if (state) out.push({ from: since, to: window.to });
  return normalizeSpans(out);
}

// ---------- the conditions ----------

/** Positions once per instant, each new instant counted against the request's budget as a full calculation. */
function budgetedRows(budget: SampleBudget): (ms: number) => BodyPosition[] {
  const memo = new Map<number, BodyPosition[]>();
  return (ms) => {
    let rows = memo.get(ms);
    if (!rows) {
      budget.spend(FULL_CALCULATION_COST);
      rows = positions(new Date(ms));
      memo.set(ms, rows);
    }
    return rows;
  };
}

/** The searches report crossings in (from, to]; a window runs [from, to). Both ends move back a millisecond. */
function searchEnds(window: Span): { from: Date; to: Date } {
  return { from: new Date(window.from - 1), to: new Date(window.to - 1) };
}

function signSpans(body: EventBody, sign: SignSlug, window: Span, budget: SampleBudget, rowsAt: (ms: number) => BodyPosition[]): Span[] {
  const index = SIGN_SLUGS.indexOf(sign);
  const ends = searchEnds(window);
  const start = index * 30;
  const end = ((index + 1) % 12) * 30;
  const changes = [
    // Its first boundary: crossed moving forward it enters the sign, moving backward it leaves.
    ...signCrossings(body, start, ends.from, ends.to, budget).map((crossing) => ({ at: crossing.at.getTime(), to: !crossing.retrograde })),
    // Its second: crossed moving forward it leaves, moving backward it enters.
    ...signCrossings(body, end, ends.from, ends.to, budget).map((crossing) => ({ at: crossing.at.getTime(), to: crossing.retrograde })),
  ];
  return spansFromChanges(rowOf(rowsAt(window.from), body).sign === sign, changes, window);
}

function retrogradeSpans(body: EventBody, window: Span, budget: SampleBudget, rowsAt: (ms: number) => BodyPosition[]): Span[] {
  const initial = rowOf(rowsAt(window.from), body).speed < 0;
  if (body === 'Sun' || body === 'Moon') return initial ? [{ ...window }] : [];
  const ends = searchEnds(window);
  // A station where the speed falls through zero begins a retrograde period. The search reads the request's
  // own positions, so each new instant counts as a full calculation beside the step the search counts.
  const changes = stationCrossings(body, ends.from, ends.to, budget, (date) => rowsAt(date.getTime()))
    .map((crossing) => ({ at: crossing.at.getTime(), to: crossing.retrograde }));
  return spansFromChanges(initial, changes, window);
}

function waxingSpans(window: Span, budget: SampleBudget): Span[] {
  const ends = searchEnds(window);
  const changes = [
    ...phaseCrossings(PHASES.new, ends.from, ends.to, budget).map((crossing) => ({ at: crossing.at.getTime(), to: true })),
    ...phaseCrossings(PHASES.full, ends.from, ends.to, budget).map((crossing) => ({ at: crossing.at.getTime(), to: false })),
  ];
  return spansFromChanges(moonPhase(new Date(window.from)).angle < 180, changes, window);
}

/** The modern bodies of VOID_OF_COURSE_CONVENTION, which a test holds to the engine's VOID_BODIES.modern. */
export const VOID_BODIES_MODERN = Object.freeze(['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const);
/** The Moon's elongation from a body at each exact Ptolemaic aspect, both ways round. */
const ASPECT_OFFSETS = Object.freeze([0, 60, 300, 90, 270, 120, 240, 180]);
const VOID_SCAN_MS = 3 * HOUR_MS;
/** The Moon spends under three days in a sign; the void period in progress at `from` began after its last sign change. */
const VOID_REACH_BEFORE_MS = 4 * DAY_MS;
const VOID_REACH_AFTER_MS = 3 * DAY_MS;

/** Signed degrees in (−180, 180] from a to b. */
function delta(a: number, b: number): number {
  const d = (((b - a) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/** The Moon's distance past an exact aspect to a body, signed, as the engine's void-of-course rule measures it. */
function separation(rows: readonly BodyPosition[], body: string, offset: number): number {
  return delta(rowOf(rows, body as EventBody).lon + offset, rowOf(rows, 'Moon').lon);
}

/** The Moon's entries into a sign in (from, to), in time order. */
function moonIngressInstants(from: number, to: number, budget: SampleBudget): number[] {
  const out: number[] = [];
  for (let index = 0; index < 12; index += 1) {
    for (const crossing of signCrossings('Moon', index * 30, new Date(from), new Date(to - 1), budget)) {
      if (!crossing.retrograde) out.push(crossing.at.getTime());
    }
  }
  return out.sort((a, b) => a - b);
}

/**
 * The first instant, to within a second, at which f has the sign it has at
 * `hi`, given that it has the other sign at `lo`. Each of a few rounds probes
 * half a second either side of where f, interpolated between the bracket's
 * ends, reaches zero, which closes the bracket once the interpolation is
 * within half a second; a bracket still open after them is halved. Every
 * probe's sign, not the interpolation, decides which side it is on.
 */
function signChange(lo: number, hi: number, flo: number, fhi: number, f: (ms: number) => number): number {
  let a = lo;
  let b = hi;
  let fa = flo;
  let fb = fhi;
  const before = flo > 0;
  for (let round = 0; b - a > SECOND_MS; round += 1) {
    let t = round < SECANT_ROUNDS && fb !== fa ? b - (fb * (b - a)) / (fb - fa) : (a + b) / 2;
    if (!(t > a && t < b)) t = (a + b) / 2;
    const probes = round < SECANT_ROUNDS ? [Math.floor(t - SECOND_MS / 2), Math.ceil(t + SECOND_MS / 2)] : [Math.floor(t)];
    for (const probe of probes) {
      if (probe <= a || probe >= b) continue;
      const value = f(probe);
      if ((value > 0) === before) {
        a = probe;
        fa = value;
      } else {
        b = probe;
        fb = value;
      }
    }
  }
  return b;
}

/**
 * The Moon's last exact Ptolemaic aspect to a modern body in (entered, leaving),
 * or null: scanned back from `leaving` in 3-hour steps, each crossing narrowed
 * to a second by signChange.
 */
function lastAspectBefore(entered: number, leaving: number, rowsAt: (ms: number) => BodyPosition[]): number | null {
  let hi = leaving;
  while (hi > entered) {
    const lo = Math.max(entered, hi - VOID_SCAN_MS);
    const before = rowsAt(lo);
    const after = rowsAt(hi);
    let latest: number | null = null;
    for (const body of VOID_BODIES_MODERN) {
      for (const offset of ASPECT_OFFSETS) {
        const s0 = separation(before, body, offset);
        const s1 = separation(after, body, offset);
        if (Math.abs(s0) >= 90 || Math.abs(s1) >= 90) continue;
        if (s1 === 0 && s0 !== 0) {
          latest = Math.max(latest ?? hi, hi);
          continue;
        }
        if (s0 === 0 || s1 === 0 || Math.sign(s0) === Math.sign(s1)) continue;
        const at = signChange(lo, hi, s0, s1, (ms) => separation(rowsAt(ms), body, offset));
        latest = Math.max(latest ?? at, at);
      }
    }
    // An aspect at `leaving` itself is the next sign's, as in the engine's rule.
    if (latest !== null && latest < leaving) return latest;
    hi = lo;
  }
  return null;
}

/** The Moon's void periods overlapping a window, clipped to it. */
function voidSpans(window: Span, budget: SampleBudget, rowsAt: (ms: number) => BodyPosition[]): Span[] {
  const ingresses = moonIngressInstants(window.from - VOID_REACH_BEFORE_MS, window.to + VOID_REACH_AFTER_MS, budget);
  const out: Span[] = [];
  for (let i = 1; i < ingresses.length; i += 1) {
    const entered = ingresses[i - 1];
    const leaving = ingresses[i];
    if (leaving <= window.from || entered >= window.to) continue;
    const last = lastAspectBefore(entered, leaving, rowsAt);
    out.push({ from: Math.max(window.from, last ?? entered), to: Math.min(window.to, leaving) });
  }
  return normalizeSpans(out);
}

/** What one natalChart sample says of a body: its house, and how far past each cusp it is. */
interface HouseSample {
  house: number;
  /** The body's longitude less the cusp's, in (−180, 180]: where it changes sign, the body crosses that cusp. */
  past(cusp: number): number;
}

/** The body's house at an instant as natalChart's cusps and houseOf place it, or null where the houses fall back. */
function houseSampleAt(body: EventBody, place: ElectionPlace, ms: number, budget: SampleBudget): HouseSample | null {
  budget.spend(FULL_CALCULATION_COST);
  const chart = natalChart({ utc: new Date(ms), latitude: place.latitude, longitude: place.longitude, houseSystem: place.houseSystem });
  if (!chart.houses || chart.flags.includes('polar-fallback')) return null;
  const { cusps } = chart.houses;
  const lon = rowOf(chart.bodies, body).lon;
  return { house: houseOf(lon, cusps), past: (cusp) => delta(cusps[cusp], lon) };
}

const isAngular = (house: number) => (ANGULAR_HOUSES as readonly number[]).includes(house);

/** How many houses a body moved through between two samples: the sky turns it from house 12 toward house 1. */
function housesPassed(before: number, after: number): number {
  return (((before - after) % 12) + 12) % 12;
}

const HOUSE_STEP_MS = ELECTION_STEPS.houseSampleMinutes * MINUTE_MS;

/** The fewest house samples a search of these stretches takes: one at each end of every step. */
export function houseSamplesAtLeast(stretches: readonly Span[], step = HOUSE_STEP_MS): number {
  return stretches.reduce((sum, stretch) => sum + Math.ceil((stretch.to - stretch.from) / step) + 1, 0);
}

/**
 * The spans of a candidate stretch in which a body is in an angular house.
 * natalChart is sampled every hour; a body passes at most a few houses in an
 * hour and never all twelve, so wherever it passed more than one house, or
 * moved the other way, the step is cut in two until each part crosses one
 * cusp. A crossing that changes whether the body is angular is narrowed to a
 * second: each round samples half a second either side of the instant where
 * the body's distance past the cusp, interpolated between the bracket's ends,
 * reaches zero, and a bracket that has not closed after a few rounds, or
 * whose cusps jump as whole-sign cusps do, is halved instead. Every sample's
 * house, not the interpolation, decides which side of the crossing it is on.
 * `step` is for the tests, which sample far more coarsely so that every step
 * passes several houses.
 */
export function angularSpans(body: EventBody, place: ElectionPlace, stretch: Span, budget: SampleBudget, step = HOUSE_STEP_MS): Span[] {
  const precision = ELECTION_STEPS.houseBoundarySeconds * SECOND_MS;
  const changes: Array<{ at: number; to: boolean }> = [];
  const samples = new Map<number, HouseSample>();
  const sample = (ms: number): HouseSample => {
    let found = samples.get(ms);
    if (found === undefined) {
      const value = houseSampleAt(body, place, ms, budget);
      // ANGULAR_MAX_ABS_LATITUDE keeps every system the engine offers from falling back.
      if (value === null) throw new Error('The houses fell back inside the latitudes an angular condition accepts.');
      found = value;
      samples.set(ms, found);
    }
    return found;
  };
  const at = (ms: number): number => sample(ms).house;
  // Whole-sign cusps jump when the ascendant changes sign, so there is nothing to interpolate: those crossings are halved.
  const rounds = place.houseSystem === 'whole' ? 0 : SECANT_ROUNDS;
  /** The first instant in house h1, to within `precision`, in a step that crosses only the cusp between h0 and h1. */
  const crossing = (lo: number, hi: number, h0: number, h1: number): number => {
    // House h runs from cusps[h - 1] to cusps[h % 12]: moving back a house the body crosses h0's first cusp, forward its last.
    const cusp = h1 === ((h0 + 10) % 12) + 1 ? h0 - 1 : h0 % 12;
    let a = lo;
    let b = hi;
    for (let round = 0; b - a > precision; round += 1) {
      const fa = sample(a).past(cusp);
      const fb = sample(b).past(cusp);
      let t = round < rounds && fb !== fa ? b - (fb * (b - a)) / (fb - fa) : (a + b) / 2;
      if (!(t > a && t < b)) t = (a + b) / 2;
      const probes = round < rounds ? [Math.floor(t - precision / 2), Math.ceil(t + precision / 2)] : [Math.floor(t)];
      for (const probe of probes) {
        if (probe <= a || probe >= b) continue;
        const house = at(probe);
        if (house === h0) a = probe;
        else if (house === h1) b = probe;
        else {
          // A third house inside a one-cusp step: narrow by halves, deciding by house alone.
          while (b - a > precision) {
            const mid = Math.floor((a + b) / 2);
            if (at(mid) === h0) a = mid;
            else b = mid;
          }
          return b;
        }
      }
    }
    return b;
  };
  /** Records each angularity change in [lo, hi], given the houses at both ends. */
  const resolve = (lo: number, hi: number): void => {
    const h0 = at(lo);
    const h1 = at(hi);
    if (h0 === h1) return;
    if (hi - lo <= precision) {
      if (isAngular(h0) !== isAngular(h1)) changes.push({ at: hi, to: isAngular(h1) });
      return;
    }
    if (housesPassed(h0, h1) === 1) {
      if (isAngular(h0) !== isAngular(h1)) changes.push({ at: crossing(lo, hi, h0, h1), to: isAngular(h1) });
      return;
    }
    const mid = Math.floor((lo + hi) / 2);
    resolve(lo, mid);
    resolve(mid, hi);
  };
  for (let lo = stretch.from; lo < stretch.to; lo += step) resolve(lo, Math.min(lo + step, stretch.to));
  return spansFromChanges(isAngular(at(stretch.from)), changes, stretch);
}

// ---------- the search ----------

function negate(spans: Span[], condition: ElectionCondition, within: Span): Span[] {
  return condition.not ? complementSpans(spans, within) : spans;
}

/** The windows in which every condition holds, and how the search ran. */
export function searchElections(request: ElectionsRequest, budget: SampleBudget = new SampleBudget('elections.samples')) {
  const window: Span = { from: request.from.getTime(), to: request.to.getTime() };
  const rowsAt = budgetedRows(budget);
  let candidates: Span[] = [{ ...window }];
  // The cheaper conditions first, so the house search runs only where they all hold.
  for (const condition of request.conditions) {
    if (condition.kind === 'angular') continue;
    let spans: Span[];
    switch (condition.kind) {
      case 'phase': {
        const waxing = waxingSpans(window, budget);
        spans = condition.phase === 'waxing' ? waxing : complementSpans(waxing, window);
        break;
      }
      case 'void-of-course':
        spans = voidSpans(window, budget, rowsAt);
        break;
      case 'sign':
        spans = signSpans(condition.body, condition.sign, window, budget, rowsAt);
        break;
      case 'retrograde':
        spans = retrogradeSpans(condition.body, window, budget, rowsAt);
        break;
    }
    candidates = intersectSpans(candidates, negate(spans, condition, window));
  }
  for (const condition of request.conditions) {
    if (condition.kind !== 'angular') continue;
    if (!request.place) throw new Error('An angular condition reached the search without a place.');
    const place = request.place;
    // Refused before sampling when the stretches left already need more samples than the request has left.
    budget.reserve(houseSamplesAtLeast(candidates) * FULL_CALCULATION_COST);
    candidates = candidates.flatMap((stretch) => intersectSpans([stretch], negate(angularSpans(condition.body, place, stretch, budget), condition, stretch)));
  }
  return { windows: resolveSpans(candidates, ELECTION_STEPS.resolutionSeconds * SECOND_MS), samples: budget.used, maxSamples: budget.max };
}

/** The request as validated, for a reader who holds only the response. */
function conditionEcho(condition: ElectionCondition): Record<string, string | boolean> {
  switch (condition.kind) {
    case 'phase': return { kind: condition.kind, phase: condition.phase, not: condition.not };
    case 'void-of-course': return { kind: condition.kind, not: condition.not };
    case 'sign': return { kind: condition.kind, body: condition.body, sign: condition.sign, not: condition.not };
    case 'retrograde':
    case 'angular': return { kind: condition.kind, body: condition.body, not: condition.not };
  }
}

/** The first and last instants a request's searches read: a void condition reads the Moon's sign changes on either side of the window. */
export function electionReach(request: ElectionsRequest): { first: Date; last: Date } {
  const voidOfCourse = request.conditions.some((condition) => condition.kind === 'void-of-course');
  return {
    first: new Date(request.from.getTime() - (voidOfCourse ? VOID_REACH_BEFORE_MS : 0)),
    last: new Date(request.to.getTime() - 1 + (voidOfCourse ? VOID_REACH_AFTER_MS : 0)),
  };
}

export function computeElections(request: ElectionsRequest) {
  const { windows, samples, maxSamples } = searchElections(request);
  const reach = electionReach(request);
  const flags = outsideReferenceSpan(reach.first) || outsideReferenceSpan(reach.last)
    ? ['outside-reference-span' as const]
    : [];
  return successBody('elections', {
    from: iso(request.from),
    to: iso(request.to),
    conditions: request.conditions.map(conditionEcho),
    place: request.place,
    windows: windows.map((span) => ({ from: iso(new Date(span.from)), to: iso(new Date(span.to)) })),
    flags,
  }, computeReceipt('elections', { electionSearch: electionSearchFacts(samples, maxSamples) }));
}

export function electionSearchFacts(samples: number, maxSamples: number): ElectionSearchFacts {
  return {
    solver: 'engine-longitude-crossings-and-sampled-houses',
    stepDays: { ...SEARCH_STEP_DAYS },
    voidOfCourse: { convention: 'last-exact-ptolemaic-aspect-to-sign-exit', bodies: 'modern', scanHours: VOID_SCAN_MS / HOUR_MS },
    houseSampleMinutes: ELECTION_STEPS.houseSampleMinutes,
    boundarySeconds: ELECTION_STEPS.houseBoundarySeconds,
    resolutionSeconds: ELECTION_STEPS.resolutionSeconds,
    fullCalculationCost: FULL_CALCULATION_COST,
    samples,
    maxSamples,
    window: 'start-inclusive-end-exclusive',
    completeness: 'tested-not-proven',
  };
}
