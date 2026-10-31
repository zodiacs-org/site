/**
 * Scores a pair of runs of the audit's twenty-fixture matrix by the earlier
 * rule, the bundle's PARTITION-EVALUATION-V2.md: section 5 (the same event,
 * and the second sense of bit-identical, as amended by A-1 and read by R-1),
 * and E-1, E-2 and E-3 restricted to the matrix.
 *
 *   node score.mjs --v1events=E1.json --v1matrix=M1.json --v2events=E2.json --v2matrix=M2.json --out=OUT.json
 *
 * "v1" is the original runtime and "v2" the code under comparison. Every
 * function between the two "verbatim" markers is copied from the bundle's
 * tools/measure/partition-evaluation-v2.mjs (lines 101, 632-707, 963-1051),
 * so the scoring is that harness's, applied to these four files instead of
 * the files it wrote itself. Nothing else in that harness is run: it needs
 * a git checkout, the rule's own pack, and runs the bundle's version 2 as
 * its "v2".
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = new Map(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)]; }));
const read = (k) => JSON.parse(readFileSync(args.get(k), 'utf8'));
const fx = { v1: { events: read('v1events'), matrix: read('v1matrix') }, v2: { events: read('v2events'), matrix: read('v2matrix') } };
const stop = (why, detail) => { process.stderr.write(`STOPPED: ${why}\n${JSON.stringify(detail).slice(0, 2000)}\n`); process.exit(3); };

// ------------------------------------------------------------ verbatim
const MATCH_WINDOW_SEC = 1;
const ROOT_TOLERANCE_SEC = 1e-3;
/** Section 5: the audit's own allowance on the fixtures. */
const FIXTURE_ALLOWANCE_SEC = 1e-2;
const DAY = 86400;

const asSec = (e) => (e.ttDays !== undefined
  ? { t: e.ttDays * DAY, lo: e.bracketTtDays[0] * DAY, hi: e.bracketTtDays[1] * DAY }
  : { t: e.tdbSec, lo: e.bracketTdbSec[0], hi: e.bracketTdbSec[1] });
const same = (a, b) => (Array.isArray(a) && Array.isArray(b)
  ? a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
  : Object.is(a, b));
const identityKeys = (e) => Object.keys(e);
const bitIdentical = (a, b) => identityKeys(a).length === identityKeys(b).length && identityKeys(a).every((k) => same(a[k], b[k]));

function compareEvents(e1, e2, { rootsOfV1 = new Map(), allowance = 0 } = {}) {
  const a = e1.map(asSec);
  const b = e2.map(asSec);
  const candidates = [];
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      const d = Math.abs(a[i].t - b[j].t);
      if (d <= MATCH_WINDOW_SEC) candidates.push({ i, j, d });
    }
  }
  candidates.sort((x, y) => x.d - y.d || x.i - y.i || x.j - y.j);
  const seenI = new Map();
  for (const c of candidates) seenI.set(c.i, (seenI.get(c.i) ?? 0) + 1);
  const takenI = new Set(); const takenJ = new Set();
  const pairs = [];
  for (const c of candidates) {
    if (takenI.has(c.i) || takenJ.has(c.j)) continue;
    takenI.add(c.i); takenJ.add(c.j);
    const overlaps = b[c.j].lo <= a[c.i].hi + ROOT_TOLERANCE_SEC && a[c.i].lo - ROOT_TOLERANCE_SEC <= b[c.j].hi;
    const roots = rootsOfV1.get(c.i) ?? [];
    const rootsInside = roots.every((r) => b[c.j].lo - allowance <= r && r <= b[c.j].hi + allowance);
    pairs.push({ v1: c.i, v2: c.j, d: c.d, overlaps, rootsInside, sameEvent: overlaps && rootsInside, bitIdentical: bitIdentical(e1[c.i], e2[c.j]) });
  }
  const sameOf = new Set(pairs.filter((p) => p.sameEvent).map((p) => p.v1));
  const lost = a.map((x, i) => ({ i, t: x.t })).filter(({ i }) => !sameOf.has(i));
  return {
    v1: a.length, v2: b.length, pairs: pairs.length, sameEventPairs: sameOf.size,
    lost: lost.length, lostAt: lost.map((x) => x.t),
    ambiguousPairing: [...seenI.values()].some((n) => n > 1),
    bitIdenticalPairs: pairs.filter((p) => p.bitIdentical).length,
  };
}

