/**
 * The six calculations. Each takes a validated request and returns the body
 * of a success response; every number in it comes from the vendored engine's
 * root entry point (`natalChart`, `positions`, `moonPhase`, `deltaTAt`,
 * `outsideReferenceSpan`, `searchLongitudeCrossings`,
 * `searchLongitudeCrossingsWith`) or, for local civil time, from the site's
 * own resolver. The engine's `/receipt` entry point writes the chart receipt.
 * Nothing here keeps anything once the request is answered.
 */
import {
  deltaTAt,
  degreeInSign,
  moonPhase,
  natalChart,
  outsideReferenceSpan,
  positions,
  searchLongitudeCrossings,
  searchLongitudeCrossingsWith,
  signForLongitude,
  type BodyName,
  type BodyPosition,
  type Chart,
  type CrossingSearchResult,
  type DeltaT,
  type LongitudeCrossing,
} from '@zodiacs/engine';
import { createNatalEnvelope, type NatalEnvelopeContext, type NatalReceipt } from '@zodiacs/engine/receipt';
import {
  ANY_ZONE_DAY,
  BUDGETS,
  PHASES,
  SEARCH_STEP_DAYS,
  SIGN_SLUGS,
  STATION_BODIES,
  type BudgetName,
  type ComputeEndpoint,
  type EventBody,
  type EventKind,
  type PhaseName,
  type SignSlug,
} from './constants.js';
import { budgetExhausted } from './errors.js';
import {
  resolveLocal,
  runtimeTzdbVersion,
  timeResolutionFacts,
  type LocalResolution,
  type LocalTimeModule,
} from './local-time.js';
import {
  computeReceipt,
  successBody,
  type ComputeReceipt,
  type SearchFacts,
  type SuccessBody,
} from './receipt.js';
import type {
  EventsRequest,
  FactDay,
  PlaceInstantRequest,
  PositionsRequest,
  SkyFactRequest,
  TimeRequest,
} from './validate.js';

export interface ComputeDependencies {
  localTime: LocalTimeModule;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** astronomy-engine's `ut` counts days from 2000-01-01T12:00Z. */
const J2000_UT_MS = Date.UTC(2000, 0, 1, 12);

/** The ΔT the engine reads an instant with, as `deltaTAt` gives it for astronomy-engine's `ut`. */
function deltaTFor(instant: Date): DeltaT {
  return deltaTAt((instant.getTime() - J2000_UT_MS) / DAY_MS);
}

function iso(date: Date): string {
  return date.toISOString();
}

function rowOf(rows: readonly BodyPosition[], body: BodyName): BodyPosition {
  const row = rows.find((candidate) => candidate.body === body);
  if (!row) throw new Error('The engine returned no row for a body it names.');
  return row;
}

/** One positions() call per instant within a request; dropped with the request. */
function positionsMemo(): (date: Date) => BodyPosition[] {
  const memo = new Map<number, BodyPosition[]>();
  return (date) => {
    const key = date.getTime();
    let rows = memo.get(key);
    if (!rows) {
      rows = positions(date);
      memo.set(key, rows);
    }
    return rows;
  };
}

/** A whole-request allowance of evaluations shared by every search in it. */
class SampleBudget {
  used = 0;

  constructor(readonly limit: BudgetName) {}

  get max(): number {
    return BUDGETS[this.limit];
  }

  options(stepDays: number): { stepDays: number; maxSamples: number } {
    const remaining = this.max - this.used;
    if (remaining < 1) throw budgetExhausted(this.limit);
    return { stepDays, maxSamples: remaining };
  }

  settle(result: CrossingSearchResult): LongitudeCrossing[] {
    if (result.status === 'refused') throw budgetExhausted(this.limit);
    this.used += result.samples;
    return result.crossings;
  }

