import { readFileSync, readdirSync } from 'node:fs';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { natalChart, positions } from '@zodiacs/engine';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import type { LocalTimeModule } from '../../src/lib/compute-api/local-time';
import * as sourceLocalTime from '../../src/lib/compute-api/local-time-source';
import * as bundledLocalTime from '../../api/_compute/local-time.mjs';
import { prepareLocalTime, resolveLocalToUtc } from '../../src/lib/time/localToUtc';
import { run, type HarnessRequest } from '../../scripts/lib/compute-api-harness';
import compatibilityHandler from '../../api/compatibility.js';

/*
 * The negative control for the compute API's privacy claim: nothing from a
 * request or its result reaches a log, the process's output, an error the
 * platform would record, a response header, or an error body.
 *
 * Every endpoint runs on canary inputs, through its successes and its
 * refusals, with the real Firewall SDK (its network call stubbed). Everything
 * the process writes to any console method, to stdout or stderr, anything the
 * handler throws or leaves unhandled, every response header and every error
 * body is collected and searched for each canary in every form it could take:
 * as sent, as the resolver turns it into an instant, as the engine turns it
 * into positions. A planted console.log(body) in the handler fails this test.
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
  DATE, TIME, ZONE, ZONE.toLowerCase(), encodeURIComponent(ZONE), INSTANT, LATER_DATE,
  ...numberForms(LATITUDE), ...numberForms(LONGITUDE),
  resolved.utc.toISOString(), String(resolved.utc.getTime()), later.toISOString(), String(later.getTime()),
  String(chart.angles!.asc), String(chart.bodies[1].lon), String(laterMoon.lon),
];
/** Sent in a query string, which the API ignores: these must appear nowhere at all. */
const QUERY_CANARIES = [QUERY_DATE, encodeURIComponent(QUERY_DATE), QUERY_PLACE];

const LOCAL = { date: DATE, time: TIME, zone: ZONE };

interface Scenario extends HarnessRequest {
  name: string;
  env?: Record<string, string>;
  firewall?: number;
  failingResolver?: boolean;
}

const SCENARIOS: Scenario[] = [
  { name: 'chart from local time', endpoint: 'chart', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE } },
  { name: 'chart from an instant', endpoint: 'chart', body: { utc: INSTANT, latitude: LATITUDE, longitude: LONGITUDE, houseSystem: 'koch' } },
  { name: 'houses from local time', endpoint: 'houses', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE, houseSystem: 'regiomontanus' } },
  { name: 'positions', endpoint: 'positions', body: { instants: [INSTANT, `${DATE}T${TIME}:00Z`] } },
  { name: 'events', endpoint: 'events', body: { from: INSTANT, to: '2071-12-23T17:43:09+05:45', bodies: ['Moon', 'Mercury'] } },
  { name: 'time with longitude', endpoint: 'time', body: { local: LOCAL, longitude: LONGITUDE } },
  { name: 'time without longitude', endpoint: 'time', body: { local: LOCAL } },
  { name: 'sky-fact on a date in a zone', endpoint: 'sky-fact', body: { kind: 'retrograde', body: 'Mercury', date: DATE, zone: ZONE } },
  { name: 'sky-fact at an instant', endpoint: 'sky-fact', body: { kind: 'sign', body: 'Moon', sign: 'leo', instant: INSTANT } },
  { name: 'sky-fact ingress on a date', endpoint: 'sky-fact', body: { kind: 'ingress', body: 'Moon', sign: 'leo', date: LATER_DATE, zone: ZONE } },
  { name: 'query string alongside a body', endpoint: 'chart', body: { utc: INSTANT, latitude: LATITUDE, longitude: LONGITUDE }, query: { utc: QUERY_DATE, latitude: QUERY_PLACE } },
  { name: 'GET with birth data in the query', endpoint: 'chart', method: 'GET', contentType: null, query: { utc: QUERY_DATE, latitude: QUERY_PLACE } },
  { name: 'preflight', endpoint: 'time', method: 'OPTIONS', contentType: null, query: { date: QUERY_DATE } },
  { name: 'invalid JSON quoting the input', endpoint: 'chart', body: `{"utc": "${INSTANT}", "latitude": ${LATITUDE}, ` },
  { name: 'unknown fields named after the input', endpoint: 'time', body: { local: LOCAL, [DATE]: TIME, [ZONE]: LONGITUDE } },
  { name: 'a latitude out of range', endpoint: 'chart', body: { local: LOCAL, latitude: 91.55537, longitude: LONGITUDE } },
  { name: 'an instant without a zone', endpoint: 'positions', body: { instants: [`${DATE}T${TIME}:00`] } },
  { name: 'a zone the server does not know', endpoint: 'time', body: { local: { date: DATE, time: TIME, zone: `${ZONE}_Island` } } },
  { name: 'a date that does not exist', endpoint: 'sky-fact', body: { kind: 'phase', phase: 'full', date: '1913-02-30', zone: ZONE } },
  { name: 'the wrong content type', endpoint: 'time', contentType: 'text/plain', body: JSON.stringify({ local: LOCAL }) },
  { name: 'a body over 16 KB', endpoint: 'positions', contentLength: null, body: JSON.stringify({ instants: Array(700).fill(INSTANT) }) },
  { name: 'over the positions budget', endpoint: 'positions', body: { instants: Array(101).fill(INSTANT) } },
  { name: 'over the events window', endpoint: 'events', body: { from: `${DATE}T${TIME}:00Z`, to: INSTANT } },
  { name: 'the switch off', endpoint: 'chart', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE }, env: { COMPUTE_API_ENABLED: '0' } },
  { name: 'rate limited', endpoint: 'houses', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE }, firewall: 429 },
  { name: 'Firewall rule not provisioned', endpoint: 'chart', body: { local: LOCAL, latitude: LATITUDE, longitude: LONGITUDE }, firewall: 404 },
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

