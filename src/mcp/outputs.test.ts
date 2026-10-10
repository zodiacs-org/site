/**
 * Every result the three tools produce, held to the output schemas a host
 * reads, over a seeded synthetic corpus; the citation digests recomputed
 * independently; the conventions vocabulary compared with the engine's sets;
 * and the real SDK client driving the real registrations in one process, so
 * the schemas are checked as advertised JSON Schema as well as in zod.
 *
 * Every chart here is synthetic: seeded random instants and places, and round
 * coordinates for well-known cities. Nobody's birth details.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { ENGINE_VERSION, EPHEMERIS, natalChart } from '@zodiacs/engine';
import { NATAL_RECEIPT_CONVENTION_SETS, createNatalEnvelope, serializeNatalEnvelope } from '@zodiacs/engine/receipt';
import candidate from '../data/platform-engine-candidate.json';
import { ADAPTER_VERSION, HOUSE_SYSTEMS } from './bounds';
import { ADAPTER_RECEIPT_SCHEMA, DOCS_URL, TOOL_NAMES, citeFor } from './cite';
import { createServer } from './create-server';
import {
  ASPECT_TYPES, BODY_NAMES, CAPABILITIES_OUTPUT, CHART_FLAGS, COMPARE_OUTPUT, EVIDENCE,
  NATAL_OUTPUT, NATAL_RECORD_OUTPUT, NATAL_SUMMARY_OUTPUT, SIGN_NAMES,
} from './outputs';
import {
  CONVENTIONS_URI, CONVENTION_KEYS, FLAG_MEANINGS, METHODOLOGY_URI, RESOURCES, SET_WRITERS,
  conventionsVocabulary, methodology,
} from './resources';
import {
  COMPARE_INPUT, NATAL_INPUT, calculateNatalChart, compareCalculationRecords, describeCapabilities,
} from './tools';

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

/** An ISO instant within 1800–2199, written with Z or with an offset, as a caller might. */
function instantFor(random: () => number, noon = false): string {
  const from = Date.UTC(1800, 0, 1);
  const to = Date.UTC(2199, 11, 31);
  const day = Math.floor((from + random() * (to - from)) / 86_400_000) * 86_400_000;
  if (noon) return `${new Date(day + 43_200_000).toISOString().slice(0, 19)}Z`;
  const ms = day + Math.floor(random() * 86_400) * 1000;
  if (random() < 0.6) return `${new Date(ms).toISOString().slice(0, 19)}Z`;
  // The same instant written in another zone: shift the wall time by the offset.
  const offsetMinutes = (Math.floor(random() * 57) - 28) * 30;
  const wall = new Date(ms + offsetMinutes * 60_000).toISOString().slice(0, 19);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const magnitude = Math.abs(offsetMinutes);
  return `${wall}${sign}${pad(Math.floor(magnitude / 60))}:${pad(magnitude % 60)}`;
}

type Args = Record<string, unknown>;

/** 520 requests: every house system, both outputs, unknown times, polar and missing places, both references. */
function corpus(): Args[] {
  const random = generator(20261004);
  const cases: Args[] = [];
  for (let index = 0; index < 520; index += 1) {
    const houseSystem = HOUSE_SYSTEMS[index % HOUSE_SYSTEMS.length];
    const output = index % 2 === 0 ? 'summary' : 'record';
    const roll = random();
    const timeKnown = roll >= 0.2;
    const noon = !timeKnown && random() < 0.4;
    const args: Args = { utc: instantFor(random, noon), houseSystem, timeKnown, output };
    if (noon) args.reference = 'utc-noon';
    else if (random() < 0.15) args.reference = 'supplied-instant';
    const place = random();
    if (place < 0.1) {
      // No coordinates: bodies only.
    } else if (place < 0.3) {
      // Inside a polar circle, where Placidus and Koch fall back to whole sign.
      const latitude = (66.6 + random() * 23.3) * (random() < 0.5 ? -1 : 1);
      Object.assign(args, { latitude: Number(latitude.toFixed(4)), longitude: Number((random() * 360 - 180).toFixed(4)) });
    } else if (place < 0.32 && !timeKnown) {
      // The exact poles, allowed only without a time.
      Object.assign(args, { latitude: random() < 0.5 ? 90 : -90, longitude: Number((random() * 360 - 180).toFixed(4)) });
    } else {
      Object.assign(args, {
        latitude: Number((random() * 132 - 66).toFixed(4)),
        longitude: Number((random() * 360 - 180).toFixed(4)),
      });
    }
    cases.push(args);
  }
  return cases;
}

