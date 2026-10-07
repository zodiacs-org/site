import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { natalChart, positions } from '@zodiacs/engine';
import {
  BUDGETS,
  BUDGET_MESSAGES,
  ERROR_CODES,
  ERROR_STATUS,
  MAX_BODY_BYTES,
  PREFLIGHT_HEADERS,
  RESPONSE_HEADERS,
  RETRY_AFTER_SECONDS,
} from '../../src/lib/compute-api/constants';
import { MESSAGES } from '../../src/lib/compute-api/errors';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import type { LocalTimeModule } from '../../src/lib/compute-api/local-time';
import * as sourceLocalTime from '../../src/lib/compute-api/local-time-source';
import { CONDITION_FIELD_POINTERS, INDEXED_POINTERS, VALIDATION_MESSAGES, VALIDATION_POINTERS } from '../../src/lib/compute-api/validate';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
const bundledLocalTime = createLocalTimeModule();
import { prepareLocalTime, resolveLocalToUtc } from '../../src/lib/time/localToUtc';
import { run, type HarnessRequest } from '../../scripts/lib/compute-api-harness';
import compatibilityHandler from '../../api/compatibility.js';

/*
 * The negative control for the compute API's privacy claim: nothing from a
 * request or its result reaches a log, the process's output, an error the
 * platform would record, a file, a global, a response header or reason
 * phrase, or an error body.
 *
 * Every endpoint runs on canary inputs, through its successes and its
 * refusals, with the real Firewall SDK (its network call stubbed). The test
 * collects everything the process writes to any console method, to stdout or
 * stderr, anything the handler throws or leaves unhandled, every call that
 * writes or changes a file, the global names and environment variables before
 * and after, and the response's status line, headers and body. Then:
 *
 * - no canary may appear anywhere but a success body, in the forms a leak is
 *   likeliest to take: as sent, as the resolver turns it into an instant, as
 *   the engine turns it into positions;
 * - the headers must be exactly the fixed set for the response's status, and
 *   the reason phrase must be the platform's own;
 * - every field of an error must come from the fixed catalogs: its code,
 *   message, pointer, limit, maximum and retry interval;
 * - nothing may be written to a file, and no global name or environment
 *   variable may be added.
 *
 * The last test plants one leak of each kind and checks that each is caught.
 */

// Canaries: synthetic, distinctive, and no one's birth.
const DATE = '1913-07-19';
const TIME = '04:37';
const ZONE = 'Australia/Lord_Howe';
const LATITUDE = -31.55537;
const LONGITUDE = 159.07735;
const INSTANT = '2071-11-23T17:43:09+05:45';
const LATER_DATE = '2071-11-23';
const QUERY_DATE = '1929-03-08T16:22:51Z';
const QUERY_PLACE = '-12.34579';
// Refused values: an error must not repeat them either.
const FAR_LATITUDE = 91.55537;
const FAR_LONGITUDE = 200.07735;
const MISSING_DATE = '1913-02-30';

function numberForms(value: number): string[] {
  return [String(value), String(Math.abs(value)), value.toFixed(3)];
}

await prepareLocalTime(DATE, ZONE);
const resolved = resolveLocalToUtc(DATE, TIME, ZONE, { longitude: LONGITUDE });
const chart = natalChart({ utc: resolved.utc, latitude: LATITUDE, longitude: LONGITUDE, houseSystem: 'placidus', timeKnown: true, flags: resolved.flags });
const later = new Date(Date.parse(INSTANT));
const laterMoon = positions(later).find((row) => row.body === 'Moon')!;