function sameCountCheck(e1, e2) {
  const unamended = e1.length === e2.length && e1.every((x, i) => bitIdentical(x, e2[i]));
  let amended = e1.length === e2.length;
  let nested = 0;
  if (amended) {
    for (let i = 0; i < e1.length; i += 1) {
      const x = e1[i]; const y = e2[i];
      const labels = ['kind', 'direction', 'domain', 'eligibility'].every((k) => Object.is(x[k], y[k]));
      const bx = asSec(x); const by = asSec(y);
      const inside = bx.lo <= by.lo && by.hi <= bx.hi;
      if (!(labels && inside)) amended = false;
      if (inside) nested += 1;
    }
  }
  const bitIdenticalEvents = Math.min(e1.length, e2.length) === 0 ? 0 : e1.filter((x, i) => i < e2.length && bitIdentical(x, e2[i])).length;
  return { events: e1.length, v2Events: e2.length, unamended, amended, nestedEvents: nested, bitIdenticalEvents };
}

for (const v of ['v1', 'v2']) {
  const shapeOk = fx[v].events.rows.length === 20 && fx[v].matrix.length === 20
    && fx[v].events.rows.every((row) => Object.keys(row.rungs).length === 6);
  if (!shapeOk) stop('a fixture file does not hold twenty fixtures on six rungs', v);
}
const scriptAgreement = [];
for (const v of ['v1', 'v2']) {
  for (const row of fx[v].events.rows) {
    const m = fx[v].matrix.find((x) => x.id === row.id);
    for (const rung of ['geometric', 'retarded', 'aberrated', 'ofDateIdentity', 'ofDateReal', 'deflected']) {
      const a = row.rungs[rung].events.map((e) => e.time);
      const b = m[rung].times;
      scriptAgreement.push({ v, id: row.id, rung, agree: a.length === b.length && a.every((t, i) => Object.is(t, b[i])) });
    }
  }
}
const TAU0 = fx.v2.events.tau0Sec;
if (!Object.is(TAU0, fx.v1.events.tau0Sec)) stop('the two trees disagree on X0/c', [fx.v1.events.tau0Sec, TAU0]);
const KNOWN = ['geometric', 'retarded', 'aberrated', 'ofDateIdentity'];
const knownRoots = (row, rung) => (rung === 'geometric' ? row.roots : row.roots.map((r) => r + TAU0));
const auditClassify = (res, expected, tol) => {
  const times = res.events.map((e) => e.time);
  const used = new Set();
  const matchedTo = new Map();
  let outsideBracket = 0;
  for (const r of expected) {
    let best = -1; let bd = Infinity;
    times.forEach((t, i) => { if (!used.has(i) && Math.abs(t - r) < bd) { bd = Math.abs(t - r); best = i; } });
    if (best >= 0 && bd <= tol) {
      used.add(best);
      matchedTo.set(r, best);
      const [lo, hi] = res.events[best].bracket;
      if (!(r >= lo - tol && r <= hi + tol)) outsideBracket += 1;
    }
  }
  const matched = matchedTo.size;
  const missed = expected.length - matched;
  const extra = times.length - matched;
  const est = res.established;
  let verdict = 'HONEST';
  if (est && (missed || extra)) verdict = 'WRONG-PROVEN';
  else if (!est && !missed && !extra) verdict = 'FOUND-ALL-UNPROVEN';
  else if (est) verdict = 'OK-PROVEN';
  else if (extra) verdict = 'EXTRA-UNPROVEN';
  return { matched, missed, extra, outsideBracket, verdict, matchedTo };
};
const rowsOut = [];
for (const row1 of fx.v1.events.rows) {
  const row2 = fx.v2.events.rows.find((x) => x.id === row1.id);
  const out = { id: row1.id, rungs: {} };
  for (const rung of ['geometric', 'retarded', 'aberrated', 'ofDateIdentity', 'ofDateReal', 'deflected']) {
    const x = row1.rungs[rung]; const y = row2.rungs[rung];
    const isKnown = KNOWN.includes(rung);
    const all = isKnown ? knownRoots(row1, rung) : [];
    // R-1: a root outside the requested window is not a root of the request.
    const inWindow = all.filter((r) => r >= row1.window[0] && r <= row1.window[1]);
    const c1 = isKnown ? auditClassify(x, all, FIXTURE_ALLOWANCE_SEC) : null;
    const c2raw = isKnown ? auditClassify(y, all, FIXTURE_ALLOWANCE_SEC) : null;
    const c2 = isKnown ? auditClassify(y, inWindow, FIXTURE_ALLOWANCE_SEC) : null;
    // E-1: roots v1 matched must lie inside the paired v2 bracket, and v2 must match them too.
    const rootsOfV1 = new Map();
    if (isKnown) for (const [r, i] of c1.matchedTo) rootsOfV1.set(i, [...(rootsOfV1.get(i) ?? []), r]);
    const toEvents = (list) => list.map((e) => (rung === 'geometric'
      ? { ttDays: e.ttDays, bracketTtDays: e.bracketTtDays, kind: e.kind, direction: e.direction }
      : { tdbSec: e.time, bracketTdbSec: e.bracket, kind: e.kind, direction: e.direction }));
    const cmp = compareEvents(toEvents(x.events), toEvents(y.events), { rootsOfV1, allowance: FIXTURE_ALLOWANCE_SEC });
    const knownRootsLost = isKnown ? [...c1.matchedTo.keys()].filter((r) => !c2raw.matchedTo.has(r)) : [];
    // The count-only deflected rung, as the audit reads it: against the real-frame of-date instants within 30 s.
    let deflectedVsOfDate = null;
    if (rung === 'deflected') {
      const od = y === null ? null : row2.rungs.ofDateReal;
      const d = auditClassify(y, od.events.map((e) => e.time), 30);
      deflectedVsOfDate = { verdict: d.verdict, scored: od.established === true, missed: d.missed, extra: d.extra };
    }
    const sameCounts = x.evaluations === y.evaluations && x.cells === y.cells;
    out.rungs[rung] = {
      v1: { status: x.status, established: x.established, evaluations: x.evaluations, cells: x.cells, events: x.events.length, auditVerdict: c1?.verdict ?? null },
      v2: { status: y.status, established: y.established, evaluations: y.evaluations, cells: y.cells, events: y.events.length, auditVerdictRaw: c2raw?.verdict ?? null, verdictInWindow: c2?.verdict ?? null },
      knownRoots: isKnown ? { declared: all.length, inWindow: inWindow.length } : null,
      comparison: { ...cmp, knownRootsLost: knownRootsLost.length },
      e2: isKnown
        ? { established: y.established, missed: c2.missed, extra: c2.extra, outsideBracket: c2.outsideBracket, pass: !y.established || (c2.missed === 0 && c2.extra === 0 && c2.outsideBracket === 0) }
        : (deflectedVsOfDate ? { ...deflectedVsOfDate, pass: !deflectedVsOfDate.scored || deflectedVsOfDate.verdict !== 'WRONG-PROVEN' } : { pass: true, note: 'count-only rung with no known roots' }),
      sameCounts,
      sameCount: sameCounts ? sameCountCheck(toEvents(x.events), toEvents(y.events)) : null,
    };
  }
  rowsOut.push(out);
}
const fixtures = { scriptsAgreeOnEveryEventTime: scriptAgreement.every((x) => x.agree), scriptDisagreements: scriptAgreement.filter((x) => !x.agree), tau0Sec: TAU0, rows: rowsOut };
// ---------------------------------------------------------- end verbatim

