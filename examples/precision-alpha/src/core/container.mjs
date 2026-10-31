/**
 * The pack container: parse, validate, and verify — in that order, and with
 * nothing allocated from a header number until that number has been checked.
 *
 * Environment-neutral. No `node:*`, no `Buffer`, no `require`. Bytes arrive as
 * a `Uint8Array`; digests are computed by an injected async function so this
 * file does not have to know whether it is in a browser or in Node.
 *
 * ## Why v2 exists
 *
 * `ZODEPH01` stored a SHA-256 of the payload *inside the header*, which means
 * the header itself — interval lengths, coverage, EMRAT, body identities, the
 * scale factors every coefficient is multiplied by — was covered by nothing.
 * Editing `intervalSec` moved the Moon by 5.7e5 km and verified clean.
 *
 * `ZODEPH02` is the same bytes with the magic changed and a 32-byte SHA-256
 * trailer appended over **everything before it**: magic, header and payload.
 * There is no circularity because the digest lives outside the region it
 * covers, and `tools/seal.mjs` converts a v1 pack without touching a
 * coefficient.
 *
 * ## Three separate things, never conflated
 *
 * 1. **Structural validity** — the file is self-consistent and safe to read.
 * 2. **Integrity** — the bytes match a digest. A digest carried *inside the
 *    artifact* only proves the file is internally consistent with itself; it
 *    is not evidence about where the file came from.
 * 3. **Authenticity** — that the pack is the one a particular party produced.
 *    This package does not establish that, and says so. Pass `expectDigest`
 *    with a digest you obtained *out of band* to get closer.
 */
import { PrecisionError, fail } from './errors.mjs';
import { memorySource, sha256HexOf } from './source.mjs';

/** Re-exported so callers have one name for it. */
export { sha256HexOf as sha256Hex } from './source.mjs';

export const MAGIC_V1 = 'ZODEPH01';
export const MAGIC_V2 = 'ZODEPH02';
export const TRAILER_BYTES = 32;
export const PROLOGUE_BYTES = 16;

/** Caps, checked before anything is allocated from a header-derived length. */
export const LIMITS = Object.freeze({
  maxFileBytes: 256 * 1024 * 1024,
  maxHeaderBytes: 4 * 1024 * 1024,
  maxBodies: 64,
  maxCoefficients: 512,
  maxRecords: 20_000_000,
  minIntervalSec: 1,
  maxIntervalSec: 4 * 365.25 * 86400 * 1000,
});

const ascii = (u8, from, to) => String.fromCharCode(...u8.subarray(from, to));

const isSafeCount = (n) => Number.isSafeInteger(n) && n >= 0;

/**
 * Multiply/add with an explicit overflow guard. `a*b + c` on doubles silently
 * loses integer exactness past 2^53, which is precisely how a hostile header
 * turns a bounds check into a pass.
 */
function safeExtent(where, a, b, c = 0) {
  if (!isSafeCount(a) || !isSafeCount(b) || !isSafeCount(c)) {
    fail('bad-header', `${where}: extent operands must be safe non-negative integers`);
  }
  const product = a * b;
  if (!Number.isSafeInteger(product)) fail('bad-header', `${where}: extent overflows exact integer range`);
  const total = product + c;
  if (!Number.isSafeInteger(total)) fail('bad-header', `${where}: extent overflows exact integer range`);
  return total;
}

const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Parse and fully validate, reading through a byte source (see
 * `./source.mjs`) so that an in-memory pack and a file left on disk go
 * through exactly this code. Synchronous, allocation-safe, and it does NOT
 * verify the digest — `verifyIntegrity` does that, asynchronously, and the
 * `openPack*` entry points run both in order.
 */
