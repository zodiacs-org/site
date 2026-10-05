/**
 * get_positions, find_events and check_sky_fact against the hosted compute API
 * whose parsers and calculations they run.
 *
 * Over a seeded corpus, each result is the body the compute API's own handler
 * answers for the same JSON, except for `cite.url`, and each refusal is the
 * handler's own sentence. Every result is held to the output schema a host
 * reads, in zod and as the JSON Schema `tools/list` advertises, and to the
 * compute API's OpenAPI response schema; the SDK's own client drives the
 * registrations in one process.
 *
 * Every instant and date here is seeded and synthetic.
 */
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import {
  BUDGETS, EPOCH, EVENT_BODIES, EVENT_KINDS, PHASE_NAMES, POSITION_BODIES, SIGN_SLUGS, SKY_FACT_KINDS,
  STATION_BODIES, type ComputeEndpoint,
} from '../lib/compute-api/constants';
import { createComputeApiHandler } from '../lib/compute-api/handler';
import * as localTime from '../lib/compute-api/local-time-source';
import { COMPUTE_COMPONENTS, responseComponentName } from '../lib/compute-api/openapi';
import { run } from '../../scripts/lib/compute-api-harness';
import { LIMITS } from './bounds';
import { SKY_TOOLS, toolUrl, type SkyToolName } from './cite';
import { createServer } from './create-server';
import { EVENTS_OUTPUT, POSITIONS_OUTPUT, SKY_FACT_OUTPUT } from './outputs';
import { RESOURCES, methodology } from './resources';
import { ANY_ZONE_DAY_TEXT, checkSkyFact, findEvents, getPositions } from './sky-tools';
import { UNSUPPORTED, describeCapabilities, type ToolOutcome } from './tools';

/** mulberry32: a small seeded generator, so the corpus is the same on every run. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');
const DAY = 86_400_000;
const FIRST = Date.UTC(1800, 0, 2);
const LAST = Date.UTC(2199, 11, 30);

/** An instant inside the accepted span, written with Z or an offset, with seconds or milliseconds or neither. */
function instantFor(random: () => number, from = FIRST, to = LAST): string {
  const ms = Math.floor(from + random() * (to - from));
  const form = random();
  const utc = new Date(ms).toISOString();
  if (form < 0.4) return `${utc.slice(0, 19)}Z`;
  if (form < 0.5) return utc;
  if (form < 0.6) return `${utc.slice(0, 16)}Z`;
  const offsetMinutes = (Math.floor(random() * 57) - 28) * 30;
  const wall = new Date(Math.floor(ms / 1000) * 1000 + offsetMinutes * 60_000).toISOString().slice(0, 19);
  const magnitude = Math.abs(offsetMinutes);
  return `${wall}${offsetMinutes < 0 ? '-' : '+'}${pad(Math.floor(magnitude / 60))}:${pad(magnitude % 60)}`;
}

const dateFor = (random: () => number) => new Date(FIRST + Math.floor(random() * ((LAST - FIRST) / DAY)) * DAY).toISOString().slice(0, 10);
const pick = <T>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length)];

/** A non-empty subset in random order, each member once. */
function subset<T>(random: () => number, list: readonly T[]): T[] {
  const chosen = list.filter(() => random() < 0.4);
  const members = chosen.length > 0 ? chosen : [pick(random, list)];
  return members.map((member) => ({ member, key: random() })).sort((a, b) => a.key - b.key).map(({ member }) => member);
}

type Args = Record<string, unknown>;

function positionsCorpus(): Args[] {
  const random = generator(20261005);
  const cases: Args[] = [];
  for (let index = 0; index < 60; index += 1) {
    const count = index < 3 ? BUDGETS['positions.instants'] : 1 + Math.floor(random() ** 2 * 12);
    const args: Args = { instants: Array.from({ length: count }, () => instantFor(random)) };
    if (random() < 0.5) args.bodies = subset(random, POSITION_BODIES);
    cases.push(args);
  }
  // The ends of the span, written both ways.
  cases.push({ instants: ['1800-01-01T00:00:00Z', '2199-12-31T23:59:59.999Z', '1800-01-01T09:00:00+09:00', '2199-12-31T13:59:59-10:00'] });
  return cases;
}