// E-1, E-2 and E-3 sense 2, as the bundle harness summarises them
// (lines 1168-1245), restricted to the fixture part.
const fixtureLost = fixtures.rows.flatMap((row) => Object.entries(row.rungs).map(([rung, x]) => ({ id: row.id, rung, lost: x.comparison.lost, knownRootsLost: x.comparison.knownRootsLost })));
const E1 = {
  scope: 'the twenty-fixture matrix only (6 rungs)',
  fixtureEventsLost: fixtureLost.reduce((n, x) => n + x.lost, 0),
  fixtureKnownRootsLost: fixtureLost.reduce((n, x) => n + x.knownRootsLost, 0),
  where: fixtureLost.filter((x) => x.lost || x.knownRootsLost),
  pass: fixtureLost.every((x) => x.lost === 0 && x.knownRootsLost === 0),
};
const fixtureE2 = fixtures.rows.flatMap((row) => Object.entries(row.rungs).filter(([, x]) => !x.e2.pass).map(([rung, x]) => ({ id: row.id, rung, ...x.e2 })));
const E2 = {
  scope: 'the twenty-fixture matrix only: the first bullet of E-2, and the deflected rung read against the real-frame of-date rung as the harness reads it',
  failures: fixtureE2,
  rawClassifierWrongProvenV2: fixtures.rows.flatMap((row) => Object.entries(row.rungs).filter(([, x]) => x.v2.auditVerdictRaw === 'WRONG-PROVEN').map(([rung]) => `${row.id} ${rung}`)),
  rawClassifierWrongProvenV1: fixtures.rows.flatMap((row) => Object.entries(row.rungs).filter(([, x]) => x.v1.auditVerdict === 'WRONG-PROVEN').map(([rung]) => `${row.id} ${rung}`)),
  pass: fixtureE2.length === 0,
};
const sameCountSets = [];
for (const row of fixtures.rows) for (const [rung, x] of Object.entries(row.rungs)) if (x.sameCounts) sameCountSets.push({ where: 'fixtures', id: row.id, rung, ...x.sameCount });
const E3sense2 = {
  scope: 'the twenty-fixture matrix only; sense 1 (apparent() on a grid) is not a matrix measurement and is reported from apparent-grid.mjs',
  results: fixtures.rows.length * 6,
  sameCountResults: sameCountSets.length,
  differentCountResults: fixtures.rows.flatMap((row) => Object.entries(row.rungs).filter(([, x]) => !x.sameCounts).map(([rung]) => `${row.id} ${rung}`)),
  unamendedFailures: sameCountSets.filter((x) => !x.unamended).map(({ where, id, rung, events, bitIdenticalEvents, nestedEvents }) => ({ where, id, rung, events, bitIdenticalEvents, nestedEvents })),
  amendedFailures: sameCountSets.filter((x) => !x.amended).map(({ where, id, rung, events, v2Events }) => ({ where, id, rung, events, v2Events })),
  eventsInSameCountResults: sameCountSets.reduce((n, x) => n + x.events, 0),
  bitIdenticalEventsInSameCountResults: sameCountSets.reduce((n, x) => n + x.bitIdenticalEvents, 0),
};
E3sense2.passUnamended = E3sense2.unamendedFailures.length === 0;
E3sense2.passAmendedA1 = E3sense2.amendedFailures.length === 0;

