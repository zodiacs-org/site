import { describe, expect, it } from 'vitest';
import { natalChart, ENGINE_VERSION } from '@zodiacs/engine';
import { NATAL_RECEIPT_CONVENTION_SETS, createNatalEnvelope, parseNatalEnvelope } from '@zodiacs/engine/receipt';
import type { NatalEnvelope } from '@zodiacs/engine/receipt';
import { deltaTAt } from '@zodiacs/engine/deltat';
import { compareEnvelopes, type Evidence, type Replay } from './diff';
import { replay as pageReplay } from './replay';
import { buildEnvelope, ORDINARY, PRESETS, presetEnvelopes, type SyntheticInput } from './fixtures';

/** The real engine, wired in the way the page wires it. */
const replay: Replay = (request) => {
  const chart = natalChart({
    utc: request.utc, latitude: request.latitude, longitude: request.longitude, houseSystem: request.houseSystem,
    ...(request.deltaT === undefined ? {} : { deltaT: request.deltaT }),
    ...(request.timeScale === undefined ? {} : { timeScale: request.timeScale }),
  } as Parameters<typeof natalChart>[0]) as {
    angles: Record<string, number> | null;
    bodies: { body: string; lon: number }[];
    houses: { cusps?: number[] } | null;
  };
  return { angles: chart.angles, bodies: chart.bodies, cusps: chart.houses?.cusps ?? null };
};
const live = { engineVersion: ENGINE_VERSION, replay };

const evidenceFor = (comparison: ReturnType<typeof compareEnvelopes>, id: string): Evidence | null =>
  comparison.explanations.find((item) => item.id === id)?.evidence ?? null;

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

/**
 * Move one body and keep the receipt internally consistent, so what the test
 * feeds the comparison is a file the engine's own parser accepts. The Moon
 * nodes take no aspects under the stated conventions, which is why they are the
 * body a test can move without rewriting the aspect list too.
 */
function withMovedNode(envelope: NatalEnvelope, lon: number): NatalEnvelope {
  const copy = JSON.parse(JSON.stringify(envelope));
  const body = copy.result.bodies.find((entry: { body: string }) => entry.body === 'North Node');
  const wrapped = ((lon % 360) + 360) % 360;
  body.lon = wrapped;
  body.sign = SIGNS[Math.floor(wrapped / 30)];
  body.degree = wrapped - Math.floor(wrapped / 30) * 30;
  const parsed = parseNatalEnvelope(JSON.stringify(copy));
  if (!parsed.ok) throw new Error(`the parser rejected a fixture this test needs: ${JSON.stringify(parsed)}`);
  return parsed.envelope;
}

const nodeLon = (envelope: NatalEnvelope): number =>
  (envelope.result.bodies.find((entry) => entry.body === 'North Node') as { lon: number }).lon;

/**
 * The same record as an older engine wrote it. rc.3 to rc.6 recorded the first
 * conventions set and rc.7 the second; neither recorded a ΔT or named its
 * ephemeris. From rc.8 the parser reads each set only from the versions that
 * wrote it, so relabelling a current record's version alone is refused.
 */
const RC3_CONVENTIONS = NATAL_RECEIPT_CONVENTION_SETS.find((set) => set.angles === 'gast-and-mean-obliquity');
const RC7_CONVENTIONS = NATAL_RECEIPT_CONVENTION_SETS
  .find((set) => set.angles === 'gast-and-true-obliquity' && !('deltaT' in set));
function asWrittenBy(envelope: NatalEnvelope, version: '0.1.1-rc.3' | '0.1.1-rc.6' | '0.1.1-rc.7'): any {
  const record = JSON.parse(JSON.stringify(envelope));
  record.receipt.engine = { name: record.receipt.engine.name, version };
  record.receipt.conventions = { ...(version === '0.1.1-rc.7' ? RC7_CONVENTIONS : RC3_CONVENTIONS) };
  // Nor the time basis that rc.15 records: the instant's scale and how it became UT1 and TT.
  delete record.receipt.timeScale;
  delete record.result.deltaT;
  delete record.result.timeScale;
  return record;
}

/**
 * `buildEnvelope`, with ΔT (TT − UT1) pinned by the caller instead of taken
 * from the engine's model, which the engine accepts from rc.8. The record says
 * so in `result.deltaT`, and the parser accepts it.
 */
function pinnedEnvelope(input: SyntheticInput, seconds: number): NatalEnvelope {
  const envelope = createNatalEnvelope(natalChart({
    utc: input.utc, latitude: input.latitude, longitude: input.longitude, houseSystem: input.houseSystem,
    ...(input.timeKnown === false ? { timeKnown: false } : {}), deltaT: seconds,
  } as Parameters<typeof natalChart>[0]), { sourceInstant: input.sourceInstant ?? input.utc });
  const parsed = parseNatalEnvelope(JSON.stringify(envelope));
  if (!parsed.ok) throw new Error(`the parser rejected a pinned fixture: ${parsed.code}`);
  return parsed.envelope;
}

