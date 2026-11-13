/**
 * The header's format version and convention tokens are checked, not read
 * on trust (version 1's M2.1). Before this, any `formatVersion` and any
 * `conventions` opened, so a pack written to another Chebyshev or unit
 * convention would have been evaluated as if it were this one.
 *
 * Named `.nodetest.mjs`: these are `node:test` suites, not vitest ones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPack, withHeader } from './_pack.mjs';
import { parseContainerBytes, FORMAT_VERSIONS, CONVENTIONS } from '../../src/core/container.mjs';
import { CONVENTION_TOKENS, FORMAT_VERSION } from '../../tools/compiler/compile.mjs';

const NCOEF = 4;
const coeffs = (r) => Array.from({ length: 3 * NCOEF }, (_, i) => (i + 1) * (r + 1) * 1.5);
const body = (name, frame) => ({ name, frame, ncoef: NCOEF, nrec: 4, initEt: 0, intervalSec: 86400, coeffs });
const v1 = () => buildPack({
  bodies: [body('sun', 'native'), body('emb', 'ssb'), body('moon', 'ssb')],
  derived: { earth399: { emrat: 81.30056822149722, from: 'moon' } },
});
const v2 = () => withHeader(v1(), (h) => {
  h.formatVersion = 2;
  h.conventions = { chebyshev: 'spk-type-2', units: 'km,km/s' };
});

const codeOf = (bytes) => {
  try { parseContainerBytes(bytes); } catch (error) {
    assert.equal(error.name, 'PrecisionError', `expected a typed error, got ${error.name}: ${error.message}`);
    return error.code;
  }
  return null;
};

test('the compiler writes exactly the tokens the reader accepts', () => {
  assert.ok(FORMAT_VERSIONS.includes(FORMAT_VERSION));
  assert.deepEqual(CONVENTIONS[FORMAT_VERSION].chebyshev, [CONVENTION_TOKENS.chebyshev]);
  assert.deepEqual(CONVENTIONS[FORMAT_VERSION].units, [CONVENTION_TOKENS.units]);
});

test('version 1 with its sentence, and version 2 with its tokens, both open', () => {
  assert.equal(codeOf(v1()), null);
  assert.equal(codeOf(v2()), null);
  assert.equal(codeOf(withHeader(v1(), (h) => { h.conventions.units = { position: 'km', velocity: 'km/s' }; })), null);
});

test('a version this reader does not know is refused by name', () => {
  for (const v of [0, 3, '2', null, 2.5]) {
    assert.equal(codeOf(withHeader(v2(), (h) => { h.formatVersion = v; })), 'unsupported-version', `formatVersion ${JSON.stringify(v)}`);
  }
  assert.equal(codeOf(withHeader(v2(), (h) => { delete h.formatVersion; })), 'unsupported-version');
});

test('a header that is not a zodiacs pack header is refused', () => {
  assert.equal(codeOf(withHeader(v2(), (h) => { h.format = 'something-else'; })), 'bad-header');
  assert.equal(codeOf(withHeader(v2(), (h) => { delete h.format; })), 'bad-header');
});

test('version 2 opens only with its own tokens', () => {
  assert.equal(codeOf(withHeader(v2(), (h) => { delete h.conventions; })), 'bad-header');
  assert.equal(codeOf(withHeader(v2(), (h) => { h.conventions = ['spk-type-2']; })), 'bad-header');
  assert.equal(codeOf(withHeader(v2(), (h) => { h.conventions.chebyshev = 'c0-halved'; })), 'bad-header');
  // version 1's sentence is not a version 2 token
  assert.equal(codeOf(withHeader(v2(), (h) => {
    h.conventions.chebyshev = 'p(tau) = sum_k c_k T_k(tau), tau = (t - mid)/radius, c_0 NOT halved';
  })), 'bad-header');
  assert.equal(codeOf(withHeader(v2(), (h) => { h.conventions.units = 'm,m/s'; })), 'bad-header');
  assert.equal(codeOf(withHeader(v2(), (h) => { delete h.conventions.units; })), 'bad-header');
});

test('version 1 opens only with a sentence version 1 wrote, and only in km', () => {
  assert.equal(codeOf(withHeader(v1(), (h) => { h.conventions.chebyshev = 'spk-type-2'; })), 'bad-header');
  assert.equal(codeOf(withHeader(v1(), (h) => { h.conventions.chebyshev = 'p(tau) = sum_k c_k T_k(tau), c_0 halved'; })), 'bad-header');
  assert.equal(codeOf(withHeader(v1(), (h) => { h.conventions.units = { position: 'm', velocity: 'm/s' }; })), 'bad-header');
  assert.equal(codeOf(withHeader(v1(), (h) => { h.conventions.units = 'km,km/s'; })), 'bad-header');
});