function eventsCorpus(): Args[] {
  const random = generator(20261006);
  const cases: Args[] = [];
  for (let index = 0; index < 24; index += 1) {
    const days = index < 2 ? BUDGETS['events.windowDays'] : 1 + Math.floor(random() * BUDGETS['events.windowDays']);
    const fromMs = FIRST + random() * (LAST - FIRST - days * DAY);
    // The window is measured from the start as written, which may round it to the minute.
    const from = instantFor(random, fromMs, fromMs + 1);
    const args: Args = { from, to: new Date(Date.parse(from) + days * DAY).toISOString() };
    if (random() < 0.6) args.bodies = subset(random, EVENT_BODIES);
    if (random() < 0.6) args.kinds = subset(random, EVENT_KINDS);
    cases.push(args);
  }
  // A window whose events are known: Mercury stations and the Moon's cycle in spring 2026.
  cases.push({ from: '2026-02-01T00:00:00Z', to: '2026-04-30T00:00:00Z' });
  return cases;
}

function skyFactCorpus(): Args[] {
  const random = generator(20261007);
  const cases: Args[] = [];
  for (let index = 0; index < 160; index += 1) {
    const kind = SKY_FACT_KINDS[index % SKY_FACT_KINDS.length];
    const when = (kind === 'sign' || kind === 'retrograde') && random() < 0.5
      ? { instant: instantFor(random) } : { date: dateFor(random) };
    if (kind === 'phase') cases.push({ kind, phase: pick(random, PHASE_NAMES), date: dateFor(random) });
    else if (kind === 'retrograde') cases.push({ kind, body: pick(random, EVENT_BODIES), ...when });
    else cases.push({ kind, body: pick(random, EVENT_BODIES), sign: pick(random, SIGN_SLUGS), ...(kind === 'ingress' ? { date: dateFor(random) } : when) });
  }
  return cases;
}

const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });
const hosted = async (endpoint: ComputeEndpoint, body: unknown) => run(handler, { endpoint, body });

const value = (outcome: ToolOutcome) => {
  if (!outcome.ok) throw new Error(`refused: ${outcome.refusal}`);
  return outcome.value as Record<string, any>;
};

const positions = positionsCorpus().map((args) => ({ args, value: value(getPositions(args as any)) }));
const events = eventsCorpus().map((args) => ({ args, value: value(findEvents(args as any)) }));
const facts = await Promise.all(skyFactCorpus().map(async (args) => ({ args, value: value(await checkSkyFact(args as any)) })));

// Facts chosen from the engine's own answers, so that every answer appears: a
// station, an ingress and a lunation found by find_events, each read on its own
// date, answer depends; Saturn's and the Sun's signs, read where get_positions
// puts them, answer true.
const known = value(findEvents({ from: '2026-02-01T00:00:00Z', to: '2026-04-30T00:00:00Z' })).result.events as any[];
const station = known.find((event) => event.kind === 'station');
const ingress = known.find((event) => event.kind === 'ingress');
const lunation = known.find((event) => event.kind === 'lunation');
const noon = value(getPositions({ instants: ['2026-10-15T12:00:00Z'] })).result.instants[0].bodies as any[];
const signOf = (name: string) => noon.find((row) => row.body === name).sign;
for (const args of [
  { kind: 'retrograde', body: station.body, date: station.at.slice(0, 10) },
  { kind: 'ingress', body: ingress.body, sign: ingress.sign, date: ingress.at.slice(0, 10) },
  { kind: 'phase', phase: lunation.type, date: lunation.at.slice(0, 10) },
  { kind: 'sign', body: ingress.body, sign: ingress.sign, date: ingress.at.slice(0, 10) },
  { kind: 'sign', body: 'Sun', sign: signOf('Sun'), instant: '2026-10-15T12:00:00Z' },
  { kind: 'sign', body: 'Saturn', sign: signOf('Saturn'), date: '2026-10-15' },
]) facts.push({ args, value: value(await checkSkyFact(args as any)) });

const all: [SkyToolName, Args, Record<string, any>][] = [
  ...positions.map(({ args, value }) => ['get_positions', args, value] as [SkyToolName, Args, Record<string, any>]),
  ...events.map(({ args, value }) => ['find_events', args, value] as [SkyToolName, Args, Record<string, any>]),
  ...facts.map(({ args, value }) => ['check_sky_fact', args, value] as [SkyToolName, Args, Record<string, any>]),
];