export function parseContainer(src) {
  if (!src || typeof src.window !== 'function' || typeof src.bytes !== 'function' || !Number.isSafeInteger(src.byteLength)) {
    fail('bad-header', 'parseContainer needs a byte source; use parseContainerBytes for a Uint8Array');
  }
  const total = src.byteLength;
  if (total > LIMITS.maxFileBytes) {
    fail('too-large', `pack is ${total} bytes; the limit is ${LIMITS.maxFileBytes}`);
  }
  if (total < PROLOGUE_BYTES + TRAILER_BYTES + 2) fail('truncated', `pack is ${total} bytes, too short to be one`);

  const prologue = src.bytes(0, PROLOGUE_BYTES);
  const magic = ascii(prologue, 0, 8);
  if (magic === MAGIC_V1) {
    fail('unsupported-version',
      'this is a ZODEPH01 pack: its digest covers only the payload, so its header is unprotected. Re-seal it with tools/seal.mjs');
  }
  if (magic !== MAGIC_V2) fail('not-a-pack', 'not a zodiacs ephemeris pack');

  const pdv = new DataView(prologue.buffer, prologue.byteOffset, prologue.byteLength);
  const headerLen = pdv.getUint32(8, true);
  const payloadOffset = pdv.getUint32(12, true);
  if (!isSafeCount(headerLen) || headerLen === 0 || headerLen > LIMITS.maxHeaderBytes) {
    fail('bad-header', `header length ${headerLen} is outside 1..${LIMITS.maxHeaderBytes}`);
  }
  const headerEnd = safeExtent('header', PROLOGUE_BYTES, 1, headerLen);
  if (headerEnd > total) fail('truncated', `header claims ${headerLen} bytes; only ${total - PROLOGUE_BYTES} remain`);
  if (payloadOffset < headerEnd || payloadOffset > total) {
    fail('bad-header', `payload offset ${payloadOffset} is not inside the file after the header`);
  }

  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(src.bytes(PROLOGUE_BYTES, headerLen)));
  } catch (error) {
    fail('bad-header', `header is not valid JSON: ${error.message}`);
  }
  if (!header || typeof header !== 'object') fail('bad-header', 'header is not an object');

  const digestRegionEnd = total - TRAILER_BYTES;
  const payloadEnd = header.payloadEndOffset;
  if (!isSafeCount(payloadEnd)) fail('bad-header', 'payloadEndOffset is not a safe non-negative integer');
  if (payloadEnd > digestRegionEnd) {
    fail('truncated', `header declares ${payloadEnd} bytes of pack; only ${digestRegionEnd} precede the digest trailer`);
  }

  validateFormat(header);
  validateCoverage(header);
  const bodies = validateBodies(header, payloadOffset, payloadEnd);
  validateConstants(header);

  return {
    magic, headerLen, payloadOffset, payloadEnd, digestRegionEnd,
    header, bodies,
    trailerDigestHex: hex(src.bytes(digestRegionEnd, TRAILER_BYTES)),
    trailingBytes: digestRegionEnd - payloadEnd,
  };
}

/** Parse a pack that is already fully in memory. */
export function parseContainerBytes(u8) {
  return parseContainer(memorySource(u8));
}

/**
 * The header versions this reader understands, and the convention tokens
 * each one may carry. A number that is not checked is a number that can
 * mean something else: before this, any `formatVersion` and any
 * `conventions` opened, so a pack written to a different Chebyshev or unit
 * convention would have been read as this one.
 *
 * Version 2 (compiler 2.0.0 on) names its conventions with tokens.
 * Version 1 (compiler 1.x, and the synthetic packs in the examples and
 * tests) wrote a sentence; the two sentences ever written are the tokens
 * here, and a version-1 header that states its units must state these.
 */
export const FORMAT_VERSIONS = Object.freeze([1, 2]);
export const CONVENTIONS = Object.freeze({
  1: Object.freeze({
    chebyshev: Object.freeze([
      'p(tau) = sum_k c_k T_k(tau), tau = (t - mid)/radius, c_0 NOT halved (SPK type-2 convention)',
      'p(tau) = sum_k c_k T_k(tau), tau = (t - mid)/radius, c_0 NOT halved',
    ]),
  }),
  2: Object.freeze({
    chebyshev: Object.freeze(['spk-type-2']),
    units: Object.freeze(['km,km/s']),
  }),
});