// ------------------------------------------- beyond the harness, reported
// Whole-result identity: every field fixture-events.mjs records for a
// result (status, counts, completeness, events, spans, jumps, joins), and
// every field fixture-matrix.mjs records, compared under Object.is.
function deepSame(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepSame(x, b[i]));
  const ka = Object.keys(a).sort(); const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && deepSame(a[k], b[k]));
}
const wholeResult = [];
for (const row1 of fx.v1.events.rows) {
  const row2 = fx.v2.events.rows.find((x) => x.id === row1.id);
  const m1 = fx.v1.matrix.find((x) => x.id === row1.id);
  const m2 = fx.v2.matrix.find((x) => x.id === row1.id);
  for (const rung of ['geometric', 'retarded', 'aberrated', 'ofDateIdentity', 'ofDateReal', 'deflected']) {
    const differs = Object.keys(row1.rungs[rung]).filter((k) => !deepSame(row1.rungs[rung][k], row2.rungs[rung][k]));
    const matrixDiffers = Object.keys(m1[rung]).filter((k) => !deepSame(m1[rung][k], m2[rung][k]));
    wholeResult.push({ id: row1.id, rung, eventsFileFieldsDiffering: differs, matrixFileFieldsDiffering: matrixDiffers, identical: differs.length === 0 && matrixDiffers.length === 0 });
  }
}