const CORPUS = corpus();
const LONDON = { utc: '1990-06-15T13:30:00Z', latitude: 51.5074, longitude: -0.1278 };

function natal(args: Args): Record<string, any> {
  const outcome = calculateNatalChart(NATAL_INPUT.parse(args));
  if (!outcome.ok) throw new Error(`${JSON.stringify(args)} was refused: ${outcome.refusal}`);
  return outcome.value;
}

function compare(left: string, right: string, output?: 'summary' | 'full'): Record<string, any> {
  const outcome = compareCalculationRecords(COMPARE_INPUT.parse({ left, right, ...(output ? { output } : {}) }));
  if (!outcome.ok) throw new Error(`a comparison was refused: ${outcome.refusal}`);
  return outcome.value;
}

/** RFC 8785 canonical JSON, written again here rather than imported from the code under test. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Args)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonical(JSON.parse(JSON.stringify(value))), 'utf8').digest('hex')}`;

const results = CORPUS.map((args) => ({ args, value: natal(args) }));
const records = results.filter(({ args }) => args.output === 'record').map(({ value }) => value.record as string);

/** 85 pairs of records from the corpus, each compared in both outputs. */
const pairs: [string, string][] = [];
for (let index = 0; index + 1 < records.length && pairs.length < 60; index += 2) pairs.push([records[index], records[index + 1]]);
for (let index = 0; index < 20; index += 1) pairs.push([records[index], records[index]]);
// One chart in two house systems: the case a cause is reproduced for.
const placidus = natal({ ...LONDON, output: 'record' }).record as string;
const whole = natal({ ...LONDON, houseSystem: 'whole', output: 'record' }).record as string;
const offset = natal({ ...LONDON, utc: '1990-06-15T19:00:00+05:30', output: 'record' }).record as string;
pairs.push([placidus, whole], [whole, placidus], [placidus, offset]);
// The same record relabelled as engine 0.1.1-rc.15 wrote it, with that version's
// conventions: a version the comparison's own receipt must not repeat.
const relabelled = (() => {
  const record = JSON.parse(placidus);
  record.receipt.engine = { ...record.receipt.engine, version: '0.1.1-rc.15' };
  record.receipt.conventions = { ...NATAL_RECEIPT_CONVENTION_SETS[1] };
  return JSON.stringify(record);
})();
pairs.push([relabelled, placidus], [placidus, relabelled]);

const compared = pairs.flatMap(([left, right]) => (['summary', 'full'] as const).map((output) => ({
  output, value: compare(left, right, output),
})));