describe("the three tools are the compute API's calculations", () => {
  it("returns, for every request of the corpus, the body the compute API's handler answers, with the tool's cite", async () => {
    expect(all).toHaveLength(61 + 25 + 166);
    for (const [tool, args, result] of all) {
      const response = await hosted(SKY_TOOLS[tool], args);
      expect(response.status, `${tool} ${JSON.stringify(args).slice(0, 120)}`).toBe(200);
      const { cite: hostedCite, ...hostedRest } = response.json;
      const { cite, ...rest } = result;
      expect(rest).toEqual(hostedRest);
      // The same receipt, so the same digest; only the documentation link differs.
      expect(cite).toEqual({ ...hostedCite, url: toolUrl(tool) });
    }
  }, 240_000);

  it('covers every answer a fact can have, on both forms', () => {
    const seen = new Set(facts.map(({ value }) => `${value.result.fact.kind} ${value.result.basis} ${value.result.answer}`));
    for (const kind of ['sign', 'retrograde']) {
      for (const answer of ['true', 'false']) expect(seen).toContain(`${kind} instant ${answer}`);
      for (const answer of ['true', 'false', 'depends']) expect(seen).toContain(`${kind} any-zone-day ${answer}`);
    }
    // A date read in every UTC offset at once cannot hold an ingress or a lunation for all of them.
    for (const kind of ['ingress', 'phase']) {
      for (const answer of ['false', 'depends']) expect(seen).toContain(`${kind} any-zone-day ${answer}`);
      expect(seen).not.toContain(`${kind} any-zone-day true`);
    }
    // Every event kind and every station body the corpus reaches comes back from find_events.
    const kinds = new Set(events.flatMap(({ value }) => value.result.events.map((event: any) => event.kind)));
    expect([...kinds].sort()).toEqual([...EVENT_KINDS].sort());
    expect(STATION_BODIES).toContain(station.body);
  });

  it("holds every result to its output schema, to the JSON Schema a host reads, and to the compute API's OpenAPI response", async () => {
    const schemas = { get_positions: POSITIONS_OUTPUT, find_events: EVENTS_OUTPUT, check_sky_fact: SKY_FACT_OUTPUT };
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const OPENAPI_ID = 'https://zodiacs.org/api/v1/openapi.json';
    ajv.addSchema({ $id: OPENAPI_ID, components: { schemas: COMPUTE_COMPONENTS } });
    const server = createServer(() => undefined);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'zodiacs-sky-tools-test', version: '1.0.0' });
    await client.connect(clientSide);
    const listed = (await client.listTools()).tools;
    for (const [tool, , result] of all) {
      expect(() => schemas[tool].parse(result), tool).not.toThrow();
      const advertised = ajv.compile(listed.find(({ name }) => name === tool)!.outputSchema as object);
      expect(advertised(result), `${tool}: ${ajv.errorsText(advertised.errors)}`).toBe(true);
      const openapi = ajv.getSchema(`${OPENAPI_ID}#/components/schemas/${responseComponentName(SKY_TOOLS[tool])}`)!;
      expect(openapi(result), `${tool}: ${ajv.errorsText(openapi.errors)}`).toBe(true);
    }
    // Each schema is a real check: an unlisted field fails it.
    for (const [tool, , result] of [all[0], all[61], all[86]]) {
      expect(schemas[tool].safeParse({ ...result, extra: 1 }).success, tool).toBe(false);
    }
  });

  it('describes a tested, not proven, search, and says so in every events receipt', async () => {
    for (const { value } of events) {
      expect(value.receipt.search).toMatchObject({ window: 'start-exclusive-end-inclusive', completeness: 'tested-not-proven', bisections: 24 });
      expect(value.receipt.search.samples).toBeLessThanOrEqual(BUDGETS['events.samples']);
    }
    const server = createServer(() => undefined);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'zodiacs-sky-tools-test', version: '1.0.0' });
    await client.connect(clientSide);
    const tool = (await client.listTools()).tools.find(({ name }) => name === 'find_events')!;
    expect(tool.description).toMatch(/tested, not proven to miss nothing/);
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true });
  });

  it('fits the largest positions answer the limits allow inside the result limit, with a tenth to spare', () => {
    // A hundred instants of all twelve rows, in the IERS era, whose rows name the
    // longest ΔT source: about 230 KB. A review's adversarial choice of instants
    // reached 231,294 bytes, 88% of the limit; the documents say about 230 KB.
    const instants = Array.from({ length: BUDGETS['positions.instants'] }, (_, index) =>
      new Date(Date.UTC(1972, 0, 2) + index * (197 * DAY + 3_600_123)).toISOString());
    const bytes = Buffer.byteLength(JSON.stringify(value(getPositions({ instants }))));
    expect(bytes).toBeGreaterThan(220_000);
    expect(bytes).toBeLessThan(0.9 * LIMITS.resultBytes);
  });
});