/** What must never leave the handler except in a success body. */
const BODY_CANARIES = [
  DATE, TIME, ZONE, ZONE.toLowerCase(), encodeURIComponent(ZONE), INSTANT, LATER_DATE, MISSING_DATE,
  ...numberForms(LATITUDE), ...numberForms(LONGITUDE), ...numberForms(FAR_LATITUDE), ...numberForms(FAR_LONGITUDE),
  resolved.utc.toISOString(), String(resolved.utc.getTime()), later.toISOString(), String(later.getTime()),
  String(chart.angles!.asc), String(chart.bodies[1].lon), String(laterMoon.lon),
];
/** Sent in a query string, which the API ignores: these must appear nowhere at all. */
const QUERY_CANARIES = [QUERY_DATE, encodeURIComponent(QUERY_DATE), QUERY_PLACE];

const LOCAL = { date: DATE, time: TIME, zone: ZONE };

interface Scenario extends HarnessRequest {
  name: string;
  env?: Record<string, string>;
  /** The status the stubbed Firewall answers with; 204 allows. */
  firewall?: number;
  failingResolver?: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: 'chart from local time', endpoint: 'chart', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE } },
  { name: 'chart from local time, zone in lower case', endpoint: 'chart', body: { local: { ...LOCAL, zone: ZONE.toLowerCase() }, latitude: LATITUDE, longitude: LONGITUDE } },
  { name: 'chart from an instant', endpoint: 'chart', body: { utc: INSTANT, latitude: LATITUDE, longitude: LONGITUDE, houseSystem: 'koch' } },
  { name: 'houses from local time', endpoint: 'houses', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE, houseSystem: 'regiomontanus' } },
  { name: 'positions', endpoint: 'positions', body: { instants: [INSTANT, `${DATE}T${TIME}:00Z`] } },
  { name: 'events', endpoint: 'events', body: { from: INSTANT, to: '2071-12-23T17:43:09+05:45', bodies: ['Moon', 'Mercury'] } },
  { name: 'time with longitude', endpoint: 'time', body: { local: LOCAL, longitude: LONGITUDE } },
  { name: 'time without longitude', endpoint: 'time', body: { local: LOCAL } },
  { name: 'sky-fact on a date in a zone', endpoint: 'sky-fact', body: { kind: 'retrograde', body: 'Mercury', date: DATE, zone: ZONE } },
  { name: 'sky-fact at an instant', endpoint: 'sky-fact', body: { kind: 'sign', body: 'Moon', sign: 'leo', instant: INSTANT } },
  { name: 'sky-fact ingress on a date', endpoint: 'sky-fact', body: { kind: 'ingress', body: 'Moon', sign: 'leo', date: LATER_DATE, zone: ZONE } },
  {
    name: 'elections at a place',
    endpoint: 'elections',
    body: { from: INSTANT, to: '2071-11-25T17:43:09+05:45', conditions: [{ kind: 'angular', body: 'Moon' }, { kind: 'phase', phase: 'waxing', not: true }], place: { latitude: LATITUDE, longitude: LONGITUDE, houseSystem: 'koch' } },
  },
  { name: 'query string alongside a body', endpoint: 'chart', body: { utc: INSTANT, latitude: LATITUDE, longitude: LONGITUDE }, query: { utc: QUERY_DATE, latitude: QUERY_PLACE } },
  { name: 'GET with birth data in the query', endpoint: 'chart', method: 'GET', contentType: null, query: { utc: QUERY_DATE, latitude: QUERY_PLACE } },
  { name: 'preflight', endpoint: 'time', method: 'OPTIONS', contentType: null, query: { date: QUERY_DATE } },
  { name: 'no endpoint name', endpoint: null, body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE } },
  { name: 'invalid JSON quoting the input', endpoint: 'chart', body: `{"utc": "${INSTANT}", "latitude": ${LATITUDE}, ` },
  { name: 'unknown fields named after the input', endpoint: 'time', body: { local: LOCAL, [DATE]: TIME, [ZONE]: LONGITUDE } },
  { name: 'a latitude out of range', endpoint: 'chart', body: { local: LOCAL, latitude: FAR_LATITUDE, longitude: LONGITUDE } },
  { name: 'a longitude out of range', endpoint: 'houses', body: { local: LOCAL, latitude: LATITUDE, longitude: FAR_LONGITUDE } },
  { name: 'an instant without a zone', endpoint: 'positions', body: { instants: [`${DATE}T${TIME}:00`] } },
  { name: 'a zone the server does not know', endpoint: 'time', body: { local: { date: DATE, time: TIME, zone: `${ZONE}_Island` } } },
  { name: 'a number where a string belongs', endpoint: 'time', body: { local: { date: DATE, time: TIME, zone: LONGITUDE } } },
  { name: 'a date that does not exist', endpoint: 'sky-fact', body: { kind: 'phase', phase: 'full', date: MISSING_DATE, zone: ZONE } },
  { name: 'a condition naming the input', endpoint: 'elections', body: { from: INSTANT, to: '2071-11-25T17:43:09+05:45', conditions: [{ kind: 'sign', body: 'Moon', sign: DATE }] } },
  { name: 'an election place out of range', endpoint: 'elections', body: { from: INSTANT, to: '2071-11-25T17:43:09+05:45', conditions: [{ kind: 'angular', body: 'Sun' }], place: { latitude: FAR_LATITUDE, longitude: LONGITUDE } } },
  { name: 'the wrong content type', endpoint: 'time', contentType: 'text/plain', body: JSON.stringify({ local: LOCAL }) },
  { name: 'a body over 16 KB', endpoint: 'positions', contentLength: null, body: JSON.stringify({ instants: Array(700).fill(INSTANT) }) },
  { name: 'over the positions budget', endpoint: 'positions', body: { instants: Array(101).fill(INSTANT) } },
  { name: 'over the events window', endpoint: 'events', body: { from: `${DATE}T${TIME}:00Z`, to: INSTANT } },
  { name: 'over the elections window', endpoint: 'elections', body: { from: `${DATE}T${TIME}:00Z`, to: INSTANT, conditions: [{ kind: 'void-of-course' }] } },
  { name: 'the switch off', endpoint: 'chart', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE }, env: { COMPUTE_API_ENABLED: '0' } },
  { name: 'rate limited', endpoint: 'houses', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE }, firewall: 429 },
  { name: 'Firewall rule not provisioned', endpoint: 'chart', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE }, firewall: 404 },
  { name: 'Firewall failing', endpoint: 'events', body: { from: INSTANT, to: '2071-12-23T17:43:09+05:45' }, firewall: 502 },
  { name: 'a resolver that fails', endpoint: 'time', body: { local: LOCAL, longitude: LONGITUDE }, failingResolver: true },
];