describe('calculate_natal_chart over the seeded corpus', () => {
  it('covers what the schemas have to describe', () => {
    const summaries = results.filter(({ args }) => args.output === 'summary').map(({ value }) => value);
    expect(new Set(CORPUS.map((args) => args.houseSystem)).size).toBe(13);
    expect(summaries.some((value) => value.resultFlags.includes('polar-fallback'))).toBe(true);
    expect(summaries.some((value) => value.houses.absenceReason === 'unknown-time')).toBe(true);
    expect(summaries.some((value) => value.houses.absenceReason === 'missing-location')).toBe(true);
    expect(summaries.some((value) => value.angles !== null && value.cusps?.length === 12)).toBe(true);
    expect(CORPUS.some((args) => args.reference === 'utc-noon')).toBe(true);
    expect(CORPUS.some((args) => Math.abs(Number(args.latitude)) === 90)).toBe(true);
  });

  it('returns only what its output schema describes', () => {
    for (const { args, value } of results) {
      const schema = args.output === 'record' ? NATAL_RECORD_OUTPUT : NATAL_SUMMARY_OUTPUT;
      const parsed = schema.safeParse(value);
      expect(parsed.success, `${JSON.stringify(args)}: ${parsed.error?.message}`).toBe(true);
      expect(NATAL_OUTPUT.safeParse(value).success).toBe(true);
    }
  });

  it('cites the digest of the calculation receipt, the same for a summary and a record', () => {
    for (const { args, value } of results.slice(0, 120)) {
      const other = natal({ ...args, output: args.output === 'record' ? 'summary' : 'record' });
      const record = args.output === 'record' ? value : other;
      const receipt = JSON.parse(record.record).receipt;
      expect(value.cite).toEqual({
        url: `${DOCS_URL}#calculate_natal_chart`,
        receipt: digest(receipt),
        engine: '@zodiacs/engine',
        version: ENGINE_VERSION,
      });
      expect(other.cite).toEqual(value.cite);
    }
  });

  it("identifies a chart's birth details through cite.receipt: its date and place give back its time", () => {
    // A synthetic chart. A digest hides nothing: whoever knows the date and the
    // place tries every minute of the day, as the methodology resource says.
    // Written with Z and asked in the default house system, as the target was;
    // a searcher who does not know those tries each, which is a few more runs.
    const target = natal({ ...LONDON, utc: '1990-06-15T13:30:00Z' }).cite.receipt;
    const found: string[] = [];
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const time = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
      if (natal({ ...LONDON, utc: `1990-06-15T${time}:00Z` }).cite.receipt === target) found.push(time);
    }
    expect(found).toEqual(['13:30']);
  }, 60_000);

  it('shows nothing that depends on the place when the time is unknown, while its receipt still holds the place', () => {
    const unknown = results.filter(({ args }) => args.timeKnown === false && args.latitude !== undefined);
    expect(unknown.length).toBeGreaterThan(40);
    for (const { args, value } of unknown) {
      const { latitude: _latitude, longitude: _longitude, ...placeless } = args;
      const without = natal({ ...placeless, output: 'summary' });
      const asked = args.output === 'summary' ? value : natal({ ...args, output: 'summary' });
      const { cite: _cite, ...shown } = asked;
      const { cite: _without, ...shownWithout } = without;
      expect(shown, JSON.stringify(args)).toEqual(shownWithout);
      expect(asked.cite.receipt).not.toBe(without.cite.receipt);
    }
  });

  it("identifies the place as well: an unknown-time chart's instant and cite.receipt give back its coordinates", () => {
    // The summary of a chart without a time shows no angle, cusp or coordinate,
    // but its positions give away the instant, and its receipt holds the place.
    // So trying places from a list of towns finds it: here 400 synthetic towns.
    const random = generator(20261005);
    const towns = Array.from({ length: 400 }, () => ({
      latitude: Number((random() * 120 - 60).toFixed(2)),
      longitude: Number((random() * 360 - 180).toFixed(2)),
    }));
    const asked = towns[137];
    const unknown = { utc: '1990-06-15T12:00:00Z', timeKnown: false };
    const summary = natal({ ...unknown, ...asked });
    expect(summary.angles).toBeNull();
    expect(summary.cusps).toBeNull();
    expect(JSON.stringify({ ...summary, cite: null })).not.toContain(String(asked.latitude));
    const found = towns.filter((town) => natal({ ...unknown, ...town }).cite.receipt === summary.cite.receipt);
    expect(found).toEqual([asked]);
    // Left out, the coordinates are not in the receipt for anyone to find.
    const record = JSON.parse(natal({ ...unknown, output: 'record' }).record);
    expect(record.receipt.coordinates ?? null).toBeNull();
  }, 60_000);

  it('names bodies, signs, flags and aspects only from the engine\'s own lists', () => {
    const summaries = results.filter(({ args }) => args.output === 'summary').map(({ value }) => value);
    const seen = (pick: (value: Record<string, any>) => string[]) => new Set(summaries.flatMap(pick));
    expect([...seen((value) => value.bodies.map((row: any) => row.body))].sort()).toEqual([...BODY_NAMES].sort());
    expect([...seen((value) => value.bodies.map((row: any) => row.sign))].sort()).toEqual([...SIGN_NAMES].sort());
    expect([...seen((value) => value.aspects.map((row: any) => row.type))].sort()).toEqual([...ASPECT_TYPES].sort());
    for (const flag of seen((value) => value.resultFlags)) expect(CHART_FLAGS).toContain(flag);
    // The engine's own body list, in its own order.
    expect(natalChart({ utc: LONDON.utc }).bodies.map((row) => row.body)).toEqual([...BODY_NAMES]);
  });

  it("cites the same digest whatever order the receipt's keys arrive in", () => {
    const receipt = JSON.parse(natal({ ...LONDON, output: 'record' }).record).receipt;
    const reversed = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reversed);
      if (value === null || typeof value !== 'object') return value;
      return Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reversed((value as Args)[key])]));
    };
    const shuffled = reversed(receipt);
    expect(JSON.stringify(shuffled)).not.toBe(JSON.stringify(receipt));
    expect(citeFor('calculate_natal_chart', shuffled).receipt).toBe(digest(receipt));
  });

  it('refuses a result with a field its schema does not list, so the check is a real one', () => {
    const summary = natal(LONDON);
    const record = natal({ ...LONDON, output: 'record' });
    expect(NATAL_OUTPUT.safeParse({ ...record, extra: 1 }).success).toBe(false);
    expect(NATAL_RECORD_OUTPUT.safeParse({ ...record, extra: 1 }).success).toBe(false);
    expect(NATAL_OUTPUT.safeParse({ ...summary, extra: 1 }).success).toBe(false);
    expect(NATAL_OUTPUT.safeParse({ ...summary, cite: { ...summary.cite, receipt: 'sha256:00' } }).success).toBe(false);
    const { cite: _cite, ...uncited } = summary;
    expect(NATAL_OUTPUT.safeParse(uncited).success).toBe(false);
  });
});

