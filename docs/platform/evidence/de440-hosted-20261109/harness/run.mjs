/**
 * P4.1's S5: the one recorded run of PREREGISTRATION.md on the frozen build.
 * It draws the holdout, fetches Horizons and JPL's EOP2 file for it, runs
 * Swiss and every rule and check, and writes results.json. Per-case Swiss
 * values stay in --scratch, outside the repository; what this writes to --out
 * holds none.
 *
 *   node run.mjs --out DIR --scratch DIR --pack PACK --kernel de440.bsp \
 *     --jpl linux_p1550p2650.440 --ephe SWISS_EPHE_DIR --python VENV_PYTHON \
 *     --engine ENGINE_CLONE --node24 NODE24_BIN [--holdout-id ID] [--replay]
 *
 * --replay reads the holdout and its Horizons responses from --out instead of
 * drawing and fetching them, checks every digest the first run recorded, and
 * recomputes (check C6). --holdout-id other than zodiacs-holdout/P4.1 is for
 * exercising the harness before the freeze; its result is not P4.1's.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACK_SHA256, bodyOf, openApi, sha256 } from './lib/api.mjs';
import { findMinimum } from './lib/canon.mjs';
import { J2000_JD, isoOf, jdTtOf, utcForTt } from './lib/clock.mjs';
import { matchCases, parseResponse } from './lib/horizons.mjs';
import { ruleI, ruleII, ruleV } from './lib/rules.mjs';
import { quantile, max, wrap, ARCSEC } from './lib/stats.mjs';
import { HOLDOUT_ID, drawHoldout } from './holdout.mjs';
import { viiiAlpha } from './viii-alpha.mjs';
import * as checks from './lib/checks.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const UNIT = resolve(HERE, '..');
const ROOT = resolve(UNIT, '../../../..');
const CORPORA = join(ROOT, 'docs/platform/evidence/engine-beyond-swiss/corpora');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
const flag = (name) => process.argv.includes(`--${name}`);
const out = resolve(arg('out'));
const scratch = resolve(arg('scratch'));
const holdoutId = arg('holdout-id', HOLDOUT_ID);
const replay = flag('replay');
for (const dir of [out, scratch]) mkdirSync(dir, { recursive: true });
if (scratch.startsWith(ROOT)) throw new Error('--scratch must be outside the repository: it holds Swiss values');
const log = [];
const say = (line) => { log.push(line); console.error(line); };
const fileSha = (path) => sha256(readFileSync(path));
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const HORIZONS_FILE = { Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'MarsBary', Jupiter: 'JupiterBary', Saturn: 'SaturnBary', Uranus: 'UranusBary', Neptune: 'NeptuneBary', Pluto: 'PlutoBary' };

function python(script, args) {
  const result = spawnSync(arg('python'), ['-I', join(HERE, script), ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (result.status !== 0) throw new Error(`${script} ${args[0]}: exit ${result.status}: ${result.stderr.slice(-600)}`);
  return result.stdout;
}

/** Swiss calls through swiss.py, written and read in --scratch only. */
function swiss(calls, label) {
  const request = join(scratch, `swiss-${label}.request.json`);
  const answer = join(scratch, `swiss-${label}.json`);
  writeFileSync(request, JSON.stringify({ ephePath: arg('ephe'), jplFile: arg('jpl'), calls }));
  python('swiss.py', [request, answer]);
  const parsed = JSON.parse(readFileSync(answer, 'utf8'));
  // The instrument as the preregistration pins it ("Oracles and their receipts").
  const pins = { swisseph: '2.10.03', pyswisseph: '2.10.3.2', jpl: '29915576d0a6555766b99485ac3056ee415e86df4fce282611c31afb329ad062', semo: '1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7', sepl: 'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66' };
  if (parsed.swisseph !== pins.swisseph || parsed.pyswisseph !== pins.pyswisseph || parsed.jplFile.sha256 !== pins.jpl
    || parsed.se1Files['semo_18.se1']?.sha256 !== pins.semo || parsed.se1Files['sepl_18.se1']?.sha256 !== pins.sepl) {
    throw new Error(`the Swiss instrument is not the preregistered one: ${JSON.stringify({ swisseph: parsed.swisseph, pyswisseph: parsed.pyswisseph, jpl: parsed.jplFile.sha256, se1: parsed.se1Files })}`);
  }
  return { meta: { swisseph: parsed.swisseph, pyswisseph: parsed.pyswisseph, python: parsed.python, jplFile: parsed.jplFile, se1Files: parsed.se1Files }, byId: new Map(parsed.calls.map((c) => [c.id, c])) };
}
const swissRef = (result, id) => {
  const c = result.byId.get(id);
  if (!c || !c.ok) return { instrument: c?.error ?? 'no answer' };
  return { lon: c.lon, lat: c.lat };
};

