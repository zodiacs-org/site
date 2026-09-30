/**
 * What differs between two calculation receipts, and how well each difference
 * is explained.
 *
 * Two rules shape everything here. Differences are facts read out of the two
 * files and are listed before any prose. Explanations are ranked by the
 * evidence that actually supports them, and the strongest rank — "reproduced" —
 * means one thing: the engine installed here, re-running the inputs each
 * receipt declares, produced the values that receipt records, and changing the
 * one named setting turned each chart into the other.
 *
 * That is a statement about this installation and these values. It is not a
 * statement about where either file came from, and nothing here can be. A
 * receipt naming a version this installation does not have is never re-run and
 * presented as the original — recomputing it would be a different calculation.
 */
import type { NatalEnvelope } from '@zodiacs/engine/receipt';
import {
  circularDelta, compareAngles, compareScalars, displayed, formatDelta, type NumericVerdict,
} from './angles';

/** How strongly a proposed cause is supported. */
export type Evidence = 'reproduced' | 'reported' | 'hypothesis' | 'unresolved';

export type DifferenceKind = 'metadata' | 'numeric' | 'display';

export interface Difference {
  readonly id: string;
  readonly area: string;
  readonly label: string;
  readonly left: string;
  readonly right: string;
  /** Signed degrees, for angular rows only. */
  readonly delta: number | null;
  readonly kind: DifferenceKind;
}

export interface Explanation {
  readonly id: string;
  readonly evidence: Evidence;
  readonly statement: string;
  /** Difference ids this claims to account for. */
  readonly covers: readonly string[];
  readonly detail: string | null;
}

export interface Comparison {
  readonly identical: boolean;
  readonly differences: readonly Difference[];
  readonly explanations: readonly Explanation[];
  /** What this comparison could not determine, stated rather than omitted. */
  readonly limits: readonly string[];
}

/** A local recalculation, injected so this module never imports an engine. */
export interface ReplayRequest {
  readonly utc: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly houseSystem: string;
  readonly timeKnown: boolean;
  /**
   * A ΔT (TT − UT1) the record's caller pinned, in seconds. Absent means the
   * engine's own model, which is what a record without a pin was computed with.
   */
  readonly deltaT?: number;
  /**
   * The scale the record's instant is on, where it is not UTC (engine
   * 0.1.1-rc.15 on). The same digits on another scale are another moment.
   */
  readonly timeScale?: 'ut1' | 'tt';
}
export interface ReplayResult {
  readonly angles: Record<string, number> | null;
  readonly bodies: readonly { readonly body: string; readonly lon: number }[];
  /** House cusps: for whole-sign versus Placidus these move while the angles do not. */
  readonly cusps: readonly number[] | null;
}
export type Replay = (request: ReplayRequest) => ReplayResult | null;

/** One body row as receipts carry it. Read defensively: this is imported data. */
interface BodyRow {
  readonly body: string;
  readonly lon?: unknown;
  readonly lat?: unknown;
  readonly speed?: unknown;
  readonly degree?: unknown;
  readonly sign?: unknown;
  readonly retrograde?: unknown;
}

/** One aspect as receipts carry it. */
interface AspectRow {
  readonly a?: unknown;
  readonly b?: unknown;
  readonly type?: unknown;
  readonly orb?: unknown;
  readonly applying?: unknown;
}

export interface CompareOptions {
  /** The engine version available to recalculate with, if any. */
  readonly engineVersion?: string | null;
  readonly replay?: Replay | null;
}

const ANGLE_LABELS: Record<string, string> = { asc: 'Ascendant', mc: 'Midheaven', dsc: 'Descendant', ic: 'Imum coeli' };

/** The fields of a record's ΔT (engine 0.1.1-rc.8 on), in the order they are listed. */
const DELTA_T_LABELS: Record<string, string> = {
  seconds: 'ΔT (TT − UT1), seconds',
  sigma: 'ΔT band (1σ), seconds',
  model: 'ΔT model',
  table: 'ΔT table (last observed day)',
  tableDigest: 'ΔT table digest',
  segment: 'ΔT segment',
};

/**
 * The ΔT rows that say where a value came from. Within one engine version only
 * the moment picks them: from 0.1.1-rc.15 an instant from 1972 to 2027-10-02
 * takes ΔT from IERS and any other from the model. Across versions a different
 * table can change them at one instant, so there no difference in the moment
 * is enough to account for them.
 */
const DELTA_T_SOURCE_ROWS = new Set(['delta-t-model', 'delta-t-table', 'delta-t-tableDigest']);

/**
 * The time basis a record carries from engine 0.1.1-rc.15 on
 * (`result.timeScale`): how its instant became UT1 and TT. Its input scale is
 * the receipt's `timeScale`, compared with the inputs.
 */
const TIME_BASIS_LABELS: ReadonlyArray<readonly [id: string, label: string, read: (scale: Record<string, any>) => unknown]> = [
  ['time-basis', 'Time basis', (scale) => scale.basis],
  ['ut1-utc-seconds', 'UT1 − UTC, seconds', (scale) => scale.ut1MinusUtc?.seconds ?? null],
  ['ut1-utc-sigma', 'UT1 − UTC band (1σ), seconds', (scale) => scale.ut1MinusUtc?.sigma ?? null],
  ['ut1-utc-source', 'UT1 − UTC source', (scale) => scale.ut1MinusUtc?.source ?? null],
  ['tai-utc-seconds', 'TAI − UTC (leap seconds), seconds', (scale) => scale.leapSeconds?.taiMinusUtc ?? null],
  ['leap-seconds-listed', 'Leap-second list in force', (scale) => scale.leapSeconds?.listed ?? null],
];

function timeBasisOf(envelope: NatalEnvelope): Record<string, any> | null {
  const scale = (envelope.result as { timeScale?: unknown }).timeScale;
  return scale !== null && typeof scale === 'object' ? scale as Record<string, any> : null;
}

function deltaTOf(envelope: NatalEnvelope): Record<string, unknown> | null {
  const deltaT = (envelope.result as { deltaT?: unknown }).deltaT;
  return deltaT !== null && typeof deltaT === 'object' ? deltaT as Record<string, unknown> : null;
}