describe('the ends of the accepted dates', () => {
  // A date at either end is read in offsets that reach past the engine's
  // reference span, so every fact on it carries outside-reference-span. The
  // seeded corpus never reaches one.
  const requests: [SkyToolName, Args][] = [
    ['get_positions', { instants: ['1800-01-01T00:00:00Z', '2199-12-31T23:59:59.999Z'] }],
    ['find_events', { from: '1800-01-01T00:00:00Z', to: '1800-04-01T00:00:00Z' }],
    ['find_events', { from: '2199-10-01T00:00:00Z', to: '2199-12-31T23:59:59.999Z' }],
    ...['1800-01-01', '2199-12-31'].flatMap((date) => [
      ['check_sky_fact', { kind: 'sign', body: 'Sun', sign: 'capricorn', date }],
      ['check_sky_fact', { kind: 'sign', body: 'Moon', sign: 'aries', date }],
      ['check_sky_fact', { kind: 'retrograde', body: 'Mars', date }],
      ['check_sky_fact', { kind: 'retrograde', body: 'Sun', date }],
      ...SIGN_SLUGS.map((sign) => ['check_sky_fact', { kind: 'ingress', body: 'Moon', sign, date }]),
      ...PHASE_NAMES.map((phase) => ['check_sky_fact', { kind: 'phase', phase, date }]),
    ] as [SkyToolName, Args][]),
  ];

  it("answers each as the compute API's handler does, flags every fact on a date, and passes every schema and the SDK's client", async () => {
    const schemas = { get_positions: POSITIONS_OUTPUT, find_events: EVENTS_OUTPUT, check_sky_fact: SKY_FACT_OUTPUT };
    const run = { get_positions: getPositions, find_events: findEvents, check_sky_fact: checkSkyFact };
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const OPENAPI_ID = 'https://zodiacs.org/api/v1/openapi.json';
    ajv.addSchema({ $id: OPENAPI_ID, components: { schemas: COMPUTE_COMPONENTS } });
    const server = createServer(() => undefined);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'zodiacs-sky-tools-test', version: '1.0.0' });
    await client.connect(clientSide);
    const listed = (await client.listTools()).tools;
    const answers = new Set<string>();
    for (const [tool, args] of requests) {
      const result = value(await (run[tool] as (args: Args) => ToolOutcome | Promise<ToolOutcome>)(args));
      const response = await hosted(SKY_TOOLS[tool], args);
      expect(response.status, `${tool} ${JSON.stringify(args)}`).toBe(200);
      const { cite: hostedCite, ...hostedRest } = response.json;
      const { cite, ...rest } = result;
      expect(rest).toEqual(hostedRest);
      expect(cite).toEqual({ ...hostedCite, url: toolUrl(tool) });
      expect(() => schemas[tool].parse(result), tool).not.toThrow();
      const advertised = ajv.compile(listed.find(({ name }) => name === tool)!.outputSchema as object);
      expect(advertised(result), `${tool}: ${ajv.errorsText(advertised.errors)}`).toBe(true);
      const openapi = ajv.getSchema(`${OPENAPI_ID}#/components/schemas/${responseComponentName(SKY_TOOLS[tool])}`)!;
      expect(openapi(result), `${tool}: ${ajv.errorsText(openapi.errors)}`).toBe(true);
      const called = await client.callTool({ name: tool, arguments: args });
      expect(called.isError, `${tool} ${JSON.stringify(called.content).slice(0, 200)}`).toBeFalsy();
      expect(called.structuredContent).toEqual(result);
      if (tool === 'check_sky_fact') {
        expect(result.result.facts.flags, JSON.stringify(args)).toContain('outside-reference-span');
        answers.add(`${result.result.fact.kind} ${result.result.answer}`);
      }
    }
    // The flagged answers are real ones, not refusals or a single constant.
    for (const answer of ['sign true', 'sign false', 'retrograde false', 'ingress false', 'phase false']) expect(answers).toContain(answer);
  }, 120_000);
});