// 0. The frozen build.
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const api = await openApi(ROOT, arg('pack'));
const freeze = {
  site: { commit: git('rev-parse', 'HEAD'), clean: git('status', '--porcelain', '--untracked-files=no') === '' },
  bundle: { path: 'api/_compute/compute.mjs', sha256: api.bundleSha256 },
  pack: { sha256: api.packSha256, bytes: api.packBytes },
  kernel: { sha256: fileSha(arg('kernel')) },
  engine: JSON.parse(readFileSync(join(ROOT, 'node_modules/@zodiacs/engine/package.json'), 'utf8')).version,
  node: process.version,
  harness: Object.fromEntries(['run.mjs', 'holdout.mjs', 'viii-alpha.mjs', 'swiss.py', 'horizons_holdout.py', 'lib/api.mjs', 'lib/canon.mjs', 'lib/checks.mjs', 'lib/clock.mjs', 'lib/horizons.mjs', 'lib/rules.mjs', 'lib/stats.mjs', 'cross-runtime/run.mjs', 'cross-runtime/entry.mjs', 'cross-runtime/node-run.mjs'].map((f) => [f, fileSha(join(HERE, f))])),
};
if (freeze.pack.sha256 !== PACK_SHA256) throw new Error('not the pinned pack');
say(`frozen: site ${freeze.site.commit.slice(0, 8)}${freeze.site.clean ? '' : ' (tracked changes!)'}, engine ${freeze.engine}, bundle ${freeze.bundle.sha256.slice(0, 12)}, node ${process.version}`);

// 1. The horizons-24 corpus on the pinned clock.
const corpusTt = JSON.parse(readFileSync(join(CORPORA, 'horizons-24/corpus-tt.json'), 'utf8')).cases;
const pinned = corpusTt.map((kase) => ({ ...kase, ...utcForTt(kase.jdTt - J2000_JD) }));
const corpusRows = await api.positions(pinned.map((p) => isoOf(p.ms)), [...BODIES, 'North Node']);
const residualsMs = pinned.map((p) => p.residualMs);
say(`corpus: ${pinned.length} instants, clock residual at most ${Math.max(...residualsMs.map(Math.abs)).toFixed(3)} ms`);
const horizons = Object.fromEntries(BODIES.map((body) => {
  const parsed = parseResponse(join(CORPORA, 'horizons-24', `${HORIZONS_FILE[body]}.txt`));
  return [body, matchCases(parsed, corpusTt, body)];
}));
const ours = (rows, i, body) => bodyOf(rows[i], body);
const ttJd = (row) => jdTtOf(Date.parse(row.instant));

// Swiss on the corpus: .se1 at Horizons's TT (parity), the JPL file at our TT (rule ii), nodes.
const corpusSwissCalls = [];
pinned.forEach((p, i) => {
  for (const body of BODIES) {
    corpusSwissCalls.push({ id: `se1-h/${i}/${body}`, mode: 'se1', jdTt: p.jdTt, body });
    corpusSwissCalls.push({ id: `jpl/${i}/${body}`, mode: 'jpl', jdTt: ttJd(corpusRows[i]), body });
  }
  corpusSwissCalls.push({ id: `jpl/${i}/TrueNode`, mode: 'jpl', jdTt: ttJd(corpusRows[i]), body: 'TrueNode' });
  corpusSwissCalls.push({ id: `se1/${i}/TrueNode`, mode: 'se1', jdTt: ttJd(corpusRows[i]), body: 'TrueNode' });
});
const swissCorpus = swiss(corpusSwissCalls, 'corpus');

const results = { preregistration: 'docs/platform/evidence/de440-hosted-20261109/PREREGISTRATION.md', holdoutId, freeze, swiss: swissCorpus.meta, rules: {}, checks: {}, reported: {} };
const rowsFor = (refOf) => pinned.flatMap((p, i) => BODIES.map((body) => ({ id: p.id, body, ours: ours(corpusRows, i, body), ref: refOf(i, body) })));