  facts(): SearchFacts {
    return {
      solver: 'engine-longitude-crossings',
      stepDays: { ...SEARCH_STEP_DAYS },
      bisections: 24,
      samples: this.used,
      maxSamples: this.max,
      window: 'start-exclusive-end-inclusive',
      completeness: 'tested-not-proven',
    };
  }
}

function stepFor(body: BodyName): number {
  return body === 'Moon' ? SEARCH_STEP_DAYS.moon : SEARCH_STEP_DAYS.default;
}

/** Sign ingresses: crossings of the twelve sign boundaries, in the engine's own longitudes. */
function signCrossings(
  body: BodyName,
  boundary: number,
  from: Date,
  to: Date,
  budget: SampleBudget,
): LongitudeCrossing[] {
  return budget.settle(searchLongitudeCrossings(body, boundary, from, to, budget.options(stepFor(body))));
}

/** The sign a body enters when it crosses a boundary: the one after it moving forward, before it moving backward. */
function signEntered(boundary: number, retrograde: boolean): SignSlug {
  const index = Math.round(boundary / 30) % 12;
  return SIGN_SLUGS[retrograde ? (index + 11) % 12 : index];
}

/** Stations: where the engine's longitude speed crosses zero, by the same solver. */
function stationCrossings(
  body: BodyName,
  from: Date,
  to: Date,
  budget: SampleBudget,
  rowsAt: (date: Date) => BodyPosition[],
): LongitudeCrossing[] {
  const speedAt = (name: BodyName, date: Date) => rowOf(rowsAt(date), name).speed;
  return budget.settle(searchLongitudeCrossingsWith(speedAt, body, 0, from, to, budget.options(SEARCH_STEP_DAYS.default)));
}

/** Principal lunar phases: where the Moon–Sun elongation of moonPhase() crosses 0°, 90°, 180° or 270°. */
function phaseCrossings(target: number, from: Date, to: Date, budget: SampleBudget): LongitudeCrossing[] {
  const elongationAt = (_body: BodyName, date: Date) => moonPhase(date).angle;
  return budget.settle(searchLongitudeCrossingsWith(elongationAt, 'Moon', target, from, to, budget.options(SEARCH_STEP_DAYS.elongation)));
}

function placeOf(lon: number): { lon: number; sign: SignSlug; degree: number } {
  return { lon, sign: signForLongitude(lon).slug, degree: degreeInSign(lon) };
}

// ---------- chart and houses ----------

interface LocalSummary {
  offsetMinutes: number;
  flags: LocalResolution['flags'];
  localMeanTime: LocalResolution['localMeanTime'];
  zoneHistory: LocalResolution['zoneHistory'];
  zoneUncertain: boolean;
}

function localSummary(local: LocalResolution): LocalSummary {
  return {
    offsetMinutes: local.offsetMinutes,
    flags: local.flags,
    localMeanTime: local.localMeanTime,
    zoneHistory: local.zoneHistory,
    zoneUncertain: local.zoneUncertain,
  };
}

async function placeInstantChart(
  request: PlaceInstantRequest,
  dependencies: ComputeDependencies,
): Promise<{ chart: Chart; receipt: NatalReceipt; local: LocalResolution | null }> {
  const local = request.local ? await resolveLocal(dependencies.localTime, request.local, request.longitude) : null;
  const instant = local ? local.utc : request.utc;
  if (!instant) throw new Error('A validated request has an instant.');
  const chart = natalChart({
    utc: instant,
    latitude: request.latitude,
    longitude: request.longitude,
    houseSystem: request.houseSystem,
    timeKnown: true,
    flags: local ? local.flags : [],
  });
  const context: NatalEnvelopeContext = { reference: 'supplied-instant' };
  if (request.sourceInstant !== null) context.sourceInstant = request.sourceInstant;
  if (local) {
    // As the calculator records a resolution: the gap shift is not rounded,
    // and a resolution whose arithmetic disagrees with its flags is left out
    // of the receipt rather than certified.
    const consistent = local.gapShiftMinutes >= 0
      && local.flags.includes('dst-gap') === (local.gapShiftMinutes > 0);
    if (consistent) {
      context.localResolution = {
        date: local.input.date,
        time: local.input.time,
        timeZone: local.input.zone,
        offsetMinutes: local.offsetMinutes,
        gapShiftMinutes: local.gapShiftMinutes,
        policy: { fold: 'earlier', gap: 'shift-forward' },
      };
    }
    const tzdb = runtimeTzdbVersion();
    context.provenance = { runtime: { name: 'node', ...(tzdb ? { tzdbVersion: tzdb } : {}) } };
  }
  const { receipt } = createNatalEnvelope(chart, context);
  return { chart, receipt, local };
}

export async function computeChart(request: PlaceInstantRequest, dependencies: ComputeDependencies) {
  const { chart, receipt, local } = await placeInstantChart(request, dependencies);
  return successBody('chart', {
    instant: iso(chart.input.utc),
    local: local ? localSummary(local) : null,
    bodies: chart.bodies,
    angles: chart.angles,
    houses: chart.houses,
    aspects: chart.aspects,
    flags: chart.flags,
    deltaT: chart.deltaT,
  }, receipt);
}

export async function computeHouses(request: PlaceInstantRequest, dependencies: ComputeDependencies) {
  const { chart, receipt, local } = await placeInstantChart(request, dependencies);
  return successBody('houses', {
    instant: iso(chart.input.utc),
    local: local ? localSummary(local) : null,
    angles: chart.angles,
    houses: chart.houses,
    flags: chart.flags,
    deltaT: chart.deltaT,
  }, receipt);
}

// ---------- positions ----------

export function computePositions(request: PositionsRequest) {
  const instants = request.instants.map((instant) => {
    const rows = positions(instant);
    return {
      instant: iso(instant),
      bodies: request.bodies ? rows.filter((row) => request.bodies!.includes(row.body)) : rows,
      deltaT: deltaTFor(instant),
      flags: outsideReferenceSpan(instant) ? ['outside-reference-span' as const] : [],
    };
  });
  return successBody('positions', { instants }, computeReceipt('positions'));
}

// ---------- events ----------

type EventRecord =
  | { kind: 'ingress'; body: EventBody; at: string; sign: SignSlug; retrograde: boolean }
  | { kind: 'station'; body: EventBody; at: string; type: 'retrograde' | 'direct'; lon: number; sign: SignSlug; degree: number }
  | { kind: 'lunation'; type: 'new' | 'full'; at: string; lon: number; sign: SignSlug; degree: number };

const KIND_ORDER: Readonly<Record<EventKind, number>> = { ingress: 0, station: 1, lunation: 2 };
const BODY_ORDER = new Map<string, number>(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
  .map((body, index) => [body, index]));

export function computeEvents(request: EventsRequest) {
  const { from, to } = request;
  const budget = new SampleBudget('events.samples');
  const rowsAt = positionsMemo();
  const events: EventRecord[] = [];
  if (request.kinds.includes('ingress')) {
    for (const body of request.bodies) {
      for (let index = 0; index < 12; index += 1) {
        for (const crossing of signCrossings(body, index * 30, from, to, budget)) {
          events.push({
            kind: 'ingress',
            body,
            at: iso(crossing.at),
            sign: signEntered(index * 30, crossing.retrograde),
            retrograde: crossing.retrograde,
          });
        }
      }
    }
  }
  if (request.kinds.includes('station')) {
    for (const body of request.bodies) {
      if (!(STATION_BODIES as readonly string[]).includes(body)) continue;
      for (const crossing of stationCrossings(body, from, to, budget, rowsAt)) {
        events.push({
          kind: 'station',
          body,
          at: iso(crossing.at),
          type: crossing.retrograde ? 'retrograde' : 'direct',
          ...placeOf(rowOf(rowsAt(crossing.at), body).lon),
        });
      }
    }
  }
  if (request.kinds.includes('lunation')) {
    for (const type of ['new', 'full'] as const) {
      for (const crossing of phaseCrossings(PHASES[type], from, to, budget)) {
        events.push({ kind: 'lunation', type, at: iso(crossing.at), ...placeOf(rowOf(rowsAt(crossing.at), 'Moon').lon) });
      }
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at)
    || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    || (BODY_ORDER.get('body' in a ? a.body : 'Moon') ?? 0) - (BODY_ORDER.get('body' in b ? b.body : 'Moon') ?? 0));
  return successBody('events', { from: iso(from), to: iso(to), events }, computeReceipt('events', { search: budget.facts() }));
}

// ---------- time ----------

export async function computeTime(request: TimeRequest, dependencies: ComputeDependencies) {
  const local = await resolveLocal(dependencies.localTime, request.local, request.longitude);
  const deltaT = deltaTFor(local.utc);
  // TT = UT1 + ΔT, with the instant read as UT1, as the engine reads it; to the millisecond.
  const tt = new Date(local.utc.getTime() + Math.round(deltaT.seconds * 1000));
  return successBody('time', {
    utc: iso(local.utc),
    ...localSummary(local),
    tt: iso(tt).slice(0, -1),
    deltaT,
  }, computeReceipt('time', { timeResolution: timeResolutionFacts() }));
}

// ---------- sky-fact ----------

type Answer = 'true' | 'false' | 'depends';

interface DayWindow {
  basis: 'local-day' | 'any-zone-day';
  from: Date;
  to: Date;
  zone: { start: LocalSummary & { utc: string }; end: LocalSummary & { utc: string } } | null;
}

function nextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

async function dayWindow(day: FactDay, dependencies: ComputeDependencies): Promise<DayWindow> {
  if (day.zone === null) {
    const midnight = Date.parse(`${day.date}T00:00:00Z`);
    return {
      basis: 'any-zone-day',
      from: new Date(midnight - ANY_ZONE_DAY.startHoursBeforeUtcMidnight * HOUR_MS),
      to: new Date(midnight + ANY_ZONE_DAY.endHoursAfterUtcMidnight * HOUR_MS),
      zone: null,
    };
  }
  const start = await resolveLocal(dependencies.localTime, { date: day.date, time: '00:00', zone: day.zone }, null);
  const end = await resolveLocal(dependencies.localTime, { date: nextDate(day.date), time: '00:00', zone: day.zone }, null);
  return {
    basis: 'local-day',
    from: start.utc,
    to: end.utc,
    zone: {
      start: { utc: iso(start.utc), ...localSummary(start) },
      end: { utc: iso(end.utc), ...localSummary(end) },
    },
  };
}

/**
 * The searches report crossings in (from, to]; a day runs [from, to). Moving
 * both ends back one millisecond, the resolution of every instant here, makes
 * the search cover the day exactly.
 */
function searchSpan(window: DayWindow): { from: Date; to: Date } {
  return { from: new Date(window.from.getTime() - 1), to: new Date(window.to.getTime() - 1) };
}

function stateAt(rows: readonly BodyPosition[], body: BodyName) {
  const row = rowOf(rows, body);
  return { lon: row.lon, sign: row.sign, degree: row.degree, speed: row.speed, retrograde: row.retrograde };
}

/** Distance from a longitude to the nearest sign boundary, in arcseconds. */
function boundaryMarginArcsec(lon: number): number {
  const within = lon % 30;
  return Math.min(within, 30 - within) * 3600;
}

export async function computeSkyFact(request: SkyFactRequest, dependencies: ComputeDependencies) {
  const budget = new SampleBudget('sky-fact.samples');
  const rowsAt = positionsMemo();
  const fact = factEcho(request);

  if ((request.kind === 'sign' || request.kind === 'retrograde') && 'instant' in request.when) {
    const instant = request.when.instant;
    const state = stateAt(rowsAt(instant), request.body);
    const answer: Answer = request.kind === 'sign'
      ? (state.sign === request.sign ? 'true' : 'false')
      : (state.retrograde ? 'true' : 'false');
    return successBody('sky-fact', {
      answer,
      basis: 'instant' as const,
      fact,
      instant: iso(instant),
      window: null,
      zone: null,
      facts: {
        ...state,
        deltaT: deltaTFor(instant),
        ...(request.kind === 'sign' ? { boundaryMarginArcsec: boundaryMarginArcsec(state.lon) } : {}),
        flags: outsideReferenceSpan(instant) ? ['outside-reference-span' as const] : [],
      },
    }, computeReceipt('sky-fact'));
  }

  const day: FactDay = 'day' in request ? request.day : (request.when as FactDay);
  const window = await dayWindow(day, dependencies);
  const span = searchSpan(window);
  const anyZone = window.basis === 'any-zone-day';
  let answer: Answer;
  let facts: Record<string, unknown>;

  switch (request.kind) {
    case 'sign': {
      const index = SIGN_SLUGS.indexOf(request.sign);
      const atStart = stateAt(rowsAt(window.from), request.body);
      const changes = [index * 30, ((index + 1) % 12) * 30]
        .flatMap((boundary) => signCrossings(request.body, boundary, span.from, span.to, budget)
          .map((crossing) => ({ at: iso(crossing.at), into: signEntered(boundary, crossing.retrograde), retrograde: crossing.retrograde })))
        .sort((a, b) => a.at.localeCompare(b.at));
      answer = changes.length > 0 ? 'depends' : (atStart.sign === request.sign ? 'true' : 'false');
      facts = { atStart, atEnd: stateAt(rowsAt(span.to), request.body), changes };
      break;
    }
    case 'retrograde': {
      const atStart = stateAt(rowsAt(window.from), request.body);
      const stations = (STATION_BODIES as readonly string[]).includes(request.body)
        ? stationCrossings(request.body, span.from, span.to, budget, rowsAt)
          .map((crossing) => ({ at: iso(crossing.at), type: crossing.retrograde ? 'retrograde' as const : 'direct' as const }))
        : [];
      answer = stations.length > 0 ? 'depends' : (atStart.retrograde ? 'true' : 'false');
      facts = { atStart, atEnd: stateAt(rowsAt(span.to), request.body), stations };
      break;
    }
    case 'ingress': {
      const index = SIGN_SLUGS.indexOf(request.sign);
      const ingresses = [
        ...signCrossings(request.body, index * 30, span.from, span.to, budget).filter((crossing) => !crossing.retrograde),
        ...signCrossings(request.body, ((index + 1) % 12) * 30, span.from, span.to, budget).filter((crossing) => crossing.retrograde),
      ].map((crossing) => ({ at: iso(crossing.at), retrograde: crossing.retrograde }))
        .sort((a, b) => a.at.localeCompare(b.at));
      answer = ingresses.length === 0 ? 'false' : anyZone ? 'depends' : 'true';
      facts = { ingresses };
      break;
    }
    case 'phase': {
      const lunations = phaseCrossings(PHASES[request.phase], span.from, span.to, budget)
        .map((crossing) => ({ at: iso(crossing.at), ...placeOf(rowOf(rowsAt(crossing.at), 'Moon').lon) }));
      answer = lunations.length === 0 ? 'false' : anyZone ? 'depends' : 'true';
      facts = { lunations };
      break;
    }
  }

  return successBody('sky-fact', {
    answer,
    basis: window.basis,
    fact,
    instant: null,
    window: { from: iso(window.from), to: iso(window.to) },
    zone: window.zone,
    facts,
  }, computeReceipt('sky-fact', {
    search: budget.facts(),
    ...(window.zone ? { timeResolution: timeResolutionFacts() } : {}),
  }));
}

/** The fact as validated, for a reader who holds only the response. */
function factEcho(request: SkyFactRequest): Record<string, string | null> {
  switch (request.kind) {
    case 'sign':
    case 'retrograde': {
      const when = 'instant' in request.when
        ? { instant: iso(request.when.instant), date: null, zone: null }
        : { instant: null, date: request.when.date, zone: request.when.zone };
      return request.kind === 'sign'
        ? { kind: request.kind, body: request.body, sign: request.sign, ...when }
        : { kind: request.kind, body: request.body, ...when };
    }
    case 'ingress':
      return { kind: request.kind, body: request.body, sign: request.sign, date: request.day.date, zone: request.day.zone };
    case 'phase':
      return { kind: request.kind, phase: request.phase, date: request.day.date, zone: request.day.zone };
  }
}

export type ComputeSuccess = SuccessBody<unknown, NatalReceipt | ComputeReceipt>;

export const PHASE_TARGETS: Readonly<Record<PhaseName, number>> = PHASES;
export type { ComputeEndpoint };
