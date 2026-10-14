/*
 * P3.6: the MCP project's conformance suite and its Inspector CLI against the
 * hosted MCP server, zodiacs.org/mcp.
 *
 *   MCP_TOOLS_DIR=<isolated install> node scripts/remote-mcp-review.mjs \
 *     --conformance-results <dir> [--url https://zodiacs.org/mcp] [--out <report.json>]
 *
 * .github/workflows/remote-mcp-conformance.yml installs the pinned suite,
 * Inspector and ajv outside the repository (MCP_TOOLS_DIR), runs the suite's
 * active server scenarios into <dir>, then runs this. It writes one report and
 * exits 1 unless both parts pass.
 *
 * 1. Conformance. Each scenario's checks.json is read. Four scenarios apply to
 *    any server (initialize, ping, tools/list, resources/list) and must have no
 *    failed check. The others exercise the suite's own test server: tools,
 *    resources and prompts it names (test_simple_text, test://static-text,
 *    test_simple_prompt and the like), capabilities this server does not
 *    declare, a localhost URL or a session. Their outcomes are recorded with
 *    the reason, and never counted as passes. A scenario this file does not
 *    classify fails the review, so a new suite version is read before it
 *    counts.
 * 2. Inspector. initialize and tools/list, then every listed tool with an
 *    input its own inputSchema accepts: the result must not be an error, and
 *    its structuredContent must validate against the tool's outputSchema,
 *    which must refuse the same result without its `schema` field. A listed
 *    tool without an input here fails the review. Calls are ten seconds apart,
 *    which keeps the traffic far below any rate limit.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const REPORT_SCHEMA = 'zodiacs.remote-mcp-review.v1';
export const CONFORMANCE_VERSION = '0.1.16';
export const INSPECTOR_VERSION = '2.10.1';

/** Scenarios any MCP server must pass. */
export const APPLIES = new Map([
  ['server-initialize', 'initialize and initialized'],
  ['ping', 'ping'],
  ['tools-list', 'tools/list, each tool with a name, description and inputSchema'],
  ['resources-list', 'resources/list, each resource with a uri and name'],
]);

/** Scenarios of the suite's own test server, with why each does not apply here. */
export const NOT_APPLICABLE = [
  [/^tools-call-/u, 'calls a tool of the suite\'s test server (test_simple_text and the like); this server\'s own tools are each called through the Inspector'],
  [/^elicitation-/u, 'calls an elicitation tool of the suite\'s test server; this server\'s tools are read-only and never ask the client'],
  [/^resources-(?:read-|templates-|subscribe$|unsubscribe$)/u, 'reads or subscribes to the suite\'s test:// resources'],
  [/^prompts-/u, 'this server declares no prompts; prompts-get scenarios also need the suite\'s test prompts'],
  [/^completion-complete$/u, 'completes an argument of the suite\'s test prompt; this server declares no completions'],
  [/^logging-set-level$/u, 'this server declares no logging capability, so logging/setLevel is not required of it'],
  [/^dns-rebinding-protection$/u, 'the suite tests DNS rebinding on localhost servers only and fails any other URL without sending a request'],
  [/^server-sse-multiple-streams$/u, 'needs a session id; this server is stateless (no Mcp-Session-Id), so the suite records a warning and stops'],
];

/** Synthetic inputs, one for each tool the server lists. */
export const TOOL_INPUTS = {
  get_capabilities: {},
  get_sky: { instant: '2026-10-09T00:00:00Z', zone: 'UTC', bodies: ['Sun', 'Moon'] },
  get_upcoming_events: { from: '2026-10-09T00:00:00Z', to: '2026-10-12T00:00:00Z', zone: 'UTC', kinds: ['lunation'] },
  check_sky_fact: { kind: 'retrograde', body: 'Mercury', instant: '2026-10-09T00:00:00Z' },
  get_horoscope: { sign: 'aries', period: 'day', zone: 'UTC' },
  open_chart_studio: {},
};