const FAILING: LocalTimeModule = {
  ...sourceLocalTime,
  prepareLocalTime: async () => { throw new Error(`resolver failed for ${DATE} ${TIME} in ${ZONE} at ${LONGITUDE}`); },
};

function render(value: unknown): string {
  const parts = [inspect(value, { depth: Infinity, maxArrayLength: Infinity, maxStringLength: Infinity, breakLength: Infinity })];
  if (value instanceof Uint8Array) parts.push(Buffer.from(value).toString('utf8'));
  if (value instanceof Error) {
    parts.push(String(value.message), String(value.stack));
    let cause: unknown = (value as { cause?: unknown }).cause;
    while (cause) {
      parts.push(render(cause));
      cause = cause instanceof Error ? (cause as { cause?: unknown }).cause : undefined;
    }
  }
  try { parts.push(JSON.stringify(value) ?? ''); } catch { /* circular: inspect has it */ }
  return parts.join('\n');
}

// ---------- what the process does while a request is answered ----------

const require = createRequire(import.meta.url);
const fsModule = require('node:fs') as Record<string, unknown>;
const fsPromises = require('node:fs/promises') as Record<string, unknown>;
/** Every fs function that writes, creates, moves or removes a file. */
const WRITING = ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'createWriteStream', 'write', 'writeSync',
  'writev', 'writevSync', 'copyFile', 'copyFileSync', 'cp', 'cpSync', 'rename', 'renameSync', 'mkdir', 'mkdirSync',
  'mkdtemp', 'mkdtempSync', 'truncate', 'truncateSync', 'ftruncate', 'ftruncateSync', 'rm', 'rmSync', 'rmdir',
  'rmdirSync', 'unlink', 'unlinkSync', 'symlink', 'symlinkSync', 'link', 'linkSync'];