function verdictKind(verdict: NumericVerdict): DifferenceKind | null {
  if (verdict === 'identical') return null;
  return verdict === 'display-only' ? 'display' : 'numeric';
}

function num(value: number): string {
  return Number.isFinite(value) ? displayed(value) : '—';
}

function engineVersionOf(envelope: NatalEnvelope): string | null {
  const engine = (envelope.receipt as { engine?: { version?: unknown } }).engine;
  return typeof engine?.version === 'string' ? engine.version : null;
}

/**
 * The part of a version string that decides SemVer precedence, with build
 * metadata dropped.
 *
 * Equal precedence is an ordering fact, not executable identity. SemVer §10
 * says `0.1.1-rc.6+abc` and `0.1.1-rc.6` order equally; it does not say the two
 * builds run the same code, and a version string is in any case a claim a file
 * makes about itself. So this decides one narrow thing — which receipts this
 * installation will re-run at all — and nothing downstream rests on the string.
 * What a verdict rests on is the replay's own result.
 */
function enginePrecedence(version: string | null): string | null {
  return version === null ? null : version.split('+')[0];
}

/**
 * What a receipt claims about the specific build it came from, if it claims
 * anything at all: `null` when it makes no such claim.
 *
 * None of this is authenticated, and a claim is never evidence that two files
 * came from the same code. It is read for one purpose only — to say out loud,
 * in `limits`, when two files that both make a claim make different ones. It is
 * deliberately NOT a gate on the verdict. SemVer build metadata is not a
 * different engine (see `enginePrecedence`), and a file that claims nothing has
 * not claimed something different from one that does. What actually establishes
 * that a recalculation may speak for a receipt is the baseline below, which
 * checks the receipt's own values against its own declared inputs.
 */
function claimedBuild(envelope: NatalEnvelope): string | null {
  const receipt = envelope.receipt as {
    engine?: { version?: unknown };
    provenance?: { artifact?: { sha256?: unknown; packageVersion?: unknown } } | null;
  };
  const artifact = receipt.provenance?.artifact;
  const sha256 = typeof artifact?.sha256 === 'string' ? artifact.sha256 : null;
  const build = typeof receipt.engine?.version === 'string' && receipt.engine.version.includes('+')
    ? receipt.engine.version.slice(receipt.engine.version.indexOf('+') + 1) : null;
  if (sha256 === null && build === null) return null;
  return JSON.stringify([build, sha256]);
}

function cuspsOf(envelope: NatalEnvelope): readonly number[] | null {
  const cusps = (envelope.result as { houses?: { cusps?: unknown } }).houses?.cusps;
  return Array.isArray(cusps) && cusps.every((value) => typeof value === 'number') ? cusps : null;
}

function anglesOf(envelope: NatalEnvelope): Record<string, number> | null {
  const angles = (envelope.result as { angles?: unknown }).angles;
  return angles !== null && typeof angles === 'object' ? angles as Record<string, number> : null;
}

function bodyLongitudesOf(source: { bodies?: readonly { body: string; lon?: unknown }[] } | null): Map<string, number> {
  return new Map((source?.bodies ?? [])
    .filter((row) => typeof row.lon === 'number')
    .map((row) => [row.body, row.lon as number]));
}

