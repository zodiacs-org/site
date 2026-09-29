import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { COMPUTE_ENDPOINTS, computePath, type ComputeEndpoint } from '../../src/lib/compute-api/constants';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import { REFUSAL_EXAMPLES, SUCCESS_EXAMPLES } from '../../src/lib/compute-api/examples';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { requestComponentName, responseComponentName } from '../../src/lib/compute-api/openapi';
import { loadSkyApiSources } from '../../src/lib/sky-api/sources';
import { buildSkyApi } from '../../src/lib/sky-api/files';
import { EXAMPLES_PATH, computeExamples, serializeExamples } from '../../scripts/lib/compute-api-examples';
import { run, withoutRuntime } from '../../scripts/lib/compute-api-harness';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const build = buildSkyApi(await loadSkyApiSources(root), { generatedAt: '2026-09-29T00:00:00.000Z' });
const openapi = JSON.parse(build.files.get('openapi.json')!);
const committed = JSON.parse(readFileSync(resolve(root, EXAMPLES_PATH), 'utf8'));
const OPENAPI_ID = 'https://zodiacs.org/api/v1/openapi.json';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ ...openapi, $id: OPENAPI_ID });
const validator = (component: string) => {
  const validate = ajv.getSchema(`${OPENAPI_ID}#/components/schemas/${component}`);
  if (!validate) throw new Error(`no component ${component}`);
  return (value: unknown) => {
    const valid = validate(value) as boolean;
    return { valid, errors: JSON.stringify(validate.errors?.slice(0, 3)) };
  };
};