// --------------------------------------- the nine record-boundary roots
const recordEdge = [];
for (const row1 of fx.v1.events.rows.filter((r) => r.id.startsWith('record-edge-root'))) {
  const row2 = fx.v2.events.rows.find((x) => x.id === row1.id);
  const scored = rowsOut.find((x) => x.id === row1.id);
  for (const rung of ['geometric', 'retarded', 'aberrated', 'ofDateIdentity', 'ofDateReal', 'deflected']) {
    const pick = (x) => ({
      status: x.status, established: x.established, events: x.events.length, unresolved: x.unresolved,
      evaluations: x.evaluations, cells: x.cells,
      eventTimesSec: x.events.map((e) => e.time),
      bracketWidthsSec: x.events.map((e) => e.bracket[1] - e.bracket[0]),
      // Recorded only by the later fixture-events.mjs (3a30ed38); null on files from the earlier one.
      unresolvedSpanWidthsSec: x.unresolvedSpans ? x.unresolvedSpans.map(([lo, hi]) => hi - lo) : null,
    });
    const s = scored.rungs[rung];
    recordEdge.push({
      id: row1.id, offsetSec: row1.roots[0] - 3 * DAY, rung,
      knownRoot: KNOWN.includes(rung) ? (rung === 'geometric' ? row1.roots[0] : row1.roots[0] + TAU0) : null,
      v1: { ...pick(row1.rungs[rung]), auditVerdict: s.v1.auditVerdict },
      v2: { ...pick(row2.rungs[rung]), auditVerdictRaw: s.v2.auditVerdictRaw, verdictInWindow: s.v2.verdictInWindow },
      sameEventPairs: s.comparison.sameEventPairs, lost: s.comparison.lost, knownRootsLost: s.comparison.knownRootsLost,
      bitIdenticalPairs: s.comparison.bitIdenticalPairs, sameCounts: s.sameCounts, sameCount: s.sameCount, e2: s.e2,
    });
  }
}

const record = {
  tool: 'score.mjs (results/matrix/scripts)',
  inputs: Object.fromEntries(['v1events', 'v1matrix', 'v2events', 'v2matrix'].map((k) => [k, args.get(k)])),
  trees: { v1: fx.v1.events.tree, v2: fx.v2.events.tree },
  fixtures,
  E1, E2, E3sense2,
  wholeResult: { identical: wholeResult.filter((x) => x.identical).length, of: wholeResult.length, differing: wholeResult.filter((x) => !x.identical) },
  recordEdge,
};
writeFileSync(args.get('out'), `${JSON.stringify(record, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({ scriptsAgree: fixtures.scriptsAgreeOnEveryEventTime, E1: { pass: E1.pass, lost: E1.fixtureEventsLost, knownRootsLost: E1.fixtureKnownRootsLost }, E2: { pass: E2.pass, failures: E2.failures.length, rawWrongProvenV1: E2.rawClassifierWrongProvenV1, rawWrongProvenV2: E2.rawClassifierWrongProvenV2 }, E3sense2: { sameCountResults: E3sense2.sameCountResults, unamendedFailures: E3sense2.unamendedFailures.length, amendedFailures: E3sense2.amendedFailures.length, events: E3sense2.eventsInSameCountResults, bitIdentical: E3sense2.bitIdenticalEventsInSameCountResults }, wholeResultIdentical: `${record.wholeResult.identical} of ${record.wholeResult.of}` })}\n`);