const OPENING = ['open', 'openSync'];
/** An open flag that writes: w, a or + in a string, or any access mode but read-only in a number. */
const writesTo = (flags: unknown) => (typeof flags === 'string' ? /[wa+]/u.test(flags) : typeof flags === 'number' ? (flags & 3) !== 0 : false);

interface Capture {
  logs: string[];
  output: string[];
  thrown: string[];
  files: string[];
  restore: () => void;
}

function capture(): Capture {
  const logs: string[] = [];
  const output: string[] = [];
  const thrown: string[] = [];
  const files: string[] = [];
  const restorers: Array<() => void> = [];
  for (const key of Object.keys(console) as (keyof Console)[]) {
    const original = console[key];
    if (typeof original !== 'function') continue;
    (console as any)[key] = (...args: unknown[]) => { logs.push(`${String(key)}: ${args.map(render).join(' ')}`); };
    restorers.push(() => { (console as any)[key] = original; });
  }
  for (const stream of [process.stdout, process.stderr]) {
    const original = stream.write;
    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      output.push(render(chunk));
      return (original as any).call(stream, chunk, ...rest);
    }) as typeof stream.write;
    restorers.push(() => { stream.write = original; });
  }
  // File writes through node:fs and node:fs/promises, including the ES module
  // bindings (syncBuiltinESMExports), are recorded and then carried out.
  for (const [label, module] of [['fs', fsModule], ['fs/promises', fsPromises]] as const) {
    for (const name of [...WRITING, ...OPENING]) {
      const original = module[name];
      if (typeof original !== 'function') continue;
      module[name] = function watched(this: unknown, ...args: unknown[]) {
        if (!OPENING.includes(name) || writesTo(args[1])) files.push(`${label}.${name}: ${args.map(render).join(' ')}`);
        return (original as (...a: unknown[]) => unknown).apply(this, args);
      };
      restorers.push(() => { module[name] = original; });
    }
  }
  syncBuiltinESMExports();
  restorers.push(() => syncBuiltinESMExports());
  const onError = (error: unknown) => { thrown.push(render(error)); };
  process.on('uncaughtException', onError);
  process.on('unhandledRejection', onError);
  restorers.push(() => {
    process.off('uncaughtException', onError);
    process.off('unhandledRejection', onError);
  });
  return { logs, output, thrown, files, restore: () => restorers.reverse().forEach((restore) => restore()) };
}

/** The names on globalThis and in process.env; none may appear while requests are answered. */
function globalNames(): Set<string> {
  return new Set([
    ...Reflect.ownKeys(globalThis).map((key) => `globalThis.${String(key)}`),
    ...Object.keys(process.env).map((key) => `process.env.${key}`),
  ]);
}
const GLOBALS_BEFORE_ANY_REQUEST = globalNames();

interface Observation {
  scenario: string;
  logs: string[];
  output: string[];
  thrown: string[];
  files: string[];
  statusMessage: unknown;
  headers: Map<string, string>;
  body: string;
  status: number;
  firewallCalls: string[];
}

/**
 * One scenario through a handler built here, or, with `entry`, through the
 * function as deployed: api/compatibility.ts with the process's environment.
 */