describe('comparing two calculation receipts', () => {
  it('reports no difference between two runs of the same calculation', () => {
    // Two separately built envelopes, not one object passed twice: the same
    // object would pass even on an implementation with an identity shortcut.
    const comparison = compareEnvelopes(buildEnvelope(ORDINARY), buildEnvelope(ORDINARY), live);
    expect(comparison.identical).toBe(true);
    expect(comparison.differences).toEqual([]);
    // Nothing to explain, so nothing is offered.
    expect(comparison.explanations).toEqual([]);
  });

  it('demonstrates the house system as a cause instead of guessing it', () => {
    const left = buildEnvelope(ORDINARY);
    const right = buildEnvelope({ ...ORDINARY, houseSystem: 'whole' });
    const comparison = compareEnvelopes(left, right, live);

    expect(evidenceFor(comparison, 'house-system')).toBe('reproduced');
    // The bodies are geocentric: a house system cannot move them.
    const movedBodies = comparison.differences.filter((row) => row.area === 'Positions' && row.kind === 'numeric');
    expect(movedBodies).toEqual([]);
    expect(comparison.differences.some((row) => row.id === 'houses-requested')).toBe(true);
    // Whole sign keeps the ascendant and moves every cusp to a sign boundary,
    // so the cusps are where the difference actually shows.
    expect(comparison.differences.some((row) => row.id.startsWith('cusp-') && row.kind === 'numeric')).toBe(true);
  });

  it('will not call the house system reproduced without an engine to reproduce it with', () => {
    const left = buildEnvelope(ORDINARY);
    const right = buildEnvelope({ ...ORDINARY, houseSystem: 'whole' });
    const comparison = compareEnvelopes(left, right, { engineVersion: null, replay: null });

    expect(evidenceFor(comparison, 'house-system')).toBe('hypothesis');
    expect(comparison.limits.join(' ')).toMatch(/No local engine was available/u);
  });

  it('refuses to reproduce with an engine that did not produce the receipt', () => {
    const left = buildEnvelope(ORDINARY);
    const right = buildEnvelope({ ...ORDINARY, houseSystem: 'whole' });
    // Same engine build, but the page believes it holds a different version.
    const comparison = compareEnvelopes(left, right, { engineVersion: '9.9.9-rc.1', replay });

    expect(evidenceFor(comparison, 'house-system')).toBe('hypothesis');
    expect(comparison.limits.join(' ')).toMatch(/would be a different calculation, not the original/u);
  });

  it('recognises the same instant written with a different offset, and says nothing follows from it', () => {
    const { left, right } = presetEnvelopes(PRESETS.find((preset) => preset.id === 'equivalent-instants')!);
    const comparison = compareEnvelopes(left, right, live);

    expect(comparison.differences.some((row) => row.id === 'source-instant')).toBe(true);
    expect(comparison.differences.some((row) => row.id === 'instant')).toBe(false);
    expect(evidenceFor(comparison, 'equivalent-instants')).toBe('reported');
    // Nothing computed may differ when the resolved instant is identical.
    expect(comparison.differences.filter((row) => row.kind === 'numeric')).toEqual([]);
  });

  it('offers more than one candidate when more than one fits', () => {
    const { left, right } = presetEnvelopes(PRESETS.find((preset) => preset.id === 'ambiguous')!);
    const comparison = compareEnvelopes(left, right, live);

    const ids = comparison.explanations.map((item) => item.id);
    expect(ids).toContain('instant');
    expect(ids).toContain('location');
    // Both are candidates; neither is asserted as the demonstrated cause.
    for (const item of comparison.explanations) expect(item.evidence).not.toBe('reproduced');
  });

  it('says so plainly when nothing in either file explains the difference', () => {
    const left = buildEnvelope(ORDINARY);
    // Same stated inputs, conventions and engine, but a moved position.
    const tampered = JSON.parse(JSON.stringify(left));
    tampered.result.bodies[0].lon = (tampered.result.bodies[0].lon + 3) % 360;
    const comparison = compareEnvelopes(left, tampered, live);

    expect(evidenceFor(comparison, 'unexplained')).toBe('unresolved');
    expect(comparison.explanations.every((item) => item.evidence !== 'reproduced')).toBe(true);
  });

  it('separates a rounding difference from a different calculation', () => {
    const left = buildEnvelope(ORDINARY);
    const rounded = JSON.parse(JSON.stringify(left));
    rounded.result.bodies[0].lon = Number(rounded.result.bodies[0].lon.toFixed(6));
    const comparison = compareEnvelopes(left, rounded, live);

    const row = comparison.differences.find((entry) => entry.id.endsWith('-lon'));
    expect(row?.kind).toBe('display');
    // A display-only difference is not a substantive one, so no cause is claimed.
    expect(comparison.explanations).toEqual([]);
  });

  it('handles a longitude pair that straddles zero without inventing a huge difference', () => {
    const left = buildEnvelope(ORDINARY);
    const wrapped = JSON.parse(JSON.stringify(left));
    wrapped.result.bodies[0].lon = 0.5;
    const near = JSON.parse(JSON.stringify(left));
    near.result.bodies[0].lon = 359.5;

    const forward = compareEnvelopes(near, wrapped, live);
    const forwardRow = forward.differences.find((entry) => entry.id.endsWith('-lon'));
    expect(forwardRow?.kind).toBe('numeric');
    // Signed, and in the direction of the column order: 359.5 -> 0.5 is +1.
    expect(forwardRow!.delta).toBeCloseTo(1, 9);

    const back = compareEnvelopes(wrapped, near, live);
    expect(back.differences.find((entry) => entry.id.endsWith('-lon'))!.delta).toBeCloseTo(-1, 9);
  });

  it('names the engine difference as a candidate it cannot decide', () => {
    const left = buildEnvelope(ORDINARY);
    const older = JSON.parse(JSON.stringify(left));
    older.receipt.engine.version = '0.1.1-rc.3';
    older.result.bodies[0].lon = (older.result.bodies[0].lon + 0.01) % 360;
    const comparison = compareEnvelopes(older, left, live);

    expect(evidenceFor(comparison, 'engine')).toBe('hypothesis');
    expect(comparison.limits.join(' ')).toMatch(/side by side/u);
  });

  it('reads a receipt naming a different engine version of the same schema', () => {
    // The developer starter pins engine 0.1.1-rc.3 while the site pins rc.15.
    // Only rc.15 is installed here, so this checks what can be checked offline:
    // a receipt naming rc.3, written in rc.3's conventions, parses, and the
    // version difference is reported rather than quietly ignored.
    const relabelled = JSON.parse(JSON.stringify(buildEnvelope(ORDINARY)));
    relabelled.receipt.engine.version = '0.1.1-rc.3';
    const refused = parseNatalEnvelope(JSON.stringify(relabelled));
    expect(refused.ok ? 'accepted' : refused.code, 'the current conventions under an rc.3 label').toBe('inconsistent_result');
    const envelope = asWrittenBy(buildEnvelope(ORDINARY), '0.1.1-rc.3');
    const reparsed = parseNatalEnvelope(JSON.stringify(envelope));
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect((reparsed.envelope.receipt as { engine: { version: string } }).engine.version)
      .toBe('0.1.1-rc.3');
    const comparison = compareEnvelopes(reparsed.envelope, buildEnvelope(ORDINARY), live);
    expect(comparison.differences.some((row) => row.id === 'engine-version')).toBe(true);
  });

  it('keeps the engine hypothesis to values an engine can move', () => {
    // The engine cause claims what a version change can move — a position, an
    // angle, a cusp, an aspect. It must not claim a whole section going missing:
    // "the angles are gone" is not something a version bump does, and an
    // undemonstrable hypothesis over it would read as an explanation where the
    // honest answer is that nothing here accounts for it.
    //
    // These two envelopes are built directly rather than parsed: the codec
    // refuses an edited result, which is the behaviour under test one layer up.
    // `timeKnown` is equal on both sides, so the absent angles cannot be
    // attributed to a missing birth time and the engine cause is the only
    // candidate left to claim them.
    //
    // An AI review found nothing pinning this scope, so widening it back to
    // every non-input, non-setting row passed the whole suite unnoticed.
    const left = JSON.parse(JSON.stringify(buildEnvelope(ORDINARY)));
    const right = JSON.parse(JSON.stringify(buildEnvelope(ORDINARY)));
    right.receipt.engine.version = '0.1.1-rc.3';
    right.result.angles = null;
    right.result.bodies[0].lon = (right.result.bodies[0].lon + 0.01) % 360;
    const comparison = compareEnvelopes(left, right, live);
    const engine = comparison.explanations.find((item) => item.id === 'engine');
    expect(comparison.differences.some((row) => row.id === 'angles-presence')).toBe(true);
    expect(engine?.evidence).toBe('hypothesis');
    expect(engine?.covers, 'the moved body is the engine cause\u2019s to claim')
      .toContain('body-Sun-lon');
    expect(engine?.covers, 'a section that is simply absent is not')
      .not.toContain('angles-presence');
    expect(comparison.explanations.find((item) => item.id === 'unexplained')?.covers,
      'and it is named as unaccounted for rather than quietly dropped')
      .toContain('angles-presence');
  });

  it('states that two receipts from one engine show consistency, not accuracy', () => {
    const left = buildEnvelope(ORDINARY);
    const right = buildEnvelope({ ...ORDINARY, houseSystem: 'whole' });
    const comparison = compareEnvelopes(left, right, live);
    expect(comparison.limits.join(' ')).toMatch(/consistency, not independent astronomical accuracy/u);
  });
});

/**
 * One test per defect an AI review reproduced against the first candidate
 * (fef5f9bf). Each of these failed on that code and passes on this one.
 */