function jcsDigest(value: unknown): string {
  const jcs = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(jcs).join(',')}]`;
    if (item && typeof item === 'object') return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${jcs((item as any)[key])}`).join(',')}}`;
    return JSON.stringify(item);
  };
  return `sha256:${createHash('sha256').update(jcs(value)).digest('hex')}`;
}

describe('compute API in the OpenAPI document', () => {
  it('describes all six endpoints as POST operations with schemas and examples for every request and response', () => {
    expect(openapi.openapi).toBe('3.1.0');
    expect(openapi.tags.map((tag: any) => tag.name)).toContain('compute');
    for (const endpoint of COMPUTE_ENDPOINTS) {
      const item = openapi.paths[computePath(endpoint)];
      expect(Object.keys(item), endpoint).toEqual(['post']);
      const operation = item.post;
      expect(operation.tags).toEqual(['compute']);
      expect(operation.description).toContain(`https://zodiacs.org/developers/compute/#${endpoint}`);
      const request = operation.requestBody.content['application/json'];
      expect(request.schema).toEqual({ $ref: `#/components/schemas/${requestComponentName(endpoint)}` });
      expect(Object.keys(request.examples).length).toBeGreaterThan(0);
      for (const [status, response] of Object.entries<any>(operation.responses)) {
        const content = response.content['application/json'];
        expect(content.schema.$ref, `${endpoint} ${status}`).toBe(status === '200'
          ? `#/components/schemas/${responseComponentName(endpoint)}` : '#/components/schemas/ErrorResponse');
        expect(Object.keys(content.examples).length, `${endpoint} ${status}`).toBeGreaterThan(0);
        expect(response.headers['Cache-Control'].schema.const).toBe('no-store');
      }
      expect(Object.keys(operation.responses).sort()).toEqual(
        ['200', '400', '405', '413', '415', ...(['positions', 'events', 'sky-fact'].includes(endpoint) ? ['422'] : []), '429', '500', '503'].sort(),
      );
    }
  });

  it('validates every example against its schema', () => {
    const problems: string[] = [];
    for (const endpoint of COMPUTE_ENDPOINTS) {
      const operation = openapi.paths[computePath(endpoint)].post;
      const requestSchema = validator(requestComponentName(endpoint));
      for (const [name, example] of Object.entries<any>(operation.requestBody.content['application/json'].examples)) {
        const { valid, errors } = requestSchema(example.value);
        if (!valid) problems.push(`${endpoint} request ${name}: ${errors}`);
      }
      for (const [status, response] of Object.entries<any>(operation.responses)) {
        const schema = validator(status === '200' ? responseComponentName(endpoint) : 'ErrorResponse');
        for (const [name, example] of Object.entries<any>(response.content['application/json'].examples)) {
          const { valid, errors } = schema(example.value);
          if (!valid) problems.push(`${endpoint} ${status} ${name}: ${errors}`);
          if (status === '200') {
            expect(example.value.cite.receipt, `${endpoint} ${name}`).toBe(jcsDigest(example.value.receipt));
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('shows what the handler answers: every example runs through it and the committed responses match', async () => {
    const fresh = await computeExamples();
    const normalize = (set: any) => ({
      ...set,
      success: Object.fromEntries(Object.entries<any>(set.success).map(([endpoint, examples]) => [endpoint,
        Object.fromEntries(Object.entries<any>(examples).map(([name, value]) => [name, withoutRuntime(value)]))])),
    });
    expect(normalize(committed), `stale ${EXAMPLES_PATH}: run npx vite-node --script scripts/build-compute-examples.mjs`)
      .toEqual(normalize(fresh));
    // On a runtime with the same time zone data the file is reproduced byte for byte.
    if (process.versions.tz === committed.success.time.pinned.receipt.timeResolution.runtimeTzdb) {
      expect(serializeExamples(fresh)).toBe(readFileSync(resolve(root, EXAMPLES_PATH), 'utf8'));
    }
    for (const endpoint of COMPUTE_ENDPOINTS) {
      expect(Object.keys(committed.success[endpoint]).sort()).toEqual(Object.keys(SUCCESS_EXAMPLES[endpoint]).sort());
    }
    expect(Object.keys(committed.refusals).sort()).toEqual(Object.keys(REFUSAL_EXAMPLES).sort());
  });

  it('agrees with the handler about which requests are valid, where a schema can say so', async () => {
    const handler = createComputeApiHandler({ localTime, env: {}, isRateLimited: async () => false });
    const cases: Array<[ComputeEndpoint, unknown, boolean]> = [
      ['chart', { utc: '2000-01-01T12:00:00Z', latitude: 10, longitude: 10 }, true],
      ['chart', { utc: '2000-01-01T12:00:00Z', latitude: 90, longitude: 10 }, false],
      ['chart', { utc: '2000-01-01T12:00:00', latitude: 10, longitude: 10 }, false],
      ['chart', { utc: '2000-01-01T12:00:00Z', local: { date: '2000-01-01', time: '12:00', zone: 'UTC' }, latitude: 10, longitude: 10 }, false],
      ['chart', { latitude: 10, longitude: 10 }, false],
      ['chart', { utc: '2000-01-01T12:00:00Z', latitude: 10, longitude: 10, houseSystem: 'Placidus' }, false],
      ['chart', { utc: '2000-01-01T12:00:00Z', latitude: 10, longitude: 10, extra: 1 }, false],
      ['houses', { local: { date: '2000-01-01', time: '12:00', zone: 'Europe/Paris' }, latitude: -10, longitude: 181 }, false],
      ['houses', { local: { date: '2000-01-01', time: '12:00:00', zone: 'Europe/Paris' }, latitude: -10, longitude: 10 }, false],
      ['positions', { instants: ['2026-01-01T00:00:00Z'], bodies: ['North Node'] }, true],
      ['positions', { instants: [] }, false],
      ['positions', { instants: ['2026-01-01T00:00:00Z'], bodies: ['Sun', 'Sun'] }, false],
      ['positions', { instants: ['1799-12-31T00:00:00Z'] }, false],
      ['events', { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z', kinds: ['lunation'] }, true],
      ['events', { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z', kinds: [] }, false],
      ['events', { from: '2026-01-01T00:00:00Z' }, false],
      ['time', { local: { date: '2026-01-01', time: '12:00', zone: 'Asia/Tokyo' }, longitude: 139.7 }, true],
      ['time', { local: { date: '2026-01-01', time: '12:00' } }, false],
      ['sky-fact', { kind: 'sign', body: 'Sun', sign: 'libra', date: '2026-09-29' }, true],
      ['sky-fact', { kind: 'sign', body: 'Sun', sign: 'libra', instant: '2026-09-29T00:00:00Z', zone: 'UTC' }, false],
      ['sky-fact', { kind: 'retrograde', body: 'North Node', date: '2026-09-29' }, false],
      ['sky-fact', { kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-29', zone: 'UTC' }, true],
      ['sky-fact', { kind: 'phase', phase: 'full', instant: '2026-09-29T00:00:00Z' }, false],
      ['sky-fact', { kind: 'eclipse', date: '2026-09-29' }, false],
    ];
    for (const [endpoint, body, valid] of cases) {
      const schema = validator(requestComponentName(endpoint))(body);
      expect(schema.valid, `schema ${endpoint} ${JSON.stringify(body)} ${schema.errors}`).toBe(valid);
      const response = await run(handler, { endpoint, body });
      expect(response.status === 200, `handler ${endpoint} ${JSON.stringify(body)} ${response.text}`).toBe(valid);
    }
  });
});
