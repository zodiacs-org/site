// What a site serves for R44's gate, "receipts and conformance vectors use its ids", against the registry, the documented
// answers and the conformance summary a merge commit holds. Shaped like ../../conventions-registry-20261018/tools/conventions-check.mjs.
// Run from a clone of zodiacs-org/site whose working tree is <merge>, with its dependencies installed (the engine it vendors):
//   node ids-check.mjs <alias.json|-> <40-hex merge> <out.json> [base URL | local]
// alias.json holds what Vercel reported for the zodiacs.org alias and its deployment just before: deploymentId, aliasUpdatedAt,
// readyState, target, githubCommitSha; nothing else is read from it. With an alias file the first check passes only when that
// deployment is READY in production and built from a commit that contains <merge>. Then:
// - registry.json is the merge's registry, with every id's address, and holds the ids the merge added;
// - /api/v1/openapi.json documents conventionIds on both receipts, and its request examples are the ones sent here;
// - the documented chart (utc, local) and houses (koch) requests and one synthetic polar chart: each receipt's conventionIds are
//   natalConventionIds of the receipt and its result, and the documented answer's (examples.json); every id is registered;
//   cite.receipt is the SHA-256 of the receipt's RFC 8785 canonical JSON;
// - the same for the positions, events, time (pinned, gap), sky-fact (phase, aspect) and elections (london) examples, whose
//   compute receipts list the ids their own fields name, by the site's rule (src/lib/compute-api/receipt.ts, computeConventionIds);
// - the hosted /mcp advertises conventionIds in check_sky_fact's output schema, and its receipt for the phase example is the
//   compute API's;
// - every id in the registry's "Coverage statements" and "Compute API receipts" groups, and the ephemeris id, is named at least once;
// - the conformance page's Dataset is the summary's suite with three vectors/<suite>/ files; each file's SHA-256 is the summary's
//   and the registry's; every vector lists its kind and arbiter ids, sorted and registered.
// Only ids, statuses, counts and digests are recorded. Each run sends 11 POSTs to the compute API, spaced out for the Firewall's
// rate rules, and four requests to /mcp, one of them a tool call.
// With "local" in place of the base URL, the eleven requests go to the merge's bundled handler (api/_compute/compute.mjs) in this
// process, and the checks of served documents, the MCP and the Dataset are not run.
// Controls, which must fail exactly the checks that read what they change: IDS_CHECK_CONTROL=dropped-id expects the registry
// without the natal receipts' conventionIds id; IDS_CHECK_CONTROL=suite-0.1.0 expects conformance suite 0.1.0.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [aliasPath, merge, out, target = 'https://zodiacs.org'] = process.argv.slice(2);
if (!aliasPath || !/^[0-9a-f]{40}$/u.test(merge ?? '') || !out) {
  throw new Error('usage: ids-check.mjs <alias.json|-> <40-hex merge> <out.json> [base URL | local]');
}
const local = target === 'local';
const base = local ? null : target;
const UA = { 'User-Agent': 'zodiacs-programme-check' };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const atMerge = (path) => git('show', `${merge}:${path}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` · ${JSON.stringify(detail).slice(0, 600)}`}`);
};
async function get(url) {
  try {
    const response = await fetch(url, { redirect: 'manual', cache: 'no-store', headers: UA, signal: AbortSignal.timeout(60000) });
    return { status: response.status, type: response.headers.get('content-type'), bytes: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    return { status: 0, type: null, bytes: Buffer.alloc(0), error: String(error) };
  }
}
const parse = (bytes) => { try { return JSON.parse(bytes.toString('utf8')); } catch { return null; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Code-unit order, each once: what "sorted-unique" says. */
const sortedUnique = (ids) => Array.isArray(ids) && ids.every((id, i) => typeof id === 'string' && (i === 0 || ids[i - 1] < id));

// RFC 8785 canonical JSON, as src/lib/receipt-digest.ts writes it: keys in code-unit order, numbers and strings as JSON.stringify.
function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}
const digest = (receipt) => `sha256:${sha256(Buffer.from(canonicalJson(receipt), 'utf8'))}`;

// The engine the merge vendors, from the dependencies of the clone this file is in. The package exports no package.json, so its
// version is read from the file beside the entry's directory.
const { conventionId, natalConventionIds } = await import('@zodiacs/engine/conventions');
const { EPHEMERIS } = await import('@zodiacs/engine');
const engineVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.resolve('@zodiacs/engine')), 'utf8')).version;

