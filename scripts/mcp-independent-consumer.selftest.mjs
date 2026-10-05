import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertArchive, assertBackend, assertCapabilities, assertParity, assertReply, canonical, CORPUS, digest, sha256,
} from './mcp-independent-consumer.mjs';

const pin = { adapterVersion: '0.1.0-rc.16.3', engineVersion: '0.1.1-rc.16', ephemerisVersion: '2.1.19' };
const backend = { name: '@zodiacs/engine', version: pin.engineVersion, ephemeris: { name: 'astronomy-engine', version: '2.1.19' } };
function reply(row, transport = 'mcp') {
  const receipt = { schema: 'zodiacs.compute-receipt.v1', endpoint: row.endpoint, engine: backend };
  if (row.endpoint === 'events') receipt.search = { samples: 4, maxSamples: 100,
    completeness: 'tested-not-proven', window: 'start-exclusive-end-inclusive' };
  return { schema: `zodiacs.compute-api.${row.endpoint}.v1`, backend,
    result: { ...(row.answer ? { answer: row.answer } : {}), ...(row.basis ? { basis: row.basis } : {}), zone: null,
      window: { from: '2026-03-02T10:00:00Z', to: '2026-03-04T12:00:00Z' },
      ...(row.endpoint === 'events' ? { events: [{ kind: 'lunation', at: '2026-03-03T12:00:00Z' }] } : {}) }, receipt,
    cite: { engine: backend.name, version: backend.version, receipt: digest(receipt),
      url: `https://zodiacs.org/developers/${transport === 'mcp' ? `mcp/#${row.tool}` : `compute/#${row.endpoint}`}` } };
}
const clone = value => JSON.parse(JSON.stringify(value));

test('canonical digest has fixed independently known bytes; finite JSON only', () => {
  assert.equal(canonical({ z: [true, null, -0], a: 'x' }), '{"a":"x","z":[true,null,0]}');
  assert.equal(digest({}), 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  assert.throws(() => canonical(NaN), /non-finite/);
});
test('altered archive hash fails before extraction', () => {
  const bytes = Buffer.from('fixed synthetic archive control');
  const archive = { bytes: bytes.length, sha256: sha256(bytes) };
  assertArchive(bytes, archive);
  assert.throws(() => assertArchive(Buffer.from('altered synthetic archive data!'), archive), /archive SHA-256/);
  assert.throws(() => assertArchive(bytes, { ...archive, bytes: 1 }), /archive bytes/);
});
test('stale engine and adapter versions fail even when wrappers agree', () => {
  assertBackend(backend, pin);
  assert.throws(() => assertBackend({ ...backend, version: '0.1.1-rc.15' }, pin), /backend version/);
  const value = { adapter: { version: pin.adapterVersion }, engine: backend,
    receipt: { adapter: { version: pin.adapterVersion }, engine: backend },
    unsupported: ['no timeout', 'no eclipse search'] };
  value.cite = { version: pin.engineVersion, receipt: digest(value.receipt) };
  const info = { name: 'zodiacs-mcp-server', version: pin.adapterVersion };
  assertCapabilities(value, info, pin);
  assert.throws(() => assertCapabilities(value, { ...info, version: '0.1.0-rc.16.2' }, pin), /MCP handshake version/);
});
test('missing receipt is refused', () => {
  const row = CORPUS[2];
  const good = reply(row);
  assertReply(good, row, pin, 'mcp');
  const bad = clone(good); delete bad.receipt;
  assert.throws(() => assertReply(bad, row, pin, 'mcp'), /missing receipt/);
});
test('bad citation digest fails independent recomputation', () => {
  const row = CORPUS[2];
  const bad = reply(row); bad.cite.receipt = `sha256:${'0'.repeat(64)}`;
  assert.throws(() => assertReply(bad, row, pin, 'mcp'), /citation digest/);
});
test('lost depends fails even after BOTH wrappers collapse it to true', () => {
  const row = CORPUS[4];
  assertParity(reply(row), reply(row, 'http'), row, pin);
  const mcp = reply(row), http = reply(row, 'http');
  mcp.result.answer = http.result.answer = 'true';
  assert.throws(() => assertParity(mcp, http, row, pin), /date-depends: answer/);
});
test('inflated completeness fails even when BOTH wrappers recite the altered receipt', () => {
  const row = CORPUS[1];
  assertParity(reply(row), reply(row, 'http'), row, pin);
  const mcp = reply(row), http = reply(row, 'http');
  for (const value of [mcp, http]) {
    value.receipt = clone(value.receipt); value.receipt.search.completeness = 'proven-complete';
    value.cite.receipt = digest(value.receipt);
  }
  assert.throws(() => assertParity(mcp, http, row, pin), /search completeness/);
});
test('parity allows only exact documentation URL substitution', () => {
  const row = CORPUS[2];
  const mcp = reply(row), http = reply(row, 'http');
  assertParity(mcp, http, row, pin);
  http.result.unadvertised = true;
  assert.throws(() => assertParity(mcp, http, row, pin), /parity beyond citation URL/);
  delete http.result.unadvertised;
  http.cite.url = 'https://example.invalid/';
  assert.throws(() => assertParity(mcp, http, row, pin), /citation URL/);
});