function validateFormat(header) {
  if (header.format !== 'zodiacs-ephemeris-pack') {
    fail('bad-header', `format ${JSON.stringify(header.format)} is not "zodiacs-ephemeris-pack"`);
  }
  if (!FORMAT_VERSIONS.includes(header.formatVersion)) {
    fail('unsupported-version', `formatVersion ${JSON.stringify(header.formatVersion)} is not one this reader understands (${FORMAT_VERSIONS.join(', ')})`);
  }
  const c = header.conventions;
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail('bad-header', 'header declares no conventions');
  const allowed = CONVENTIONS[header.formatVersion];
  if (!allowed.chebyshev.includes(c.chebyshev)) {
    fail('bad-header', `conventions.chebyshev ${JSON.stringify(c.chebyshev)} is not a convention format ${header.formatVersion} defines`);
  }
  if (header.formatVersion === 1) {
    if (c.units !== undefined && !(c.units && c.units.position === 'km' && c.units.velocity === 'km/s')) {
      fail('bad-header', `conventions.units ${JSON.stringify(c.units)} is not km and km/s`);
    }
  } else if (!allowed.units.includes(c.units)) {
    fail('bad-header', `conventions.units ${JSON.stringify(c.units)} is not a convention format ${header.formatVersion} defines`);
  }
}

/** The compiler writes TDB seconds past J2000 under these two keys. */
export const COVERAGE_START = 'startEtSecTdb';
export const COVERAGE_STOP = 'stopEtSecTdb';

function validateCoverage(header) {
  const c = header.coverage;
  if (!c || typeof c !== 'object') fail('bad-header', 'header declares no coverage');
  for (const k of [COVERAGE_START, COVERAGE_STOP]) {
    if (!Number.isFinite(c[k])) fail('bad-header', `coverage.${k} is not finite`);
  }
  if (!(c[COVERAGE_STOP] > c[COVERAGE_START])) {
    fail('bad-header', 'coverage is not monotonic: stop must exceed start');
  }
  if (c.marginSec !== undefined && (!Number.isFinite(c.marginSec) || c.marginSec < 0)) {
    fail('bad-header', 'coverage.marginSec must be a finite non-negative number');
  }
}

