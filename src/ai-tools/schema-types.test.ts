import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { ALL_AI_TOOL_NAMES, INPUT_SCHEMAS, OUTPUT_SCHEMAS, type AiToolName } from './contracts';
import { SAVE_OUTPUT_SCHEMA, SAVE_TOOL_NAME, saveInput } from './accounts/contracts';
import { executeAiTool } from './tools';
import { COMPUTE_SCHEMAS } from '../lib/compute-api/openapi';
import { EPOCH, PHASE_NAMES, POSITION_BODIES, SIGN_SLUGS, STATION_BODIES } from '../lib/compute-api/constants';
import committedWindow from '../data/horoscope-window.json';
import type { HoroscopeWindow } from './horoscope/window';

type Json = Record<string, unknown>;
type Converts = { '~standard': { jsonSchema: Record<'input' | 'output', (options: { target: string }) => Json> } };

/** The JSON Schema a client receives for a tool, written as the MCP SDK writes it (draft 2020-12). */
const advertised = (schema: unknown, io: 'input' | 'output') => (schema as Converts)['~standard'].jsonSchema[io]({ target: 'draft-2020-12' });

const TOOLS: Array<[string, unknown, unknown]> = [
  ...ALL_AI_TOOL_NAMES.map((tool): [string, unknown, unknown] => [tool, INPUT_SCHEMAS[tool], OUTPUT_SCHEMAS[tool]]),
  [SAVE_TOOL_NAME, saveInput, SAVE_OUTPUT_SCHEMA],
];

// The keywords that let a schema constrain a value. A schema with none of them, such as {}, accepts anything without
// saying so, and the MCP Inspector's --strict check reports it as untyped.
const VALIDATION = ['type', 'enum', 'const', 'anyOf', 'oneOf', 'allOf', '$ref', 'not'];
// Where a bare true or false is conventional. Anywhere else, such as the items: false a fixed-length tuple writes, the
// Inspector's --strict check reports it as an error, because some clients expect a schema object there.
const BOOLEAN_VALUED = ['additionalProperties', 'unevaluatedProperties', 'additionalItems', 'unevaluatedItems'];
const SUBSCHEMA_MAPS = ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas'];
const SUBSCHEMAS = ['items', 'additionalProperties', 'propertyNames', 'contains', 'not', 'if', 'then', 'else', 'unevaluatedItems', 'unevaluatedProperties'];
const SUBSCHEMA_LISTS = ['anyOf', 'oneOf', 'allOf', 'prefixItems'];

/** Every schema within a schema, with its path and the keyword it sits under; true and false are schemas too. */
function* subschemas(schema: unknown, path: string, keyword = ''): Generator<[string, Json | boolean, string]> {
  if (typeof schema === 'boolean') { yield [path, schema, keyword]; return; }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
  const node = schema as Json;
  yield [path, node, keyword];
  for (const key of SUBSCHEMA_MAPS) {
    const map = node[key];
    if (map && typeof map === 'object') for (const [name, child] of Object.entries(map)) yield* subschemas(child, `${path}.${key}.${name}`, key);
  }
  for (const key of SUBSCHEMAS) if (key in node) yield* subschemas(node[key], `${path}.${key}`, key);
  for (const key of SUBSCHEMA_LISTS) {
    const list = node[key];
    if (Array.isArray(list)) for (const [index, child] of list.entries()) yield* subschemas(child, `${path}.${key}[${index}]`, key);
  }
}

/** A compute API component with its references written out, as a tool's schema carries it. */
function inlined(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(inlined);
  if (!schema || typeof schema !== 'object') return schema;
  const node = schema as Json;
  if (typeof node.$ref === 'string') return inlined(COMPUTE_SCHEMAS[node.$ref.replace('#/components/schemas/', '')]);
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, inlined(value)]));
}

const at = (schema: Json, ...path: string[]) => path.reduce<unknown>((node, key) => (node as Json)[key], schema) as Json;

describe('the tools\' schemas', () => {
  it('state a type for every part of every input and every result, with a schema object wherever one is expected', () => {
    const untyped: string[] = [];
    const bare: string[] = [];
    let parts = 0;
    for (const [tool, input, output] of TOOLS) {
      for (const [io, schema] of [['input', input], ['output', output]] as const) {
        for (const [path, node, under] of subschemas(advertised(schema, io), `${tool} ${io}`)) {
          parts += 1;
          if (typeof node === 'boolean') { if (!BOOLEAN_VALUED.includes(under)) bare.push(path); }
          else if (!VALIDATION.some((keyword) => keyword in node)) untyped.push(path);
        }
      }
    }
    expect({ untyped, bare }).toEqual({ untyped: [], bare: [] });
    expect(parts).toBeGreaterThan(1000);
  });

  it('give the values the compute API returns exactly the schemas the API documents for them', () => {
    const data = (tool: AiToolName) => at(advertised(OUTPUT_SCHEMAS[tool], 'output'), 'anyOf', '0', 'properties', 'data', 'properties');
    const documented = (name: string) => inlined(COMPUTE_SCHEMAS[name]);
    expect(data('get_capabilities').engine).toEqual(documented('Backend'));
    for (const [tool, result] of [['get_upcoming_events', 'EventsResult'], ['check_sky_fact', 'SkyFactResult']] as const) {
      const calculation = at(data(tool), 'calculation', 'properties');
      expect(calculation.result, tool).toEqual(documented(result));
      expect(calculation.receipt, tool).toEqual(documented('ComputeReceipt'));
      expect(calculation.backend, tool).toEqual(documented('Backend'));
    }
    const sky = at(data('get_sky'), 'calculation', 'properties');
    expect(sky.receipt).toEqual(documented('ComputeReceipt'));
    const instant = at(sky, 'result', 'properties', 'instants', 'items', 'properties');
    expect(instant.deltaT).toEqual(documented('DeltaT'));
    expect(instant.timeScale).toEqual(documented('TimeScale'));
  });
});