interface Capture {
  logs: string[];
  output: string[];
  thrown: string[];
  restore: () => void;
}

function capture(): Capture {
  const logs: string[] = [];
  const output: string[] = [];
  const thrown: string[] = [];
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
  const onError = (error: unknown) => { thrown.push(render(error)); };
  process.on('uncaughtException', onError);
  process.on('unhandledRejection', onError);
  restorers.push(() => {
    process.off('uncaughtException', onError);
    process.off('unhandledRejection', onError);
  });
  return { logs, output, thrown, restore: () => restorers.reverse().forEach((restore) => restore()) };
}

interface Observation {
  scenario: string;
  logs: string[];
  output: string[];
  thrown: string[];
  headers: string;
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
    ...(firewall === 'none' ? { isRateLimited: async () => false } : {}),
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
    process.env.NODE_ENV = savedEnv;
    if (savedSwitch === undefined) delete process.env.COMPUTE_API_ENABLED;
    else process.env.COMPUTE_API_ENABLED = savedSwitch;
    vi.unstubAllGlobals();
  }
  return {
    scenario: scenario.name,
    logs: captured.logs,
    output: captured.output,
    thrown: captured.thrown,
    headers: response ? [...response.headers].map(([key, value]) => `${key}: ${value}`).join('\n') : '',
    body: response?.text ?? '',
    status: response?.status ?? 0,
    firewallCalls,
  };
}