describe('compare_calculation_records over pairs from the corpus', () => {
  it('returns only what its output schema describes, both outputs', () => {
    expect(compared).toHaveLength(170);
    for (const { output, value } of compared) {
      const parsed = COMPARE_OUTPUT.safeParse(value);
      expect(parsed.success, parsed.error?.message).toBe(true);
      expect(value.output).toBe(output);
      expect(value.receipt.output).toBe(output);
    }
  });

  it('exercises every evidence label and both kinds of row', () => {
    const evidence = new Set(compared.flatMap(({ value }) => value.explanations.map((row: any) => row.evidence)));
    for (const label of ['reproduced', 'reported', 'hypothesis']) expect(evidence).toContain(label);
    for (const label of evidence) expect(EVIDENCE).toContain(label);
    const rows = compared.flatMap(({ value }) => value.differences);
    expect(rows.some((row: any) => row.valuesWithheld === true)).toBe(true);
    expect(rows.some((row: any) => typeof row.left === 'string')).toBe(true);
    expect(compared.some(({ value }) => value.identical === true)).toBe(true);
  });

  it('cites its own receipt, which carries nothing from either record', () => {
    for (const { output, value } of compared) {
      // The whole receipt, not a search for birth details in it: a record's own
      // claims, such as the engine version it names, must not reach it either.
      expect(value.receipt).toEqual({
        schema: ADAPTER_RECEIPT_SCHEMA,
        tool: 'compare_calculation_records',
        adapter: { name: 'zodiacs-mcp-server', version: ADAPTER_VERSION },
        engine: { name: '@zodiacs/engine', version: ENGINE_VERSION, ephemeris: { ...EPHEMERIS } },
        output,
      });
      expect(value.cite).toEqual({
        url: `${DOCS_URL}#compare_calculation_records`,
        receipt: digest(value.receipt),
        engine: '@zodiacs/engine',
        version: ENGINE_VERSION,
      });
      expect(value.receipt.schema).toBe(ADAPTER_RECEIPT_SCHEMA);
      expect(value.receipt.adapter).toEqual({ name: 'zodiacs-mcp-server', version: ADAPTER_VERSION });
    }
    const receipts = new Set(compared.map(({ value }) => JSON.stringify(value.receipt)));
    // One receipt per output, whatever the records: it describes the comparison, not its inputs.
    expect(receipts.size).toBe(2);
    const text = [...receipts].join('');
    for (const needle of [LONDON.utc, '51.5074', '1990-06-15', '0.1.1-rc.15']) expect(text).not.toContain(needle);
  });

  it("compares what was calculated and how, and not a record's extensions or its claims about its origin", () => {
    // What the methodology resource says a comparison lists: a difference in
    // each of these is a row in its area.
    const areas = new Set([[placidus, offset], [placidus, whole], [placidus, relabelled], [records[0], records[1]]]
      .flatMap(([left, right]) => compare(left, right, 'full').differences.map((row: Args) => row.area)));
    for (const area of ['Inputs', 'Houses', 'Conventions', 'Provenance', 'Time scale', 'Positions', 'Angles']) {
      expect(areas, area).toContain(area);
    }
    // …and what it says is not compared: two records of one chart that differ
    // only in extensions and in claims about where they came from are identical.
    const chart = natalChart({ utc: LONDON.utc, latitude: LONDON.latitude, longitude: LONDON.longitude });
    const plain = serializeNatalEnvelope(createNatalEnvelope(chart));
    const claimed = serializeNatalEnvelope(createNatalEnvelope(chart, {
      provenance: {
        source: { repository: 'https://example.org/synthetic', commit: '0'.repeat(40) },
        runtime: { name: 'node', version: '22.22.2' },
      },
      extensions: { 'org.example.note': 'synthetic' },
    }));
    expect(claimed).toContain('org.example.note');
    expect(compare(plain, claimed, 'full')).toMatchObject({ identical: true, differences: [] });
  });

  it('sends a difference too large for a number as null, as the text reply always wrote it', () => {
    // The record format bounds a speed only by Number.MAX_VALUE, so two records
    // can differ by more than any number: right minus left is an infinity.
    const withNodeSpeed = (speed: number) => {
      const record = JSON.parse(placidus);
      const node = record.result.bodies.find((row: Args) => row.body === 'North Node');
      Object.assign(node, { speed, retrograde: speed < 0 });
      return JSON.stringify(record);
    };
    for (const output of ['summary', 'full'] as const) {
      const value = compare(withNodeSpeed(Number.MAX_VALUE), withNodeSpeed(-Number.MAX_VALUE), output);
      expect(value.differences.find((row: Args) => row.id === 'body-North Node-speed')).toMatchObject({ delta: null });
      const parsed = COMPARE_OUTPUT.safeParse(value);
      expect(parsed.success, parsed.error?.message).toBe(true);
    }
  });
});