const RESULT_DIR = /^server-(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/u;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** Every scenario the suite wrote under <dir>: its checks, counted by status. */
export function readConformanceResults(dir) {
  const scenarios = new Map();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const match = entry.isDirectory() ? RESULT_DIR.exec(entry.name) : null;
    const file = match ? join(dir, entry.name, 'checks.json') : null;
    if (!file || !existsSync(file)) continue;
    const checks = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(checks)) throw new Error(`${file} is not a list of checks`);
    const counts = {};
    for (const check of checks) counts[check.status] = (counts[check.status] ?? 0) + 1;
    const failed = checks.filter((check) => check.status === 'FAILURE')
      .map((check) => `${check.name ?? check.id}: ${check.errorMessage ?? check.description ?? ''}`.trim());
    if (scenarios.has(match[1])) throw new Error(`Two results for ${match[1]}`);
    scenarios.set(match[1], { counts, failed, checks: checks.length });
  }
  return scenarios;
}

/** Classifies each scenario's outcome; `passed` is false when one that applies failed, or one is unclassified. */
export function judgeConformance(scenarios) {
  const rows = [];
  const problems = [];
  for (const name of APPLIES.keys()) {
    if (!scenarios.has(name)) problems.push(`${name} did not run`);
  }
  for (const [name, result] of [...scenarios].sort(([a], [b]) => a.localeCompare(b))) {
    const outcome = result.failed.length > 0 ? 'FAILURE' : (result.counts.WARNING ?? 0) > 0 ? 'WARNING' : 'SUCCESS';
    if (APPLIES.has(name)) {
      rows.push({ scenario: name, applies: true, covers: APPLIES.get(name), outcome, counts: result.counts, failed: result.failed });
      if (result.failed.length > 0 || result.checks === 0) problems.push(`${name}: ${result.failed.join('; ') || 'no checks'}`);
      continue;
    }
    const reason = NOT_APPLICABLE.find(([pattern]) => pattern.test(name))?.[1];
    if (!reason) {
      problems.push(`${name} is not classified: read the scenario and add it to APPLIES or NOT_APPLICABLE`);
      rows.push({ scenario: name, applies: null, outcome, counts: result.counts });
      continue;
    }
    rows.push({ scenario: name, applies: false, reason, outcome, counts: result.counts });
  }
  return { passed: problems.length === 0, problems, scenarios: rows };
}

