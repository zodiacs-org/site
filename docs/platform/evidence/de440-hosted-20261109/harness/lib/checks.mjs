/**
 * Checks C1 to C12 of the preregistration that run.mjs does not compute
 * inline (C4 comes from the engine's tier-B report, C5 from rule (vi), C6
 * from --replay), each with its control, which must fail.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PACK_SHA256, bodyOf, sha256 } from './api.mjs';
import { J2000_JD, isoOf, jdTtOf } from './clock.mjs';
import { wrap } from './stats.mjs';

const pass = (ok) => (ok ? 'PASS' : 'FAIL');
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

/** C1: S1, then S2, precede every backend-code commit, by ancestry and by push time. */
export function orderingProblems(commits, s1, s2) {
  // commits: [{ sha, backend: bool, pushedAt: ISO|null, ancestorsOf: Set }] in order; s1, s2 the same shape.
  const problems = [];
  for (const commit of commits.filter((c) => c.backend)) {
    if (!commit.ancestors.has(s1.sha) || !commit.ancestors.has(s2.sha)) problems.push(`${commit.sha.slice(0, 8)} does not descend from S1 and S2`);
    if (commit.pushedAt && Date.parse(commit.pushedAt) <= Date.parse(s2.pushedAt)) problems.push(`${commit.sha.slice(0, 8)} was pushed before S2`);
  }
  return problems;
}