// The site's rule for compute receipts: src/lib/compute-api/receipt.ts, computeConventionIds, at the merge.
function computeIds(receipt) {
  const ids = new Set();
  for (const fields of [receipt.conventions, receipt.coverage]) for (const [key, value] of Object.entries(fields)) ids.add(conventionId(key, value));
  ids.add(conventionId('ephemeris', `${receipt.engine.ephemeris.name}@${receipt.engine.ephemeris.version}`));
  ids.add(conventionId('endpoint', receipt.endpoint));
  for (const source of receipt.deltaT) ids.add(conventionId('deltat-model', source.model));
  if (receipt.timeResolution) {
    ids.add(conventionId('fold-policy', receipt.timeResolution.policy.fold));
    ids.add(conventionId('gap-policy', receipt.timeResolution.policy.gap));
  }
  for (const search of [receipt.search, receipt.electionSearch]) {
    if (!search) continue;
    ids.add(conventionId('search-solver', search.solver));
    ids.add(conventionId('search-window', search.window));
    ids.add(conventionId('completeness', search.completeness));
  }
  if (receipt.electionSearch) {
    ids.add(conventionId('void-of-course', receipt.electionSearch.voidOfCourse.convention));
    ids.add(conventionId('void-of-course-bodies', receipt.electionSearch.voidOfCourse.bodies));
  }
  return [...ids].sort();
}

const registry = JSON.parse(atMerge('src/data/conventions/registry.json'));
const examples = JSON.parse(atMerge('src/lib/compute-api/examples.json'));
const summary = JSON.parse(atMerge('src/data/conformance/summary.json'));
const parent = git('rev-parse', `${merge}^1`).trim();
const previous = JSON.parse(git('show', `${parent}:src/data/conventions/registry.json`));
const control = process.env.IDS_CHECK_CONTROL ?? null;
let suite = summary.suiteVersion;
const natalSetId = registry.namespaces.find((space) => space.name === 'conventionIds').entries[0].id;
if (control === 'dropped-id') {
  for (const space of registry.namespaces) space.entries = space.entries.filter((entry) => entry.id !== natalSetId);
} else if (control === 'suite-0.1.0') {
  suite = '0.1.0';
} else if (control !== null) {
  throw new Error(`Unknown control ${control}`);
}
const ids = registry.namespaces.flatMap((space) => space.entries.map((entry) => entry.id));
const registered = new Set(ids);
const previousIds = new Set(previous.namespaces.flatMap((space) => space.entries.map((entry) => entry.id)));
const added = ids.filter((id) => !previousIds.has(id));
const address = (id) => `${registry.base}#${encodeURI(id)}`;

let deployment = null;
if (aliasPath !== '-') {
  const raw = JSON.parse(await readFile(aliasPath, 'utf8'));
  deployment = Object.fromEntries(['deploymentId', 'aliasUpdatedAt', 'readyState', 'target', 'githubCommitSha'].map((key) => [key, raw[key]]));
  let containsMerge = false;
  try {
    git('merge-base', '--is-ancestor', merge, deployment.githubCommitSha);
    containsMerge = true;
  } catch {}
  check('the zodiacs.org alias names a READY production deployment built from a commit that contains the merge',
    deployment.readyState === 'READY' && deployment.target === 'production' && containsMerge, { containsMerge });
}
check(`this clone's engine is the one the registry names (${registry.engine.version})`, engineVersion === registry.engine.version, { engineVersion });