describe('regressions an adversarial review found', () => {
  const accept = (value: unknown): NatalEnvelope => {
    const parsed = parseNatalEnvelope(JSON.stringify(value));
    if (!parsed.ok) throw new Error(`the parser rejected a fixture this test needs: ${JSON.stringify(parsed)}`);
    return parsed.envelope;
  };

  it('does not call two records the same calculation when a body latitude differs', () => {
    const left = buildEnvelope(ORDINARY);
    const tampered = JSON.parse(JSON.stringify(left));
    for (const body of tampered.result.bodies) body.lat = 7.5;
    const comparison = compareEnvelopes(left, accept(tampered), live);

    expect(comparison.identical).toBe(false);
    expect(comparison.differences.filter((row) => row.id.endsWith('-lat')).length).toBeGreaterThan(0);
  });

  it('does not call two records the same calculation when a body speed differs', () => {
    const left = buildEnvelope(ORDINARY);
    const tampered = JSON.parse(JSON.stringify(left));
    // Doubling keeps every sign, so the retrograde flags, and each aspect's
    // applying flag, which rc.7 derives from the relative speed, still follow.
    for (const body of tampered.result.bodies) body.speed *= 2;
    const comparison = compareEnvelopes(left, accept(tampered), live);

    expect(comparison.identical).toBe(false);
    expect(comparison.differences.filter((row) => row.id.endsWith('-speed')).length).toBeGreaterThan(0);
  });

  it('notices that one record is missing aspects the other has', () => {
    const left = buildEnvelope(ORDINARY);
    expect(left.result.aspects.length).toBeGreaterThan(0);
    const tampered = JSON.parse(JSON.stringify(left));
    tampered.result.aspects = [];
    const comparison = compareEnvelopes(left, accept(tampered), live);

    expect(comparison.identical).toBe(false);
    expect(comparison.differences.some((row) => row.area === 'Aspects')).toBe(true);
  });

  it('reads an aspect list in a different order as no difference', () => {
    const left = buildEnvelope(ORDINARY);
    const shuffled = JSON.parse(JSON.stringify(left));
    shuffled.result.aspects.reverse();
    expect(compareEnvelopes(left, accept(shuffled), live).identical).toBe(true);
  });

  it('classifies two real charts a millisecond apart by what they print, not by how far apart they are', () => {
    // Nothing is edited here: two ordinary calculations at instants a few
    // milliseconds apart, which is the realistic shape of "two programs
    // disagree slightly". One millisecond moves every body by less than the
    // sixth decimal, so every row prints the same and every row is rounding.
    //
    // The millisecond before. The Moon covers 1.5e-7° in a millisecond, so at an
    // instant just below a sixth-decimal boundary the millisecond after crosses
    // it; on engine rc.15's time basis neither neighbour of 13:30:00.000 does.
    const base = buildEnvelope({ ...ORDINARY, utc: '1990-06-15T13:30:00.000Z' });
    const oneMs = compareEnvelopes(base, buildEnvelope({ ...ORDINARY, utc: '1990-06-15T13:29:59.999Z' }), live);
    const oneMsRows = oneMs.differences.filter((row) => row.id.endsWith('-lon'));
    expect(oneMsRows.length).toBeGreaterThan(0);
    for (const row of oneMsRows) {
      expect(row.kind, `${row.id} ${row.left} vs ${row.right}`).toBe('display');
      expect(row.left).toBe(row.right);
    }
    // The instants themselves differ, and that is what accounts for the angles,
    // which do move a visible amount in a millisecond. Nothing is unresolved.
    expect(evidenceFor(oneMs, 'instant')).toBe('hypothesis');
    expect(evidenceFor(oneMs, 'unexplained')).toBeNull();

    // Six milliseconds moves the faster bodies across a rounding boundary while
    // the slower ones stay put, so one comparison carries both kinds at once —
    // and the distance between the two is not what separates them. Mercury
    // moves 1.2e-7 and prints differently; the lunar nodes move 5.1e-7 and
    // print the same. (Under the ΔT model, before engine rc.15 read 1990 on
    // IERS UT1, ten milliseconds showed the same, with 2.0e-7 and 5.3e-7.)
    const sixMs = compareEnvelopes(base, buildEnvelope({ ...ORDINARY, utc: '1990-06-15T13:30:00.006Z' }), live);
    const moved = sixMs.differences.filter((row) => row.id.endsWith('-lon') && row.kind === 'numeric');
    const still = sixMs.differences.filter((row) => row.id.endsWith('-lon') && row.kind === 'display');
    expect(moved.length).toBeGreaterThan(0);
    expect(still.length).toBeGreaterThan(0);
    for (const row of moved) expect(row.left, row.id).not.toBe(row.right);
    for (const row of still) expect(row.left, row.id).toBe(row.right);
    // The smallest real difference is smaller than the largest rounding one:
    // no threshold on distance could have separated these two sets.
    const smallestMoved = Math.min(...moved.map((row) => Math.abs(row.delta!)));
    const largestStill = Math.max(...still.map((row) => Math.abs(row.delta!)));
    expect(smallestMoved).toBeLessThan(largestStill);
  });

  it('calls two values that print the same a rounding difference, not a different calculation', () => {
    const base = buildEnvelope(ORDINARY);
    const comparison = compareEnvelopes(
      withMovedNode(base, 308.1223466), withMovedNode(base, 308.1223474), live,
    );

    const row = comparison.differences.find((entry) => entry.id.endsWith('-lon'));
    expect(row?.kind).toBe('display');
    expect(row?.left).toBe(row?.right);
    // A rounding difference is not something to declare unverified.
    expect(comparison.explanations).toEqual([]);
  });

  it('calls two values that print differently a difference, however small', () => {
    const base = buildEnvelope(ORDINARY);
    const comparison = compareEnvelopes(
      withMovedNode(base, 308.12234749), withMovedNode(base, 308.12234751), live,
    );

    const row = comparison.differences.find((entry) => entry.id.endsWith('-lon'));
    expect(row?.kind).toBe('numeric');
    expect(row?.left).not.toBe(row?.right);
  });

  it('will not call the house system reproduced when the angles and cusps did not move', () => {
    // At 78° Placidus is not computable, so both charts fall back to whole
    // sign and end up with identical cusps. The requested system differs; that
    // difference explains nothing computed, and nothing was demonstrated.
    const polar = { utc: '1990-06-15T13:30:00Z', latitude: 78, longitude: 15, houseSystem: 'placidus' } as const;
    const left = buildEnvelope(polar);
    const right = buildEnvelope({ ...polar, houseSystem: 'whole' });
    const comparison = compareEnvelopes(left, withMovedNode(right, nodeLon(right) + 3), live);

    expect(comparison.differences.some((row) => row.id.startsWith('cusp-'))).toBe(false);
    expect(evidenceFor(comparison, 'house-system')).toBe('reported');
  });

  it('does not call an absent house table two different house systems', () => {
    // Both sides requested placidus; the right has no time, so it has no houses
    // at all. An AI review found this reported as "a different one was actually
    // used", which a reader can only take to mean the systems disagreed.
    const comparison = compareEnvelopes(
      buildEnvelope(ORDINARY), buildEnvelope({ ...ORDINARY, timeKnown: false }), live,
    );
    const houseSystem = comparison.explanations.find((item) => item.id === 'house-system');
    expect(houseSystem?.statement).toBe('One chart has no house table at all, so there is no house system to compare.');
    expect(houseSystem?.statement).not.toMatch(/different one was actually used|asked for different/);
    // …and the rows it was claiming are still claimed, so nothing slid into the
    // unresolved bucket in exchange for a better sentence.
    expect(houseSystem?.covers).toContain('houses-actual');
    expect(evidenceFor(comparison, 'unexplained')).toBeNull();
  });

  it('will not build evidence about a time-unknown receipt out of a time-known replay', () => {
    const left = buildEnvelope({ ...ORDINARY, utc: '1990-06-15T12:00:00Z', timeKnown: false });
    expect(left.result.angles).toBeNull();
    const right = buildEnvelope({ ...ORDINARY, utc: '1990-06-15T12:00:00Z' });
    const comparison = compareEnvelopes(left, withMovedNode(right, nodeLon(right) + 3), live);

    expect(comparison.explanations.every((item) => item.evidence !== 'reproduced')).toBe(true);
  });

  it('the page replay honours whether the birth time was known', () => {
    const request = { utc: '1990-06-15T12:00:00Z', latitude: 51.5, longitude: 0, houseSystem: 'placidus' };
    expect(pageReplay({ ...request, timeKnown: true })?.angles).not.toBeNull();
    expect(pageReplay({ ...request, timeKnown: false })?.angles).toBeNull();
  });

  it('does not let an unrelated difference absorb a position difference it cannot cause', () => {
    const left = buildEnvelope(ORDINARY);
    const right = buildEnvelope({ ...ORDINARY, houseSystem: 'whole' });
    const comparison = compareEnvelopes(left, withMovedNode(right, nodeLon(right) + 3), live);

    // A house system cannot move a geocentric body. That 3° is unaccounted for
    // and must be said so, whatever else in the two files differs.
    const unresolved = comparison.explanations.find((item) => item.evidence === 'unresolved');
    expect(unresolved).toBeDefined();
    expect(unresolved!.covers.some((id) => id.endsWith('-lon'))).toBe(true);
  });

  it('accounts for every substantive difference in every preset, without falling back', () => {
    for (const preset of PRESETS) {
      const { left, right } = presetEnvelopes(preset);
      const comparison = compareEnvelopes(left, right, live);
      const covered = new Set(comparison.explanations.flatMap((item) => item.covers));
      const uncovered = comparison.differences
        .filter((row) => row.kind !== 'display' && !covered.has(row.id))
        .map((row) => row.id);
      expect(uncovered, `${preset.id} leaves rows unexplained and unmentioned`).toEqual([]);
      // Coverage alone would be satisfied by sweeping everything into the
      // unresolved bucket. Each preset has real causes, so that bucket must be
      // empty — a preset falling back to "unresolved" is a defect in the rules.
      expect(evidenceFor(comparison, 'unexplained'), `${preset.id} fell back to unresolved`).toBeNull();
    }
  });

  it('treats build metadata as the same engine version', () => {
    const base = buildEnvelope(ORDINARY);
    const withMetadata = JSON.parse(JSON.stringify(base));
    withMetadata.receipt.engine.version = `${ENGINE_VERSION}+deadbeef`;
    const comparison = compareEnvelopes(
      accept(withMetadata), withMovedNode(base, nodeLon(base) + 0.01), live,
    );

    // SemVer orders these two version strings equally, so this tool does not
    // treat the second as a different engine and does not offer it as a
    // candidate cause for a moved position. That is a rule about how this tool
    // reads a version string, not a finding that the two builds run the same
    // code — nothing here can establish that.
    expect(evidenceFor(comparison, 'engine')).toBeNull();
    expect(evidenceFor(comparison, 'engine-build')).toBe('reported');
    expect(evidenceFor(comparison, 'unexplained')).toBe('unresolved');
  });
});