function validateBodies(header, payloadOffset, payloadEnd) {
  const list = header.bodies;
  if (!Array.isArray(list) || list.length === 0) fail('bad-header', 'header declares no bodies');
  if (list.length > LIMITS.maxBodies) fail('bad-header', `header declares ${list.length} bodies; the limit is ${LIMITS.maxBodies}`);

  const seen = new Set();
  const spans = [];
  const out = new Map();
  for (const b of list) {
    if (!b || typeof b.name !== 'string' || b.name.length === 0 || b.name.length > 64) {
      fail('bad-header', 'a body has no usable name');
    }
    if (seen.has(b.name)) fail('bad-header', `body ${b.name} is declared twice`);
    seen.add(b.name);

    for (const [k, v] of [['ncoef', b.ncoef], ['nrec', b.nrec], ['offset', b.offset]]) {
      if (!isSafeCount(v)) fail('bad-header', `body ${b.name}: ${k} is not a safe non-negative integer`);
    }
    if (b.ncoef < 2 || b.ncoef > LIMITS.maxCoefficients) {
      fail('bad-header', `body ${b.name}: ncoef ${b.ncoef} is outside 2..${LIMITS.maxCoefficients}`);
    }
    if (b.nrec < 1 || b.nrec > LIMITS.maxRecords) {
      fail('bad-header', `body ${b.name}: nrec ${b.nrec} is outside 1..${LIMITS.maxRecords}`);
    }
    if (!Number.isFinite(b.initEt)) fail('bad-header', `body ${b.name}: initEt is not finite`);
    if (!Number.isFinite(b.intervalSec) || b.intervalSec < LIMITS.minIntervalSec || b.intervalSec > LIMITS.maxIntervalSec) {
      fail('bad-header', `body ${b.name}: intervalSec ${b.intervalSec} is outside ${LIMITS.minIntervalSec}..${LIMITS.maxIntervalSec}`);
    }
    // 'ssb' and 'sun' say what the stored vector is relative to; 'native'
    // marks the Sun itself, which is already the thing other frames add.
    if (!['ssb', 'sun', 'native'].includes(b.frame)) {
      fail('bad-header', `body ${b.name}: frame ${JSON.stringify(b.frame)} is not supported`);
    }
    const layout = b.layout;
    if (!layout || typeof layout !== 'object') fail('bad-header', `body ${b.name}: no layout`);
    if (layout.enc !== 'q' && layout.enc !== 'f64') {
      fail('bad-header', `body ${b.name}: encoding ${JSON.stringify(layout.enc)} is not supported`);
    }
    for (const [k, v] of [['stride', layout.stride], ['midsOffset', layout.midsOffset], ['recordsOffset', layout.recordsOffset]]) {
      if (!isSafeCount(v)) fail('bad-header', `body ${b.name}: layout.${k} is not a safe non-negative integer`);
    }
    if (layout.stride === 0) fail('bad-header', `body ${b.name}: layout.stride is zero`);
    // A record holds 3 components x ncoef coefficients, so the per-field
    // arrays are 3*ncoef long. Getting this wrong in either direction lets a
    // read run off the end of a record, which is why both are checked rather
    // than one inferred from the other.
    const fields = safeExtent(`body ${b.name} fields`, 3, b.ncoef);
    if (layout.enc === 'q') {
      if (!Number.isFinite(layout.q) || layout.q <= 0) fail('bad-header', `body ${b.name}: quantum q must be finite and positive`);
      if (!Array.isArray(layout.widths) || layout.widths.length !== fields) {
        fail('bad-header', `body ${b.name}: widths must have 3*ncoef = ${fields} entries, has ${layout.widths?.length}`);
      }
      if (!Array.isArray(layout.fieldOffset) || layout.fieldOffset.length !== fields) {
        fail('bad-header', `body ${b.name}: fieldOffset must have 3*ncoef = ${fields} entries, has ${layout.fieldOffset?.length}`);
      }
      if (!Array.isArray(layout.mids) && layout.midsOffset === undefined) {
        fail('bad-header', `body ${b.name}: quantised layout needs midsOffset`);
      }
      for (let f = 0; f < fields; f += 1) {
        const w = layout.widths[f];
        const off = layout.fieldOffset[f];
        if (![0, 1, 2, 3, 4, 5, 6, 8].includes(w)) fail('bad-header', `body ${b.name}: field width ${w} is not supported`);
        if (!isSafeCount(off)) fail('bad-header', `body ${b.name}: fieldOffset[${f}] is not a safe non-negative integer`);
        const fieldEnd = safeExtent(`body ${b.name} field ${f}`, off, 1, w);
        if (fieldEnd > layout.stride) {
          fail('bad-geometry', `body ${b.name}: field ${f} ends at ${fieldEnd}, past the ${layout.stride}-byte stride`);
        }
      }
      const midsBytes = safeExtent(`body ${b.name} mids`, fields, 8, layout.midsOffset);
      if (midsBytes > layout.recordsOffset) {
        fail('bad-geometry', `body ${b.name}: the mid-point table needs ${midsBytes} bytes but records start at ${layout.recordsOffset}`);
      }
    } else {
      const need = safeExtent(`body ${b.name} stride`, fields, 8);
      if (need > layout.stride) {
        fail('bad-geometry', `body ${b.name}: float64 record needs ${need} bytes but stride is ${layout.stride}`);
      }
    }

    const recBytes = safeExtent(`body ${b.name} records`, b.nrec, layout.stride, layout.recordsOffset);
    const start = safeExtent(`body ${b.name} start`, b.offset, 1);
    const end = safeExtent(`body ${b.name} end`, start, 1, recBytes);
    if (start < payloadOffset) fail('bad-geometry', `body ${b.name} starts at ${start}, before the payload at ${payloadOffset}`);
    if (end > payloadEnd) fail('truncated', `body ${b.name} needs bytes to ${end}; the payload ends at ${payloadEnd}`);

    // Time, not bytes: initEt is legitimately negative (epochs before J2000),
    // so the byte-extent guard does not apply. What matters here is that the
    // span stays finite and covers the coverage window it claims to.
    const spanSeconds = b.nrec * b.intervalSec;
    const spanEnd = b.initEt + spanSeconds;
    if (!Number.isFinite(spanSeconds) || !Number.isFinite(spanEnd)) {
      fail('bad-header', `body ${b.name}: record span is not finite`);
    }
    const cov = header.coverage;
    if (b.initEt > cov[COVERAGE_START] + 1 || spanEnd < cov[COVERAGE_STOP] - 1) {
      fail('bad-geometry',
        `body ${b.name} spans ${b.initEt}..${spanEnd} but the pack claims coverage ${cov[COVERAGE_START]}..${cov[COVERAGE_STOP]}`);
    }

    spans.push({ name: b.name, start, end });
    out.set(b.name, b);
  }

  spans.sort((x, y) => x.start - y.start);
  for (let i = 1; i < spans.length; i += 1) {
    if (spans[i].start < spans[i - 1].end) {
      fail('bad-geometry', `bodies ${spans[i - 1].name} and ${spans[i].name} overlap in the payload`);
    }
  }

  const deps = header.derived ?? {};
  if (deps.earth399 && typeof deps.earth399 === 'object') {
    const need = deps.earth399.from ?? 'moon';
    if (!out.has(need)) fail('bad-header', `derived earth399 depends on body ${need}, which the pack does not contain`);
  }
  return out;
}