// The documented requests (src/lib/compute-api/examples.ts at the merge), and one synthetic polar chart: an instant and a place
// in Svalbard, no person's data, where Placidus has no cusps and the engine falls back, naming flag:polar-fallback.
const REQUESTS = [
  ['chart', 'utc', { utc: '2000-01-01T12:00:00Z', latitude: 51.4779, longitude: -0.0015, houseSystem: 'placidus' }],
  ['chart', 'local', { local: { date: '1990-06-15', time: '14:30', zone: 'Europe/Paris' }, latitude: 48.8566, longitude: 2.3522, houseSystem: 'whole' }],
  ['houses', 'koch', { utc: '2026-06-21T12:00:00Z', latitude: -33.8688, longitude: 151.2093, houseSystem: 'koch' }],
  ['chart', 'polar', { utc: '2026-12-21T12:00:00Z', latitude: 78.2232, longitude: 15.6267, houseSystem: 'placidus' }],
  ['positions', 'two', { instants: ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'], bodies: ['Sun', 'Moon', 'Mercury'] }],
  ['events', 'october', { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', bodies: ['Sun', 'Mercury', 'Venus'], kinds: ['ingress', 'station', 'lunation'] }],
  ['time', 'pinned', { local: { date: '1947-07-01', time: '12:00', zone: 'Europe/Stockholm' }, longitude: 18.07 }],
  ['time', 'gap', { local: { date: '2026-03-29', time: '02:30', zone: 'Europe/Paris' } }],
  ['sky-fact', 'phase', { kind: 'phase', phase: 'full', date: '2026-10-26' }],
  ['sky-fact', 'aspect', { kind: 'aspect', body: 'Moon', other: 'Saturn', aspect: 'trine', date: '2026-10-14', zone: 'Europe/London' }],
  ['elections', 'london', {
    from: '2026-12-09T00:00:00Z',
    to: '2026-12-12T00:00:00Z',
    conditions: [
      { kind: 'phase', phase: 'waxing' },
      { kind: 'void-of-course', not: true },
      { kind: 'retrograde', body: 'Mercury', not: true },
      { kind: 'angular', body: 'Jupiter' },
    ],
    place: { latitude: 51.5072, longitude: -0.1276, houseSystem: 'placidus' },
  }],
];
const NATAL = new Set(['chart', 'houses']);

let send;
let dispose = () => {};
if (local) {
  const bundle = 'api/_compute/compute.mjs';
  check('the bundled handler is the merge\'s', sha256(await readFile(bundle)) === sha256(Buffer.from(atMerge(bundle), 'utf8')), { bundle });
  const { createComputeApiHandler } = await import(pathToFileURL(join(process.cwd(), bundle)).href);
  const { createLocalTimeModule } = await import(pathToFileURL(join(process.cwd(), 'api/_compute/local-time.mjs')).href);
  send = async (endpoint, body) => {
    const text = JSON.stringify(body);
    const localTime = createLocalTimeModule();
    try {
      return await new Promise((resolve) => {
        const res = { statusCode: 0, setHeader() {}, end(payload) { resolve({ status: this.statusCode, answer: parse(Buffer.from(payload, 'utf8')) }); } };
        const req = { method: 'POST', url: `/api/compatibility?__zodiacs_compute=${endpoint}`, query: { __zodiacs_compute: endpoint },
          headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)) }, body: text };
        createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' })(req, res);
      });
    } finally {
      localTime.dispose();
    }
  };
} else {
  send = async (endpoint, body) => {
    try {
      const response = await fetch(`${base}/api/v1/${endpoint}`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(60000),
        headers: { ...UA, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, answer: parse(Buffer.from(await response.arrayBuffer())) };
    } catch (error) {
      return { status: 0, answer: null, error: String(error) };
    }
  };
}

const served = { registry: null, openapi: null };
if (!local) {
  const json = await get(`${base}/developers/conventions/registry.json`);
  const servedRegistry = parse(json.bytes);
  const expected = { ...registry, namespaces: registry.namespaces.map((space) => ({ ...space, entries: space.entries.map((entry) => ({ ...entry, uri: address(entry.id) })) })) };
  const servedEntries = (servedRegistry?.namespaces ?? []).flatMap((space) => space.entries ?? []);
  check('registry.json is the merge\'s registry, with every id\'s address', json.status === 200 && same(servedRegistry, expected),
    { status: json.status, entries: servedEntries.length, namespaces: servedRegistry?.namespaces?.length ?? null });
  const servedById = new Map(servedEntries.map((entry) => [entry.id, entry]));
  const missing = added.filter((id) => servedById.get(id)?.uri !== address(id));
  check(`registry.json holds the ${added.length} ids the merge added, each with its address`, json.status === 200 && added.length > 0 && missing.length === 0,
    { added, missing });
  served.registry = { status: json.status, sha256: sha256(json.bytes), entries: servedEntries.length, namespaces: servedRegistry?.namespaces?.length ?? null };

  const openapi = await get(`${base}/api/v1/openapi.json`);
  const document = parse(openapi.bytes);
  const documents = (name) => {
    const schema = document?.components?.schemas?.[name];
    return Boolean(schema?.properties?.conventionIds) && (schema?.required ?? []).includes('conventionIds');
  };
  check('/api/v1/openapi.json documents conventionIds on the calculation receipt and the compute receipt', openapi.status === 200
    && documents('CalculationReceipt') && documents('ComputeReceipt'),
    { status: openapi.status, calculation: documents('CalculationReceipt'), compute: documents('ComputeReceipt') });
  const undocumented = REQUESTS.filter(([endpoint, name]) => name !== 'polar').filter(([endpoint, name, body]) =>
    !same(document?.paths?.[`/api/v1/${endpoint}`]?.post?.requestBody?.content?.['application/json']?.examples?.[name]?.value, body))
    .map(([endpoint, name]) => `${endpoint}.${name}`);
  check('the requests sent are the OpenAPI document\'s own examples', openapi.status === 200 && undocumented.length === 0, { undocumented });
  served.openapi = { status: openapi.status, sha256: sha256(openapi.bytes) };
}

const requests = [];
const named = new Set();
let skyFactPhase = null;
for (const [endpoint, name, body] of REQUESTS) {
  if (requests.length && !local) await pause(1500);
  const { status, answer, error } = await send(endpoint, body);
  const receipt = answer?.receipt ?? null;
  const listed = receipt?.conventionIds ?? null;
  const problems = [];
  let rule = null;
  if (status !== 200 || !receipt) problems.push('no answer');
  else {
    const { conventionIds: _ids, ...fields } = receipt;
    try {
      rule = NATAL.has(endpoint) ? natalConventionIds({ receipt: fields, result: answer.result }) : computeIds(fields);
    } catch (failure) {
      problems.push(`rule threw: ${String(failure).slice(0, 120)}`);
    }
    if (!sortedUnique(listed)) problems.push('not sorted and unique');
    if (rule && !same(listed, rule)) problems.push(NATAL.has(endpoint) ? 'not natalConventionIds' : 'not the site rule');
    const documented = examples.success?.[endpoint]?.[name]?.receipt?.conventionIds;
    if (name !== 'polar' && !same(listed, documented)) problems.push('not examples.json\'s');
    if (name === 'polar' && !(listed ?? []).includes('flag:polar-fallback')) problems.push('no polar fallback named');
    const unregistered = (listed ?? []).filter((id) => !registered.has(id));
    if (unregistered.length) problems.push(`unregistered: ${unregistered.join(' ')}`);
    if (answer.cite?.receipt !== digest(receipt)) problems.push('cite.receipt is not the receipt\'s digest');
    for (const id of listed ?? []) named.add(id);
    if (endpoint === 'sky-fact' && name === 'phase') skyFactPhase = receipt;
  }
  const row = { endpoint, name, status, schema: receipt?.schema ?? null, ids: Array.isArray(listed) ? listed.length : null,
    sha256: receipt ? digest(receipt).slice(7) : null,
    citeEqualsDocumented: name === 'polar' ? null : answer?.cite?.receipt === examples.success?.[endpoint]?.[name]?.cite?.receipt, problems, ...(error ? { error } : {}) };
  requests.push(row);
  const what = name === 'polar' ? 'a synthetic polar chart, whose Placidus falls back' : `${endpoint} ${name}`;
  check(`${what}: the receipt lists ${NATAL.has(endpoint) ? 'its and its result\'s' : 'its own fields\''} ids, registered and cited`, problems.length === 0, row);
}

let mcp = null;
if (!local) {
  // Streamable HTTP, one JSON-RPC message per POST; a session id, if the server gives one, goes back on each later request.
  let session = null;
  let next = 1;
  const rpc = async (method, params, notification = false) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${base}/mcp`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(60000),
        headers: { ...UA, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(session ? { 'mcp-session-id': session } : {}) },
        body: JSON.stringify({ jsonrpc: '2.0', method, ...(params ? { params } : {}), ...(notification ? {} : { id: next++ }) }) });
      session = response.headers.get('mcp-session-id') ?? session;
      const text = await response.text();
      if (response.status === 429) { await pause(61000); continue; }
      if (notification) return { status: response.status, message: null };
      const json = (response.headers.get('content-type') ?? '').includes('text/event-stream')
        ? text.split('\n').filter((line) => line.startsWith('data:')).map((line) => parse(Buffer.from(line.slice(5).trim(), 'utf8'))).find((message) => message?.id !== undefined)
        : parse(Buffer.from(text, 'utf8'));
      return { status: response.status, message: json };
    }
    return { status: 429, message: null };
  };
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'zodiacs-programme-check', version: '1' } });
  await rpc('notifications/initialized', null, true);
  const listed = await rpc('tools/list', {});
  const tool = (listed.message?.result?.tools ?? []).find((item) => item.name === 'check_sky_fact');
  // The receipt's schema, wherever the output schema nests it: a node whose receipt property lists conventionIds as required.
  const receiptSchemas = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const receipt = node.properties?.receipt;
    if (receipt?.properties?.conventionIds && (receipt.required ?? []).includes('conventionIds')) receiptSchemas.push(receipt);
    for (const value of Object.values(node)) visit(value);
  };
  visit(tool?.outputSchema);
  check('the hosted MCP advertises conventionIds in check_sky_fact\'s output schema', listed.status === 200 && receiptSchemas.length > 0,
    { initialize: init.status, list: listed.status, tool: Boolean(tool), receiptSchemas: receiptSchemas.length });
  await pause(1500);
  const called = await rpc('tools/call', { name: 'check_sky_fact', arguments: { kind: 'phase', phase: 'full', date: '2026-10-26' } });
  const found = [];
  const collect = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.receipt?.schema && node.cite?.receipt) found.push(node);
    for (const value of Object.values(node)) collect(value);
  };
  collect(called.message?.result?.structuredContent);
  const calculation = found[0] ?? null;
  const receipt = calculation?.receipt ?? null;
  const problems = [];
  if (called.status !== 200 || !receipt) problems.push('no receipt');
  else {
    const { conventionIds: listedIds, ...fields } = receipt;
    if (!sortedUnique(listedIds) || !same(listedIds, computeIds(fields))) problems.push('not the site rule');
    if (listedIds.some((id) => !registered.has(id))) problems.push('unregistered');
    if (calculation.cite.receipt !== digest(receipt)) problems.push('cite.receipt is not the receipt\'s digest');
    if (!skyFactPhase || calculation.cite.receipt !== digest(skyFactPhase)) problems.push('not the compute API\'s receipt for the same request');
    for (const id of listedIds) named.add(id);
  }
  mcp = { initialize: init.status, session: Boolean(session), list: listed.status, call: called.status, receiptSchemas: receiptSchemas.length,
    ids: Array.isArray(receipt?.conventionIds) ? receipt.conventionIds.length : null, sha256: receipt ? digest(receipt).slice(7) : null, problems };
  check('the hosted MCP\'s check_sky_fact receipt lists its ids, registered and cited, as the compute API\'s for the same request', problems.length === 0, mcp);
}

const groups = new Set(['Coverage statements', 'Compute API receipts']);
const wanted = [...registry.groups.filter((group) => groups.has(group.title)).flatMap((group) => group.namespaces)
  .flatMap((name) => registry.namespaces.find((space) => space.name === name)?.entries.map((entry) => entry.id) ?? []),
  conventionId('ephemeris', `${EPHEMERIS.name}@${EPHEMERIS.version}`)];
const unnamed = wanted.filter((id) => !named.has(id));
check(`the receipts name each of the ${wanted.length} ids of the coverage statements and compute receipts, and the ephemeris`, unnamed.length === 0,
  { wanted: wanted.length, unnamed });

let conformance = null;
if (!local) {
  const page = await get(`${base}/developers/conformance/`);
  const blocks = [...page.bytes.toString('utf8').matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gu)].map((match) => parse(Buffer.from(match[1], 'utf8')));
  const nodes = blocks.flatMap((block) => (Array.isArray(block) ? block : block?.['@graph'] ?? [block]));
  const dataset = nodes.find((node) => node?.['@type'] === 'Dataset');
  const urls = (dataset?.distribution ?? []).map((item) => item.contentUrl);
  const prefix = `/conformance/vectors/${suite}/`;
  check(`the conformance page's Dataset is suite ${suite} with three vectors/${suite}/ files`, page.status === 200 && dataset?.version === suite
    && urls.length === 3 && urls.every((url) => typeof url === 'string' && url.includes(prefix)), { status: page.status, version: dataset?.version ?? null, files: urls.length });
  const kinds = registry.namespaces.find((space) => space.name === 'kind')?.entries ?? [];
  const files = [];
  let vectors = 0;
  const vectorProblems = [];
  for (const level of summary.levels) {
    const file = level.file.split('/').pop();
    const url = urls.find((item) => item?.endsWith(`/${file}`)) ?? null;
    const fetched = url ? await get(url) : { status: 0, bytes: Buffer.alloc(0) };
    const hex = sha256(fetched.bytes);
    // The registry's kind entries name each file and its digest in their sources' titles.
    const quoted = kinds.flatMap((entry) => entry.sources ?? []).map((source) => source.title ?? '')
      .filter((title) => title.includes(`vectors/${suite}/${file} `)).map((title) => title.match(/sha256 ([0-9a-f]{64})/u)?.[1]);
    const content = parse(fetched.bytes);
    const okFile = fetched.status === 200 && Boolean(url?.includes(prefix)) && content?.suiteVersion === suite && hex === level.sha256
      && quoted.length > 0 && quoted.every((value) => value === hex);
    files.push({ file, status: fetched.status, sha256: hex, summary: hex === level.sha256, registry: quoted.length > 0 && quoted.every((value) => value === hex), suiteVersion: content?.suiteVersion ?? null });
    check(`vectors/${suite}/${file}: its SHA-256 is the summary's and the registry's`, okFile, files.at(-1));
    for (const vector of content?.vectors ?? []) {
      vectors += 1;
      const listed = vector.conventionIds;
      const expected = [`arbiter:${vector.arbiter}`, `kind:${vector.kind}`].sort();
      if (content.suiteVersion !== suite || !sortedUnique(listed) || !expected.every((id) => listed.includes(id)) || listed.some((id) => !registered.has(id))) {
        vectorProblems.push(vector.id);
      }
    }
  }
  const total = summary.levels.reduce((sum, level) => sum + level.count, 0);
  check(`all ${total} vectors list their kind and arbiter ids, sorted and registered`, vectors === total && vectorProblems.length === 0,
    { vectors, problems: vectorProblems.length, sample: vectorProblems.slice(0, 3) });
  conformance = { page: { status: page.status, sha256: sha256(page.bytes) }, suite: dataset?.version ?? null, files, vectors };
}
dispose();

const record = {
  schema: 'zodiacs.convention-ids-check.v1',
  checkedAt: new Date().toISOString(),
  target: local ? 'local: api/_compute/compute.mjs' : base,
  merge,
  deployment,
  control,
  registry: { version: registry.version, ids: ids.length, namespaces: registry.namespaces.length, added },
  engine: engineVersion,
  suite,
  served,
  requests,
  mcp,
  named: named.size,
  conformance,
  results,
  passed: results.filter((result) => result.ok).length,
  failed: results.filter((result) => !result.ok).length,
};
await writeFile(out, `${JSON.stringify(record, null, 2)}\n`);
console.log(`${record.passed} passed, ${record.failed} failed`);
process.exitCode = record.failed ? 1 : 0;