describe('get_capabilities', () => {
  const outcome = describeCapabilities();
  const value = outcome.ok ? outcome.value as Record<string, any> : null;

  it('returns only what its output schema describes', () => {
    const parsed = CAPABILITIES_OUTPUT.safeParse(value);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  it('labels the engine as the site\'s candidate record does, and the adapter as an unpublished candidate', () => {
    // rc.17 is vendored and not on npm; a published engine would carry registry: 'npm' as rc.16.1 to rc.16.3 did.
    expect(candidate.version).toBe(ENGINE_VERSION);
    expect(value?.engine).toEqual(candidate.releaseStatus === 'published'
      ? { name: '@zodiacs/engine', version: ENGINE_VERSION, releaseStatus: 'published', registry: 'npm' }
      : { name: '@zodiacs/engine', version: ENGINE_VERSION, releaseStatus: 'unpublished-candidate' });
    expect(value?.adapter.releaseStatus).toBe('unpublished-candidate');
  });

  it('lists the resources the server offers, and cites its own receipt', () => {
    expect(value?.resources).toEqual(RESOURCES.map(({ uri, name, mimeType }) => ({ uri, name, mimeType })));
    expect(value?.cite).toEqual({
      url: `${DOCS_URL}#get_capabilities`, receipt: digest(value?.receipt), engine: '@zodiacs/engine', version: ENGINE_VERSION,
    });
    expect(value?.receipt).toEqual({
      schema: ADAPTER_RECEIPT_SCHEMA,
      tool: 'get_capabilities',
      adapter: { name: 'zodiacs-mcp-server', version: ADAPTER_VERSION },
      engine: { name: '@zodiacs/engine', version: ENGINE_VERSION, ephemeris: { ...EPHEMERIS } },
    });
  });
});

describe('the conventions vocabulary', () => {
  const vocabulary = conventionsVocabulary();

  it('is the engine\'s own sets, the current one first, with a writer for each', () => {
    expect(SET_WRITERS).toHaveLength(NATAL_RECEIPT_CONVENTION_SETS.length);
    expect(vocabulary.sets.map((set) => set.conventions)).toEqual([...NATAL_RECEIPT_CONVENTION_SETS]);
    const fresh = createNatalEnvelope(natalChart({ utc: LONDON.utc })).receipt;
    expect(fresh.conventions).toEqual(vocabulary.sets[0].conventions);
    // The installed engine writes the current set, first introduced in rc.16.
    // Compare the whole release tuple across the transition to 1.0 candidates.
    const release = (version: string) => {
      const parts = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(version);
      expect(parts, 'a stable release or numbered release candidate').not.toBeNull();
      return [...parts!.slice(1, 4).map(Number), parts![4] === undefined ? Infinity : Number(parts![4])];
    };
    expect(vocabulary.sets[0].writtenBy).toEqual({ from: '0.1.1-rc.16', to: null });
    const installed = release(ENGINE_VERSION);
    const introduced = release(vocabulary.sets[0].writtenBy.from);
    const order = installed.reduce((result, value, index) => result || Math.sign(value - introduced[index]), 0);
    expect(order).toBeGreaterThanOrEqual(0);
    expect(vocabulary.coverage).toEqual(fresh.coverage);
    expect(vocabulary.engine).toEqual({ name: '@zodiacs/engine', version: ENGINE_VERSION, ephemeris: { ...EPHEMERIS } });
  });

  it('describes every key any set carries, and nothing else', () => {
    const keys = new Set(NATAL_RECEIPT_CONVENTION_SETS.flatMap((set) => Object.keys(set)));
    expect(Object.keys(CONVENTION_KEYS).sort()).toEqual([...keys].sort());
    expect(vocabulary.keys.calendar.recordedFrom).toBe('0.1.1-rc.3');
    expect(vocabulary.keys.deltaT.recordedFrom).toBe('0.1.1-rc.8');
    expect(vocabulary.keys.timeScale.recordedFrom).toBe('0.1.1-rc.15');
    expect(vocabulary.keys.nutation.recordedFrom).toBe('0.1.1-rc.16');
  });

  it('names the versions that wrote each set, newest first and without a gap', () => {
    const rc = (version: string) => Number(/^0\.1\.1-rc\.(\d+)$/.exec(version)![1]);
    expect(vocabulary.sets.map((set) => set.current)).toEqual(vocabulary.sets.map((_set, index) => index === 0));
    expect(SET_WRITERS[0].to).toBeNull();
    for (let index = 1; index < SET_WRITERS.length; index += 1) {
      const { from, to } = SET_WRITERS[index];
      expect(rc(from)).toBeLessThanOrEqual(rc(to!));
      // Each older set ends the version before the next one begins.
      expect(rc(to!) + 1).toBe(rc(SET_WRITERS[index - 1].from));
    }
    expect(SET_WRITERS.at(-1)!.from).toBe('0.1.1-rc.3');
  });

  it('says what every chart flag reports', () => {
    expect(Object.keys(FLAG_MEANINGS).sort()).toEqual([...CHART_FLAGS].sort());
  });
});

describe('the registrations, through the SDK\'s own client', async () => {
  const notes: string[] = [];
  const server = createServer((message) => notes.push(message));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'zodiacs-outputs-test', version: '1.0.0' });
  await client.connect(clientSide);
  const listed = (await client.listTools()).tools;
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  it('advertises an output schema, read-only hints and a closed argument object on every tool', () => {
    expect(listed.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const tool of listed) {
      expect(tool.outputSchema?.type, tool.name).toBe('object');
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false, destructiveHint: false });
    }
  });

  it("describes in the schema a model reads that a chart's digest identifies the birth details", () => {
    const natalTool = listed.find((tool) => tool.name === 'calculate_natal_chart')!;
    const receipt = (natalTool.outputSchema as any).anyOf.map((branch: any) => branch.properties.cite.properties.receipt.description);
    for (const description of receipt) expect(description).toMatch(/identifies the birth details/);
    expect(natalTool.description).toMatch(/identifies the birth details/);
    const compareTool = listed.find((tool) => tool.name === 'compare_calculation_records')!;
    expect((compareTool.outputSchema as any).properties.cite.properties.receipt.description).toMatch(/holds nothing from a record/);
  });

  it('accepts, as the JSON Schema it advertises, every result of the corpus', () => {
    // The zod checks above, repeated on the schema a host actually reads:
    // all 520 charts, all 170 comparisons and the capabilities reply.
    const validators = new Map(listed.map((tool) => [tool.name, ajv.compile(tool.outputSchema as object)]));
    const all: [string, unknown][] = [
      ['get_capabilities', (describeCapabilities() as { value: unknown }).value],
      ...results.map(({ value }) => ['calculate_natal_chart', value] as [string, unknown]),
      ...compared.map(({ value }) => ['compare_calculation_records', value] as [string, unknown]),
    ];
    expect(all).toHaveLength(1 + 520 + 170);
    for (const [name, value] of all) {
      const validate = validators.get(name)!;
      expect(validate(value), `${name}: ${ajv.errorsText(validate.errors)}`).toBe(true);
    }
    // …and the advertised schema is a real check: an unlisted field fails it.
    expect(validators.get('calculate_natal_chart')!({ ...results[0].value, extra: 1 })).toBe(false);
  });

  it('sends each result unchanged, and the advertised JSON Schema accepts it', async () => {
    const validators = new Map(listed.map((tool) => [tool.name, ajv.compile(tool.outputSchema as object)]));
    const calls: [string, Args, Record<string, any>][] = [
      ['get_capabilities', {}, describeCapabilities().ok ? (describeCapabilities() as any).value : null],
      ...results.slice(0, 60).map(({ args, value }) => ['calculate_natal_chart', args, value] as [string, Args, Record<string, any>]),
      ...records.slice(0, 20).map((record, index) => {
        const args = { left: record, right: records[index + 20], output: index % 2 ? 'full' : 'summary' };
        return ['compare_calculation_records', args, compare(args.left, args.right, args.output as 'summary' | 'full')] as [string, Args, Record<string, any>];
      }),
    ];
    for (const [name, args, direct] of calls) {
      // The client checks structuredContent against the advertised schema itself and throws on a mismatch.
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, `${name} ${JSON.stringify(result.content).slice(0, 200)}`).toBeFalsy();
      expect(result.structuredContent).toEqual(direct);
      // A host that reads only content gets the same result, as text.
      expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual(result.structuredContent);
      const validate = validators.get(name)!;
      expect(validate(result.structuredContent), `${name}: ${ajv.errorsText(validate.errors)}`).toBe(true);
    }
  });

  it('answers a comparison whose difference is too large for a number, not an output-schema failure', async () => {
    const record = JSON.parse(placidus);
    const speeds = [Number.MAX_VALUE, -Number.MAX_VALUE].map((speed) => {
      const copy = structuredClone(record);
      Object.assign(copy.result.bodies.find((row: Args) => row.body === 'North Node'), { speed, retrograde: speed < 0 });
      return JSON.stringify(copy);
    });
    const result = await client.callTool({ name: 'compare_calculation_records', arguments: { left: speeds[0], right: speeds[1] } });
    expect(result.isError, JSON.stringify(result.content).slice(0, 300)).toBeFalsy();
  });

  it('still answers a refusal as an error with its reason, not as an output-schema failure', async () => {
    const refused = await client.callTool({ name: 'calculate_natal_chart', arguments: { ...LONDON, utc: '2001-02-29T00:00:00Z' } });
    expect(refused.isError).toBe(true);
    expect(JSON.stringify(refused.content)).not.toMatch(/Output validation/);
    expect(notes).toEqual([]);
  });

  it('lists the two resources and serves them from the bundle', async () => {
    const resources = (await client.listResources()).resources;
    expect(resources.map(({ uri, name, mimeType }) => ({ uri, name, mimeType })))
      .toEqual(RESOURCES.map(({ uri, name, mimeType }) => ({ uri, name, mimeType })));
    const conventions = await client.readResource({ uri: CONVENTIONS_URI });
    const text = (conventions.contents[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(conventionsVocabulary())));
    const method = await client.readResource({ uri: METHODOLOGY_URI });
    expect((method.contents[0] as { text: string }).text).toBe(methodology());
    expect(methodology()).toContain(`@zodiacs/engine ${ENGINE_VERSION}`);
    expect(methodology()).toContain('https://zodiacs.org/methodology/');
  });
});