describe('a cause never claims a row it could not have caused', () => {
  /** Which rows each explanation is physically capable of accounting for. */
  const CANNOT: Record<string, RegExp> = {
    // A different moment or place moves computed values; neither can change
    // which house system the calculation was asked for. A moment moves a
    // modelled ΔT, but not where a ΔT came from, and a place moves neither.
    instant: /^houses-(requested|actual|system)$|^delta-t-(model|table|tableDigest)$/u,
    location: /^houses-(requested|actual|system)$|^delta-t-/u,
    // A house system moves the cusps and nothing else. Bodies are geocentric,
    // and the angles come from the time and the place — every system in this
    // engine derives from the same ascendant and midheaven, so a pair differing
    // only in house system has identical angles. Claiming an angle row is a
    // hypothesis a recalculation refutes, which is what this pattern forbids.
    'house-system': /^(body-|angle-|aspect-|delta-t-)/u,
    // Writing the same instant two ways changes nothing computed at all.
    'equivalent-instants': /^(body-|angle-|cusp-|aspect-|delta-t-)/u,
    // ΔT moves where things are, not what was asked for or whether it exists.
    'delta-t': /^(houses-|cusps-shape$|angles-presence$|instant$|source-instant$|latitude$|longitude$|time-known$)/u,
  };

  // A synthetic input with no coordinates at all: the engine accepts it and
  // returns no angles and no house table.
  const { latitude: _lat, longitude: _lon, ...PLACELESS } = ORDINARY;
  const NO_PLACE = PLACELESS as unknown as typeof ORDINARY;

  const cases = [
    { name: 'different place and different house system',
      left: ORDINARY,
      right: { utc: ORDINARY.utc, latitude: 40.7128, longitude: -74.006, houseSystem: 'whole' } as const },
    { name: 'different moment and different house system',
      left: ORDINARY,
      right: { ...ORDINARY, utc: '1990-06-15T18:45:00Z', houseSystem: 'whole' } as const },
    // One hour apart and a different house system. The angles move, but not
    // because of the house system — an AI review found the comparison naming it
    // as "the obvious candidate for the angle differences" here.
    { name: 'one hour apart and a different house system',
      left: ORDINARY,
      right: { ...ORDINARY, utc: '1990-06-15T14:30:00Z', houseSystem: 'whole' } as const },
    { name: 'different moment, place and house system at once',
      left: ORDINARY,
      right: { utc: '1990-06-15T18:45:00Z', latitude: 40.7128, longitude: -74.006, houseSystem: 'whole' } as const },
    // The synthetic MCP benchmark found `cusps-shape` reported as accounted for
    // by nothing here, with its cause — an absent birth time — printed two rows
    // above it. The suite above had every pair with a known time on both sides,
    // which is how the gap survived, so the unknown-time pairs join it.
    { name: 'a known birth time against an unknown one',
      left: ORDINARY,
      right: { ...ORDINARY, timeKnown: false } as const },
    { name: 'an unknown birth time and a different house system at once',
      left: ORDINARY,
      right: { ...ORDINARY, houseSystem: 'whole', timeKnown: false } as const },
    // The same defect through the other absence reason. An AI review pointed
    // out that every unknown-time pair above keeps its coordinates, so a
    // receipt with no place at all — which also has no ascendant and no house
    // table — still left `angles-presence` and `cusps-shape` claimed by
    // nobody, with the cause printed above them. `idsIn` sees only numeric
    // rows, and a missing place leaves none.
    { name: 'a chart with a place against one without',
      left: ORDINARY,
      right: NO_PLACE },
    { name: 'a missing place and a different house system at once',
      left: ORDINARY,
      right: { ...NO_PLACE, houseSystem: 'whole' } as const },
    // From rc.8 a record can carry a ΔT its caller pinned. At one instant that
    // moves every position with nothing else differing; beside another cause
    // it must claim only what it can move, and nothing may claim its rows but
    // itself — or, for a modelled value, a different moment.
    { name: 'a pinned ΔT against the engine’s model at one instant',
      left: ORDINARY, right: ORDINARY, pinRight: 75.5 },
    { name: 'a pinned ΔT and a different house system at once',
      left: ORDINARY, right: { ...ORDINARY, houseSystem: 'whole' } as const, pinRight: 75.5 },
    { name: 'a different moment against a pinned ΔT',
      left: ORDINARY, right: { ...ORDINARY, utc: '1990-06-15T18:45:00Z' }, pinRight: 75.5 },
  ] as { name: string; left: SyntheticInput; right: SyntheticInput; pinRight?: number }[];

  for (const scenario of cases) {
    it(`holds for ${scenario.name}`, () => {
      const comparison = compareEnvelopes(
        buildEnvelope(scenario.left),
        scenario.pinRight === undefined ? buildEnvelope(scenario.right) : pinnedEnvelope(scenario.right, scenario.pinRight),
        live,
      );
      for (const item of comparison.explanations) {
        const forbidden = CANNOT[item.id];
        if (!forbidden) continue;
        const overreach = item.covers.filter((id) => forbidden.test(id));
        expect(overreach, `${item.id} claims rows it cannot cause`).toEqual([]);
      }
      // And every substantive row is still accounted for by a real cause.
      //
      // The unresolved bucket is excluded from `covered` on purpose. It is
      // pushed with whatever no other explanation claimed, so counting it made
      // this loop unfalsifiable: no row could ever be claimed by nobody, and
      // the assertion passed while rows were being reported as explained by
      // nothing. The synthetic MCP benchmark found the first such row.
      const real = comparison.explanations.filter((item) => item.evidence !== 'unresolved');
      const covered = new Set(real.flatMap((item) => item.covers));
      for (const row of comparison.differences) {
        if (row.kind === 'display') continue;
        expect(covered.has(row.id), `${row.id} is claimed by nobody`).toBe(true);
      }
      expect(evidenceFor(comparison, 'unexplained'), 'fell back to unresolved').toBeNull();
    });
  }
});

/**
 * An audit asked whether "reproduced" can be reached without establishing that
 * the recalculation is entitled to speak for both files. It can, in four ways,
 * and each one is a case here. Every fixture goes through the engine's own
 * parser first: a record the parser refuses can never reach the comparison, so
 * a counterexample built out of one would prove nothing.
 */