describe('what the three tools cite holds nothing the request gave', () => {
  it('cites one receipt for every positions request, and one per form for events and facts, apart from how many evaluations a search made', () => {
    const shapes = (tool: SkyToolName) => new Set(all.filter(([name]) => name === tool).map(([, , result]) => {
      const { search, ...rest } = result.receipt;
      return JSON.stringify({ ...rest, search: search ? { ...search, samples: 0 } : null });
    }));
    expect(shapes('get_positions').size).toBe(1);
    expect(shapes('find_events').size).toBe(1);
    // A fact at an instant runs no search; a fact on a date does.
    expect(shapes('check_sky_fact').size).toBe(2);
    for (const [tool, args, result] of all) {
      const receipt = JSON.stringify(result.receipt);
      const given = [...(args.instants as string[] ?? []), args.from, args.to, args.instant, args.date].filter(Boolean) as string[];
      for (const text of given) expect(receipt, tool).not.toContain(text);
    }
  });
});

describe("refusals are the compute API's own sentences", () => {
  const refusals: [SkyToolName, Args][] = [
    ['get_positions', { instants: ['2001-02-29T00:00:00Z'] }],
    ['get_positions', { instants: ['2026-10-05T12:00:00'] }],
    ['get_positions', { instants: ['2026-10-05T12:00:00+14:30'] }],
    ['get_positions', { instants: ['2200-01-01T00:00:00Z'] }],
    ['get_positions', { instants: ['1800-01-01T08:59:59+09:00'] }],
    ['get_positions', { instants: ['2026-10-05T12:00:00Z'], bodies: ['Sun', 'Sun'] }],
    ['find_events', { from: '2026-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }],
    ['find_events', { from: '2026-01-01T00:00:00Z', to: '2026-04-03T00:00:00.001Z' }],
    ['find_events', { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z', kinds: ['station', 'station'] }],
    ['check_sky_fact', { kind: 'sign', body: 'Sun', sign: 'aries', instant: '2026-10-05T12:00:00Z', date: '2026-10-05' }],
    ['check_sky_fact', { kind: 'sign', body: 'Sun', sign: 'aries' }],
    ['check_sky_fact', { kind: 'sign', sign: 'aries', date: '2026-10-05' }],
    ['check_sky_fact', { kind: 'phase', phase: 'full', body: 'Moon', date: '2026-10-05' }],
    ['check_sky_fact', { kind: 'ingress', body: 'Mars', sign: 'leo', instant: '2026-10-05T12:00:00Z' }],
    ['check_sky_fact', { kind: 'phase', phase: 'new' }],
    ['check_sky_fact', { kind: 'retrograde', body: 'Mars', date: '2026-02-30' }],
    ['check_sky_fact', { kind: 'retrograde', body: 'Mars', date: '2200-01-01' }],
  ];

  it('refuses what the compute API refuses, in the same words', async () => {
    for (const [tool, args] of refusals) {
      const run = { get_positions: getPositions, find_events: findEvents, check_sky_fact: checkSkyFact }[tool] as (args: Args) => ToolOutcome | Promise<ToolOutcome>;
      const outcome = await run(args);
      expect(outcome.ok, `${tool} ${JSON.stringify(args)}`).toBe(false);
      const response = await hosted(SKY_TOOLS[tool], args);
      expect(response.status).toBeGreaterThanOrEqual(400);
      const { message, pointer } = response.json.error;
      expect((outcome as { refusal: string }).refusal).toBe(pointer ? `${pointer}: ${message}` : message);
    }
  });

  it('refuses a zone, which this adapter never reads, before any calculation, and keeps serving', async () => {
    const notes: string[] = [];
    const server = createServer((message) => notes.push(message));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'zodiacs-sky-tools-test', version: '1.0.0' });
    await client.connect(clientSide);
    const listed = (await client.listTools()).tools.find(({ name }) => name === 'check_sky_fact')!;
    expect(Object.keys((listed.inputSchema as any).properties)).not.toContain('zone');
    const zoned = await client.callTool({ name: 'check_sky_fact', arguments: { kind: 'phase', phase: 'full', date: '2026-10-05', zone: 'Europe/Paris' } });
    expect(zoned.isError).toBe(true);
    const plain = await client.callTool({ name: 'check_sky_fact', arguments: { kind: 'phase', phase: 'full', date: '2026-10-05' } });
    expect(plain.isError).toBeFalsy();
    expect((plain.structuredContent as any).result.basis).toBe('any-zone-day');
    // A refusal from the compute API's parser comes back as the tool's error, with its sentence.
    const refused = await client.callTool({ name: 'find_events', arguments: { from: '2026-01-01T00:00:00Z', to: '2025-01-01T00:00:00Z' } });
    expect(refused.isError).toBe(true);
    expect(JSON.stringify(refused.content)).toContain('/to: Must be later than from.');
    expect(notes).toEqual([]);
  });

  it("sends each result unchanged through the SDK's client, which checks it against the advertised schema", async () => {
    const server = createServer(() => undefined);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'zodiacs-sky-tools-test', version: '1.0.0' });
    await client.connect(clientSide);
    for (const [tool, args, result] of [...all.slice(0, 12), ...all.slice(61, 67), ...all.slice(86, 120)]) {
      const response = await client.callTool({ name: tool, arguments: args });
      expect(response.isError, `${tool} ${JSON.stringify(response.content).slice(0, 200)}`).toBeFalsy();
      expect(response.structuredContent).toEqual(result);
      expect(JSON.parse((response.content as { text: string }[])[0].text)).toEqual(result);
    }
  }, 120_000);
});