// Rule (i), corpus.
results.rules.i = {
  corpus: ruleI({
    label: 'horizons-24, 240 rows, against Horizons (DE441, QUANTITIES=31, barycentres for Mars to Pluto)',
    ours: rowsFor((i, body) => ({ lon: horizons[body][i].lon, lat: horizons[body][i].lat })),
    swiss: pinned.flatMap((p, i) => BODIES.map((body) => ({ id: p.id, body, ours: { lon: horizons[body][i].lon, lat: horizons[body][i].lat }, ref: swissRef(swissCorpus, `se1-h/${i}/${body}`) }))),
    parity: true,
  }),
  clockResidualMsMax: Math.max(...residualsMs.map(Math.abs)),
};
// Rule (ii), corpus.
results.rules.ii = { corpus: ruleII({ label: 'horizons-24, 240 rows, against Swiss on linux_p1550p2650.440 at the backend\'s TT', ours: rowsFor((i, body) => swissRef(swissCorpus, `jpl/${i}/${body}`)) }) };

// Rule (iii): the canon events.
const canon = JSON.parse(readFileSync(join(CORPORA, 'canon-events.json'), 'utf8')).events;
const TRANSIT_TT_MINUS_UT = { 'venus-transit-2004-06-08': 64.184, 'venus-transit-2012-06-06': 66.184 };
const events = [];
for (const event of canon) {
  const offset = TRANSIT_TT_MINUS_UT[event.id];
  if (offset !== undefined && !event.tt.includes(`${offset} s`)) throw new Error(`${event.id}: the file does not record TT - UT ${offset} s`);
  const found = await findMinimum(api, offset === undefined ? event : { ...event, ttMinusUt: offset }, event.id.startsWith('eclipse') ? 'Moon' : 'Venus');
  events.push({ id: event.id, ...found });
}
results.rules.iii = { events, verdict: events.every((e) => !e.fail && Math.abs(e.dtSeconds) <= 2) ? 'PASS' : 'FAIL' };
say(`rule (iii): ${events.map((e) => `${e.id} ${e.fail ?? `${e.dtSeconds.toFixed(3)} s`}`).join('; ')}`);

