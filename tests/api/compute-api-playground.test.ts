import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPUTE_ENDPOINTS, MAX_BODY_BYTES } from '../../src/lib/compute-api/constants';
import { REFUSAL_EXAMPLES, SUCCESS_EXAMPLES } from '../../src/lib/compute-api/examples';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { answerHere } from '../../src/lib/compute-api/playground';
import { createHash as playgroundHash, sha256 } from '../../src/lib/compute-api/playground-crypto';
import { receiptDigest } from '../../src/lib/receipt-digest';
import { BUNDLE_PATH, buildPlaygroundEngineBundle } from '../../scripts/build-playground-engine.mjs';
import { run } from '../../scripts/lib/compute-api-harness';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });

/** Every request the playground can send with a JSON body: the documented answers, and the refusals a body provokes. */
function bodies(): Array<[string, string, string]> {
  const cases: Array<[string, string, string]> = [];
  for (const [endpoint, examples] of Object.entries(SUCCESS_EXAMPLES)) {
    for (const [name, example] of Object.entries(examples)) cases.push([`${endpoint} ${name}`, endpoint, JSON.stringify(example.body)]);
  }
  for (const [name, example] of Object.entries(REFUSAL_EXAMPLES)) {
    if (example.endpoint === null || example.method !== 'POST' || example.contentType !== 'application/json') continue;
    if (example.rateLimit || example.env || example.contentLength !== undefined) continue;
    // Its documented answer comes from a resolver made to fail (scripts/lib/compute-api-examples.ts); the body itself succeeds.
    if (example.code === 'calculation-failed') continue;
    cases.push([`refusal ${name}`, example.endpoint, typeof example.body === 'string' ? example.body : JSON.stringify(example.body)]);
  }
  cases.push(['refusal payload-too-large, counted', 'positions', JSON.stringify({ instants: ['2026-01-01T00:00:00Z'], pad: 'x'.repeat(MAX_BODY_BYTES) })]);
  return cases;
}

describe('the playground\'s browser run', () => {
  it('answers every documented example, and every refusal a body provokes, as the handler does', async () => {
    const cases = bodies();
    expect(new Set(cases.map(([, endpoint]) => endpoint))).toEqual(new Set(COMPUTE_ENDPOINTS));
    expect(cases.filter(([name]) => name.startsWith('refusal')).map(([name]) => name).sort()).toEqual([
      'refusal budget-exhausted', 'refusal invalid-json', 'refusal invalid-request', 'refusal payload-too-large, counted',
    ]);
    for (const [name, endpoint, text] of cases) {
      const hosted = await run(handler, { endpoint: endpoint as never, body: text });
      const here = await answerHere(endpoint, text);
      expect({ status: here.status, body: here.body }, name).toEqual({ status: hosted.status, body: hosted.json });
    }
  });

  it('refuses an address that names no endpoint as the handler does', async () => {
    const hosted = await run(handler, { endpoint: null, body: '{}' });
    expect(await answerHere('nowhere', '{}')).toEqual({ status: hosted.status, body: hosted.json });
  });

  it('is built from the current sources, and the built file answers as they do', async () => {
    const { bytes } = await buildPlaygroundEngineBundle();
    const committed = readFileSync(resolve(root, BUNDLE_PATH));
    expect(committed.equals(bytes), `stale ${BUNDLE_PATH}: run node scripts/build-playground-engine.mjs`).toBe(true);
    // The page calls it about 155 KB compressed.
    const compressed = gzipSync(committed, { level: 9 }).byteLength;
    expect(compressed).toBeGreaterThan(145_000);
    expect(compressed).toBeLessThan(165_000);
    const text = committed.toString('utf8');
    expect(text).toContain('// Engine NOTICE from the digest-pinned installed archive:');
    expect(text).not.toMatch(/\bimport\s*\(|\brequire\s*\(/u);
    const bundle = await import(pathToFileURL(resolve(root, BUNDLE_PATH)).href);
    for (const [name, endpoint, body] of bodies()) {
      expect(await bundle.answerHere(endpoint, body), name).toEqual(await answerHere(endpoint, body));
    }
    const answer = await bundle.answerHere('chart', JSON.stringify(SUCCESS_EXAMPLES.chart.utc.body));
    expect(bundle.receiptDigest(answer.body.receipt)).toBe(receiptDigest(answer.body.receipt));
    expect(answer.body.cite.receipt).toBe(receiptDigest(answer.body.receipt));
  });

  it('hashes with SHA-256 exactly as node:crypto does', () => {
    const lengths = [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 65_537];
    for (const length of lengths) {
      const bytes = randomBytes(length);
      expect(Buffer.from(sha256(bytes)).toString('hex'), `${length} bytes`).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
    const text = 'Zodiacs ✶ receipt — ünïcödé';
    expect(playgroundHash('sha256').update(text, 'utf8').digest('hex')).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    expect(() => playgroundHash('md5')).toThrow(/sha256 only/u);
  });
});