describe('what the adapter says about the three tools', () => {
  it("lists them in its capabilities with the compute API's own limits and vocabularies", () => {
    const { sky } = value(describeCapabilities()) as any;
    expect(sky).toEqual({
      tools: ['get_positions', 'find_events', 'check_sky_fact'],
      sameAs: expect.stringContaining('POST https://zodiacs.org/api/v1/positions, /events and /sky-fact'),
      epoch: { from: EPOCH.from, to: EPOCH.to },
      positionBodies: [...POSITION_BODIES],
      eventBodies: [...EVENT_BODIES],
      eventKinds: [...EVENT_KINDS],
      factKinds: [...SKY_FACT_KINDS],
      phases: [...PHASE_NAMES],
      // Only these tools' limits: the compute API's table also holds the
      // elections endpoint's, and this adapter has no tool for it.
      limits: {
        'positions.instants': BUDGETS['positions.instants'],
        'events.windowDays': BUDGETS['events.windowDays'],
        'events.samples': BUDGETS['events.samples'],
        'sky-fact.samples': BUDGETS['sky-fact.samples'],
      },
      search: { window: 'start-exclusive-end-inclusive', completeness: 'tested-not-proven' },
      dates: ANY_ZONE_DAY_TEXT,
    });
    expect(UNSUPPORTED.join(' ')).not.toMatch(/any other search over a date range/);
    expect(UNSUPPORTED.join(' ')).toMatch(/find_events finds sign ingresses, stations and new and full moons in a window of at most 92 days, and nothing else/);
  });

  it('says, in the sentence about dates, the window a date is read in', () => {
    // The numbers are checked against a reply, not against the constants that wrote them.
    const day = facts.find(({ value }) => value.result.basis === 'any-zone-day')!;
    const midnight = Date.parse(`${day.args.date}T00:00:00Z`);
    const before = (midnight - Date.parse(day.value.result.window.from)) / 3_600_000;
    const after = (Date.parse(day.value.result.window.to) - midnight) / 3_600_000;
    expect([before, after]).toEqual([14, 36]);
    expect(ANY_ZONE_DAY_TEXT).toContain(`from ${before} hours before its midnight UTC to ${after} hours after`);
    expect(ANY_ZONE_DAY_TEXT).toContain(`every UTC offset in use today, from −${after - 24}:00 to +${before}:00`);
  });

  it('describes them in the methodology resource', () => {
    const text = methodology();
    expect(text).toContain('the six tools');
    expect(text).toContain('## Positions, events and sky facts');
    expect(text).toContain(ANY_ZONE_DAY_TEXT);
    expect(text).toContain('tested, not proven to miss nothing');
    expect(RESOURCES.find(({ name }) => name === 'methodology')!.description).toMatch(/positions, events and sky facts/);
  });
});