// Rule (iv): the 180-case benchmark, Swiss side by dump_swiss.py unchanged.
const { MEASURE, BODIES: BENCH_BODIES } = await import(join(ROOT, 'docs/platform/evidence/swiss-benchmark/tools/corpus.mjs'));
const benchRows = await api.positions(MEASURE.map((kase) => kase.utc), [...BENCH_BODIES, 'North Node']);
const zodiacsDump = { engine: `${freeze.engine} (hosted path, backend de440)`, node: process.version, set: 'measure', cases: MEASURE.map((kase, i) => {
  const record = { id: kase.id, stratum: kase.stratum, utc: kase.utc };
  if (benchRows[i].refused) record.error = benchRows[i].refused;
  else record.bodies = Object.fromEntries(BENCH_BODIES.map((b) => { const hit = bodyOf(benchRows[i], b); return [b, hit.fail ? null : { lon: hit.lon, lat: hit.lat, speed: hit.speed }]; }));
  return record;
}) };
const zodiacsPath = join(scratch, 'iv-zodiacs.json');
writeFileSync(zodiacsPath, JSON.stringify(zodiacsDump));
const dump = spawnSync(arg('python'), ['-I', join(ROOT, 'docs/platform/evidence/swiss-benchmark/tools/dump_swiss.py'), zodiacsPath, arg('ephe')], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (dump.status !== 0) throw new Error(`dump_swiss.py: ${dump.stderr.slice(-400)}`);
writeFileSync(join(scratch, 'iv-swiss.json'), dump.stdout);
const compared = spawnSync(process.execPath, [join(ROOT, 'docs/platform/evidence/swiss-benchmark/tools/compare.mjs'), zodiacsPath, join(scratch, 'iv-swiss.json')], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (compared.status !== 0) throw new Error(`compare.mjs: ${compared.stderr.slice(-400)}`);
const report = JSON.parse(compared.stdout);
writeFileSync(join(scratch, 'iv-report.json'), compared.stdout);
const scoredIv = report.rows.filter((row) => row.stratum !== 'future').map((row) => Math.abs(row.dLonArcsec));
const futureIv = report.rows.filter((row) => row.stratum === 'future').map((row) => Math.abs(row.dLonArcsec));
results.rules.iv = {
  n: scoredIv.length, p50Arcsec: quantile(scoredIv, 0.5), p95Arcsec: quantile(scoredIv, 0.95), maxArcsec: max(scoredIv),
  excluded: report.excluded.length, swissBackends: report.swissBackendsObserved,
  future: { n: futureIv.length, p50Arcsec: quantile(futureIv, 0.5), maxArcsec: max(futureIv) },
  verdict: report.excluded.length === 0 && scoredIv.length === 160 && quantile(scoredIv, 0.5) <= 0.2 && quantile(scoredIv, 0.95) <= 0.4 && max(scoredIv) <= 0.5 ? 'PASS' : 'FAIL',
};
say(`rule (iv): ${results.rules.iv.n} rows, p50 ${results.rules.iv.p50Arcsec?.toFixed(3)}", p95 ${results.rules.iv.p95Arcsec?.toFixed(3)}", max ${results.rules.iv.maxArcsec?.toFixed(3)}" (${results.rules.iv.verdict})`);

// Rule (v), corpus: the 24 corpus instants and the 17 distinct benchmark instants.
const distinct = [...new Set(MEASURE.map((kase) => kase.utc))];
const benchNodeRows = await api.positions(distinct, ['North Node']);
const nodeCalls = benchNodeRows.flatMap((row, i) => [{ id: `jpl-b/${i}/TrueNode`, mode: 'jpl', jdTt: ttJd(row), body: 'TrueNode' }, { id: `se1-b/${i}/TrueNode`, mode: 'se1', jdTt: ttJd(row), body: 'TrueNode' }]);
const swissNodes = swiss(nodeCalls, 'bench-nodes');
const nodeRowsCorpus = [
  ...pinned.map((p, i) => ({ id: p.id, body: 'North Node', ours: ours(corpusRows, i, 'North Node'), ref: swissRef(swissCorpus, `jpl/${i}/TrueNode`) })),
  ...benchNodeRows.map((row, i) => ({ id: distinct[i], body: 'North Node', ours: bodyOf(row, 'North Node'), ref: swissRef(swissNodes, `jpl-b/${i}/TrueNode`) })),
];
results.rules.v = { corpus: ruleV({ label: '41 instants against Swiss TRUE_NODE on the DE440 binary', ours: nodeRowsCorpus.map((r) => ({ ...r, body: 'North Node' })) }) };

// 2. The holdout: drawn once (or, with --replay, read and checked).
const holdoutPath = join(out, 'holdout.json');
let holdout;
if (replay) {
  holdout = JSON.parse(readFileSync(holdoutPath, 'utf8'));
  const again = drawHoldout(holdout.id);
  if (again.positionsSha256 !== holdout.positionsSha256) throw new Error('C6: the holdout file is not the one the rule draws');
} else {
  if (existsSync(holdoutPath)) throw new Error('the holdout was drawn already: use --replay');
  holdout = { ...drawHoldout(holdoutId), drawnAt: new Date().toISOString(), siteCommit: freeze.site.commit, generatorSha256: fileSha(join(HERE, 'holdout.mjs')) };
  writeFileSync(holdoutPath, `${JSON.stringify(holdout, null, 1)}\n`);
}
const holdoutRows = await api.positions(holdout.positions.map((p) => p.utc), [...BODIES, 'North Node']);
// jdTt rounded to the 1e-8 day a Horizons TLIST carries; jdUt the UTC day decompose.py reads the EOP offsets at.
const holdoutCases = holdoutRows.map((row, i) => ({ id: `h${i}`, jdTt: Number(ttJd(row).toFixed(8)), jdUt: 2440587.5 + Date.parse(row.instant) / 86_400_000 }));
const casesPath = join(out, 'holdout-cases.json');
writeFileSync(casesPath, `${JSON.stringify({ cases: holdoutCases }, null, 1)}\n`);
const responses = join(out, 'holdout-horizons');
if (!replay) {
  if (existsSync(responses)) throw new Error('Horizons responses exist already: use --replay');
  python('horizons_holdout.py', ['fetch', casesPath, responses]);
}
/** Each kept response and the EOP2 file against the digest its fetch logged (C6's refusal of a changed input). */
function changedInputs(dir) {
  const logged = readFileSync(join(dir, 'queries.log'), 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((entry) => entry.file && entry.sha256);
  return logged.filter((entry) => !existsSync(join(dir, entry.file)) || fileSha(join(dir, entry.file)) !== entry.sha256).map((entry) => entry.file);
}
if (replay && changedInputs(responses).length) throw new Error(`C6: changed inputs ${changedInputs(responses).join(', ')}`);
const carriedPath = join(out, 'holdout-carried.json');
python('horizons_holdout.py', ['carry', casesPath, responses, carriedPath]);
const carried = JSON.parse(readFileSync(carriedPath, 'utf8'));
const carriedBy = new Map(carried.rows.map((row) => [`${row.id}/${row.body}`, row]));
// Within 0.5 degree of the Sun's centre (great circle, Horizons's own directions): reported, not scored.
const near = (i, body) => body !== 'Sun' && body !== 'Moon' && carriedBy.get(`h${i}/${body}`).sunSeparationDeg <= 0.5;
const holdoutSwissCalls = [];
holdoutRows.forEach((row, i) => {
  for (const body of BODIES) {
    holdoutSwissCalls.push({ id: `jpl/${i}/${body}`, mode: 'jpl', jdTt: ttJd(row), body });
    holdoutSwissCalls.push({ id: `se1-h/${i}/${body}`, mode: 'se1', jdTt: holdoutCases[i].jdTt, body });
  }
  holdoutSwissCalls.push({ id: `jpl/${i}/TrueNode`, mode: 'jpl', jdTt: ttJd(row), body: 'TrueNode' });
  holdoutSwissCalls.push({ id: `se1/${i}/TrueNode`, mode: 'se1', jdTt: ttJd(row), body: 'TrueNode' });
});
const swissHoldout = swiss(holdoutSwissCalls, 'holdout');
const scoredRows = (refOf) => holdoutRows.flatMap((row, i) => BODIES.filter((body) => !near(i, body)).map((body) => ({ id: `h${i}`, body, ours: bodyOf(row, body), ref: refOf(i, body) })));
const leftOut = holdoutRows.flatMap((_, i) => BODIES.filter((body) => near(i, body)).map((body) => `h${i}/${body}`));
// The frame model's own check: Swiss (.se1) against the carried Horizons rows.
const frameCheck = holdoutRows.flatMap((_, i) => BODIES.filter((body) => !near(i, body)).map((body) => {
  const s = swissRef(swissHoldout, `se1-h/${i}/${body}`);
  return s.instrument ? NaN : Math.abs(wrap(s.lon, carriedBy.get(`h${i}/${body}`).carried.lon) * ARCSEC);
}));
const frameHolds = frameCheck.every((d) => Number.isFinite(d) && d <= 0.05);
const holdoutI = ruleI({ label: 'holdout against Horizons carried by eopJpl into IAU 2006/2000A', ours: scoredRows((i, body) => carriedBy.get(`h${i}/${body}`).carried), parity: false });
const rawI = ruleI({ label: 'holdout against raw QUANTITIES=31 (reported)', ours: scoredRows((i, body) => carriedBy.get(`h${i}/${body}`).raw), parity: false });
results.rules.i.holdout = frameHolds ? holdoutI : { ...holdoutI, verdict: 'NOT RUN', why: 'Swiss (.se1) differs from the carried Horizons rows by more than 0.05" on some row' };
results.rules.i.holdout.frameCheck = { swissVsCarriedMaxArcsec: max(frameCheck.filter(Number.isFinite)), holds: frameHolds };
results.rules.i.holdout.leftOutNearTheSun = leftOut;
results.reported.iHoldoutRaw = rawI;
results.rules.ii.holdout = ruleII({ label: 'holdout against Swiss on linux_p1550p2650.440', ours: scoredRows((i, body) => swissRef(swissHoldout, `jpl/${i}/${body}`)) });
results.rules.v.holdout = ruleV({ label: '200 holdout instants against Swiss TRUE_NODE on the DE440 binary', ours: holdoutRows.map((row, i) => ({ id: `h${i}`, body: 'North Node', ours: bodyOf(row, 'North Node'), ref: swissRef(swissHoldout, `jpl/${i}/TrueNode`) })) });
const pooled = [...nodeRowsCorpus, ...holdoutRows.map((row, i) => ({ id: `h${i}`, body: 'North Node', ours: bodyOf(row, 'North Node'), ref: swissRef(swissHoldout, `jpl/${i}/TrueNode`) }))];
results.reported.vPooled = ruleV({ label: 'pooled 241, reported only', ours: pooled });
results.reported.vSe1 = ruleV({ label: 'Swiss TRUE_NODE on the .se1 files, corpus and holdout, reported beside', ours: [
  ...pinned.map((p, i) => ({ id: p.id, body: 'North Node', ours: ours(corpusRows, i, 'North Node'), ref: swissRef(swissCorpus, `se1/${i}/TrueNode`) })),
  ...holdoutRows.map((row, i) => ({ id: `h${i}`, body: 'North Node', ours: bodyOf(row, 'North Node'), ref: swissRef(swissHoldout, `se1/${i}/TrueNode`) })),
] });

// Rule (vi), rule (vii) and rule (viii).
const vi = spawnSync(process.execPath, [join(HERE, 'cross-runtime/run.mjs'), '--pack', arg('pack'), '--node22', process.execPath, '--node24', arg('node24'), '--scratch', join(scratch, 'vi')], { encoding: 'utf8', maxBuffer: 1 << 26, cwd: ROOT });
results.rules.vi = vi.status === 0 ? JSON.parse(vi.stdout) : { verdict: 'NOT RUN', why: vi.stderr.slice(-400) };
results.rules.vii = { verdict: 'RECORDED SEPARATELY', why: 'CI on each pull request head and each main merge commit, read from GitHub after the merges (the production record)' };
const portReport = join(scratch, 'engine-kernel-report.json');
const port = spawnSync('npx', ['vitest', 'run', 'src/de440-kernel.test.ts'], { cwd: arg('engine'), encoding: 'utf8', env: { ...process.env, PRECISION_KERNEL: arg('kernel'), DE440_KERNEL_REPORT: portReport, GIT_NO_LAZY_FETCH: '1' } });
const portMeasured = existsSync(portReport) ? JSON.parse(readFileSync(portReport, 'utf8')) : null;
const alpha = viiiAlpha(arg('kernel'));
results.rules.viii = {
  port: { engineCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: arg('engine'), encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).stdout.trim(), testsExit: port.status, ...(portMeasured?.viii ?? {}) },
  alpha,
  verdict: port.status === 0 && portMeasured?.viii?.over === 0 && alpha.verdict === 'PASS' ? 'PASS' : 'FAIL',
};
results.checks.C4 = portMeasured ? { node: portMeasured.c4, control: portMeasured.c4Control, verdict: port.status === 0 && portMeasured.c4?.maxArcsec <= 1e-6 && portMeasured.c4Control?.failsTheGate ? 'PASS' : 'FAIL' } : { verdict: 'FAIL', why: 'no report' };

// The other checks.
Object.assign(results.checks, await checks.all({ ROOT, UNIT, api, arg, scratch, pinned, corpusRows, results }));

// Verdict.
const ruleVerdicts = [results.rules.i.corpus.verdict, results.rules.i.holdout.verdict, results.rules.ii.corpus.verdict, results.rules.ii.holdout.verdict, results.rules.iii.verdict, results.rules.iv.verdict, results.rules.v.corpus.verdict, results.rules.v.holdout.verdict, results.rules.vi.verdict, results.rules.viii.verdict];
const checkVerdicts = Object.values(results.checks).map((c) => c.verdict);
results.verdict = [...ruleVerdicts, ...checkVerdicts].includes('FAIL') ? 'FAIL' : [...ruleVerdicts, ...checkVerdicts].includes('NOT RUN') ? 'NOT RUN (partial)' : 'PASS, (vii) to be recorded';
results.requests = api.requests;
if (replay) {
  // C6: the same results from the committed inputs; and a changed input is refused.
  const first = JSON.parse(readFileSync(join(out, 'results.json'), 'utf8'));
  const comparable = (r) => JSON.stringify({ ...r, checks: { ...r.checks, C6: null }, verdict: null, freeze: { ...r.freeze, site: null } });
  const copy = join(scratch, 'c6-control');
  mkdirSync(copy, { recursive: true });
  for (const name of readdirSync(responses)) copyFileSync(join(responses, name), join(copy, name));
  const victim = readdirSync(copy).find((name) => name.endsWith('.txt'));
  writeFileSync(join(copy, victim), `${readFileSync(join(copy, victim), 'utf8')} `);
  const refused = changedInputs(copy).includes(victim);
  results.checks.C6 = { reproduced: comparable(first) === comparable(results), control: { changedInputRefused: refused }, verdict: comparable(first) === comparable(results) && refused ? 'PASS' : 'FAIL' };
  writeFileSync(join(out, 'results-replay.json'), `${JSON.stringify(results, null, 1)}\n`);
  say(`C6: ${results.checks.C6.verdict}`);
} else {
  say(`verdict: ${results.verdict}`);
  writeFileSync(join(out, 'results.json'), `${JSON.stringify(results, null, 1)}\n`);
  writeFileSync(join(out, 'run.log'), `${log.join('\n')}\n`);
}