describe('what a local recalculation has to establish before it is a cause', () => {
  const T1 = '1990-06-15T13:30:00Z';
  const T2 = '1990-06-15T14:30:00Z';
  const at = (utc: string, houseSystem: 'placidus' | 'whole') =>
    buildEnvelope({ ...ORDINARY, utc, houseSystem });

  /** Parser-accepted, or the fixture is not an input this tool can receive. */
  const accepted = (raw: unknown, label: string): NatalEnvelope => {
    const parsed = parseNatalEnvelope(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(`${label} is not a record the parser accepts: ${parsed.code}`);
    return parsed.envelope;
  };
  const edited = (envelope: NatalEnvelope, change: (copy: any) => void): any => {
    const copy = JSON.parse(JSON.stringify(envelope));
    change(copy);
    return copy;
  };
  /**
   * Rewrites the instant a record declares, and the ΔT and time basis that go
   * with it. From rc.8 the parser checks a modelled ΔT against the declared
   * instant, and from rc.15 the time basis too, so a rewritten instant alone is
   * refused (tested below). Both are public, so the extra edits are no obstacle
   * to anyone, and the values still come from the other moment: this is the
   * same counterexample under the rc.15 parser.
   */
  const declaring = (utc: string) => (o: any) => {
    o.receipt.instant = new Date(utc).toISOString();
    o.receipt.sourceInstant = utc;
    const fresh = at(utc, 'placidus').result;
    o.result.deltaT = JSON.parse(JSON.stringify(fresh.deltaT));
    o.result.timeScale = JSON.parse(JSON.stringify((fresh as { timeScale?: unknown }).timeScale));
  };
  const houseSystemEvidence = (left: NatalEnvelope, right: NatalEnvelope) =>
    compareEnvelopes(left, right, live).explanations.find((item) => item.id === 'house-system')?.evidence ?? null;

  it('cannot be given a rewritten instant that keeps the old instant’s ΔT', () => {
    const naive = edited(at(T2, 'placidus'), (o) => {
      o.receipt.instant = new Date(T1).toISOString();
      o.receipt.sourceInstant = T1;
    });
    const parsed = parseNatalEnvelope(JSON.stringify(naive));
    expect(parsed.ok ? 'accepted' : parsed.code).toBe('inconsistent_result');
    // …and with the ΔT rewritten too, the parser accepts it: it checks that a
    // record is coherent with itself, not that its values follow from it.
    expect(parseNatalEnvelope(JSON.stringify(edited(at(T2, 'placidus'), declaring(T1)))).ok).toBe(true);
  });

  it('reproduces an ordinary house-system difference, which is the case that must keep working', () => {
    const comparison = compareEnvelopes(at(T1, 'placidus'), at(T1, 'whole'), live);
    const houseSystem = comparison.explanations.find((item) => item.id === 'house-system');
    expect(houseSystem?.evidence).toBe('reproduced');
    expect(houseSystem?.detail).toMatch(/its own declared inputs/);
    expect(comparison.differences.filter((row) => /^cusp-\d+$/.test(row.id))).toHaveLength(12);
  });

  it('withholds it when the other receipt names an engine this installation does not have', () => {
    // The values are genuine — they are exactly what the installed engine
    // produces — but the receipt says they came from somewhere else. Matching
    // them demonstrates nothing about why these two files differ.
    const foreign = accepted(edited(at(T1, 'whole'), (o) => { o.receipt.engine.version = '99.0.0'; }), 'foreign');
    expect(houseSystemEvidence(at(T1, 'placidus'), foreign)).toBe('hypothesis');
  });

  it('gives the same verdict whichever file is passed first', () => {
    const foreign = accepted(edited(at(T1, 'whole'), (o) => { o.receipt.engine.version = '99.0.0'; }), 'foreign');
    const genuine = at(T1, 'placidus');
    expect(houseSystemEvidence(genuine, foreign)).toBe(houseSystemEvidence(foreign, genuine));

    const drifted = accepted(edited(at(T2, 'placidus'), declaring(T1)), 'drifted');
    expect(houseSystemEvidence(drifted, at(T1, 'whole'))).toBe(houseSystemEvidence(at(T1, 'whole'), drifted));
  });

  /**
   * This expectation was reversed, deliberately, and the reason is worth more
   * than the assertion.
   *
   * The first attempt at this audit made a differing build claim refuse the
   * replay outright. A review showed that contradicted two things at once: the
   * rule stated a few hundred lines above it in `diff.ts` — build metadata does
   * not make a different engine, and such a pair must not "be refused a replay
   * as if they were" — and the response itself, which printed "build metadata
   * does not change which version a receipt was produced by" beside a limit
   * saying the two claims made the replay unusable. Both sentences in one
   * answer, saying opposite things.
   *
   * What actually establishes that a recalculation may speak for a receipt is
   * the baseline below: the receipt's own values, checked against the receipt's
   * own declared inputs. A claim printed inside the file establishes nothing
   * either way — which is the audit's own instruction. So the claim is recorded
   * in `limits`, where an unauthenticated assertion belongs, and the verdict
   * rests on the arithmetic.
   */
  it('records a differing build claim as a limit rather than refusing the replay', () => {
    const label = (envelope: NatalEnvelope, meta: string) => accepted(
      edited(envelope, (o) => { o.receipt.engine.version = `${ENGINE_VERSION}+${meta}`; }), meta,
    );
    const different = compareEnvelopes(label(at(T1, 'placidus'), 'build.a'), label(at(T1, 'whole'), 'build.b'), live);
    expect(evidenceFor(different, 'house-system')).toBe('reproduced');
    expect(different.limits.join(' ')).toMatch(/each claims a different build of it/);
    // Both naming the same build says nothing either, and is not remarked on.
    const same = compareEnvelopes(label(at(T1, 'placidus'), 'build.a'), label(at(T1, 'whole'), 'build.a'), live);
    expect(evidenceFor(same, 'house-system')).toBe('reproduced');
    expect(same.limits.join(' ')).not.toMatch(/claims a different build/);
  });

  it('does not treat a receipt that claims no build as claiming a different one', () => {
    // One file carrying build metadata and the other carrying none is not a
    // disagreement: the second has not said anything to disagree with. An
    // earlier version of this gate compared the two as strings and refused the
    // replay, then described the pair in a sentence that was simply false.
    const labelled = accepted(
      edited(at(T1, 'whole'), (o) => { o.receipt.engine.version = `${ENGINE_VERSION}+2000377`; }), 'labelled',
    );
    const comparison = compareEnvelopes(at(T1, 'placidus'), labelled, live);
    expect(evidenceFor(comparison, 'house-system')).toBe('reproduced');
    expect(comparison.limits.join(' ')).not.toMatch(/claims a different build/);
    // The difference is still reported, by the cause that owns it.
    expect(evidenceFor(comparison, 'engine-build')).toBe('reported');
  });

  /**
   * The counterexample that forced the baseline to widen.
   *
   * Whole-sign cusps are quantised to sign boundaries, so they survive an hour
   * of drift in the declared instant without moving. A baseline that checks the
   * cusps alone therefore passes trivially on a record whose instant was
   * rewritten, and the pair reached "reproduced" while sixty-five rows sat in
   * the unresolved bucket. The angles and the body longitudes move continuously
   * and are what discriminate, so the baseline checks every value the replay
   * also produces.
   */
  it('withholds it when only the quantised cusps survive a rewritten instant', () => {
    const whole = (utc: string) => buildEnvelope({ ...ORDINARY, utc, houseSystem: 'whole' });
    // The premise, stated rather than assumed: these cusps really are identical.
    expect(replay({ ...ORDINARY, utc: T1, houseSystem: 'whole', timeKnown: true })?.cusps)
      .toEqual(replay({ ...ORDINARY, utc: T2, houseSystem: 'whole', timeKnown: true })?.cusps);
    const drifted = accepted(edited(whole(T2), declaring(T1)), 'drifted-whole');
    for (const comparison of [
      compareEnvelopes(drifted, at(T1, 'placidus'), live),
      compareEnvelopes(at(T1, 'placidus'), drifted, live),
    ]) {
      expect(evidenceFor(comparison, 'house-system')).toBe('hypothesis');
      expect(comparison.limits.join(' ')).toMatch(/could not be reproduced from the inputs it declares/);
    }
  });

  it('withholds it when the declared place is not the one the values came from', () => {
    // The same hole reached through the coordinates instead of the instant.
    const drifted = accepted(
      edited(buildEnvelope({ ...ORDINARY, utc: T1, houseSystem: 'whole', longitude: 2.8722 }),
        (o) => { o.receipt.coordinates.longitude = ORDINARY.longitude; }), 'drifted-place',
    );
    expect(houseSystemEvidence(drifted, at(T1, 'placidus'))).toBe('hypothesis');
  });

  it('does not deny a house-system difference it is claiming in the same breath', () => {
    // When one side has no house table the cause says so. An AI review found it
    // saying so over a pair that ALSO requested different systems, adding "the
    // house system is not" the difference on top of a row recording exactly
    // that difference.
    const { latitude: _lat, longitude: _lon, ...placeless } = ORDINARY;
    const noPlace = buildEnvelope({ ...placeless, houseSystem: 'whole' } as unknown as typeof ORDINARY);
    const houseSystem = compareEnvelopes(buildEnvelope({ ...ORDINARY, houseSystem: 'placidus' }), noPlace, live)
      .explanations.find((item) => item.id === 'house-system');
    expect(houseSystem?.statement).toBe('The two charts asked for different house systems.');
    expect(houseSystem?.detail).not.toMatch(/the house system is not/);
    // …and it still does not claim the cusps are equal when one side has none.
    expect(houseSystem?.detail).toMatch(/no house table/);
  });

  it('names every foreign engine, not whichever one it met first', () => {
    const foreign = (envelope: NatalEnvelope, version: string) => accepted(
      edited(envelope, (o) => { o.receipt.engine.version = version; }), version,
    );
    const comparison = compareEnvelopes(
      foreign(at(T1, 'placidus'), '98.0.0'), foreign(at(T1, 'whole'), '99.0.0'), live,
    );
    const limit = comparison.limits.find((line) => line.includes('Local recalculation runs engine')) ?? '';
    expect(limit).toMatch(/98\.0\.0/);
    expect(limit).toMatch(/99\.0\.0/);
  });

  it('withholds it when a receipt’s own values do not follow from the inputs it declares', () => {
    // The parser accepts a record whose declared instant is not the one its
    // values came from: it checks internal coherence, not that the result
    // follows from the inputs. Without a baseline the comparison called this
    // pair reproduced, while the house system explained none of it.
    const drifted = accepted(edited(at(T2, 'placidus'), declaring(T1)), 'drifted');
    const comparison = compareEnvelopes(drifted, at(T1, 'whole'), live);
    expect(comparison.explanations.find((item) => item.id === 'house-system')?.evidence).toBe('hypothesis');
    expect(comparison.limits.join(' ')).toMatch(/could not be reproduced from the inputs it declares/);
  });

  it('still says what the installed engine does, when only the identity is unestablished', () => {
    // Withholding the word "reproduced" must not throw away the useful part.
    // The arithmetic did work; what could not be established is whose engine it
    // speaks for, and the two statements are kept apart.
    const foreign = accepted(edited(at(T1, 'whole'), (o) => { o.receipt.engine.version = '99.0.0'; }), 'foreign');
    const houseSystem = compareEnvelopes(at(T1, 'placidus'), foreign, live)
      .explanations.find((item) => item.id === 'house-system');
    expect(houseSystem?.evidence).toBe('hypothesis');
    expect(houseSystem?.detail).toMatch(/fact about this engine, not a demonstration about these two files/);
  });

  it('cannot be given two records that disagree about conventions', () => {
    // The audit asked for a differing-conventions case. It cannot be built:
    // this draft implements exactly one convention set, so a record declaring
    // any other is refused before the comparison sees it. Recorded as a
    // refutation rather than left as an untested worry.
    for (const change of [
      (o: any) => { o.receipt.conventions.angles = 'other-convention'; },
      (o: any) => { o.receipt.conventions.zodiac = 'sidereal'; },
      (o: any) => { o.receipt.coverage.broadDateRange = 'certified'; },
    ]) {
      const parsed = parseNatalEnvelope(JSON.stringify(edited(at(T1, 'placidus'), change)));
      expect(parsed.ok ? 'accepted' : parsed.code).toBe('unsupported_feature');
    }
  });
});

/**
 * An audit asked whether a summary can assert more agreement than the
 * comparison's own difference rows support. It can, and the reason is that the
 * summary's view of "computed" was built from `kind === 'numeric'` while several
 * computed facts are stored as booleans or strings.
 *
 * Every fixture here goes through the engine's own parser first. A record the
 * parser refuses can never reach the comparison, so a counterexample built out
 * of one would prove nothing.
 */
describe('a summary never claims more agreement than the differences support', () => {
  const T = '1990-06-15T13:30:00Z';
  /** The same instant, written two ways. Both resolve to T. */
  const asWritten = (sourceInstant: string) =>
    buildEnvelope({ ...ORDINARY, utc: T, sourceInstant });

  const accept = (raw: unknown, label: string): NatalEnvelope => {
    const parsed = parseNatalEnvelope(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(`${label} is not a record the parser accepts: ${parsed.code}`);
    return parsed.envelope;
  };
  const copy = (envelope: NatalEnvelope): any => JSON.parse(JSON.stringify(envelope));
  /**
   * The same record as rc.3 to rc.6 wrote it. Those versions judged applying by
   * stepping both bodies ahead, which a reader of the record cannot re-derive,
   * so two of their records can disagree about applying while every number
   * agrees. From rc.7 the flag follows from the record's own speeds, and the
   * parser refuses a record where it does not (tested below).
   */
  const asRc6 = (envelope: NatalEnvelope): any => asWrittenBy(envelope, '0.1.1-rc.6');
  const statementOf = (comparison: ReturnType<typeof compareEnvelopes>, id: string) =>
    comparison.explanations.find((item) => item.id === id)?.statement ?? null;
  const AGREES = /Every computed value agrees/;

  it('says every computed value agrees when that is true', () => {
    const comparison = compareEnvelopes(asWritten(T), asWritten('1990-06-15T14:30:00+01:00'), live);
    expect(statementOf(comparison, 'equivalent-instants')).toMatch(AGREES);
    // The premise: the notation really is the only difference.
    expect(comparison.differences.filter((row) => row.kind !== 'display').map((row) => row.id))
      .toEqual(['source-instant']);
  });

  it('does not say it when an aspect disagrees about applying', () => {
    // `applying` is a computed result stored as a boolean, so the numeric-only
    // view could not see it and the summary claimed agreement over it.
    const flipped = accept(asRc6(asWritten('1990-06-15T14:30:00+01:00')), 'flipped-source');
    const edited = copy(flipped);
    const aspect = edited.result.aspects[0];
    expect(aspect, 'the ordinary fixture must carry at least one aspect').toBeTruthy();
    aspect.applying = !aspect.applying;
    const comparison = compareEnvelopes(accept(asRc6(asWritten(T)), 'rc.6 record'), accept(edited, 'flipped-applying'), live);
    expect(comparison.differences.some((row) => /-applying$/.test(row.id))).toBe(true);
    expect(statementOf(comparison, 'equivalent-instants')).not.toMatch(AGREES);
  });

  it('does not say it when an aspect is missing on one side', () => {
    const edited = copy(asWritten('1990-06-15T14:30:00+01:00'));
    edited.result.aspects.pop();
    const comparison = compareEnvelopes(asWritten(T), accept(edited, 'one-aspect-fewer'), live);
    expect(comparison.differences.some((row) => /^aspect-/.test(row.id))).toBe(true);
    expect(statementOf(comparison, 'equivalent-instants')).not.toMatch(AGREES);
  });

  it('gives the same answer whichever record is passed first', () => {
    const edited = asRc6(asWritten('1990-06-15T14:30:00+01:00'));
    edited.result.aspects[0].applying = !edited.result.aspects[0].applying;
    const left = accept(asRc6(asWritten(T)), 'rc.6 record');
    const right = accept(edited, 'flipped-applying');
    expect(statementOf(compareEnvelopes(left, right, live), 'equivalent-instants'))
      .toBe(statementOf(compareEnvelopes(right, left, live), 'equivalent-instants'));
  });

  it('cannot be given an rc.7 record whose applying flag contradicts its own speeds', () => {
    const edited = copy(asWritten('1990-06-15T14:30:00+01:00'));
    edited.result.aspects[0].applying = !edited.result.aspects[0].applying;
    const parsed = parseNatalEnvelope(JSON.stringify(edited));
    expect(parsed.ok ? 'accepted' : parsed.code).toBe('inconsistent_result');
  });

  /**
   * The invariant, over the whole acceptance corpus plus the pairs above. This
   * is the assertion that would have caught the defect without anyone naming
   * the aspect rows in advance, and it is written from the rows rather than
   * from the implementation's own condition.
   */
  it('holds across every pair the corpus can build', () => {
    const editedAspect = asRc6(asWritten('1990-06-15T14:30:00+01:00'));
    editedAspect.result.aspects[0].applying = !editedAspect.result.aspects[0].applying;
    const pairs: [NatalEnvelope, NatalEnvelope, string][] = [
      [asWritten(T), asWritten(T), 'identical'],
      [asWritten(T), asWritten('1990-06-15T14:30:00+01:00'), 'notation only'],
      [accept(asRc6(asWritten(T)), 'rc.6 record'), accept(editedAspect, 'applying'), 'notation plus applying, rc.6 records'],
      [buildEnvelope({ ...ORDINARY, utc: T }), buildEnvelope({ ...ORDINARY, utc: T, houseSystem: 'whole' }), 'house system'],
      [buildEnvelope({ ...ORDINARY, utc: T }), buildEnvelope({ ...ORDINARY, utc: '1990-06-15T18:45:00Z' }), 'different moment'],
      [buildEnvelope({ ...ORDINARY, utc: T }), buildEnvelope({ ...ORDINARY, utc: T, timeKnown: false }), 'unknown time'],
      // Neither side has a house table, and they still asked for different
      // systems. Nothing about the cusps is comparable, so nothing may be said
      // about the cusps agreeing.
      [buildEnvelope({ ...ORDINARY, utc: T, timeKnown: false }),
        buildEnvelope({ ...ORDINARY, utc: T, timeKnown: false, houseSystem: 'whole' }),
        'no houses either side, different systems requested'],
      ...PRESETS.map((preset) => {
        const { left, right } = presetEnvelopes(preset);
        return [left, right, `preset ${preset.id}`] as [NatalEnvelope, NatalEnvelope, string];
      }),
    ];
    for (const [left, right, name] of pairs) {
      const comparison = compareEnvelopes(left, right, live);
      const substantive = comparison.differences.filter((row) => row.kind !== 'display');
      const computedIds = substantive
        .filter((row) => /^(angle-|angles-presence|body-|aspect-|cusp-|cusps-shape)/.test(row.id))
        .map((row) => row.id);
      // A reader gets the statement and the detail together, so a claim of
      // agreement in either one is a claim of agreement. An AI review found the
      // detail line asserting "the cusps are the same in both files" for pairs
      // where neither file had cusps at all, which the statement-only sweep
      // could not see.
      const cuspsOnBothSides = (envelope: NatalEnvelope) =>
        Array.isArray((envelope.result as any).houses?.cusps);
      for (const item of comparison.explanations) {
        if (computedIds.length > 0) {
          expect(item.statement, `${name}: claims agreement over ${computedIds.join(', ')}`)
            .not.toMatch(AGREES);
        }
        if (!cuspsOnBothSides(left) || !cuspsOnBothSides(right)) {
          expect(`${item.statement} ${item.detail ?? ''}`,
            `${name}: says cusps are the same when a file has none`)
            .not.toMatch(/cusps are the same/);
        }
        // Any explanation saying the difference is "only" one thing has to
        // account for every substantive row, or "only" is not true.
        if (/\bonly\b/.test(`${item.statement} ${item.detail ?? ''}`)) {
          const unclaimed = substantive.filter((row) => !item.covers.includes(row.id)).map((row) => row.id);
          expect(unclaimed, `${name}: "${item.statement}" leaves ${unclaimed.join(', ')} unaccounted`).toEqual([]);
        }
      }
    }
  });
});

/**
 * ΔT (TT − UT1), which records carry from engine 0.1.1-rc.8 on. Before this
 * module read the field, a record whose caller pinned ΔT came back against a
 * modelled one of the same chart as computed values that "nothing in either
 * file accounts for" — while both files said exactly what it was — and a pinned
 * record could never reproduce its own values, because the replay dropped the
 * pin it declares.
 */
describe('ΔT, which records carry from engine 0.1.1-rc.8 on', () => {
  const cause = (comparison: ReturnType<typeof compareEnvelopes>, id: string) =>
    comparison.explanations.find((item) => item.id === id) ?? null;

  it('names a pinned ΔT as the candidate for the positions it moved', () => {
    const modelled = buildEnvelope(ORDINARY);
    const pinned = pinnedEnvelope(ORDINARY, 75.5);
    const comparison = compareEnvelopes(modelled, pinned, live);
    // What the cause's detail says a different ΔT does: the Moon moves about
    // half an arcsecond per second of it, and the angles far less — here not
    // at all at the sixth decimal.
    const moon = (envelope: NatalEnvelope) => envelope.result.bodies.find((row) => row.body === 'Moon')!.lon;
    const perSecond = Math.abs(moon(pinned) - moon(modelled)) * 3600 / (75.5 - modelled.result.deltaT!.seconds);
    expect(perSecond).toBeGreaterThan(0.4);
    expect(perSecond).toBeLessThan(0.7);
    expect(comparison.differences.some((row) => /^(angle-|cusp-)/.test(row.id) && row.kind !== 'display')).toBe(false);
    const deltaT = cause(comparison, 'delta-t');
    expect(deltaT?.evidence).toBe('hypothesis');
    expect(deltaT?.covers).toEqual(expect.arrayContaining(['delta-t-seconds', 'delta-t-model', 'body-Moon-lon']));
    expect(evidenceFor(comparison, 'unexplained')).toBeNull();
    // Same instant, place, house system and engine: nothing else is offered.
    expect(comparison.explanations.map((item) => item.id)).toEqual(['delta-t']);
    // Seconds are not degrees, so the row carries no delta for a table to print as one.
    // 1990 is read on IERS UT1 − UTC from engine rc.15 (the model gave 57.181833).
    expect(comparison.differences.find((row) => row.id === 'delta-t-seconds'))
      .toMatchObject({ area: 'Time scale', kind: 'numeric', left: '57.197125', right: '75.500000', delta: null });
  });

  it('does not call two records the same when only the source of their ΔT differs', () => {
    // Pinned at exactly the value the time basis gives: every longitude and
    // latitude agrees, and the two records still say different things about ΔT.
    // From engine rc.15 a pin also puts TT on UT1, so the time between a speed's
    // two samples follows the Earth's rotation rather than UTC: 2.3e-8 longer
    // here, which moves the Sun's and the Moon's speeds across a sixth decimal.
    const modelled = buildEnvelope(ORDINARY);
    const comparison = compareEnvelopes(modelled, pinnedEnvelope(ORDINARY, modelled.result.deltaT!.seconds), live);
    expect(comparison.identical).toBe(false);
    expect(comparison.differences.some((row) => row.id === 'delta-t-seconds')).toBe(false);
    const speeds = comparison.differences.filter((row) => row.id.endsWith('-speed') && row.kind !== 'display');
    expect(speeds.map((row) => row.id)).toEqual(['body-Sun-speed', 'body-Moon-speed']);
    for (const row of speeds) expect(Math.abs(row.delta! / Number(row.left))).toBeLessThan(3e-8);
    expect(comparison.differences.find((row) => row.id === 'delta-t-model'))
      .toMatchObject({ left: 'iers-utc/1', right: 'pinned' });
    // A pin also records its own time basis: no leap seconds, since TT is UT1 plus the pin.
    expect(comparison.differences.find((row) => row.id === 'time-basis'))
      .toMatchObject({ area: 'Time scale', left: 'iers', right: 'pinned' });
    expect(comparison.differences.filter((row) => row.area !== 'Time scale' && !row.id.endsWith('-speed'))
      .every((row) => row.kind === 'display')).toBe(true);
    const deltaT = cause(comparison, 'delta-t');
    expect(deltaT?.evidence).toBe('hypothesis');
    const area = (id: string) => comparison.differences.find((row) => row.id === id)?.area;
    expect(deltaT?.covers.filter((id) => area(id) !== 'Time scale')).toEqual(['body-Sun-speed', 'body-Moon-speed']);
    expect(comparison.explanations.map((item) => item.id)).toEqual(['delta-t']);
  });

  it('lets a different moment account for a different modelled ΔT', () => {
    const comparison = compareEnvelopes(
      buildEnvelope(ORDINARY), buildEnvelope({ ...ORDINARY, utc: '1990-06-15T18:45:00Z' }), live,
    );
    expect(comparison.differences.find((row) => row.id === 'delta-t-seconds')?.kind).toBe('numeric');
    expect(cause(comparison, 'instant')?.covers).toContain('delta-t-seconds');
    expect(cause(comparison, 'delta-t')).toBeNull();
    expect(evidenceFor(comparison, 'unexplained')).toBeNull();
  });

  it('does not let a different moment account for a pinned ΔT, nor a pin for a different moment', () => {
    const comparison = compareEnvelopes(
      buildEnvelope(ORDINARY), pinnedEnvelope({ ...ORDINARY, utc: '1990-06-15T18:45:00Z' }, 75.5), live,
    );
    expect(cause(comparison, 'instant')?.covers.some((id) => id.startsWith('delta-t-'))).toBe(false);
    const deltaT = cause(comparison, 'delta-t');
    expect(deltaT?.evidence).toBe('reported');
    expect(deltaT?.covers).toEqual(expect.arrayContaining(['delta-t-seconds', 'delta-t-model']));
    // Five hours move the positions; eighteen seconds of ΔT are not offered for them.
    const area = (id: string) => comparison.differences.find((row) => row.id === id)?.area;
    expect(deltaT?.covers.some((id) => area(id) !== 'Time scale')).toBe(false);
    expect(evidenceFor(comparison, 'unexplained')).toBeNull();
  });

  it('replays a pinned record with its own ΔT, so its values can reproduce', () => {
    // Two records pinned at one value, differing only in house system. Replayed
    // without the pin, neither reproduced its own positions, and the answer
    // said their values described a different calculation from the one recorded.
    const comparison = compareEnvelopes(
      pinnedEnvelope(ORDINARY, 75.5), pinnedEnvelope({ ...ORDINARY, houseSystem: 'whole' }, 75.5), live,
    );
    expect(evidenceFor(comparison, 'house-system')).toBe('reproduced');
    expect(comparison.limits.join(' ')).not.toMatch(/could not be reproduced/);
    // The page's replay carries the pin through to the engine.
    const request = { utc: ORDINARY.utc, latitude: ORDINARY.latitude, longitude: ORDINARY.longitude,
      houseSystem: 'placidus', timeKnown: true };
    const moon = (result: ReturnType<typeof pageReplay>) => result?.bodies.find((row) => row.body === 'Moon')?.lon;
    const pinnedMoon = pinnedEnvelope(ORDINARY, 75.5).result.bodies.find((row) => row.body === 'Moon')?.lon;
    expect(moon(pageReplay({ ...request, deltaT: 75.5 }))).toBe(pinnedMoon);
    expect(moon(pageReplay(request))).not.toBe(pinnedMoon);
  });

  it('reads a record from before rc.8, which has no ΔT, without a row for the missing field', () => {
    const older = parseNatalEnvelope(JSON.stringify(asWrittenBy(buildEnvelope(ORDINARY), '0.1.1-rc.7')));
    expect(older.ok).toBe(true);
    if (!older.ok) return;
    const comparison = compareEnvelopes(older.envelope, buildEnvelope(ORDINARY), live);
    expect(comparison.differences.some((row) => row.area === 'Time scale')).toBe(false);
    // The difference is stated where the parser ties it, in the conventions.
    expect(comparison.differences.find((row) => row.id === 'convention-deltaT')?.left).toBe('—');
    expect(evidenceFor(comparison, 'conventions')).toBe('reported');
  });
});

describe('the time basis, which records carry from engine 0.1.1-rc.15 on', () => {
  const cause = (comparison: ReturnType<typeof compareEnvelopes>, id: string) =>
    comparison.explanations.find((item) => item.id === id) ?? null;
  /** `buildEnvelope`, with the instant read on another scale. */
  const onScale = (input: SyntheticInput, timeScale: 'ut1' | 'tt'): NatalEnvelope => {
    const envelope = createNatalEnvelope(natalChart({
      utc: input.utc, latitude: input.latitude, longitude: input.longitude, houseSystem: input.houseSystem,
      timeScale,
    } as Parameters<typeof natalChart>[0]), { sourceInstant: input.sourceInstant ?? input.utc });
    const parsed = parseNatalEnvelope(JSON.stringify(envelope));
    if (!parsed.ok) throw new Error(`the parser rejected a ${timeScale} fixture: ${parsed.code}`);
    return parsed.envelope;
  };

  it('names another input scale as the candidate for the positions and angles it moved', () => {
    const comparison = compareEnvelopes(buildEnvelope(ORDINARY), onScale(ORDINARY, 'tt'), live);
    expect(comparison.differences.find((row) => row.id === 'time-scale'))
      .toMatchObject({ area: 'Inputs', left: 'utc', right: 'tt' });
    const scale = cause(comparison, 'time-scale');
    expect(scale?.evidence).toBe('hypothesis');
    // Both are read on IERS in 1990; the scale moves ΔT and UT1 − UTC, not the basis.
    expect(scale?.covers).toEqual(expect.arrayContaining(['time-scale', 'body-Moon-lon', 'angle-asc', 'delta-t-seconds', 'ut1-utc-seconds']));
    expect(comparison.differences.some((row) => row.id === 'time-basis')).toBe(false);
    expect(cause(comparison, 'delta-t')).toBeNull();
    expect(evidenceFor(comparison, 'unexplained')).toBeNull();
  });

  it('replays a record on its own scale, so its values can reproduce', () => {
    // Two TT records differing only in house system. Replayed on UTC, neither
    // would reproduce its own values: the same digits are another moment.
    const comparison = compareEnvelopes(onScale(ORDINARY, 'tt'), onScale({ ...ORDINARY, houseSystem: 'whole' }, 'tt'), live);
    expect(evidenceFor(comparison, 'house-system')).toBe('reproduced');
    const request = { utc: ORDINARY.utc, latitude: ORDINARY.latitude, longitude: ORDINARY.longitude,
      houseSystem: 'placidus', timeKnown: true };
    const moon = (result: ReturnType<typeof pageReplay>) => result?.bodies.find((row) => row.body === 'Moon')?.lon;
    const ttMoon = onScale(ORDINARY, 'tt').result.bodies.find((row) => row.body === 'Moon')?.lon;
    expect(moon(pageReplay({ ...request, timeScale: 'tt' }))).toBe(ttMoon);
    expect(moon(pageReplay(request))).not.toBe(ttMoon);
  });

  it('lets a moment across 1972 account for where one engine took ΔT from', () => {
    // One engine version: before 1972 the ΔT model, from 1972 IERS.
    const comparison = compareEnvelopes(
      buildEnvelope({ ...ORDINARY, utc: '1971-06-15T13:30:00Z' }), buildEnvelope({ ...ORDINARY, utc: '1973-06-15T13:30:00Z' }), live,
    );
    expect(comparison.differences.find((row) => row.id === 'delta-t-model'))
      .toMatchObject({ left: 'zodiacs-deltat/1', right: 'iers-utc/1' });
    expect(comparison.differences.find((row) => row.id === 'time-basis')).toMatchObject({ left: 'delta-t', right: 'iers' });
    expect(cause(comparison, 'instant')?.covers).toEqual(expect.arrayContaining(['delta-t-model', 'time-basis', 'tai-utc-seconds']));
    expect(cause(comparison, 'delta-t')).toBeNull();
    expect(evidenceFor(comparison, 'unexplained')).toBeNull();
  });

  it('reads a record of the rc.8 conventions, which states no scale, as a difference of conventions', () => {
    // As rc.8 to rc.14 wrote it: the instant read as UT1 with the model's ΔT,
    // and no time basis recorded. Its positions here are rc.15's, which the
    // parser does not recompute; only the model's ΔT at the instant is checked.
    const current = buildEnvelope(ORDINARY);
    const record = JSON.parse(JSON.stringify(current));
    record.receipt.engine = { ...record.receipt.engine, version: '0.1.1-rc.14' };
    record.receipt.conventions = { ...NATAL_RECEIPT_CONVENTION_SETS.find((set) => set.deltaT === 'tt-minus-ut1;ut1-read-as-utc;value-in-result') };
    delete record.receipt.timeScale;
    delete record.result.timeScale;
    record.result.deltaT = deltaTAt((Date.parse(ORDINARY.utc) - Date.UTC(2000, 0, 1, 12)) / 86_400_000);
    const parsed = parseNatalEnvelope(JSON.stringify(record));
    expect(parsed.ok ? 'accepted' : parsed.code).toBe('accepted');
    if (!parsed.ok) return;
    const comparison = compareEnvelopes(parsed.envelope, current, live);
    expect(comparison.differences.find((row) => row.id === 'time-scale')).toMatchObject({ left: '—', right: 'utc' });
    expect(cause(comparison, 'time-scale')).toBeNull();
    expect(cause(comparison, 'conventions')?.covers).toEqual(expect.arrayContaining(['time-scale', 'convention-timeScale']));
    expect(comparison.differences.some((row) => ['time-basis', 'ut1-utc-seconds'].includes(row.id))).toBe(false);
    expect(cause(comparison, 'unexplained')?.covers ?? []).not.toContain('time-scale');
  });
});