function leaks(observation: Observation): string[] {
  const found: string[] = [];
  const places: Array<[string, string, readonly string[]]> = [
    ['console', observation.logs.join('\n'), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['stdout/stderr', observation.output.join('\n'), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['thrown', observation.thrown.join('\n'), [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['response headers', observation.headers, [...BODY_CANARIES, ...QUERY_CANARIES]],
    ['rate-limit request', observation.firewallCalls.join('\n'), BODY_CANARIES],
    [observation.status === 200 ? 'success body' : 'error body', observation.body,
      observation.status === 200 ? QUERY_CANARIES : [...BODY_CANARIES, ...QUERY_CANARIES]],
  ];
  for (const [place, text, canaries] of places) {
    for (const canary of canaries) if (text.includes(canary)) found.push(`${observation.scenario}: ${place} carries ${canary}`);
  }
  return found;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('compute API negative control', () => {
  it('computes the canaries it looks for, and they are distinctive', () => {
    expect(resolved.utc.toISOString()).toBe('1913-07-18T18:37:00.000Z');
    for (const canary of [...BODY_CANARIES, ...QUERY_CANARIES]) expect(canary.length).toBeGreaterThanOrEqual(5);
    expect(SCENARIOS.map((scenario) => scenario.endpoint)).toEqual(expect.arrayContaining(['chart', 'positions', 'houses', 'events', 'time', 'sky-fact']));
  });

  it('keeps every canary out of logs, output, errors, headers and error bodies, with the real Firewall SDK', async () => {
    const problems: string[] = [];
    const statuses = new Map<string, number>();
    for (const scenario of SCENARIOS) {
      const observation = await observe(scenario, bundledLocalTime, 'real');
      statuses.set(scenario.name, observation.status);
      problems.push(...leaks(observation));
      if (observation.thrown.length) problems.push(`${scenario.name}: the handler let an error escape`);
    }
    expect(problems).toEqual([]);
    // Both kinds of path ran: successes, and every refusal the API has.
    expect(new Set(statuses.values())).toEqual(new Set([200, 204, 400, 405, 413, 415, 422, 429, 500, 503]));
  }, 60_000);

  it('keeps every canary out of the same places when the compatibility function serves the request, as deployed', async () => {
    const problems: string[] = [];
    const statuses = new Set<number>();
    // The failing resolver cannot be planted in the deployed function; every other scenario runs.
    for (const scenario of SCENARIOS.filter((candidate) => !candidate.failingResolver)) {
      const observation = await observe(scenario, bundledLocalTime, 'real', compatibilityHandler);
      statuses.add(observation.status);
      problems.push(...leaks(observation));
      if (observation.thrown.length) problems.push(`${scenario.name}: the function let an error escape`);
    }
    expect(problems).toEqual([]);
    expect(statuses).toEqual(new Set([200, 204, 400, 405, 413, 415, 422, 429, 503]));
  }, 60_000);

  it('writes nothing at all to any console method or to the output when the rate limit is not consulted', async () => {
    for (const scenario of SCENARIOS.filter((candidate) => candidate.firewall === undefined)) {
      const observation = await observe(scenario, sourceLocalTime, 'none');
      expect(observation.logs, scenario.name).toEqual([]);
      expect(observation.output, scenario.name).toEqual([]);
      expect(observation.thrown, scenario.name).toEqual([]);
    }
  }, 60_000);

  it('sees what a leak would look like: a canary written to the console is caught', async () => {
    const planted = createComputeApiHandler({
      localTime: {
        ...sourceLocalTime,
        prepareLocalTime: async (date, zone) => {
          console.info('resolving', { date, zone });
          return sourceLocalTime.prepareLocalTime(date, zone);
        },
      },
      env: {},
      isRateLimited: async () => false,
    });
    const captured = capture();
    try {
      await run(planted, SCENARIOS[0]);
    } finally {
      captured.restore();
    }
    const observation: Observation = {
      scenario: 'planted', logs: captured.logs, output: captured.output, thrown: captured.thrown, headers: '', body: '', status: 0, firewallCalls: [],
    };
    expect(leaks(observation)).toEqual(expect.arrayContaining([`planted: console carries ${DATE}`, `planted: console carries ${ZONE}`]));
  });
});

describe('the site and the compute API', () => {
  it('is not called by any page, island or script of the site', () => {
    // The site's calculators compute in the browser; only the API's own
    // documentation names its paths, and only build-time modules import it.
    const root = new URL('../../', import.meta.url);
    const DOCUMENTS = new Set(['src/pages/developers/compute/index.astro']);
    const IMPORTERS = new Set(['src/pages/developers/compute/index.astro', 'src/lib/sky-api/schemas.ts', 'src/lib/sky-api/text.ts']);
    const PATHS = /\/api\/(?:v1\/(?:chart|positions|houses|events|time|sky-fact)\b|compute\b)/u;
    const IMPORT = /\bfrom\s+['"][^'"]*compute-api\/|\bimport\s*\(\s*['"][^'"]*compute-api\//u;
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(new URL(directory, root), { withFileTypes: true })) {
        const path = `${directory}${entry.name}`;
        if (entry.isDirectory()) {
          if (path !== 'src/lib/compute-api') walk(`${path}/`);
        } else if (/\.(?:astro|html|js|jsx|mjs|ts|tsx)$/u.test(entry.name)) {
          files.push(path);
        }
      }
    };
    walk('src/');
    walk('public/');
    expect(files.length).toBeGreaterThan(1000);
    const callers = files.filter((path) => {
      const text = readFileSync(new URL(path, root), 'utf8');
      return (PATHS.test(text) && !DOCUMENTS.has(path)) || (IMPORT.test(text) && !IMPORTERS.has(path));
    });
    expect(callers).toEqual([]);
    for (const path of DOCUMENTS) {
      if (files.includes(path)) expect(readFileSync(new URL(path, root), 'utf8')).not.toMatch(/<script\b/u);
    }
  });
});