/** Whether two cusp lists agree at every index, by the circular rules. */
function cuspsAgree(a: readonly number[] | null | undefined, b: readonly number[] | null | undefined, indices: readonly number[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return indices.every((index) => index >= 0 && index < a.length
    && compareAngles(a[index], b[index]) !== 'different');
}

/**
 * Whether a receipt's own recorded values follow from the inputs it declares,
 * recalculated here.
 *
 * The cusps alone cannot answer this. Whole-sign cusps are quantised to sign
 * boundaries, so they survive an hour of drift in the declared instant
 * unchanged — a receipt whose instant was rewritten reproduces its own
 * whole-sign cusps trivially. The angles and the body longitudes do not: they
 * move continuously with the moment and the place, which is what makes them the
 * discriminating evidence here. Every value a receipt carries that the replay
 * also produces is checked, not a conveniently matching subset.
 */
function reproducesItsOwnValues(envelope: NatalEnvelope, replayed: ReplayResult | null): boolean {
  if (!replayed) return false;
  const cusps = cuspsOf(envelope);
  if (cusps !== null) {
    if (!cuspsAgree(replayed.cusps, cusps, cusps.map((_, index) => index))) return false;
  }
  const angles = anglesOf(envelope);
  if (angles !== null) {
    const replayedAngles = replayed.angles;
    if (replayedAngles === null) return false;
    for (const [key, value] of Object.entries(angles)) {
      if (typeof value !== 'number') continue;
      const mine = replayedAngles[key];
      if (typeof mine !== 'number' || compareAngles(mine, value) === 'different') return false;
    }
  }
  const recorded = bodyLongitudesOf(envelope.result as { bodies?: readonly { body: string; lon?: unknown }[] });
  const produced = bodyLongitudesOf(replayed as unknown as { bodies?: readonly { body: string; lon?: unknown }[] });
  for (const [body, lon] of recorded) {
    const mine = produced.get(body);
    if (typeof mine !== 'number' || compareAngles(mine, lon) === 'different') return false;
  }
  return true;
}

function replayInputOf(envelope: NatalEnvelope): ReplayRequest | null {
  const receipt = envelope.receipt as {
    instant?: unknown; timeKnown?: unknown;
    coordinates?: { latitude?: unknown; longitude?: unknown } | null;
    houses?: { requested?: unknown } | null;
  };
  const { latitude, longitude } = receipt.coordinates ?? {};
  if (typeof receipt.instant !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number'
    || typeof receipt.houses?.requested !== 'string') return null;
  // A pinned ΔT is one of the inputs a record declares — the engine's own
  // replay input carries it — so a replay without it recalculates a different
  // chart and then blames the record for not matching.
  const deltaT = deltaTOf(envelope);
  const pinned = deltaT?.model === 'pinned' && typeof deltaT.seconds === 'number' ? { deltaT: deltaT.seconds } : {};
  // So is the scale of the instant (engine 0.1.1-rc.15 on): read on UTC, a UT1
  // or TT instant is another moment.
  const scale = (receipt as { timeScale?: unknown }).timeScale;
  const onScale = scale === 'ut1' || scale === 'tt' ? { timeScale: scale } : {};
  return {
    utc: receipt.instant, latitude, longitude, houseSystem: receipt.houses.requested,
    timeKnown: receipt.timeKnown === true, ...pinned, ...onScale,
  };
}

/** Rows: every fact that differs, read from the two files and nothing else. */
function collectDifferences(left: NatalEnvelope, right: NatalEnvelope): Difference[] {
  const rows: Difference[] = [];
  const add = (id: string, area: string, label: string, a: string, b: string, kind: DifferenceKind, delta: number | null = null) => {
    rows.push({ id, area, label, left: a, right: b, delta, kind });
  };
  const text = (id: string, area: string, label: string, a: unknown, b: unknown) => {
    const x = a === null || a === undefined ? '—' : String(a);
    const y = b === null || b === undefined ? '—' : String(b);
    if (x !== y) rows.push({ id, area, label, left: x, right: y, delta: null, kind: 'metadata' });
  };
  // Values arrive from imported files, so they are unknown until checked here:
  // anything that is not a pair of numbers falls back to a stated-value row.
  const scalar = (id: string, area: string, label: string, a: unknown, b: unknown) => {
    if (typeof a !== 'number' || typeof b !== 'number') return text(id, area, label, a, b);
    const kind = verdictKind(compareScalars(a, b));
    if (kind) add(id, area, label, num(a), num(b), kind, b - a);
  };
  const angle = (id: string, area: string, label: string, a: unknown, b: unknown) => {
    if (typeof a !== 'number' || typeof b !== 'number') return text(id, area, label, a, b);
    const kind = verdictKind(compareAngles(a, b));
    if (kind) add(id, area, label, num(a), num(b), kind, circularDelta(a, b));
  };
  // A quantity in its own unit: judged like `scalar`, but with no `delta`,
  // which the tables print in degrees.
  const quantity = (id: string, area: string, label: string, a: unknown, b: unknown) => {
    if (typeof a !== 'number' || typeof b !== 'number') return text(id, area, label, a, b);
    const kind = verdictKind(compareScalars(a, b));
    if (kind) add(id, area, label, num(a), num(b), kind);
  };

  const lr = left.receipt as Record<string, any>;
  const rr = right.receipt as Record<string, any>;

  text('instant', 'Inputs', 'Resolved instant (UTC)', lr.instant, rr.instant);
  text('source-instant', 'Inputs', 'Instant as supplied', lr.sourceInstant, rr.sourceInstant);
  text('reference', 'Inputs', 'How the instant was reached', lr.reference, rr.reference);
  // The scale the instant is on, which records state from engine 0.1.1-rc.15.
  text('time-scale', 'Inputs', 'Time scale of the instant', lr.timeScale, rr.timeScale);
  text('time-known', 'Inputs', 'Birth time known', lr.timeKnown, rr.timeKnown);
  text('zone', 'Inputs', 'Supplied time zone', lr.localResolution?.timeZone ?? null, rr.localResolution?.timeZone ?? null);
  scalar('latitude', 'Inputs', 'Latitude', lr.coordinates?.latitude, rr.coordinates?.latitude);
  scalar('longitude', 'Inputs', 'Longitude', lr.coordinates?.longitude, rr.coordinates?.longitude);

  text('houses-requested', 'Houses', 'House system requested', lr.houses?.requested, rr.houses?.requested);
  text('houses-actual', 'Houses', 'House system actually used', lr.houses?.actual, rr.houses?.actual);
  text('houses-absence', 'Houses', 'Why houses are absent', lr.houses?.absenceReason, rr.houses?.absenceReason);

  const conventionKeys = [...new Set([...Object.keys(lr.conventions ?? {}), ...Object.keys(rr.conventions ?? {})])].sort();
  for (const key of conventionKeys) {
    const own = (source: Record<string, unknown> | undefined | null) =>
      (source && Object.hasOwn(source, key) ? source[key] : null);
    text(`convention-${key}`, 'Conventions', key, own(lr.conventions), own(rr.conventions));
  }

  text('engine-version', 'Provenance', 'Engine version', engineVersionOf(left), engineVersionOf(right));
  // Reported above whatever the difference is; `explain` decides separately
  // whether it is a difference in the engine or only in its build metadata.
  text('schema', 'Provenance', 'Receipt schema', left.schema, right.schema);
  text('result-flags', 'Provenance', 'Result flags', JSON.stringify(lr.resultFlags ?? []), JSON.stringify(rr.resultFlags ?? []));
  text('input-flags', 'Provenance', 'Input flags', JSON.stringify(lr.inputFlags ?? []), JSON.stringify(rr.inputFlags ?? []));

  // ΔT (TT − UT1), which records carry from engine 0.1.1-rc.8 on. Every field,
  // as with a body row: two records of one instant can still differ here — one
  // caller pinned it, or it came from another table — and that moves every
  // position. A record from before rc.8 carries none, and that difference is
  // already a conventions row: the parser requires the field exactly when the
  // record declares the rc.8 conventions.
  const ldt = deltaTOf(left);
  const rdt = deltaTOf(right);
  if (ldt && rdt) {
    const extra = [...new Set([...Object.keys(ldt), ...Object.keys(rdt)])]
      .filter((key) => !Object.hasOwn(DELTA_T_LABELS, key)).sort();
    for (const key of [...Object.keys(DELTA_T_LABELS), ...extra]) {
      const own = (source: Record<string, unknown>) => (Object.hasOwn(source, key) ? source[key] : null);
      quantity(`delta-t-${key}`, 'Time scale', Object.hasOwn(DELTA_T_LABELS, key) ? DELTA_T_LABELS[key] : `ΔT ${key}`,
        own(ldt), own(rdt));
    }
  }

  // How each instant became UT1 and TT, which records carry from engine
  // 0.1.1-rc.15: a different moment, input scale or pin can change it.
  const lts = timeBasisOf(left);
  const rts = timeBasisOf(right);
  if (lts && rts) {
    for (const [id, label, read] of TIME_BASIS_LABELS) quantity(id, 'Time scale', label, read(lts), read(rts));
  }

  const la = (left.result as any).angles as Record<string, number> | null;
  const ra = (right.result as any).angles as Record<string, number> | null;
  if (la && ra) {
    for (const key of [...new Set([...Object.keys(la), ...Object.keys(ra)])].sort()) {
      const label = Object.hasOwn(ANGLE_LABELS, key) ? ANGLE_LABELS[key] : key;
      angle(`angle-${key}`, 'Angles', label, la[key], ra[key]);
    }
  } else if (Boolean(la) !== Boolean(ra)) {
    text('angles-presence', 'Angles', 'Angles available', Boolean(la), Boolean(ra));
  }

  const byBody = (result: unknown): Map<string, BodyRow> =>
    new Map((((result as { bodies?: readonly BodyRow[] }).bodies ?? []) as readonly BodyRow[])
      .map((entry) => [entry.body, entry] as const));
  const lb = byBody(left.result);
  const rb = byBody(right.result);
  for (const body of [...new Set([...lb.keys(), ...rb.keys()])]) {
    const a = lb.get(body);
    const b = rb.get(body);
    if (!a || !b) { text(`body-${body}`, 'Positions', `${body} present`, Boolean(a), Boolean(b)); continue; }
    // Every field a body row carries, not only the longitude: two receipts that
    // agree on longitude can still disagree on ecliptic latitude or on speed,
    // and calling those two files the same calculation would be false.
    angle(`body-${body}-lon`, 'Positions', `${body} longitude`, a.lon, b.lon);
    scalar(`body-${body}-lat`, 'Positions', `${body} ecliptic latitude`, a.lat, b.lat);
    scalar(`body-${body}-speed`, 'Positions', `${body} speed`, a.speed, b.speed);
    scalar(`body-${body}-degree`, 'Positions', `${body} degree in sign`, a.degree, b.degree);
    text(`body-${body}-sign`, 'Positions', `${body} sign`, a.sign, b.sign);
    text(`body-${body}-retrograde`, 'Positions', `${body} retrograde`, a.retrograde, b.retrograde);
  }

  // Aspects are keyed by the pair and the type, so a list in a different order
  // is not a difference and a genuinely missing aspect is.
  const byAspect = (result: unknown): Map<string, AspectRow> => new Map(
    (((result as { aspects?: readonly AspectRow[] }).aspects ?? []) as readonly AspectRow[])
      .map((entry) => [`${String(entry.a)}|${String(entry.b)}|${String(entry.type)}`, entry] as const),
  );
  const lasp = byAspect(left.result);
  const rasp = byAspect(right.result);
  for (const key of [...new Set([...lasp.keys(), ...rasp.keys()])].sort()) {
    const a = lasp.get(key);
    const b = rasp.get(key);
    const label = key.split('|').join(' ');
    if (!a || !b) { text(`aspect-${key}`, 'Aspects', `${label} present`, Boolean(a), Boolean(b)); continue; }
    scalar(`aspect-${key}-orb`, 'Aspects', `${label} orb`, a.orb, b.orb);
    text(`aspect-${key}-applying`, 'Aspects', `${label} applying`, a.applying, b.applying);
  }

  text('houses-system', 'Houses', 'House system in the result',
    (left.result as any).houses?.system ?? null, (right.result as any).houses?.system ?? null);
  const lc = (left.result as any).houses?.cusps as number[] | undefined;
  const rc = (right.result as any).houses?.cusps as number[] | undefined;
  if (Array.isArray(lc) && Array.isArray(rc) && lc.length === rc.length) {
    for (let index = 0; index < lc.length; index += 1) {
      angle(`cusp-${index + 1}`, 'Houses', `House ${index + 1} cusp`, lc[index], rc[index]);
    }
  } else if (Array.isArray(lc) !== Array.isArray(rc) || (lc?.length ?? 0) !== (rc?.length ?? 0)) {
    text('cusps-shape', 'Houses', 'House cusps present', lc?.length ?? '—', rc?.length ?? '—');
  }

  return rows;
}

/**
 * Try to account for the differences, one varied setting at a time, and say how
 * strong the evidence is. Every claim here is either read from the files
 * ("reported"), demonstrated by a local recalculation on a matching engine
 * ("reproduced"), offered as a candidate ("hypothesis"), or refused
 * ("unresolved").
 */
/**
 * What a difference row is ABOUT, decided by the fact it reports rather than by
 * how that fact happens to be written down.
 *
 * An aspect's applying flag, and an aspect's very existence, are results this
 * engine computed — but they are booleans, so a view of "computed" built from
 * `kind === 'numeric'` could not see them. That is how a summary came to say
 * "Every computed value agrees" over two files whose aspect lists disagreed.
 * Seven computed row families were invisible that way: angles-presence,
 * body presence, body sign, body retrograde, aspect presence, aspect applying,
 * and cusps-shape.
 *
 * `kind === 'display'` stays excluded everywhere, and that is a stated policy
 * of this module rather than a loophole: two values that print identically at
 * six decimals are a rounding difference, not a different calculation.
 */
type RowCategory = 'computed' | 'setting' | 'input' | 'provenance';

/** Requested or actual house system: a setting, not a result. */
const SETTING_ROWS = new Set(['houses-requested', 'houses-actual', 'houses-system']);
/** Birth details as supplied, and how the instant was reached from them. */
const INPUT_ROWS = new Set(['instant', 'source-instant', 'reference', 'time-scale', 'time-known', 'zone', 'latitude', 'longitude']);
/** What a file says about itself, or about how its run went. */
const PROVENANCE_ROWS = new Set(['engine-version', 'schema', 'result-flags', 'input-flags', 'houses-absence']);

function categoryOf(row: Difference): RowCategory {
  if (SETTING_ROWS.has(row.id)) return 'setting';
  if (INPUT_ROWS.has(row.id)) return 'input';
  if (PROVENANCE_ROWS.has(row.id)) return 'provenance';
  if (row.area === 'Conventions') return 'setting';
  // What the Angles, Positions, Aspects and Houses areas have left is a value
  // this engine produced: angle-*, angles-presence, body-*, aspect-*, cusp-*,
  // cusps-shape.
  return 'computed';
}

function explain(left: NatalEnvelope, right: NatalEnvelope, differences: Difference[], options: CompareOptions): {
  explanations: Explanation[]; limits: string[];
} {
  const explanations: Explanation[] = [];
  const limits: string[] = [];
  const has = (id: string) => differences.some((row) => row.id === id && row.kind !== 'display');
  // `idsIn` stays numeric-only, which is the right test for `movedCusps` below:
  // a house system moves cusp NUMBERS. It is the wrong test for "did anything
  // this engine computed differ?", which is what `computed` answers.
  const idsIn = (area: string) => differences.filter((row) => row.area === area && row.kind === 'numeric').map((row) => row.id);
  const computed = differences
    .filter((row) => row.kind !== 'display' && categoryOf(row) === 'computed')
    .map((row) => row.id);

  /**
   * Everything a cause upstream of the calculation can move, of any kind: a
   * different moment changes signs and which aspects exist, not only numbers.
   *
   * Two families are held back. Rows recording that a whole section is missing
   * follow from an absent birth time, and rows recording which house system was
   * asked for or used are a setting, not a result — a different moment or place
   * cannot change either, and letting one claim them is the same error as
   * letting a house system absorb a moved body, only pointing the other way.
   */
  const NOT_DOWNSTREAM = new Set([
    'angles-presence', 'houses-absence', 'cusps-shape',
    'houses-requested', 'houses-actual', 'houses-system',
  ]);
  const downstream = (areas: readonly string[]) => differences
    .filter((row) => areas.includes(row.area) && row.kind !== 'display' && !NOT_DOWNSTREAM.has(row.id))
    .map((row) => row.id);

  const leftEngine = engineVersionOf(left);
  const rightEngine = engineVersionOf(right);
  const available = options.engineVersion ?? null;
  const replay = options.replay ?? null;
  const leftPrecedence = enginePrecedence(leftEngine);
  const sameEngine = leftPrecedence !== null && leftPrecedence === enginePrecedence(rightEngine);
  const engineDiffers = leftPrecedence !== enginePrecedence(rightEngine);

  if (has('source-instant') && !has('instant')) {
    // "only" has to mean only. Deciding it on a count of computed rows let the
    // sentence stand while a convention, a flag or a provenance row differed
    // elsewhere in the same result; deciding it on coverage cannot.
    const notationRows = ['source-instant', 'zone', 'reference'].filter(has);
    const onlyNotation = differences
      .every((row) => row.kind === 'display' || notationRows.includes(row.id));
    explanations.push({
      id: 'equivalent-instants', evidence: 'reported',
      statement: onlyNotation
        ? 'These differ only in how the instant is written. Every computed value agrees.'
        : 'The same moment was written two different ways.',
      covers: notationRows,
      detail: 'Both files resolve to the same UTC instant, so nothing downstream can differ because of this.',
    });
  }

  // House system: a metadata difference that can be promoted to a demonstrated
  // cause by recalculating one side with the other's system and nothing else.
  //
  // Three things have to hold before that word is earned, and an audit found the
  // rule asking for one of them. "The installed engine produces these numbers"
  // and "this setting explains why these two files disagree" are different
  // claims, and only the second one is a cause.
  //
  //   1. Both receipts name a version this installation actually has, so both
  //      can be re-run at all. Checking only the first one let a second receipt
  //      claiming an engine nobody has be matched against a local recalculation
  //      and called reproduced — and made the verdict depend on which file was
  //      passed first. Naming the same version is not evidence that the two
  //      files came from the same build; it is only what makes a replay
  //      meaningful rather than a different calculation.
  //   2. Each receipt's own recorded values — cusps, angles and body positions —
  //      follow from its own declared inputs. Without this baseline the tool
  //      will happily "reproduce" a difference between a genuine chart and one
  //      whose values came from another moment entirely. The cusps alone cannot
  //      carry it: whole-sign cusps sit on sign boundaries and survive an hour
  //      of drift in the declared instant unchanged.
  //   3. Changing only the house system turns each chart into the other, in
  //      both directions, so the answer cannot depend on argument order.
  //
  // A differing build claim is NOT a fourth gate. It is recorded in `limits`
  // below, because it is an unauthenticated assertion either way: it cannot
  // grant the verdict and it is not evidence enough to refuse the arithmetic.
  if (has('houses-requested') || has('houses-actual') || has('houses-system')) {
    // Only the rows that actually moved are up for explanation. A pair whose
    // cusps are identical — two polar charts that both fell back to whole sign,
    // say — has nothing here for a house system to account for, and a replay
    // that "matches" values that never moved demonstrates nothing.
    // A house system moves the cusps. It cannot move the angles: the ascendant
    // and midheaven come from the time and the place, and every system in this
    // engine derives from them, which is why `angle-` rows are held out of what
    // this cause may claim in both branches.
    const movedCusps = idsIn('Houses').filter((id) => id.startsWith('cusp-'));
    const movedIndices = movedCusps.map((id) => Number(id.slice('cusp-'.length)) - 1);
    const rightPrecedence = enginePrecedence(rightEngine);
    const availablePrecedence = enginePrecedence(available);

    /** Gate 1 and 2: whose engine this recalculation is entitled to speak for. */
    const identity: string | null = (() => {
      if (!replay || !available) return 'No local engine was available, so nothing could be recalculated.';
      if (leftPrecedence === null || rightPrecedence === null) {
        return 'One of the receipts names no engine version, so a local recalculation cannot stand in for it.';
      }
      if (leftPrecedence !== availablePrecedence || rightPrecedence !== availablePrecedence) {
        // Name every foreign receipt, not the first one found: which side was
        // passed first must not decide what the reader is told.
        const foreign = [leftEngine, rightEngine]
          .filter((version, index) => (index === 0 ? leftPrecedence : rightPrecedence) !== availablePrecedence && version !== null);
        const named = foreign.length > 1 && foreign[0] !== foreign[1]
          ? `the two receipts name ${foreign[0]} and ${foreign[1]}`
          : foreign.length > 1
            ? `both receipts name ${foreign[0]}`
            : `one receipt names ${foreign[0]}`;
        return `Local recalculation runs engine ${available}, and ${named}. `
          + 'Recalculating it here would be a different calculation, not the one it records, so nothing is demonstrated about why these two differ.';
      }
      return null;
    })();

    // A different claimed build is not a different engine, and it is not a
    // reason to refuse a replay — SemVer says build metadata does not change
    // which version produced a file, and this module says the same a few
    // hundred lines up. What it is, is worth saying out loud. It is recorded
    // only when both files actually make a claim: one that claims nothing has
    // not claimed something different.
    const leftBuild = claimedBuild(left);
    const rightBuild = claimedBuild(right);
    const buildClaims = leftBuild !== null && rightBuild !== null && leftBuild !== rightBuild
      ? 'Both receipts name the same engine version and each claims a different build of it. Neither claim is authenticated here, '
        + 'and neither is what this recalculation rests on: what was checked is that each file\u2019s own values follow from its own declared inputs.'
      : null;

    const leftInput = replayInputOf(left);
    const rightInput = replayInputOf(right);
    const leftCusps = cuspsOf(left);
    const rightCusps = cuspsOf(right);

    // The arithmetic is worked whatever the identity gate said, because a
    // qualified observation about what this engine produces is still useful
    // when the identity behind it cannot be established.
    let baselineFailure: string | null = null;
    let controlledMatch = false;
    if (replay && movedCusps.length > 0 && leftInput && rightInput && leftCusps && rightCusps) {
      const leftBaseline = reproducesItsOwnValues(left, replay({ ...leftInput }));
      const rightBaseline = reproducesItsOwnValues(right, replay({ ...rightInput }));
      if (!leftBaseline || !rightBaseline) {
        const side = !leftBaseline && !rightBaseline ? 'Neither receipt\u2019s'
          : !leftBaseline ? 'The first receipt\u2019s' : 'The second receipt\u2019s';
        baselineFailure = `${side} own recorded values \u2014 cusps, angles and body positions \u2014 could not be reproduced from the inputs it declares, `
          + 'recalculated here on the engine it names. Its values describe a different calculation from the one it records, so nothing downstream of it can be demonstrated.';
      } else {
        const forward = cuspsAgree(replay({ ...leftInput, houseSystem: rightInput.houseSystem })?.cusps, rightCusps, movedIndices);
        const backward = cuspsAgree(replay({ ...rightInput, houseSystem: leftInput.houseSystem })?.cusps, leftCusps, movedIndices);
        controlledMatch = forward && backward;
      }
    }
    const promoted = identity === null && baselineFailure === null && controlledMatch && movedCusps.length > 0;

    if (promoted) {
      explanations.push({
        id: 'house-system', evidence: 'reproduced',
        statement: 'The different house system accounts for the house cusps.',
        covers: [...movedCusps, ...['houses-requested', 'houses-actual', 'houses-system'].filter(has)],
        detail: `Each chart's own recorded values were reproduced from its own declared inputs on engine ${available}, `
          + 'and changing only the house system turns each one into the other, in both directions.',
      });
      if (buildClaims !== null) limits.push(buildClaims);
    } else {
      const unexplainedCusps = movedCusps.length > 0;
      // One side having no house table at all is not two charts using different
      // systems, and saying so of a pair that agreed on the system — which is
      // what an unknown birth time produces — invites exactly the wrong
      // conclusion. The rows still need a claimant, so this keeps the coverage
      // and corrects the sentence.
      // …but only when the two files agreed on what to ask for. A pair that
      // requested different systems AND lost one house table has both
      // differences in it, and saying "the house system is not the difference"
      // over a row that records exactly that difference is false.
      const absent = (((left.receipt as any).houses?.actual ?? null) === null
        || ((right.receipt as any).houses?.actual ?? null) === null)
        && !has('houses-requested');
      explanations.push({
        id: 'house-system', evidence: unexplainedCusps ? 'hypothesis' : 'reported',
        statement: absent
          ? 'One chart has no house table at all, so there is no house system to compare.'
          : has('houses-actual') && !has('houses-requested')
            ? 'The same house system was requested, but a different one was actually used.'
            : 'The two charts asked for different house systems.',
        covers: [
          ...['houses-requested', 'houses-actual', 'houses-system', 'houses-absence'].filter(has),
          ...(unexplainedCusps ? movedCusps : []),
        ],
        detail: absent
          ? 'Whatever left one chart without houses is the difference here; the house system is not.'
          : !unexplainedCusps
            // Whether there are cusps to agree about is a fact about the two
            // files, not about which difference rows happen to be present. An
            // AI review found this branch asserting that the cusps were the
            // same for a pair in which neither file had any: two charts with no
            // birth time, asking for different systems, produce no cusp rows,
            // no cusps-shape row and no houses-absence row, so the row-presence
            // test this used to make came out false and the sentence claimed
            // agreement over values that do not exist.
            ? (leftCusps && rightCusps
              ? 'The cusps are the same in both files, so this difference changed nothing that was computed.'
              : leftCusps || rightCusps
                ? 'One chart has no house table, so there are no cusps on both sides to compare here.'
                : 'Neither chart has a house table, so there are no cusps here to be affected by it.')
            : controlledMatch
              // The useful qualified case: the arithmetic worked, and only the
              // identity behind it could not be established. Saying what the
              // installed engine produces is not the same as saying this
              // setting explains the original discrepancy, and the difference
              // is the whole reason this stays a hypothesis.
              ? `The engine installed here, ${available}, does turn each chart's declared inputs into the other chart's cusps `
                + 'when only the house system changes, in both directions. That is a fact about this engine, not a demonstration about these two files, for the reason stated below.'
              : 'This is a candidate for the cusp differences, but it was not reproduced here, so it stays a hypothesis. It accounts for no angle: those come from the time and the place.',
      });
      if (unexplainedCusps) {
        if (baselineFailure !== null) limits.push(baselineFailure);
        if (identity !== null) limits.push(identity);
        if (buildClaims !== null) limits.push(buildClaims);
      }
    }
  }

  // ΔT and the time basis. The engine gives both as a function of the instant
  // on its scale, so a different moment accounts for different modelled
  // values; within one engine version that includes where ΔT came from, since
  // from 0.1.1-rc.15 the instant picks IERS or the model. A moment cannot
  // account for a value a caller pinned, another table or another input scale,
  // and at one instant nothing but those can move them at all.
  const deltaTRows = differences
    .filter((row) => row.area === 'Time scale' && row.kind !== 'display').map((row) => row.id);
  const modelled = (envelope: NatalEnvelope) => {
    const deltaT = deltaTOf(envelope);
    return deltaT !== null && deltaT.model !== 'pinned';
  };
  const statedScale = (envelope: NatalEnvelope) => typeof (envelope.receipt as { timeScale?: unknown }).timeScale === 'string';
  // Both records say which scale their instant is on, and they differ. A record
  // from before 0.1.1-rc.15 states none; that is a difference of conventions.
  const scaleDiffers = has('time-scale') && statedScale(left) && statedScale(right);
  const momentMovesDeltaT = has('instant') && modelled(left) && modelled(right) && !has('time-scale')
    && (sameEngine || !deltaTRows.some((id) => DELTA_T_SOURCE_ROWS.has(id)));

  if (has('instant') && computed.length > 0) {
    explanations.push({
      id: 'instant', evidence: 'hypothesis',
      statement: 'The two charts are for different moments, which moves every position.',
      covers: [
        ...['instant', 'source-instant', 'reference', 'zone'].filter(has),
        ...downstream(['Positions', 'Angles', 'Houses', 'Aspects']),
        ...(momentMovesDeltaT ? deltaTRows : []),
      ],
      detail: 'Positions change continuously with time, so a different instant is expected to change all of them.',
    });
  }

  if (scaleDiffers) {
    // The same digits on another scale are another moment. Across two instants
    // the moment is the candidate for the positions, and this claims its own rows.
    const moved = has('instant') ? [] : downstream(['Positions', 'Angles', 'Houses', 'Aspects']);
    explanations.push({
      id: 'time-scale', evidence: moved.length > 0 ? 'hypothesis' : 'reported',
      statement: moved.length > 0
        ? 'The two records read their instant on different time scales, which moves the positions and the angles.'
        : 'The two records read their instant on different time scales.',
      covers: ['time-scale', ...(modelled(left) && modelled(right) ? deltaTRows : []), ...moved],
      detail: 'From engine 0.1.1-rc.15 an instant can be given on UTC, UT1 or TT, and the same digits on another scale '
        + 'are another moment: TT runs about 69 seconds ahead of UTC today, which moves the Moon by about half an '
        + 'arcsecond per second, and UT1 differs from UTC by up to 0.9 seconds, which turns the angles. It is not re-run here.',
    });
  }

  if (deltaTRows.length > 0 && !momentMovesDeltaT && !(scaleDiffers && modelled(left) && modelled(right))) {
    // At one instant a different ΔT is the only thing here that moved the
    // clock the positions are computed on, so it is a candidate for them. Across
    // two instants the moment is, and this claims only its own rows.
    const moved = has('instant') ? [] : downstream(['Positions', 'Angles', 'Houses', 'Aspects']);
    explanations.push({
      id: 'delta-t', evidence: moved.length > 0 ? 'hypothesis' : 'reported',
      statement: moved.length > 0
        ? 'The two charts were computed with different values of ΔT (TT − UT1), which moves the positions.'
        : 'The two records state ΔT (TT − UT1) differently.',
      covers: [...deltaTRows, ...moved],
      detail: 'ΔT is the gap between the clock the instant is written in and the clock the positions are computed on. '
        + 'A record takes it from the engine’s time basis at its instant unless its caller pinned it: from engine '
        + '0.1.1-rc.15 IERS from 1972 to 2027-10-02 and the model otherwise, before that the model throughout. A different value '
        + 'moves every body, the Moon by about half an arcsecond per second of ΔT, and the angles far less. It is not re-run here.',
    });
  }

  // One side having no place at all is the same difference wearing a different
  // shape: no coordinates means no ascendant and no house table, so what it
  // leaves behind is presence rows rather than moved numbers. `idsIn` sees only
  // numeric rows, so such a pair used to reach no cause at all and its absence
  // rows were reported as accounted for by nothing.
  const placeMissing = ((left.receipt as any).coordinates ?? null) === null
    || ((right.receipt as any).coordinates ?? null) === null;
  if ((has('latitude') || has('longitude'))
    && (idsIn('Angles').length > 0 || idsIn('Houses').length > 0
      || (placeMissing && (has('angles-presence') || has('cusps-shape'))))) {
    explanations.push({
      id: 'location', evidence: placeMissing ? 'reported' : 'hypothesis',
      statement: placeMissing
        ? 'One chart has a place and the other does not.'
        : 'The two charts are for different places, which moves the angles and houses.',
      covers: [
        ...['latitude', 'longitude'].filter(has),
        ...downstream(['Angles', 'Houses']),
        // `houses-absence` stays with the house-system cause, which always
        // fires when one side lost its table; claiming it twice would print the
        // same row under two explanations.
        ...(placeMissing ? ['angles-presence', 'cusps-shape'].filter(has) : []),
      ],
      detail: placeMissing
        ? 'Without coordinates there is no ascendant and no house table, so those values are missing rather than different.'
        : 'Body longitudes are geocentric and barely move with location; the angles and house cusps depend on it directly.',
    });
  }

  if (has('time-known')) {
    explanations.push({
      id: 'time-known', evidence: 'reported',
      // `cusps-shape` belongs here with the other two absence rows. Without a
      // time there is no house table at all, so the cusp list is missing on one
      // side for exactly this reason — and the receipt says so, in a field this
      // comparison already read. Leaving it out reported a row as accounted for
      // by nothing while its cause was printed two rows above it.
      covers: ['time-known', 'angles-presence', 'houses-absence', 'cusps-shape'].filter(has),
      statement: 'One chart has a known birth time and the other does not.',
      detail: 'Without a time there is no ascendant and no houses, and the positions use a stated convention rather than a real moment.',
    });
  }

  const conventionRows = differences.filter((row) => row.area === 'Conventions').map((row) => row.id);
  if (conventionRows.length > 0) {
    explanations.push({
      id: 'conventions', evidence: 'reported',
      statement: 'The two charts were computed under different stated conventions.',
      // A record from before engine 0.1.1-rc.15 states no input scale: its
      // conventions read every instant as UT1. That row belongs to them.
      covers: [...conventionRows, ...(has('time-scale') && !scaleDiffers ? ['time-scale'] : [])],
      detail: 'Different conventions can make values incomparable rather than merely different.',
    });
  }

  if (has('engine-version') && !engineDiffers) {
    explanations.push({
      id: 'engine-build', evidence: 'reported',
      statement: 'The two files name the same engine version with different build metadata.',
      covers: ['engine-version'],
      detail: 'Build metadata does not change which version a receipt was produced by.',
    });
  }

  if (has('result-flags') || has('input-flags')) {
    explanations.push({
      id: 'flags', evidence: 'reported',
      statement: 'The two files record different flags about how the calculation went.',
      covers: ['result-flags', 'input-flags'].filter(has),
      detail: 'A flag records something the engine had to do — a fallback, or a missing input — rather than a result.',
    });
  }

  if (has('schema')) {
    explanations.push({
      id: 'schema', evidence: 'reported',
      statement: 'The two files use different receipt schemas.',
      covers: ['schema'],
      detail: 'A schema difference can change what a field means, so values across the two are not necessarily comparable.',
    });
  }

  // Engine difference with no input difference: candidate cause, but this tool
  // holds exactly one engine build and cannot rerun the other one.
  // `downstream`, not `computed`. The two differ by exactly `angles-presence`
  // and `cusps-shape`: a section of the chart being there or not. An engine
  // change can move a sign or an aspect's existence as well as a number, which
  // is why this is not the numeric view either — but it does not make the
  // angles vanish, and an undemonstrable hypothesis over a whole missing
  // section would read as an explanation where the honest answer is that
  // nothing in these two files accounts for it.
  const engineDownstream = downstream(['Positions', 'Angles', 'Houses', 'Aspects']);
  if (has('engine-version') && engineDiffers && engineDownstream.length > 0) {
    explanations.push({
      id: 'engine', evidence: 'hypothesis',
      statement: 'The two charts were produced by different engine versions.',
      covers: ['engine-version', ...engineDownstream],
      detail: 'A change between engine versions can move computed values. It cannot be demonstrated here.',
    });
    limits.push(`Reproducing the difference would need engine ${leftEngine} and ${rightEngine} side by side. `
      + `This page has ${available ?? 'no engine'} only, so no recalculation can decide it.`);
  }

  // Whatever no explanation above claimed is unresolved, and it is named. An
  // unrelated difference — one house system, one latitude — must never absorb a
  // position difference it cannot cause, which a "does any input differ?" test
  // would let it do.
  const covered = new Set(explanations.flatMap((item) => item.covers));
  const uncovered = differences
    .filter((row) => row.kind !== 'display' && !covered.has(row.id))
    .map((row) => row.id);
  if (uncovered.length > 0) {
    const anyComputed = uncovered.some((id) => computed.includes(id));
    explanations.push({
      id: 'unexplained', evidence: 'unresolved',
      statement: anyComputed
        ? 'Some computed values differ and nothing in either file accounts for them.'
        : 'Some differences are not accounted for by anything in either file.',
      covers: uncovered,
      detail: anyComputed
        ? 'Treat those values as unverified until the difference is understood.'
        : null,
    });
  }

  if (has('instant') && (has('latitude') || has('longitude')) && computed.length > 0) {
    limits.push('The moment and the place both differ, so what each one contributed cannot be '
      + 'separated from these two files.');
  }
  if (computed.length > 0) {
    limits.push('Only the house system is re-run here. A different moment or place is never '
      + 'promoted past a hypothesis, even when both records name the same engine.');
  }
  if (sameEngine && computed.length > 0) {
    limits.push('Both receipts name the same engine, so agreement between them would show consistency, not independent astronomical accuracy.');
  }
  // Fires for whichever side cannot be replayed, not only the first. Checking
  // the left alone meant swapping the two files changed which limits appeared.
  const unreplayable = [
    ['first', leftEngine, leftPrecedence] as const,
    ['second', rightEngine, enginePrecedence(rightEngine)] as const,
  ].filter(([, , precedence]) => precedence === null || precedence !== enginePrecedence(available));
  if (unreplayable.length > 0 && computed.length > 0) {
    limits.push(available === null || replay === null
      ? 'No local engine was available, so nothing was reproduced by recalculation.'
      : `Local recalculation uses engine ${available}; the ${unreplayable.map(([side, version]) => `${side} receipt names ${version ?? 'no engine'}`).join(' and the ')}, `
        + 'so replaying it here would be a different calculation, not the original.');
  }
  return { explanations, limits };
}

export function compareEnvelopes(left: NatalEnvelope, right: NatalEnvelope, options: CompareOptions = {}): Comparison {
  const differences = collectDifferences(left, right);
  const substantive = differences.filter((row) => row.kind !== 'display');
  const { explanations, limits } = explain(left, right, differences, options);
  return {
    identical: differences.length === 0,
    differences,
    explanations: substantive.length === 0 ? [] : explanations,
    limits,
  };
}

export { formatDelta };