// Synthetic requests across the engine's span: before the IERS era, in it, past its tables, and at the span's ends.
const INSTANTS = [EPOCH.from, '1800-06-01T00:00:00Z', '1899-12-31T12:00:00Z', '1950-06-15T06:30:00Z', '1971-12-31T23:59:59Z',
  '1972-01-01T00:00:00Z', '2000-01-01T12:00:00Z', '2016-12-31T23:59:59Z', '2026-10-18T03:00:00Z', '2027-09-01T00:00:00Z',
  '2035-01-01T00:00:00Z', '2150-07-04T18:00:00Z', EPOCH.to];
const WINDOWS: Array<[string, string]> = [['1850-01-01T00:00:00Z', '1850-03-31T00:00:00Z'], ['1972-06-01T00:00:00Z', '1972-07-31T00:00:00Z'],
  ['2026-10-01T00:00:00Z', '2026-12-30T00:00:00Z'], ['2099-11-15T00:00:00Z', '2100-01-31T00:00:00Z']];
const CALLS: Array<[AiToolName, unknown]> = [
  ['get_capabilities', {}],
  ...INSTANTS.map((instant): [AiToolName, unknown] => ['get_sky', { instant }]),
  ['get_sky', { instant: '2026-10-18T03:00:00+07:00', zone: 'Asia/Bangkok', bodies: [...POSITION_BODIES] }],
  ['get_sky', { instant: '2026-03-20T14:46:00Z', bodies: ['Sun', 'Moon'] }],
  ['get_upcoming_events', {}],
  ...WINDOWS.map(([from, to]): [AiToolName, unknown] => ['get_upcoming_events', { from, to, zone: 'America/New_York' }]),
  ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-12-30T00:00:00Z', bodies: ['Mercury', 'Venus', 'Mars'], kinds: ['station'] }],
  ...SIGN_SLUGS.slice(0, 3).map((sign): [AiToolName, unknown] => ['check_sky_fact', { kind: 'sign', body: 'Moon', sign, instant: '2026-10-18T03:00:00Z' }]),
  ...STATION_BODIES.map((body): [AiToolName, unknown] => ['check_sky_fact', { kind: 'retrograde', body, date: '2026-11-20', zone: 'Europe/London' }]),
  ['check_sky_fact', { kind: 'retrograde', body: 'Mercury', instant: '1900-01-01T00:00:00Z' }],
  ['check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'scorpio', date: '2026-10-23', zone: 'Asia/Bangkok' }],
  ['check_sky_fact', { kind: 'ingress', body: 'Moon', sign: 'sagittarius', date: '2026-10-18' }],
  ...PHASE_NAMES.map((phase): [AiToolName, unknown] => ['check_sky_fact', { kind: 'phase', phase, date: '2026-10-21', zone: 'America/Los_Angeles' }]),
  ['check_sky_fact', { kind: 'phase', phase: PHASE_NAMES[0], date: '2199-12-20' }],
];

describe('what the tools return', () => {
  it('validates against the schemas they advertise, as a client checks it', async () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validators = new Map(ALL_AI_TOOL_NAMES.map((tool) => [tool, ajv.compile(advertised(OUTPUT_SCHEMAS[tool], 'output'))]));
    const dependencies = { occasions: true, horoscopeWindow: async () => committedWindow as HoroscopeWindow, allowEvents: async () => 'allowed' as const };
    const invalid: string[] = [];
    const refused: string[] = [];
    const answered = new Set<string>();
    for (const [tool, input] of CALLS) {
      const result = JSON.parse(JSON.stringify(await executeAiTool(tool, input, dependencies)));
      if (result.ok) answered.add(tool);
      else refused.push(`${tool} ${JSON.stringify(input)}: ${result.error.code} ${result.error.message}`);
      const validate = validators.get(tool)!;
      if (!validate(result)) invalid.push(`${tool} ${JSON.stringify(input)}: ${ajv.errorsText(validate.errors).slice(0, 300)}`);
      // The server checks the same result with the tool's own schema before it answers.
      if (!OUTPUT_SCHEMAS[tool].safeParse(result).success) invalid.push(`${tool} ${JSON.stringify(input)}: refused by its own schema`);
    }
    expect(CALLS).toHaveLength(41);
    expect(invalid).toEqual([]);
    // Every request is one the tool answers, so each result checked is a calculation, not a refusal.
    expect(refused).toEqual([]);
    expect([...answered].sort()).toEqual(['check_sky_fact', 'get_capabilities', 'get_sky', 'get_upcoming_events']);
  }, 300_000);
});