async function observe(
  scenario: Scenario,
  localTime: LocalTimeModule,
  firewall: 'real' | 'none',
  entry?: (req: any, res: any) => Promise<void>,
): Promise<Observation> {
  const firewallCalls: string[] = [];
  const savedEnv = process.env.NODE_ENV;
  const savedSwitch = process.env.COMPUTE_API_ENABLED;
  if (entry && scenario.env?.COMPUTE_API_ENABLED !== undefined) process.env.COMPUTE_API_ENABLED = scenario.env.COMPUTE_API_ENABLED;
  if (firewall === 'real') {
    process.env.NODE_ENV = 'production';
    vi.stubGlobal('fetch', async (url: unknown, init?: { headers?: Headers }) => {
      firewallCalls.push(render(url), render(init?.headers ? [...new Headers(init.headers).entries()] : []));
      return new Response(null, { status: scenario.firewall ?? 204 });
    });
  }
  const handler = entry ?? createComputeApiHandler({
    localTime: scenario.failingResolver ? FAILING : localTime,
    env: scenario.env ?? {},
    ...(firewall === 'none' ? { rateLimit: async () => 'allowed' as const } : {}),
  });
  const captured = capture();
  let response: Awaited<ReturnType<typeof run>> | null = null;
  try {
    response = await run(handler, scenario);
  } catch (error) {
    captured.thrown.push(render(error));
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    captured.restore();
    if (savedEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedEnv;
    if (savedSwitch === undefined) delete process.env.COMPUTE_API_ENABLED;
    else process.env.COMPUTE_API_ENABLED = savedSwitch;
    vi.unstubAllGlobals();
  }
  return {
    scenario: scenario.name,
    logs: captured.logs,
    output: captured.output,
    thrown: captured.thrown,
    files: captured.files,
    statusMessage: response?.statusMessage,
    headers: response?.headers ?? new Map(),
    body: response?.text ?? '',
    status: response?.status ?? 0,
    firewallCalls,
  };
}

// ---------- what an answer may carry ----------

const lower = (headers: Readonly<Record<string, string>>) => new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
const RETRY_AFTER: Readonly<Record<string, number>> = {
  'rate-limited': RETRY_AFTER_SECONDS.rateLimited,
  'rate-limit-unavailable': RETRY_AFTER_SECONDS.rateLimitUnavailable,
  disabled: RETRY_AFTER_SECONDS.disabled,
};

/** The exact headers of an answer: fixed for its status, with Allow or Retry-After for the refusals that send them. */
function expectedHeaders(status: number, code: string | undefined): Map<string, string> {
  if (status === 204) return lower(PREFLIGHT_HEADERS);
  const headers = lower(RESPONSE_HEADERS);
  if (status === 405) headers.set('allow', 'POST, OPTIONS');
  if (code !== undefined && RETRY_AFTER[code] !== undefined) headers.set('retry-after', String(RETRY_AFTER[code]));
  return headers;
}

const MESSAGE_CATALOG = new Set<string>([...Object.values(MESSAGES), ...Object.values(VALIDATION_MESSAGES), ...Object.values(BUDGET_MESSAGES)]);
const LIMITS = new Map<string, number>([...Object.entries(BUDGETS), ['body.bytes', MAX_BODY_BYTES]]);
const INDEXED = new RegExp(`^(?:${INDEXED_POINTERS.join('|')})/(?:0|[1-9]\\d{0,2})$`, 'u');
/** A field of one election condition: /conditions/2/body. */
const CONDITION_FIELD = new RegExp(`^/conditions/(?:0|[1-9]\\d{0,2})/(?:${CONDITION_FIELD_POINTERS.join('|')})$`, 'u');

/** Every field of a refusal from a fixed catalog, and nothing else in it. */
function catalogProblems(observation: Observation): string[] {
  const problems: string[] = [];
  const say = (what: string) => problems.push(`${observation.scenario}: ${what}`);
  if (observation.status < 400) return problems;
  let parsed: any;
  try { parsed = JSON.parse(observation.body); } catch { say('the error body is not JSON'); return problems; }
  if (Object.keys(parsed ?? {}).join() !== 'error') say('the error body has fields besides error');
  const error = parsed?.error ?? {};
  for (const key of Object.keys(error)) {
    if (!['code', 'message', 'pointer', 'limit', 'max', 'retryAfterSeconds'].includes(key)) say(`the error has a field outside the catalog (${key.length} characters)`);
  }
  if (!(ERROR_CODES as readonly string[]).includes(error.code) || ERROR_STATUS[error.code as keyof typeof ERROR_STATUS] !== observation.status) say('the error code is not the catalog code for its status');
  if (!MESSAGE_CATALOG.has(error.message)) say('the error message is not a fixed sentence');
  if ('pointer' in error && !((VALIDATION_POINTERS as readonly string[]).includes(error.pointer) || INDEXED.test(error.pointer) || CONDITION_FIELD.test(error.pointer))) say('the pointer is not a field the schema names');
  if ('pointer' in error !== (error.code === 'invalid-request')) say('a pointer where there should be none, or none where there should be one');
  if ('limit' in error || 'max' in error) {
    if (LIMITS.get(error.limit) !== error.max) say('the limit and maximum are not a catalog pair');
  }
  if ('retryAfterSeconds' in error && RETRY_AFTER[error.code] !== error.retryAfterSeconds) say('the retry interval is not the catalog interval for its code');
  return problems;
}

function leaks(observation: Observation): string[] {
  const found: string[] = [];
  const headers = [...observation.headers].map(([key, value]) => `${key}: ${value}`).join('\n');
  const places: Array<[string, string, readonly string[]]> = [
    ['console', observation.logs.join('\n'), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['stdout/stderr', observation.output.join('\n'), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['thrown', observation.thrown.join('\n'), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['a file', observation.files.join('\n'), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['response headers', headers, [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['status message', render(observation.statusMessage), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['rate-limit request', observation.firewallCalls.join('\n'), BODY_CANARIES],
    [observation.status === 200 ? 'success body' : 'error body', observation.body,
      observation.status === 200 ? QUERY_CANARIES : [...BODY_CANARIES, ...QUERY_CANARIES]],
  ];
  for (const [place, text, canaries] of places) {
    for (const canary of canaries) if (text.includes(canary)) found.push(`${observation.scenario}: ${place} carries ${canary}`);
  }
  if (observation.files.length) found.push(`${observation.scenario}: wrote to a file (${observation.files.length} calls)`);
  if (observation.statusMessage !== undefined) found.push(`${observation.scenario}: set a status message of its own`);
  let code: string | undefined;
  try { code = JSON.parse(observation.body)?.error?.code; } catch { code = undefined; }
  const expected = expectedHeaders(observation.status, code);
  const sent = new Map([...observation.headers].map(([key, value]) => [key.toLowerCase(), value]));
  if (JSON.stringify([...sent].sort()) !== JSON.stringify([...expected].sort())) {
    found.push(`${observation.scenario}: headers differ from the fixed set (${[...sent.keys()].filter((key) => expected.get(key) !== sent.get(key)).length} added or changed, ${[...expected.keys()].filter((key) => !sent.has(key)).length} missing)`);
  }
  found.push(...catalogProblems(observation));
  return found;
}

function newGlobals(): string[] {
  return [...globalNames()].filter((name) => !GLOBALS_BEFORE_ANY_REQUEST.has(name));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('compute API negative control', () => {
  it('computes the canaries it looks for, and they are distinctive', () => {
    expect(resolved.utc.toISOString()).toBe('1913-07-18T18:37:00.000Z');
    for (const canary of [...BODY_CANARIES, ...QUERY_CANARIES]) expect(canary.length).toBeGreaterThanOrEqual(5);
    expect(SCENARIOS.map((scenario) => scenario.endpoint)).toEqual(expect.arrayContaining(['chart', 'positions', 'houses', 'events', 'time', 'sky-fact', 'elections']));
  });

  it('keeps every canary out of logs, output, errors, files, globals, headers and error bodies, with the real Firewall SDK', async () => {
    const problems: string[] = [];
    const statuses = new Map<string, number>();
    for (const scenario of SCENARIOS) {
      const observation = await observe(scenario, bundledLocalTime, 'real');
      statuses.set(scenario.name, observation.status);
      problems.push(...leaks(observation));
      if (observation.thrown.length) problems.push(`${scenario.name}: the handler let an error escape`);
    }
    expect(problems).toEqual([]);
    expect(newGlobals()).toEqual([]);
    // Both kinds of path ran: successes, and every refusal the API has.
    expect(new Set(statuses.values())).toEqual(new Set([200, 204, 400, 404, 405, 413, 415, 422, 429, 500, 503]));
    // The API fails closed: without the rule, or with the Firewall failing, nothing is computed.
    expect(statuses.get('Firewall rule not provisioned')).toBe(503);
    expect(statuses.get('Firewall failing')).toBe(503);
  }, 60_000);

  it('keeps every canary out of the same places when the compatibility function serves the request, as deployed', async () => {
    const problems: string[] = [];
    const statuses = new Set<number>();
    // The failing resolver cannot be planted in the deployed function, and a
    // request without the endpoint parameter is one of the function's own routes.
    for (const scenario of SCENARIOS.filter((candidate) => !candidate.failingResolver && candidate.endpoint !== null)) {
      const observation = await observe(scenario, bundledLocalTime, 'real', compatibilityHandler);
      statuses.add(observation.status);
      problems.push(...leaks(observation));
      if (observation.thrown.length) problems.push(`${scenario.name}: the function let an error escape`);
    }
    expect(problems).toEqual([]);
    expect(newGlobals()).toEqual([]);
    expect(statuses).toEqual(new Set([200, 204, 400, 405, 413, 415, 422, 429, 503]));
  }, 60_000);

  it('writes nothing at all to any console method, the output or a file when the rate limit is not consulted', async () => {
    for (const scenario of SCENARIOS.filter((candidate) => candidate.firewall === undefined)) {
      const observation = await observe(scenario, sourceLocalTime, 'none');
      expect(observation.logs, scenario.name).toEqual([]);
      expect(observation.output, scenario.name).toEqual([]);
      expect(observation.thrown, scenario.name).toEqual([]);
      expect(observation.files, scenario.name).toEqual([]);
    }
    expect(newGlobals()).toEqual([]);
  }, 60_000);

  it('sees what a leak would look like: one planted leak of each kind is caught', async () => {
    const base = createComputeApiHandler({ localTime: sourceLocalTime, env: {}, rateLimit: async () => 'allowed' });
    const request = SCENARIOS.find((scenario) => scenario.name === 'chart from local time')!;
    const refused = SCENARIOS.find((scenario) => scenario.name === 'a longitude out of range')!;
    const leakFile = `${tmpdir()}/compute-negative-control-${process.pid}.json`;
    const plants: Array<[string, Scenario, (req: any, res: any) => Promise<void>, string]> = [
      ['console', request, async (req, res) => { console.info('resolving', LOCAL); await base(req, res); }, `console carries ${DATE}`],
      ['error repeating the refused longitude', refused, async (req, res) => {
        const end = res.end.bind(res);
        res.end = (text: string) => end(text.replace('from -180 to 180.', `from -180 to 180. Got ${FAR_LONGITUDE}.`));
        await base(req, res);
      }, 'the error message is not a fixed sentence'],
      ['header carrying the latitude to one decimal', request, async (req, res) => {
        res.setHeader('X-Region', LATITUDE.toFixed(1));
        await base(req, res);
      }, 'headers differ from the fixed set (1 added or changed, 0 missing)'],
      ['status message carrying the zone', request, async (req, res) => {
        await base(req, res);
        res.statusMessage = `OK ${ZONE}`;
      }, 'set a status message of its own'],
      ['the body written to a file', request, async (req, res) => {
        const fs = await import('node:fs');
        fs.writeFileSync(leakFile, JSON.stringify(req.body ?? LOCAL));
        await base(req, res);
      }, 'wrote to a file (1 calls)'],
    ];
    for (const [name, scenario, planted, expected] of plants) {
      const captured = capture();
      let response: Awaited<ReturnType<typeof run>> | null = null;
      try {
        response = await run(planted, scenario);
      } finally {
        captured.restore();
      }
      const observation: Observation = {
        scenario: 'planted', logs: captured.logs, output: captured.output, thrown: captured.thrown, files: captured.files,
        statusMessage: response?.statusMessage, headers: response?.headers ?? new Map(), body: response?.text ?? '', status: response?.status ?? 0, firewallCalls: [],
      };
      expect(leaks(observation), name).toEqual(expect.arrayContaining([`planted: ${expected}`]));
    }
    unlinkSync(leakFile);
    // A global keeping the body.
    (globalThis as any).__plantedComputeBody = LOCAL;
    try {
      expect(newGlobals()).toEqual(['globalThis.__plantedComputeBody']);
    } finally {
      delete (globalThis as any).__plantedComputeBody;
    }
    expect(newGlobals()).toEqual([]);
  });
});

describe('the site and the compute API', () => {
  it('is not called by any page, island or script of the site', () => {
    // The site's calculators compute in the browser; only the API's own
    // documentation names its paths, and only build-time modules import it.
    const root = new URL('../../', import.meta.url);
    const DOCUMENTS = new Set(['src/pages/developers/compute/index.astro']);
    const IMPORTERS = new Set(['src/pages/developers/compute/index.astro', 'src/lib/sky-api/schemas.ts', 'src/lib/sky-api/text.ts']);
    // The local MCP adapter bundles the compute API's own parsers and
    // calculations into examples/mcp-server/server.mjs and runs them on the
    // user's machine, and its descriptions name the endpoints whose answers it
    // matches. It is no page, island or script of the site: nothing the site
    // serves imports it, which the end of this test holds, and its bundle makes
    // no network request, which scripts/mcp-artifact.test.mjs holds.
    const ADAPTER = 'src/mcp/';
    // Every way a module names another: from, a bare side-effect import, a
    // dynamic import with any quote, and require. An AI review found the first
    // two forms alone let a side-effect import and a template-literal import
    // through.
    const importOf = (target: string) => new RegExp(
      `(?:\\bfrom\\s*|\\bimport\\s*|\\bimport\\s*\\(\\s*|\\brequire\\s*\\(\\s*)['"\`][^'"\`]*${target}`, 'u');
    const ADAPTER_IMPORT = importOf('\\/mcp\\/');
    const PATHS = /\/api\/(?:v1\/(?:chart|positions|houses|events|time|sky-fact|elections)\b|compute\b)/u;
    const IMPORT = importOf('compute-api(?:\\/|[\'"\`])');
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(new URL(directory, root), { withFileTypes: true })) {
        const path = `${directory}${entry.name}`;
        if (entry.isDirectory()) {
          if (path !== 'src/lib/compute-api') walk(`${path}/`);
        } else if (/\.(?:astro|html|mdx|js|jsx|mjs|cjs|ts|tsx|mts|cts)$/u.test(entry.name)) {
          files.push(path);
        }
      }
    };
    walk('src/');
    walk('public/');
    expect(files.length).toBeGreaterThan(1000);
    const callers = files.filter((path) => {
      if (path.startsWith(ADAPTER)) return false;
      const text = readFileSync(new URL(path, root), 'utf8');
      return (PATHS.test(text) && !DOCUMENTS.has(path)) || (IMPORT.test(text) && !IMPORTERS.has(path));
    });
    expect(callers).toEqual([]);
    expect(files.filter((path) => path.startsWith(ADAPTER) && IMPORT.test(readFileSync(new URL(path, root), 'utf8'))).length).toBeGreaterThan(0);
    expect(files.filter((path) => !path.startsWith(ADAPTER) && ADAPTER_IMPORT.test(readFileSync(new URL(path, root), 'utf8')))).toEqual([]);
    for (const path of DOCUMENTS) {
      if (files.includes(path)) expect(readFileSync(new URL(path, root), 'utf8')).not.toMatch(/<script\b/u);
    }
  });
});