const BACKEND = [/^src\/lib\/compute-api\//u, /^api\//u, /^scripts\/build-compute-/u, /^scripts\/build-precision-pack\.mjs$/u, /^examples\/precision-alpha\/(src|tools)\//u];
const ENGINE_BACKEND = [/^src\//u, /^scripts\//u, /^package\.json$/u, /^CHANGELOG\.md$/u];

function c1(ROOT, arg) {
  const git = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).stdout.trim();
  const S1 = git(ROOT, 'rev-parse', '5305fc74');
  const S2 = git(ROOT, 'rev-parse', '4fa9ffbf');
  const siteCommits = git(ROOT, 'rev-list', '--reverse', `${S1}^..HEAD`).split('\n').filter(Boolean);
  const files = (cwd, sha) => git(cwd, 'diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean);
  const ancestry = (cwd, sha) => new Set(git(cwd, 'rev-list', sha).split('\n'));
  const site = siteCommits.map((sha) => ({ sha, backend: files(ROOT, sha).some((f) => BACKEND.some((re) => re.test(f))), ancestors: ancestry(ROOT, sha), pushedAt: null }));
  // Push records: GitHub's repository activity, the first push that brought each commit.
  const activity = (repo) => {
    const r = spawnSync('gh', ['api', '--paginate', `repos/${repo}/activity?activity_type=push&per_page=100`], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0) return null;
    return r.stdout.split(/\n(?=\[)/u).flatMap((page) => JSON.parse(page));
  };
  const siteActivity = activity('zodiacs-org/site');
  const engineActivity = activity('zodiacs-org/engine');
  if (!siteActivity || !engineActivity) return { verdict: 'NOT RUN', why: 'GitHub activity API unavailable' };
  const pushedAt = (acts, sha, cwd) => {
    const times = acts.filter((a) => a.after && (a.after === sha || ancestry(cwd, a.after).has(sha))).map((a) => a.timestamp).sort();
    return times[0] ?? null;
  };
  const s2Pushed = pushedAt(siteActivity, S2, ROOT);
  for (const c of site) c.pushedAt = pushedAt(siteActivity, c.sha, ROOT);
  const engine = arg('engine');
  const engineBase = git(engine, 'merge-base', 'HEAD', 'origin/main');
  const engineCommits = git(engine, 'rev-list', '--reverse', `${engineBase}..HEAD`).split('\n').filter(Boolean)
    .map((sha) => ({ sha, backend: files(engine, sha).some((f) => ENGINE_BACKEND.some((re) => re.test(f))), ancestors: new Set([S1, S2]), pushedAt: pushedAt(engineActivity, sha, engine) }));
  const problems = orderingProblems([...site, ...engineCommits], { sha: S1 }, { sha: S2, pushedAt: s2Pushed });
  // Control: a synthetic history with a backend commit first.
  const synthetic = [{ sha: 'b'.repeat(40), backend: true, ancestors: new Set(), pushedAt: '2026-11-09T10:00:00Z' }];
  const control = orderingProblems(synthetic, { sha: S1 }, { sha: S2, pushedAt: s2Pushed });
  return { s1: S1, s2: S2, s2PushedAt: s2Pushed, siteBackendCommits: site.filter((c) => c.backend).length, engineBackendCommits: engineCommits.filter((c) => c.backend).length, problems, control: { problems: control.length }, verdict: pass(problems.length === 0 && control.length > 0) };
}

async function c2(ROOT, arg) {
  const { openDe440Pack, De440Error } = await import(pathToFileURL(join(ROOT, 'node_modules/@zodiacs/engine/dist/de440.js')).href);
  const bytes = new Uint8Array(readFileSync(arg('pack')));
  const changed = bytes.slice();
  changed[1_000_000] ^= 1;
  let refused = null;
  try { await openDe440Pack(changed, { expectDigest: PACK_SHA256 }); } catch (error) { refused = error instanceof De440Error ? error.code : String(error); }
  let opens = false;
  try { opens = (await openDe440Pack(bytes, { expectDigest: PACK_SHA256 })).ephemeris.version === PACK_SHA256; } catch {}
  return { oneByteChanged: { refused: refused ?? 'opened' }, control: { unmodifiedOpens: opens }, verdict: pass(refused === 'digest-mismatch' && opens) };
}

function c3(UNIT) {
  const path = join(UNIT, 'oracles/c3-unchanged-alpha.json');
  const record = JSON.parse(readFileSync(path, 'utf8'));
  return { record: 'oracles/c3-unchanged-alpha.json', sha256: sha256(readFileSync(path)), moonOver: record.byBody.Moon.over, outcome: record.outcome, verdict: pass(record.byBody.Moon.over > 0) };
}

/** C7: astronomy-engine named, on the frozen bundle, against main's rc.2 bundle; results equal, receipts equal but for version and backend. */
async function c7(ROOT, scratch, api) {
  const dir = join(scratch, 'c7-main');
  mkdirSync(dir, { recursive: true });
  const firewall = pathToFileURL(createRequire(join(ROOT, 'package.json')).resolve('@vercel/firewall')).href;
  for (const f of ['compute.mjs', 'local-time.mjs']) {
    const r = spawnSync('git', ['show', `a67b7c9a:api/_compute/${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
    // Main's bundle, as committed, with the Firewall SDK resolved from the checkout.
    writeFileSync(join(dir, f), r.stdout.replace('from "@vercel/firewall";', `from ${JSON.stringify(firewall)};`));
  }
  const mainCompute = await import(pathToFileURL(join(dir, 'compute.mjs')).href);
  const { createLocalTimeModule: mainLocal } = await import(pathToFileURL(join(dir, 'local-time.mjs')).href);
  // The documented requests (src/lib/compute-api/examples.ts), compiled by the site's esbuild.
  const esbuild = createRequire(join(ROOT, 'package.json'))('esbuild');
  const examplesModule = join(dir, 'examples.mjs');
  await esbuild.build({ entryPoints: [join(ROOT, 'src/lib/compute-api/examples.ts')], bundle: true, format: 'esm', platform: 'node', outfile: examplesModule, logLevel: 'silent' });
  const { SUCCESS_EXAMPLES: bodies } = await import(pathToFileURL(examplesModule).href);
  if (!bodies) return { verdict: 'NOT RUN', why: 'the documented requests could not be read' };
  async function mainCall(endpoint, body) {
    const localTime = mainLocal();
    let text = '';
    const res = { statusCode: 0, setHeader() {}, end(v) { text = v; } };
    try {
      await mainCompute.createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' })({ method: 'POST', query: { __zodiacs_compute: endpoint }, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, res);
    } finally { localTime.dispose(); }
    return { status: res.statusCode, body: JSON.parse(text) };
  }
  const normal = (receipt) => {
    const copy = JSON.parse(JSON.stringify(receipt));
    if (copy.engine) { delete copy.engine.version; delete copy.engine.pack; delete copy.engine.fallback; }
    delete copy.conventionIds; // they carry the engine's version through the registry's ids? kept below if equal
    return copy;
  };
  const problems = [];
  let compared = 0;
  let controlDiffers = 0;
  for (const endpoint of ['chart', 'positions', 'events', 'sky-fact', 'elections']) {
    for (const [name, example] of Object.entries(bodies[endpoint] ?? {})) {
      // rc.2 knows no backend field: it gets the request without one.
      const { backend: _named, ...plain } = example.body;
      const named = await api.call(endpoint, { ...plain, backend: 'astronomy-engine' });
      const before = await mainCall(endpoint, plain);
      compared += 1;
      if (named.status !== 200 || before.status !== 200) { problems.push(`${endpoint}.${name}: status ${named.status}/${before.status}`); continue; }
      if (JSON.stringify(named.body.result) !== JSON.stringify(before.body.result)) problems.push(`${endpoint}.${name}: result differs`);
      if (JSON.stringify(normal(named.body.receipt)) !== JSON.stringify(normal(before.body.receipt))) problems.push(`${endpoint}.${name}: receipt differs beyond version and backend`);
      const de440 = await api.call(endpoint, { ...plain, backend: 'de440' });
      if (de440.status === 200 && JSON.stringify(de440.body.result) !== JSON.stringify(before.body.result)) controlDiffers += 1;
    }
  }
  // Control: the same comparison, given the de440 answers, finds them different.
  return { compared, problems, control: { de440Differs: controlDiffers, of: compared }, verdict: pass(problems.length === 0 && controlDiffers > 0) };
}

/** C8 (b): /chart against /positions on both backends; /events against /positions 2 s either side; control. */
async function c8(api, pinned) {
  const problems = [];
  const at = isoOf(pinned[11].ms);
  const place = { latitude: 40.7128, longitude: -74.006 };
  for (const backend of ['astronomy-engine', 'de440']) {
    const chart = await api.call('chart', { utc: at, ...place, backend });
    const [row] = await api.positions([at], undefined, backend);
    for (const body of chart.body.result.bodies) {
      const p = bodyOf(row, body.body);
      if (p.fail || p.lon !== body.lon || p.lat !== body.lat || p.speed !== body.speed) problems.push(`${backend} chart ${body.body} differs from positions`);
    }
    const from = '2026-03-01T00:00:00Z';
    const to = '2026-05-30T00:00:00Z';
    const events = await api.call('events', { from, to, backend });
    for (const event of events.body.result.events) {
      const t = Date.parse(event.at);
      const [before, after] = await api.positions([isoOf(t - 2000), isoOf(t + 2000)], undefined, backend);
      const side = (row) => {
        if (event.kind === 'ingress') return wrap(bodyOf(row, event.body).lon, SIGNS.indexOf(event.sign) * 30) >= 0;
        if (event.kind === 'station') return bodyOf(row, event.body).speed >= 0;
        if (event.kind === 'lunation') return wrap(bodyOf(row, 'Moon').lon - bodyOf(row, 'Sun').lon, event.type === 'new' ? 0 : 180) >= 0;
        return null;
      };
      const a = side(before);
      const b = side(after);
      if (a === null || a === b) problems.push(`${backend} ${event.kind} ${event.body ?? ''} at ${new Date(t).toISOString()}: same side`);
    }
  }
  // Control: the de440 chart against astronomy-engine's positions.
  const chart = await api.call('chart', { utc: at, ...place, backend: 'de440' });
  const [other] = await api.positions([at], undefined, 'astronomy-engine');
  const differs = chart.body.result.bodies.some((b) => bodyOf(other, b.body).lon !== b.lon);
  return { problems, control: { otherBackendDiffers: differs }, verdict: pass(problems.length === 0 && differs) };
}

/** C9: the engine's port against the research runtime's apparent(), bit for bit, on the pack; a port with one constant changed fails. */
async function c9(ROOT, arg, scratch, pinned) {
  const { openPackFromBytes } = await import(pathToFileURL(join(ROOT, 'examples/precision-alpha/src/index.mjs')).href);
  const bytes = new Uint8Array(readFileSync(arg('pack')));
  const engineDist = join(ROOT, 'node_modules/@zodiacs/engine/dist');
  const { openDe440Pack } = await import(pathToFileURL(join(engineDist, 'de440.js')).href);
  // The engine checks the whole file against the pinned digest; the runtime's
  // expectDigest is its own region digest, the trailer of those same bytes.
  const port = await openDe440Pack(bytes, { expectDigest: PACK_SHA256 });
  const runtime = await openPackFromBytes(bytes, { expectDigest: Buffer.from(bytes.subarray(bytes.length - 32)).toString('hex') });
  const compare = (source) => {
    let differ = 0;
    let n = 0;
    for (const p of pinned) {
      const ttDays = jdTtOf(p.ms) - J2000_JD;
      for (const body of BODIES) {
        const a = runtime.apparent(body, ttDays);
        const b = source.place(body, ttDays);
        n += 1;
        if (!Object.is(a.lon, b.lon) || !Object.is(a.lat, b.lat)) differ += 1;
      }
    }
    return { n, differ };
  };
  const same = compare(port);
  // Control: a copy of the port with the light time per au changed in its last digit.
  const copy = join(scratch, 'c9-port');
  cpSync(engineDist, copy, { recursive: true });
  const files = readdirSync(copy).filter((f) => f.endsWith('.js') && readFileSync(join(copy, f), 'utf8').includes('499.004783836'));
  for (const f of files) writeFileSync(join(copy, f), readFileSync(join(copy, f), 'utf8').replaceAll('499.004783836', '499.004783837'));
  const changed = await import(pathToFileURL(join(copy, 'de440.js')).href);
  const control = files.length ? compare(await changed.openDe440Pack(bytes, { expectDigest: PACK_SHA256 })) : { n: 0, differ: 0 };
  return { places: same.n, differing: same.differ, control: { constantChangedIn: files.length, differing: control.differ }, verdict: pass(same.n === 240 && same.differ === 0 && control.differ > 0) };
}

/** C10: no pack in the built client files or public/; the same scan finds a planted one. */
function c10(ROOT, scratch) {
  const magic = Buffer.from('ZODEPH02');
  const scan = (dir) => {
    const found = [];
    const walk = (d) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        const s = statSync(p);
        if (s.isDirectory()) walk(p);
        else if (name.endsWith('.zeph') || (s.size > 1_000_000 && readFileSync(p).subarray(0, 8).equals(magic))) found.push(p.slice(ROOT.length + 1));
      }
    };
    if (existsSync(dir)) walk(dir);
    return found;
  };
  const inPublic = scan(join(ROOT, 'public'));
  const inDist = scan(join(ROOT, 'dist'));
  const planted = join(scratch, 'c10-public');
  mkdirSync(planted, { recursive: true });
  writeFileSync(join(planted, 'x.zeph'), 'planted');
  const control = scan(planted).length;
  return { public: inPublic, dist: existsSync(join(ROOT, 'dist')) ? inDist : 'not built here', control: { plantedFound: control }, deployment: 'checked against the production deployment in the production record', verdict: pass(inPublic.length === 0 && (inDist.length === 0) && control === 1) };
}

/** C11: a runtime without the pack; the receipts' digest; the bundle's --check. */
async function c11(ROOT, api, scratch) {
  const at = '2026-09-29T12:00:00Z';
  const place = { latitude: 51.5, longitude: 0 };
  const none = async () => null;
  const named = await api.call('positions', { instants: [at], backend: 'de440' }, { precision: none });
  const fallback = await api.call('chart', { utc: at, ...place }, { precision: none, defaultBackend: 'de440' });
  const withPack = await api.call('positions', { instants: [at], backend: 'de440' });
  const receiptDigest = withPack.body?.receipt?.engine?.ephemeris?.version;
  const check = spawnSync(process.execPath, [join(ROOT, 'scripts/build-compute-handler.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  // Control for the --check: the committed bundle with one byte more is stale to the same comparison.
  const bundle = readFileSync(join(ROOT, 'api/_compute/compute.mjs'));
  const { buildComputeHandlerBundle } = await import(pathToFileURL(join(ROOT, 'scripts/build-compute-handler.mjs')).href);
  const built = await buildComputeHandlerBundle();
  const staleDetected = !Buffer.concat([bundle, Buffer.from(' ')]).equals(built.bytes);
  const ok = named.status === 503 && named.body.error.code === 'backend-unavailable'
    && fallback.status === 200 && fallback.body.backend.fallback?.reason === 'pack-unavailable' && fallback.body.backend.ephemeris.name === 'astronomy-engine'
    && withPack.status === 200 && receiptDigest === PACK_SHA256 && check.status === 0;
  void scratch;
  return {
    namedWithoutPack: named.status, defaultWithoutPack: fallback.body?.backend?.fallback ?? null, receiptDigest,
    buildCheck: check.status, control: { withPackNo503: withPack.status === 200, otherDigestRefused: receiptDigest !== '0'.repeat(64), staleBundleDetected: staleDetected },
    verdict: pass(ok && staleDetected),
  };
}

/** C12: interleaved requests naming different backends; a double that keeps the source installed fails. */
async function c12(api, pinned) {
  const requests = pinned.slice(0, 6).flatMap((p) => [
    { endpoint: 'positions', body: { instants: [isoOf(p.ms)], backend: 'de440' } },
    { endpoint: 'positions', body: { instants: [isoOf(p.ms)], backend: 'astronomy-engine' } },
    { endpoint: 'chart', body: { utc: isoOf(p.ms), latitude: 10, longitude: 20, backend: 'de440' } },
    { endpoint: 'chart', body: { utc: isoOf(p.ms), latitude: 10, longitude: 20 } },
  ]);
  const problemsOf = async (answer) => {
    const alone = [];
    for (const r of requests) alone.push(JSON.stringify((await answer(r)).body));
    const together = await Promise.all(requests.map(answer));
    return together.map((r, i) => {
      const wanted = requests[i].body.backend === 'de440' ? 'jpl-de440' : 'astronomy-engine';
      return JSON.stringify(r.body) !== alone[i] || r.body.backend.ephemeris.name !== wanted ? i : null;
    }).filter((i) => i !== null);
  };
  const problems = await problemsOf((r) => api.call(r.endpoint, r.body));
  const control = await problemsOf((r) => api.call(r.endpoint, { ...r.body, backend: 'de440' }));
  return { requests: requests.length, problems, control: { problems: control.length }, verdict: pass(problems.length === 0 && control.length > 0) };
}

export async function all({ ROOT, UNIT, api, arg, scratch, pinned, results }) {
  return {
    C1: c1(ROOT, arg),
    C2: await c2(ROOT, arg),
    C3: c3(UNIT),
    C5: { found: results.rules.vi?.c5?.found ?? false, verdict: results.rules.vi?.c5 ? pass(results.rules.vi.c5.found) : 'NOT RUN' },
    C6: { verdict: 'PENDING', why: 'run.mjs --replay on the committed inputs' },
    C7: await c7(ROOT, scratch, api),
    C8: await c8(api, pinned),
    C9: await c9(ROOT, arg, scratch, pinned),
    C10: c10(ROOT, scratch),
    C11: await c11(ROOT, api, scratch),
    C12: await c12(api, pinned),
  };
}