function validateConstants(header) {
  const d = header.derived ?? {};
  const emrat = d.earth399?.emrat;
  if (emrat !== undefined) {
    // Earth/Moon mass ratio. Anything far from 81.3 is not a plausible value
    // and would silently displace the observer.
    if (!Number.isFinite(emrat) || emrat < 80 || emrat > 83) {
      fail('bad-header', `derived.earth399.emrat ${emrat} is not a plausible Earth/Moon mass ratio`);
    }
  }
  if (header.conventions && typeof header.conventions !== 'object') fail('bad-header', 'conventions must be an object');
}

/**
 * Integrity, as a separate async step. Returns a report; it does not decide
 * policy. `expectDigest`, if given, is the only input here that can speak to
 * provenance, and only because the caller got it from somewhere else.
 */
export async function verifyIntegrity(src, parsed, { expectDigest = null } = {}) {
  if (typeof src?.digest !== 'function') fail('unverified', 'this byte source cannot compute a digest');
  return applyIntegrityPolicy(await src.digest(0, parsed.digestRegionEnd), parsed, { expectDigest });
}

/**
 * The policy, separated from the transport. A browser hashes an ArrayBuffer
 * and a low-memory Node load streams the file; they must reach the same
 * verdict from the same digest, so only this function decides.
 */
export function applyIntegrityPolicy(computed, parsed, { expectDigest = null } = {}) {
  const selfConsistent = computed === parsed.trailerDigestHex;
  const matchesExpected = expectDigest === null ? null : computed === expectDigest;
  return {
    computedDigest: computed,
    storedDigest: parsed.trailerDigestHex,
    selfConsistent,
    expectedDigest: expectDigest,
    matchesExpected,
    // Said plainly because it is the thing most often assumed and least often true.
    authenticity: 'not established: a digest stored in the artifact cannot attest to its source',
  };
}