function inspector(directory, url) {
  const require = createRequire(resolve(directory, 'package.json'));
  const version = require('@modelcontextprotocol/inspector/package.json').version;
  if (version !== INSPECTOR_VERSION) throw new Error(`Inspector ${version}, expected ${INSPECTOR_VERSION}`);
  const executable = resolve(directory, 'node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js');
  const storage = resolve(directory, 'isolated-auth');
  mkdirSync(storage, { recursive: true, mode: 0o700 });
  const env = { ...process.env, MCP_STORAGE_DIR: storage, MCP_INSPECTOR_OAUTH_STATE_PATH: resolve(storage, 'oauth.json') };
  const calls = [];
  return {
    version,
    calls,
    async command(method, extra = []) {
      const args = [executable, '--cli', '--transport', 'http', '--server-url', url, '--connect-timeout', '15000',
        '--stored-auth-only', '--format', 'json', '--method', method, ...extra];
      const result = spawnSync(process.execPath, args, { encoding: 'utf8', env, timeout: 45_000, maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
      calls.push({ method, tool: extra.includes('--tool-name') ? extra[extra.indexOf('--tool-name') + 1] : null, exit: result.status,
        stdoutSha256: sha256(result.stdout ?? ''), stderrSha256: sha256(result.stderr ?? '') });
      if (result.status !== 0) throw new Error(`Inspector ${method} exited ${result.status}: ${(result.stderr ?? '').slice(0, 300)}`);
      const envelope = JSON.parse(result.stdout);
      if (!envelope.result) throw new Error(`Inspector ${method} returned no result`);
      await wait(10_000);
      return envelope;
    },
  };
}

async function reviewTools(directory, url) {
  const require = createRequire(resolve(directory, 'package.json'));
  const Ajv = require('ajv');
  const Ajv2020 = require('ajv/dist/2020');
  const addFormats = require('ajv-formats');
  const compile = (schema) => {
    const ajv = new (String(schema.$schema ?? '').includes('2020-12') ? Ajv2020 : Ajv)({ strict: false, allErrors: true });
    addFormats(ajv);
    return ajv.compile(schema);
  };
  const run = inspector(directory, url);
  const report = { inspector: run.version, calls: run.calls, tools: [], passed: false };
  try {
    const initialized = await run.command('initialize');
    report.server = { name: initialized.result.serverInfo?.name, version: initialized.result.serverInfo?.version,
      protocolVersion: initialized.result.protocolVersion, capabilities: initialized.result.capabilities };
    const listed = await run.command('tools/list');
    const names = listed.result.tools.map((tool) => tool.name).sort();
    const missing = names.filter((name) => !(name in TOOL_INPUTS));
    if (missing.length > 0) throw new Error(`No input here for ${missing.join(', ')}: add one to TOOL_INPUTS`);
    for (const tool of listed.result.tools) {
      if (tool.annotations?.readOnlyHint !== true) throw new Error(`${tool.name} is not marked readOnlyHint`);
      if (!tool.inputSchema || !tool.outputSchema) throw new Error(`${tool.name} lacks an input or output schema`);
      const input = TOOL_INPUTS[tool.name];
      if (!compile(tool.inputSchema)(input)) throw new Error(`${tool.name}'s inputSchema refuses the input here`);
      const called = await run.command('tools/call', ['--tool-name', tool.name, '--tool-args-json', JSON.stringify(input)]);
      if (called.result.isError === true) throw new Error(`${tool.name} answered with an error`);
      const payload = called.result.structuredContent;
      if (!payload) throw new Error(`${tool.name} returned no structuredContent`);
      const validate = compile(tool.outputSchema);
      if (!validate(payload)) throw new Error(`${tool.name}'s outputSchema refuses its result: ${JSON.stringify(validate.errors?.slice(0, 3))}`);
      const control = structuredClone(payload);
      delete control.schema;
      if (validate(control)) throw new Error(`${tool.name}'s outputSchema accepts a result without its schema field`);
      report.tools.push({ name: tool.name, inputSha256: sha256(JSON.stringify(input)), inputSchemaSha256: sha256(JSON.stringify(tool.inputSchema)),
        outputSchemaSha256: sha256(JSON.stringify(tool.outputSchema)), outputSha256: sha256(JSON.stringify(payload)),
        resultSchema: payload.schema, ok: payload.ok, inputValid: true, outputValid: true, controlRefused: true });
    }
    report.passed = report.tools.length === names.length;
  } catch (error) {
    report.failure = error instanceof Error ? error.message : String(error);
  }
  return report;
}

async function main(argv) {
  const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const url = option('--url', 'https://zodiacs.org/mcp');
  const results = option('--conformance-results');
  const out = option('--out', 'remote-mcp-review.json');
  const directory = process.env.MCP_TOOLS_DIR;
  if (!results || !directory) {
    console.error('usage: MCP_TOOLS_DIR=<dir> node scripts/remote-mcp-review.mjs --conformance-results <dir> [--url <url>] [--out <file>]');
    return 2;
  }
  const require = createRequire(resolve(directory, 'package.json'));
  const conformanceVersion = require('@modelcontextprotocol/conformance/package.json').version;
  const report = {
    schema: REPORT_SCHEMA,
    endpoint: url,
    producer: { commit: process.env.GITHUB_SHA ?? null, run: process.env.GITHUB_RUN_ID ?? null, node: process.version },
    lockSha256: existsSync(resolve(directory, 'package-lock.json')) ? sha256(readFileSync(resolve(directory, 'package-lock.json'))) : null,
    credentials: 'none: an empty, isolated OAuth store, stored-auth-only',
    conformance: { version: conformanceVersion, ...judgeConformance(readConformanceResults(results)) },
  };
  if (conformanceVersion !== CONFORMANCE_VERSION) {
    report.conformance.passed = false;
    report.conformance.problems.push(`suite ${conformanceVersion}, expected ${CONFORMANCE_VERSION}`);
  }
  report.inspector = await reviewTools(directory, url);
  report.passed = report.conformance.passed && report.inspector.passed;
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  const applied = report.conformance.scenarios.filter((row) => row.applies);
  console.log(`Conformance ${conformanceVersion}: ${applied.filter((row) => row.outcome !== 'FAILURE').length} of ${applied.length} scenarios that apply passed; ${report.conformance.scenarios.length - applied.length} others recorded as not applying.`);
  for (const problem of report.conformance.problems) console.log(`  problem: ${problem}`);
  console.log(`Inspector ${report.inspector.inspector}: ${report.inspector.tools.length} tools called and validated${report.inspector.failure ? `; failed: ${report.inspector.failure}` : ''}.`);
  return report.passed ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
