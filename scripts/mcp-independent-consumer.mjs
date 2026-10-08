/**
 * Archive-to-HTTP integration check. No astronomical accuracy claim.
 * See docs/platform/evidence/mcp-independent-consumer-2026-10-05/README.md.
 * Uses the archive's locked SDK and verify.mjs; protocol coverage stays in
 * tests/mcp-protocol-drive.mjs. Only the citation URL may differ in parity.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const FILE = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(FILE), '..');
const DOCS = 'https://zodiacs.org/developers/';
const SOURCE_PATHS = [
  'src/mcp', 'src/lib/compute-api', 'src/lib/sky-api', 'src/lib/receipt-digest.ts',
  'src/lib/engine/time-basis.mjs', 'src/lib/time', 'src/lib/compare', 'src/data',
  'api/_compute', 'examples/mcp-server', 'public/examples/mcp-server.json',
  'public/examples/zodiacs-mcp-server-0.1.0-rc.16.3.tgz', 'vendor',
  'scripts/build-compute-handler.mjs', 'scripts/build-compute-local-time.mjs',
  'scripts/build-mcp-server.mjs', 'scripts/pack-mcp-server.mjs',
  'package.json', 'package-lock.json',
];

export const CORPUS = Object.freeze([
  { id: 'positions', tool: 'get_positions', endpoint: 'positions',
    args: { instants: ['2000-01-01T12:00:00Z'], bodies: ['Sun', 'Moon', 'Mars'] } },
  { id: 'short-lunation', tool: 'find_events', endpoint: 'events',
    args: { from: '2026-03-01T00:00:00Z', to: '2026-03-05T00:00:00Z', bodies: ['Moon'], kinds: ['lunation'] }, nonempty: true },
  { id: 'sun-never-retrograde', tool: 'check_sky_fact', endpoint: 'sky-fact',
    args: { kind: 'retrograde', body: 'Sun', instant: '2000-01-01T12:00:00Z' }, answer: 'false' },
  { id: 'instant-sign', tool: 'check_sky_fact', endpoint: 'sky-fact',
    args: { kind: 'sign', body: 'Sun', sign: 'capricorn', instant: '2000-01-01T12:00:00Z' }, answer: 'true' },
  { id: 'date-depends', tool: 'check_sky_fact', endpoint: 'sky-fact',
    args: { kind: 'phase', phase: 'full', date: '2026-03-03' }, answer: 'depends', basis: 'any-zone-day' },
  { id: 'reference-edge', tool: 'check_sky_fact', endpoint: 'sky-fact',
    args: { kind: 'retrograde', body: 'Sun', date: '1800-01-01' }, answer: 'false', flag: 'outside-reference-span' },
]);
const REFUSALS = [
  { id: 'invalid-civil-date', tool: 'get_positions', endpoint: 'positions', args: { instants: ['2001-02-29T00:00:00Z'] } },
  { id: 'reversed-event-window', tool: 'find_events', endpoint: 'events',
    args: { from: '2026-03-05T00:00:00Z', to: '2026-03-01T00:00:00Z' } },
];

// Opt-in production plan: four meaningful successes, one cheap refusal,
// then recovery. Never add requests to this plan to diagnose a live failure.
export const LIVE_PLAN = Object.freeze([
  CORPUS[0], CORPUS[1], CORPUS[4], CORPUS[5],
  { ...REFUSALS[0], refusal: true },
  { ...CORPUS[0], id: 'invalid-civil-date-recovery', mcpCaseId: 'positions' },
]);
const LIVE_HOSTS = ['zodiacs.org', 'zodiacs-pqzrjq0ev-zodiacsofficial.vercel.app'];
export function assertLivePolicy(policy, origin) {
  const url = new URL(origin);
  assert.equal(url.protocol, 'https:', 'live HTTPS origin');
  assert.equal(url.origin, origin, 'live origin cannot contain credentials, path, query or fragment');
  assert(!url.username && !url.password, 'live credentials forbidden');
  assert(LIVE_HOSTS.includes(url.hostname), 'live host outside exact approved hosts');
  assert.equal(policy.http_network_policy?.type, 'restricted', 'restricted environment policy required');
  const hosts = policy.http_network_policy.egress_rules.map(rule => rule.host);
  assert(LIVE_HOSTS.every(host => hosts.includes(host)), 'approved hosts absent from active environment policy');
}
export function assertLiveBinding(binding, pin, bytes) {
  const deployment = binding.provider.deployment;
  assert.equal(binding.schema, 'zodiacs.live-parity-binding.v1');
  assert.equal(deployment.id, 'dpl_6omXmaCaRgp4BXt9ZDBskx84262E', 'approved immutable deployment');
  assert.equal(deployment.url, LIVE_HOSTS[1], 'approved immutable deployment host');
  assert.equal(binding.origin, `https://${deployment.url}`, 'live calls use source-bound immutable origin');
  assert.equal(deployment.sourceCommit, pin.http.sourceCommit, 'provider source commit binding');
  assert.equal(deployment.repository, 'zodiacs-org/site', 'provider repository');
  assert.equal(deployment.target, 'production', 'provider production target');
  assert.equal(deployment.readyState, 'READY', 'provider READY state');
  assert.equal(deployment.source, 'git', 'provider git source');
  assert(deployment.alias.includes('zodiacs.org'), 'canonical alias observed on deployment');
  for (const [name, expected, path] of [
    ['manifest', { sha256: pin.manifestSha256, bytes: bytes.manifest.length }, '/examples/mcp-server.json'],
    ['archive', pin.archive, `/examples/${JSON.parse(bytes.manifest).file}`],
    ['openapi', pin.openapi, '/api/v1/openapi.json'],
  ]) {
    const record = binding.served[name];
    assert.equal(record.method, 'GET', `${name} metadata method`);
    assert.equal(record.url, binding.origin + path, `${name} source-bound URL`);
    assert.equal(record.status, 200, `${name} metadata status`);
    assert.equal(record.curlExitCode, 0, `${name} metadata transport`);
    assert.equal(record.redirectsFollowed, 0, `${name} metadata redirects`);
    assert.equal(record.headersTruncated, false, `${name} metadata header limit`);
    assert.equal(record.bodySha256, expected.sha256, `${name} served hash binding`);
    assert.equal(record.bodyBytes, expected.bytes, `${name} served byte binding`);
    assert.equal(sha256(bytes[name]), expected.sha256, `${name} captured bytes binding`);
    assert.equal(bytes[name].length, expected.bytes, `${name} captured byte length`);
  }
}
export async function runLiveHttp({ binding, pin, mcp, validate, out, report, fetchImpl = fetch }) {
  const http = [];
  report.live.status = 'running';
  report.cases = [];
  for (const row of LIVE_PLAN) {
    assert(report.live.requests < 6, 'six production compute calls maximum');
    if (row.endpoint === 'events') {
      assert(report.live.eventSearches < 2, 'two short production event searches maximum');
      report.live.eventSearches += 1;
    }
    report.httpRequests += 1;
    report.live.requests += 1; // Count attempts, including fetch/status/parse failures.
    await save(join(out, 'report.json'), report);
    const response = await captureHttpResponse(row, binding.origin, http, join(out, 'http.json'), fetchImpl);
    const expectedStatus = row.refusal ? 400 : 200;
    assert.equal(response.status, expectedStatus, `${row.id}: unexpected live HTTP status; stopping`);
    validate(response.value, row.endpoint, expectedStatus);
    if (row.refusal) {
      const refusal = mcp.refusals.find(item => item.id === row.id).refusal;
      assert.equal(refusal.layer, 'tool', 'live parser refusal layer');
      const detail = response.value.error;
      assert.equal(refusal.message, `${detail.pointer ? `${detail.pointer}: ` : ''}${detail.message}`, 'live shared parser refusal sentence');
      report.cases.push({ id: row.id, status: response.status, result: 'pass', error: detail });
    } else {
      const value = mcp.cases.find(item => item.id === (row.mcpCaseId ?? row.id)).value;
      validate(value, row.endpoint);
      assertParity(value, response.value, row, pin);
      report.cases.push({ id: row.id, status: response.status, result: 'pass', receiptDigest: digest(response.value.receipt),
        onlyAllowedDifference: 'cite.url', ...(row.answer ? { answer: response.value.result.answer } : {}),
        ...(row.endpoint === 'events' ? { events: response.value.result.events.length,
          completeness: response.value.receipt.search.completeness } : {}) });
    }
  }
  report.live.status = 'pass';
}

// Independent implementation: never import the application's receipt helper.
export function canonical(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (typeof value === 'number') {
    assert(Number.isFinite(value), 'non-finite canonical number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  assert(value && typeof value === 'object', 'canonical value must be JSON');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const digest = value => `sha256:${sha256(canonical(value))}`;

export function assertArchive(bytes, pin) {
  assert.equal(sha256(bytes), pin.sha256, 'archive SHA-256');
  assert.equal(bytes.length, pin.bytes, 'archive bytes');
}
export function assertBackend(backend, pin) {
  assert.equal(backend?.name, '@zodiacs/engine', 'backend name');
  assert.equal(backend?.version, pin.engineVersion, 'backend version');
  assert.deepEqual(backend?.ephemeris, { name: 'astronomy-engine', version: pin.ephemerisVersion }, 'ephemeris');
}
export function assertCapabilities(value, info, pin) {
  assert.deepEqual(info, { name: 'zodiacs-mcp-server', version: pin.adapterVersion }, 'MCP handshake version');
  assert.equal(value?.adapter?.version, pin.adapterVersion, 'capabilities adapter version');
  assert.equal(value?.receipt?.adapter?.version, pin.adapterVersion, 'receipt adapter version');
  assertBackend(value?.receipt?.engine, pin);
  assert.equal(value?.engine?.version, pin.engineVersion, 'capabilities engine version');
  assert.equal(value?.cite?.receipt, digest(value.receipt), 'capabilities citation digest');
  assert.equal(value?.cite?.version, pin.engineVersion, 'capabilities citation version');
  assert(value.unsupported.some(line => /eclipse/i.test(line)), 'unsupported eclipse search is disclosed');
  assert(value.unsupported.some(line => /no timeout/.test(line)), 'no interruptible timeout is disclosed');
}
export function assertReply(value, row, pin, transport) {
  assert.equal(value?.schema, `zodiacs.compute-api.${row.endpoint}.v1`, 'response schema');
  assert(value.receipt && typeof value.receipt === 'object', 'missing receipt');
  assert.equal(value.receipt.schema, 'zodiacs.compute-receipt.v1', 'receipt schema');
  assert.equal(value.receipt.endpoint, row.endpoint, 'receipt endpoint');
  assertBackend(value.backend, pin);
  assertBackend(value.receipt.engine, pin);
  assert.equal(value.cite?.engine, '@zodiacs/engine', 'citation engine');
  assert.equal(value.cite?.version, pin.engineVersion, 'citation version');
  assert.equal(value.cite?.receipt, digest(value.receipt), 'citation digest');
  assert.equal(value.cite?.url, `${DOCS}${transport === 'mcp' ? `mcp/#${row.tool}` : `compute/#${row.endpoint}`}`, 'citation URL');
  if (row.answer) assert.equal(value.result?.answer, row.answer, `${row.id}: answer`);
  if (row.basis) {
    assert.equal(value.result.basis, row.basis, 'date basis');
    assert.equal(value.result.zone, null, 'no assumed zone');
    assert.equal(Date.parse(value.result.window.to) - Date.parse(value.result.window.from), 50 * 3600000, 'date span');
  }
  if (row.flag) assert(value.result.facts.flags.includes(row.flag), 'coverage flag');
  if (row.endpoint === 'events') {
    assert(value.receipt.search, 'search receipt');
    if (row.nonempty) assert(value.result.events.length > 0, 'fixed event window must exercise a result');
    for (const [index, event] of value.result.events.entries()) {
      assert(row.args.kinds.includes(event.kind), 'requested event kinds');
      assert(Date.parse(event.at) > Date.parse(row.args.from) && Date.parse(event.at) <= Date.parse(row.args.to), 'event window membership');
      if (index) assert(value.result.events[index - 1].at <= event.at, 'event time order');
    }
  }
  if (value.receipt.search) {
    const search = value.receipt.search;
    assert.equal(search.completeness, 'tested-not-proven', 'search completeness');
    assert.equal(search.window, 'start-exclusive-end-inclusive', 'search window');
    assert(Number.isInteger(search.samples) && search.samples >= 0 && search.samples <= search.maxSamples, 'search samples');
  }
}
export function assertParity(mcp, http, row, pin) {
  assertReply(mcp, row, pin, 'mcp');
  assertReply(http, row, pin, 'http');
  const normalized = value => ({ ...value, cite: { ...value.cite, url: '<transport documentation URL>' } });
  assert.equal(canonical(normalized(mcp)), canonical(normalized(http)), `${row.id}: parity beyond citation URL`);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}
async function jsonFile(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function save(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); }
export async function prepareOutputDirectory(out) {
  await mkdir(dirname(out), { recursive: true });
  try { await mkdir(out); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert.fail('output directory already exists; use a new output directory');
  }
}
export const HTTP_EVIDENCE_LIMITS = Object.freeze({ bodyBytes: 256 * 1024, headerBytes: 16 * 1024 });
function failureDetail(error) {
  return { name: error.name, message: error.message, ...(error.code ? { code: error.code } : {}),
    ...(error.cause ? { cause: { name: error.cause.name, message: error.cause.message,
      ...(error.cause.code ? { code: error.cause.code } : {}) } } : {}) };
}
export async function captureHttpResponse(row, origin, records, evidencePath, fetchImpl = fetch) {
  const record = { ...row, status: null, headers: Object.create(null), headersBytes: 0, headersTruncated: false,
    text: '', body: { limitBytes: HTTP_EVIDENCE_LIMITS.bodyBytes, capturedBytes: 0, observedBytes: 0, truncated: false },
    state: 'fetching' };
  records.push(record);
  await save(evidencePath, records);
  let stage = 'fetch', reader;
  const chunks = [];
  const snapshotBody = () => {
    const bytes = Buffer.concat(chunks);
    record.text = bytes.toString('utf8');
    record.body.capturedBytes = bytes.length;
    record.body.capturedSha256 = sha256(bytes);
  };
  try {
    const response = await fetchImpl(`${origin}/api/v1/${row.endpoint}`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(row.args),
      signal: AbortSignal.timeout(10000), redirect: 'error' });
    record.status = response.status;
    stage = 'headers';
    for (const [name, value] of response.headers) {
      const size = Buffer.byteLength(name) + Buffer.byteLength(value);
      if (record.headersBytes + size > HTTP_EVIDENCE_LIMITS.headerBytes) {
        record.headersTruncated = true;
        break;
      }
      record.headers[name] = value;
      record.headersBytes += size;
      // Response cookies can be credentials; their bytes count toward the
      // bound, but their values never enter durable evidence.
      if (['set-cookie', 'authorization', 'proxy-authorization'].includes(name.toLowerCase())) {
        record.headers[name] = '<sensitive response header omitted>';
      }
    }
    record.state = 'reading-body';
    await save(evidencePath, records);
    assert(!record.headersTruncated, 'HTTP headers exceed evidence byte limit; stopping');
    stage = 'body';
    reader = response.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const bytes = Buffer.from(value);
      const remaining = HTTP_EVIDENCE_LIMITS.bodyBytes - record.body.capturedBytes;
      record.body.observedBytes += bytes.length;
      chunks.push(bytes.subarray(0, Math.max(0, remaining)));
      record.body.capturedBytes += Math.min(bytes.length, Math.max(0, remaining));
      if (bytes.length > remaining) {
        record.body.truncated = true;
        // Cancellation is best effort; preserve the byte-limit failure itself.
        await reader.cancel('HTTP evidence byte limit').catch(() => {});
        assert.fail('HTTP body exceeds evidence byte limit; stopping');
      }
    }
    snapshotBody();
    record.state = 'parse-pending';
    // Raw status, bounded headers and body are durable BEFORE JSON.parse.
    await save(evidencePath, records);
    stage = 'status';
    assert(![429, 500, 503].includes(response.status), `unexpected HTTP ${response.status}; stopping`);
    stage = 'parse';
    record.value = JSON.parse(record.text);
    record.state = 'parsed';
    await save(evidencePath, records);
    return record;
  } catch (error) {
    snapshotBody();
    record.state = 'failed';
    record.failure = { stage, ...failureDetail(error) };
    await save(evidencePath, records);
    throw error;
  } finally { reader?.releaseLock(); }
}
function cleanEnv() {
  // Do not hand the consumer credentials, NODE_PATH, preload hooks or repo env.
  const network = Object.fromEntries(['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS']
    .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]));
  return { ...network, PATH: process.env.PATH, TMPDIR: '/tmp', LANG: 'C.UTF-8', NODE_ENV: 'development',
    npm_config_cache: '/tmp/zodiacs-consumer-npm-cache', npm_config_userconfig: '/dev/null' };
}
async function runLogged(command, args, cwd, path, env = cleanEnv()) {
  try {
    const result = await exec(command, args, { cwd, env, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    await writeFile(path, `${result.stdout}${result.stderr}`);
    return { command: [command, ...args], exitCode: 0, log: path };
  } catch (error) {
    await writeFile(path, `${error.stdout ?? ''}${error.stderr ?? ''}`);
    throw new Error(`${command} exited ${error.code}: see ${path}`);
  }
}
async function assertIsolation(consumer, checkoutRoot = ROOT) {
  assert(!isAbsolute(relative(checkoutRoot, consumer)) && relative(checkoutRoot, consumer).startsWith(`..${sep}`), 'consumer must be outside checkout');
  for (let parent = dirname(consumer); ; parent = dirname(parent)) {
    for (const name of ['node_modules', 'package.json']) {
      await access(join(parent, name)).then(() => { throw new Error(`consumer inherits ${join(parent, name)}`); }, error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    if (dirname(parent) === parent) break;
  }
}

// This branch runs as a child from a copy of THIS file in the extracted package.
// Both SDK and its transitive dependencies resolve in that consumer alone.
async function consume(pinPath, out) {
  const consumer = dirname(FILE);
  assert.equal(await realpath(process.cwd()), await realpath(consumer), 'consumer process cwd');
  assert.equal(process.env.NODE_PATH, undefined, 'consumer NODE_PATH must be absent');
  assert.equal(process.env.NODE_OPTIONS, undefined, 'consumer NODE_OPTIONS must be absent');
  await assertIsolation(consumer, option('--checkout-root'));
  const pin = await jsonFile(pinPath);
  const require = createRequire(join(consumer, 'package.json'));
  const resolved = {};
  for (const name of ['@modelcontextprotocol/client', '@modelcontextprotocol/client/stdio']) {
    const path = await realpath(require.resolve(name));
    assert(path.startsWith(join(consumer, 'node_modules') + sep), `SDK escaped consumer: ${path}`);
    resolved[name] = { path: relative(consumer, path), sha256: sha256(await readFile(path)) };
  }
  const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client')));
  const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/client/stdio')));
  const client = new Client({ name: 'zodiacs-independent-consumer', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(consumer, 'server.mjs')],
    cwd: consumer, env: cleanEnv(), stderr: 'pipe' });
  const result = { status: 'running', resolved, cases: [], refusals: [], unsupported: [], stderr: '' };
  const environmentProof = env => Object.fromEntries(Object.entries(env).map(([key, value]) =>
    [key, /PROXY|CA_CERTS/.test(key) ? '<platform network setting; value omitted>' : value]));
  result.isolation = { consumerCwd: process.cwd(), installPath: consumer, checkoutRootExcluded: option('--checkout-root'),
    workerEnvironment: environmentProof(process.env),
    serverLaunch: { command: process.execPath, args: [join(consumer, 'server.mjs')], cwd: consumer, environment: environmentProof(cleanEnv()) },
    ancestorPackageOrNodeModules: 'absent; checked again in consumer process',
    moduleResolution: 'SDK entry realpaths are inside this consumer/node_modules; NODE_PATH and NODE_OPTIONS absent' };
  result.clientVersion = (await jsonFile(join(consumer, 'node_modules/@modelcontextprotocol/client/package.json'))).version;
  assert.equal(result.clientVersion, '2.0.0', 'locked consumer client');
  try {
    await client.connect(transport);
    if (process.platform === 'linux') {
      const childCwd = await realpath(`/proc/${transport.pid}/cwd`);
      const childEnv = Object.fromEntries((await readFile(`/proc/${transport.pid}/environ`, 'utf8'))
        .split('\0').filter(Boolean).map(entry => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
      assert.equal(childCwd, await realpath(consumer), 'actual extracted server cwd');
      assert.deepEqual(childEnv, cleanEnv(), 'actual extracted server environment');
      result.isolation.observedServer = { pid: transport.pid, cwd: childCwd,
        environment: environmentProof(childEnv), proof: 'read-only /proc observation after SDK initialization' };
    }
    transport.stderr?.on('data', data => { result.stderr += data.toString(); });
    result.server = client.getServerVersion();
    result.tools = (await client.listTools()).tools;
    assert.deepEqual(result.tools.map(tool => tool.name).sort(),
      ['calculate_natal_chart', 'check_sky_fact', 'compare_calculation_records', 'find_events', 'get_capabilities', 'get_positions']);
    for (const tool of result.tools) {
      assert.equal(tool.inputSchema.type, 'object', `${tool.name} input schema`);
      assert.equal(tool.outputSchema?.type, 'object', `${tool.name} output schema`);
      assert.deepEqual(tool.annotations && {
        readOnlyHint: tool.annotations.readOnlyHint, destructiveHint: tool.annotations.destructiveHint,
        openWorldHint: tool.annotations.openWorldHint, idempotentHint: tool.annotations.idempotentHint,
      }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true });
    }
    // Client.callTool checks the output against the schema advertised by tools/list.
    const call = async row => {
      const answer = await client.callTool({ name: row.tool, arguments: row.args });
      assert(!answer.isError, `${row.id}: ${JSON.stringify(answer.content)}`);
      assert(answer.structuredContent, 'missing structuredContent');
      return answer.structuredContent;
    };
    result.capabilities = await call({ tool: 'get_capabilities', args: {} });
    assertCapabilities(result.capabilities, result.server, pin);
    for (const row of CORPUS) {
      const value = await call(row);
      assertReply(value, row, pin, 'mcp');
      result.cases.push({ ...row, value });
    }
    for (const row of [...REFUSALS,
      { id: 'zone-unsupported', tool: 'check_sky_fact', args: { kind: 'phase', phase: 'full', date: '2026-03-03', zone: 'Europe/Paris' } },
      { id: 'eclipse-unsupported', tool: 'find_events', args: { from: '2026-03-01T00:00:00Z', to: '2026-03-05T00:00:00Z', kinds: ['eclipse'] } },
    ]) {
      let refusal;
      try {
        const answer = await client.callTool({ name: row.tool, arguments: row.args });
        assert(answer.isError, `${row.id}: request was silently accepted`);
        refusal = { layer: 'tool', message: answer.content[0].text };
      } catch (error) {
        // Only a protocol invalid-params rejection counts; assertion/transport failures do not.
        assert.equal(error.code, -32602, `${row.id}: unexpected failure`);
        refusal = { layer: 'sdk-input-schema', message: error.message };
      }
      if (row.id === 'zone-unsupported') assert.match(refusal.message, /zone/i);
      if (row.id === 'eclipse-unsupported') assert.match(refusal.message, /kind|eclipse/i);
      const recovery = await call(CORPUS[0]);
      assert.deepEqual(recovery, result.cases[0].value, `${row.id}: recovery`);
      (row.endpoint ? result.refusals : result.unsupported).push({ ...row, refusal, recovery });
    }
    result.status = 'pass';
  } catch (error) {
    result.status = 'fail';
    result.failure = error.stack ?? String(error);
    throw error;
  } finally {
    await client.close();
    await save(out, result);
  }
}

async function generateOpenApi(out) {
  // Run this mode with the source checkout's locked vite-node, as the existing
  // publication builder does. The resulting bytes match buildSkyApi's output.
  const { loadSkyApiSources } = await import('../src/lib/sky-api/sources.ts');
  const { buildSkyApi } = await import('../src/lib/sky-api/files.ts');
  const build = buildSkyApi(await loadSkyApiSources(ROOT), { generatedAt: '2000-01-01T00:00:00.000Z' });
  await writeFile(out, build.files.get('openapi.json'));
}

async function main(pinPath, out) {
  assert(pinPath && out, 'usage: node scripts/mcp-independent-consumer.mjs --pin FILE --out DIRECTORY [--archive FILE] [--live-binding FILE]');
  const pin = await jsonFile(resolve(pinPath));
  // Atomic creation rejects even empty existing directories and symlinks.
  // Never overwrite or remove evidence from a prior run.
  await prepareOutputDirectory(out);
  const report = { schema: 'zodiacs.independent-consumer-evidence.v1', startedAt: new Date().toISOString(),
    node: process.version, pin, status: 'running', checks: [], httpRequests: 0,
    live: { status: 'inconclusive', requests: 0, reason: 'No live deployment source binding was established; selected source-bound loopback HTTP.' },
    credit: 'No delivery credit. Integration evidence, not independent astronomical accuracy or astrology prediction validation.' };
  let server;
  try {
    const liveBindingPath = option('--live-binding');
    let liveBinding, liveBytes;
    if (liveBindingPath) {
      assert(option('--archive'), 'live mode requires a captured archive; no fallback download');
      assert(process.execArgv.includes('--use-env-proxy'), 'live mode requires --use-env-proxy for the active environment policy');
      liveBinding = await jsonFile(resolve(liveBindingPath));
      assertLivePolicy(await jsonFile('/etc/codex/network-policy.json'), liveBinding.origin);
      liveBytes = {};
      for (const name of ['manifest', 'archive', 'openapi']) {
        liveBytes[name] = await readFile(resolve(dirname(resolve(liveBindingPath)), liveBinding.served[name].bodyFile));
      }
      assertLiveBinding(liveBinding, pin, liveBytes);
      report.live.binding = liveBinding;
      report.live.reason = 'Provider source and served bytes bound; source build and consumer checks pending.';
    }
    const git = async (...args) => (await exec('git', args, { cwd: ROOT })).stdout.trim();
    report.runner = { path: 'scripts/mcp-independent-consumer.mjs', sha256: sha256(await readFile(FILE)) };
    report.npm = (await exec('npm', ['--version'])).stdout.trim();
    report.sourceLockSha256 = sha256(await readFile(join(ROOT, 'package-lock.json')));
    assert.equal(await git('rev-parse', `${pin.http.sourceCommit}^{commit}`), pin.http.sourceCommit);
    await git('merge-base', '--is-ancestor', pin.archive.sourceCommit, pin.http.sourceCommit);
    await git('diff', '--exit-code', pin.http.sourceCommit, '--', ...SOURCE_PATHS);
    assert.equal(await git('ls-files', '--others', '--exclude-standard', '--', ...SOURCE_PATHS), '', 'untracked source inputs');
    report.source = { httpCommit: pin.http.sourceCommit, httpTree: await git('rev-parse', `${pin.http.sourceCommit}^{tree}`),
      archiveSourceCommit: pin.archive.sourceCommit, sourcePaths: SOURCE_PATHS };
    const manifestBytes = await readFile(join(ROOT, 'public/examples/mcp-server.json'));
    assert.equal(sha256(manifestBytes), pin.manifestSha256, 'manifest SHA-256');
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.version, pin.adapterVersion);
    assert.equal(manifest.sha256, pin.archive.sha256);
    assert.equal(manifest.artifactCommit, pin.archive.sourceCommit);
    assert.equal(manifest.bytes, pin.archive.bytes);
    await git('diff', '--exit-code', pin.http.sourceCommit, '--', `public/examples/${manifest.file}`);
    const archiveOverride = option('--archive');
    // curl follows the environment's supported proxy/CA configuration. Native
    // Node fetch does not do so by default on every supported Node release.
    const archiveBytes = archiveOverride ? await readFile(resolve(archiveOverride)) : (await exec('curl',
      ['--fail', '--silent', '--show-error', '--location', '--max-redirs', '3', '--proto', '=https',
        '--max-time', '30', '--max-filesize', String(pin.archive.bytes), pin.archive.url],
      { encoding: 'buffer', timeout: 35000, maxBuffer: pin.archive.bytes + 4096 })).stdout;
    assertArchive(archiveBytes, pin.archive);
    if (liveBinding) assert.deepEqual(archiveBytes, liveBytes.archive, 'consumer uses freshly served archive bytes');
    report.archive = { origin: archiveOverride ? 'explicit local archive' : pin.archive.url, bytes: archiveBytes.length, sha256: sha256(archiveBytes) };
    report.checks.push('source and archive bindings');

    const scratch = await mkdtemp('/tmp/zodiacs-mcp-consumer-');
    const consumer = join(scratch, 'package');
    report.scratch = scratch;
    await assertIsolation(consumer);
    const archivePath = join(scratch, 'candidate.tgz');
    await writeFile(archivePath, archiveBytes);
    // Validate tar member names/types before extracting the pinned archive.
    const members = (await exec('tar', ['-tzf', archivePath])).stdout.trim().split('\n');
    assert(members.every(name => name.startsWith('package/') && !name.split('/').includes('..')), 'unexpected archive path');
    const types = (await exec('tar', ['-tvzf', archivePath])).stdout.trim().split('\n');
    assert(types.every(line => /^[d-]/.test(line)), 'archive links or special files');
    await exec('tar', ['-xzf', archivePath, '-C', scratch]);
    const pkg = await jsonFile(join(consumer, 'package.json'));
    const candidate = await jsonFile(join(consumer, 'candidate.json'));
    assert.equal(pkg.version, pin.adapterVersion);
    assert.equal(candidate.version, pin.adapterVersion);
    assert.equal(pkg.license, 'MIT AND CC-BY-4.0', 'both licences retained');
    assert.match(await readFile(join(consumer, 'NOTICE'), 'utf8'), /MIT AND CC-BY-4\.0/);
    assert.equal(candidate.bundled.engine.version, pin.engineVersion);
    assert.equal(candidate.bundled.engine.artifactSha256, pin.engineArchiveSha256);
    assert.equal(candidate.bundled.ephemeris.version, pin.ephemerisVersion);
    const lockBefore = sha256(await readFile(join(consumer, 'npm-shrinkwrap.json')));
    report.install = await runLogged('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], consumer, join(out, 'consumer-install.log'));
    assert.equal(sha256(await readFile(join(consumer, 'npm-shrinkwrap.json'))), lockBefore, 'consumer lock changed');
    assert(!(await lstat(join(consumer, 'node_modules'))).isSymbolicLink(), 'consumer node_modules link');
    report.consumer = { packageVersion: pkg.version, license: pkg.license, shrinkwrapSha256: lockBefore,
      serverSha256: sha256(await readFile(join(consumer, 'server.mjs'))), nodeModules: 'fresh npm ci inside extracted package', inheritedNodeModules: false };
    report.consumer.installPath = consumer;
    report.consumer.lockPath = join(consumer, 'npm-shrinkwrap.json');
    report.verify = await runLogged(process.execPath, ['verify.mjs'], consumer, join(out, 'packaged-verify.log'));
    report.checks.push('locked fresh consumer and packaged verify.mjs');
    const consumerPin = join(scratch, 'pin.json');
    await save(consumerPin, pin);
    await copyFile(FILE, join(consumer, 'consumer-check.mjs'));
    await runLogged(process.execPath, ['consumer-check.mjs', '--consumer', '--checkout-root', ROOT, '--pin', consumerPin, '--out', join(out, 'mcp.json')], consumer, join(out, 'consumer-check.log'));
    const mcp = await jsonFile(join(out, 'mcp.json'));
    report.checks.push('advertised MCP schemas, versions, citations, unsupported requests and recovery');

    await runLogged(process.execPath, [join(ROOT, 'node_modules/vite-node/vite-node.mjs'), '--script', FILE,
      '--openapi-out', join(out, 'openapi.json')], ROOT, join(out, 'openapi-build.log'));
    const openapiBytes = await readFile(join(out, 'openapi.json'));
    assert.equal(sha256(openapiBytes), pin.openapi.sha256, 'OpenAPI bytes');
    assert.equal(openapiBytes.length, pin.openapi.bytes, 'OpenAPI length');
    report.openapi = { ...pin.openapi, origin: 'source buildSkyApi bytes', sourceCommit: pin.http.sourceCommit };
    const openapi = JSON.parse(openapiBytes);
    const { default: Ajv } = await import('ajv/dist/2020.js');
    const { default: addFormats } = await import('ajv-formats');
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const OPENAPI_ID = 'https://zodiacs.org/api/v1/openapi.json';
    ajv.addSchema({ $id: OPENAPI_ID, ...openapi });
    const validate = (value, endpoint, status = 200) => {
      const schema = openapi.paths[`/api/v1/${endpoint}`].post.responses[status].content['application/json'].schema;
      const check = ajv.compile({ ...schema, $ref: schema.$ref?.replace(/^#/, OPENAPI_ID + '#') });
      assert(check(value), `${endpoint} OpenAPI ${status}: ${ajv.errorsText(check.errors)}`);
    };
    const modulePath = join(ROOT, 'api/_compute/compute.mjs');
    assert.equal(sha256(await readFile(modulePath)), pin.http.bundleSha256, 'HTTP bundle SHA-256');
    if (liveBinding) {
      assert.deepEqual(manifestBytes, liveBytes.manifest, 'served manifest equals pinned source');
      assert.deepEqual(openapiBytes, liveBytes.openapi, 'served OpenAPI equals pinned source build');
      assert.equal(sha256(await readFile(join(ROOT, 'api/_compute/local-time.mjs'))), pin.http.localTimeBundleSha256, 'local-time bundle SHA-256');
      assert.equal(report.sourceLockSha256, pin.sourceLockSha256, 'runtime source lock SHA-256');
      assert.equal(sha256(await readFile(join(ROOT, 'vendor', `zodiacs-engine-${pin.engineVersion}.tgz`))), pin.engineArchiveSha256, 'vendored runtime engine archive SHA-256');
      report.http = { ...pin.http, mode: 'live-immutable-production', origin: liveBinding.origin,
        deployment: liveBinding.provider.deployment.id };
      Object.assign(report.live, { status: 'bound', eventSearches: 0,
        reason: 'Provider git source, served manifest/archive/OpenAPI and pinned runtime source hashes established.' });
      report.checks.push('provider and freshly served metadata bound to pinned runtime sources');
      await runLiveHttp({ binding: liveBinding, pin, mcp, validate, out, report });
      report.checks.push('bounded production parity, typed refusal and recovery');
      report.status = 'pass';
      return;
    }
    const { createComputeApiHandler } = await import(pathToFileURL(modulePath));
    const { createLocalTimeModule } = await import(pathToFileURL(join(ROOT, 'api/_compute/local-time.mjs')));
    server = createServer(async (req, res) => {
      // Test fixture for the public path rewrite; no production environment or
      // firewall configuration is used. Actual IncomingMessage/ServerResponse.
      req.query = { __zodiacs_compute: req.url.slice('/api/v1/'.length) };
      const localTime = createLocalTimeModule();
      try { await createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' })(req, res); }
      catch { res.statusCode = 500; res.end('{}'); }
      finally { localTime.dispose(); }
    });
    await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    report.http = { ...pin.http, mode: 'local-loopback', origin, rateLimitFixture: 'allowed', deployment: null };
    const http = [];
    report.cases = [];
    const post = async row => {
      report.httpRequests += 1;
      return captureHttpResponse(row, origin, http, join(out, 'http.json'));
    };
    for (const row of CORPUS) {
      const response = await post(row);
      assert.equal(response.status, 200, `${row.id}: HTTP status`);
      validate(response.value, row.endpoint);
      validate(mcp.cases.find(item => item.id === row.id).value, row.endpoint);
      assertParity(mcp.cases.find(item => item.id === row.id).value, response.value, row, pin);
      report.cases.push({ id: row.id, schema: response.value.schema, result: 'pass',
        receiptDigest: digest(response.value.receipt), onlyAllowedDifference: 'cite.url',
        ...(row.answer ? { answer: response.value.result.answer } : {}),
        ...(row.endpoint === 'events' ? { events: response.value.result.events.length, completeness: response.value.receipt.search.completeness } : {}) });
    }
    for (const row of REFUSALS) {
      const response = await post(row);
      assert.equal(response.status, 400, `${row.id}: refusal status`);
      validate(response.value, row.endpoint, 400);
      const refusal = mcp.refusals.find(item => item.id === row.id).refusal;
      assert.equal(refusal.layer, 'tool', 'parser refusal layer');
      const detail = response.value.error;
      assert.equal(refusal.message, `${detail.pointer ? `${detail.pointer}: ` : ''}${detail.message}`, 'shared parser refusal sentence');
      const recovery = await post({ ...CORPUS[0], id: `${row.id}-recovery` });
      assert.equal(recovery.status, 200, 'HTTP recovery');
      validate(recovery.value, 'positions');
      assertParity(mcp.cases[0].value, recovery.value, CORPUS[0], pin);
    }
    report.checks.push('six fixed source-bound HTTP parity cases, two parser refusals and recovery');
    report.status = 'pass';
  } catch (error) {
    report.status = 'fail';
    report.failure = error.stack ?? String(error);
    if (option('--live-binding')) {
      report.live.status = report.live.requests ? 'fail' : 'inconclusive';
      report.live.reason = error.message;
    }
    process.exitCode = 1;
  } finally {
    if (server) await new Promise(yes => server.close(yes));
    report.finishedAt = new Date().toISOString();
    await save(join(out, 'report.json'), report);
    console.log(`${report.status}: ${report.checks.length} stages, ${report.httpRequests - report.live.requests} local HTTP requests, ${report.live.requests} live HTTP requests. ${join(out, 'report.json')}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === FILE) {
  if (process.argv.includes('--consumer')) await consume(option('--pin'), option('--out'));
  else if (option('--openapi-out')) await generateOpenApi(option('--openapi-out'));
  else await main(option('--pin'), resolve(option('--out') ?? '/tmp/zodiacs-mcp-consumer-results'));
}
