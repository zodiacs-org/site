/**
 * Lite parity: the site's own declination, sect, composite and dignity code
 * against @zodiacs/engine/lite, in one process, on one engine, as section 4 of
 * the lite preregistration fixes it (../PREREGISTRATION.md, the engine's
 * docs/evidence/1.1.0-rc.2-20261102/lite/PREREGISTRATION.md byte for byte).
 *
 *   node docs/platform/evidence/site-engine-1-1-0-rc2/lite/tools/compare-lite.mjs <40-hex base commit> [--head <40-hex>] [--plan <file.json>] > parity.json
 *
 * Run from the repository root of the adoption head with 1.1.0-rc.2
 * installed (npm ci). Three sides, all resolving the one installed package:
 *
 *   S  the base commit's site code, read from git objects (never the working
 *      tree) and bundled by the repository's esbuild for Node, with
 *      @zodiacs/engine and astronomy-engine left external, as the rc.16 tool
 *      (../../../site-engine-rc16/tools/compare-techniques.mjs) bundles it;
 *   A  the head commit's four adapters (src/lib/declination.ts, sect.ts,
 *      composite.ts and dignities.ts) and src/islands/synastry/relationshipData.ts,
 *      read from git objects at the head and bundled the same way;
 *   P  the installed package's @zodiacs/engine/lite (and its root, for the
 *      ecliptic convention's sectOf and chartDeclinations).
 *
 * What A is called with is fixed here, before the adapters are written (the
 * lite design, section 10): declination.ts exports
 * findDeclinationAspects(bodies, obliquity) in the site's shape and
 * declinationRows(bodies, obliquity) giving { body, dec, outOfBounds } per
 * body in input order; sect.ts exports sectOf({ sunAltitude, sunLon,
 * mercuryLon }) in the site's shape; composite.ts exports compositeMidpoints
 * and compositeAspects; dignities.ts exports dignityFor, dignitiesFor and
 * hasClassicalDignities.
 *
 * The corpus is synthetic (section 4.2): births are invented instants and
 * places. Every random draw comes from mulberry32 seeded by the 32-bit FNV-1a
 * of "site-engine-1-1-0-rc2-lite:<section>"; the 3,000 charts that D2-A,
 * D2-R, D2-O, S2-A, S2-E and S2-P share are drawn from the section name
 * "charts". Every value is compared exactly (Object.is on every leaf, list
 * order and length included). Each difference is given the first cause of
 * section 4.3's table, in its order, whose predicate holds, or "unexplained";
 * a section passes when it has no difference but by the causes it allows.
 * Recorded sections have no pass condition, but an unexplained difference
 * anywhere fails the record. The referee (section 4.3) re-derives, in BigInt,
 * the type, inclusion and order of every pair from P's own declination
 * doubles in D2-A and D2-T.
 *
 * --plan names a JSON file for the tool's own controls (compare-lite.test.mjs,
 * section 4.5): { sections, siteMutations, headWrappers, packageMutations,
 * constructedD2A, sharedCharts }. A record made with a plan says so and is
 * never the parity record. constructedD2A (added 2026-11-04, before any run)
 * lists constructed cases ({ label, bodies, obliquity }) that D2-A compares
 * after the shared charts, and sharedCharts: false leaves the 3,000 charts
 * out; both belong to a plan only, and the tool refuses them without one, so
 * neither ever reaches the parity corpus. Control 1 gives D2-A
 * CONTROL_ONE_CASE (../README.md, the note of 2026-11-04).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

export const SEED_TEXT = 'site-engine-1-1-0-rc2-lite';
/** Section 4.3's thresholds, in degrees. */
export const THRESHOLD = 1e-12;
export const SUN_BOUND_LATITUDE = 0.001;
export const FORMULA_DECLINATION_LIMIT = 60;
export const ARBITER_MINIMUM_ALTITUDE = 0.01;

export const BODY_NAMES = Object.freeze(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node']);
/** The ten bodies the 3D view draws (EclipticView's GLYPH). */
export const VIEW_BODIES = Object.freeze(BODY_NAMES.slice(0, 10));
export const SIGN_SLUGS = Object.freeze(['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']);
export const PROTOTYPE_NAMES = Object.freeze(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']);
const LUMINARIES = new Set(['Sun', 'Moon']);

/** Section 4.3's causes, in the order they are tried. */
export const CAUSE_ORDER = Object.freeze([
  'ecliptic-clamp', 'sun-bound-exemption', 'bound-boundary', 'orb-boundary', 'type-tie', 'order-tie',
  'declination-formula', 'separation-exact', 'declination-validation', 'sect-validation', 'sect-convention',
  'composite-validation', 'site-prototype-lookup', 'dignity-validation',
]);
export const CAUSES = Object.freeze({
  'ecliptic-clamp': 'A row with latitude exactly 0 is out of bounds on S only, its declination\'s size exceeding the obliquity by at most 1e-12: the package clamps a point on the ecliptic to plus or minus the obliquity.',
  'sun-bound-exemption': 'A row labelled Sun, out of bounds on S and not on A or P, with latitude of size at most 0.001: convention C3.',
  'bound-boundary': 'A row\'s out-of-bounds flag differs and its declination\'s size is within 1e-12 of the obliquity (on both sides): the package compares its own double, the site its asin value.',
  'orb-boundary': 'A pair is in one result only, and where it is present its orb is within 1e-12 of its maximum orb: the package decides the inclusive test exactly on the declination doubles, the site on the float difference.',
  'type-tie': 'A pair\'s type differs and one of its declinations (on either side) is within 1e-12 of 0: on the equator the two distances are equal.',
  'order-tie': 'The same pairs in another order, every pair that moves having an orb within 1e-12 of the pair it changes place with (on both sides): an exact sort against a float sort, both stable.',
  'declination-formula': 'A declination, orb, decA or decB differs by at most 1e-12, every declination involved being at most 60 degrees in size, with (for a pair) the case\'s pair set, types and order equal: asin of a sine against atan2 of the rotated vector.',
  'separation-exact': 'separation differs by at most 1e-12: the package reduces the difference exactly modulo 360 and rounds once.',
  'declination-validation': 'An input S takes and the package refuses with RangeError: a label that is not a trimmed string of 1 to 80 characters without control characters, a body named twice, more than 256 bodies, a number that is not finite or is out of range, an obliquity outside [0, 90].',
  'sect-validation': 'An input S takes and the package refuses: an altitude that is not finite or is outside [-90, 90], a longitude that is not finite, an unknown convention or key.',
  'sect-convention': 'Recorded sections only: the two conventions name different sects (convention C1).',
  'composite-validation': 'A name that is not one of the twelve bodies, or a body twice, or (C2-X) a longitude that is not finite: S takes it, the package throws RangeError.',
  'site-prototype-lookup': 'A name Object.prototype carries (toString, constructor, valueOf, hasOwnProperty, __proto__): S\'s hasClassicalDignities answers true and its dignityFor throws TypeError; A answers false and null, and P throws RangeError: a site defect the adoption removes.',
  'dignity-validation': 'A name outside the twelve bodies, or a sign that is not a lowercase slug: S answers null, [] or false where P throws RangeError.',
});

// ---------------------------------------------------------------- corpus

export function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** mulberry32 seeded by the FNV-1a of "<seedText>:<section>", with the draws the corpus uses. */
export function stream(section, seedText = SEED_TEXT) {
  let state = fnv1a(`${seedText}:${section}`) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const uniform = (low, high) => low + (high - low) * next();
  const integer = (low, high) => Math.floor(uniform(low, high + 1));
  const shuffle = (list) => {
    const out = [...list];
    for (let index = out.length - 1; index > 0; index -= 1) {
      const other = integer(0, index);
      [out[index], out[other]] = [out[other], out[index]];
    }
    return out;
  };
  return { next, uniform, integer, shuffle, instant: (low, high) => Math.floor(uniform(low, high)) };
}

/**
 * Control 1's constructed case, added on 2026-11-04 before any run (the
 * coordinator's decision; ../README.md): a luminary pair whose declinations,
 * at obliquity 0 where the declination is the latitude, lie 1.49995 degrees
 * apart, inside (1.4999, 1.5], so that the base's luminary orb written 1.4999
 * must drop a pair that the adapter and the package keep. It reaches D2-A only
 * through a control's plan (constructedD2A), never the parity corpus.
 */
export const CONTROL_ONE_CASE = Object.freeze({
  label: 'control 1 only: a luminary pair at orb 1.49995 (obliquity 0, declinations 10 and 8.50005)',
  bodies: Object.freeze([Object.freeze({ body: 'Sun', lon: 10, lat: 10 }), Object.freeze({ body: 'Moon', lon: 200, lat: 8.50005 })]),
  obliquity: 0,
});

const FROM = Date.parse('1800-01-02T00:00:00Z');
const TO = Date.parse('2199-12-30T00:00:00Z');
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

// ---------------------------------------------------------------- the referee

/** A finite double as a BigInt N with value = N / 2^1074, exactly. */
export function exactScaled(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError(`not a finite double: ${value}`);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const high = view.getUint32(0);
  const low = view.getUint32(4);
  const exponent = (high >>> 20) & 0x7ff;
  const mantissa = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
  const scaled = exponent === 0 ? mantissa : (mantissa | (1n << 52n)) << BigInt(exponent - 1);
  return high >>> 31 ? -scaled : scaled;
}

const absolute = (value) => (value < 0n ? -value : value);

/**
 * The referee: from declination doubles (rows of { body, dec } in input order),
 * every pair's type, inclusion under its maximum orb (1, or 1.5 with Sun or
 * Moon) and order, in exact rational arithmetic; the order is by exact orb,
 * ties kept in pair order. `strict` writes the inclusive test strict (the
 * referee's own control).
 */
export function refereeAspects(rows, { strict = false } = {}) {
  const one = exactScaled(1);
  const oneAndHalf = exactScaled(1.5);
  const found = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = exactScaled(rows[i].dec);
      const b = exactScaled(rows[j].dec);
      const apart = absolute(a - b);
      const mirrored = absolute(a + b);
      const parallel = apart <= mirrored;
      const orb = parallel ? apart : mirrored;
      const maximum = LUMINARIES.has(rows[i].body) || LUMINARIES.has(rows[j].body) ? oneAndHalf : one;
      if (strict ? orb < maximum : orb <= maximum) {
        found.push({ a: rows[i].body, b: rows[j].body, type: parallel ? 'parallel' : 'contraparallel', orb, index: found.length });
      }
    }
  }
  found.sort((x, y) => (x.orb < y.orb ? -1 : x.orb > y.orb ? 1 : x.index - y.index));
  return found.map(({ a, b, type }) => ({ a, b, type }));
}

/** Whether the referee gives P's pairs: the same pairs, types and order. */
export function refereeAgrees(rows, packageAspects, options = {}) {
  const expected = refereeAspects(rows, options);
  return expected.length === packageAspects.length
    && expected.every((pair, index) => pair.a === packageAspects[index].a && pair.b === packageAspects[index].b && pair.type === packageAspects[index].type);
}

// ---------------------------------------------------------------- outcomes and causes

export function outcome(run) {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return { ok: false, error: { name: error?.constructor?.name ?? typeof error, message: String(error?.message ?? error) } };
  }
}

const isRangeError = (result) => result && result.ok === false && result.error.name === 'RangeError';

/** Leaves of a value, as [path, leaf] pairs; object keys sorted, arrays with their length. */
export function flatten(value, path = '', out = []) {
  if (value instanceof Date) out.push([path, value.getTime()]);
  else if (Array.isArray(value)) {
    out.push([`${path}.length`, value.length]);
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) flatten(value[key], `${path}.${key}`, out);
  } else out.push([path, value]);
  return out;
}

const sameValue = (x, y) => {
  const a = flatten(x);
  const b = flatten(y);
  return a.length === b.length && a.every(([path, leaf], index) => path === b[index][0] && Object.is(leaf, b[index][1]));
};

const badLabel = (label) => typeof label !== 'string' || label.length === 0 || label.length > 80 || label.trim() !== label || /[\u0000-\u001f\u007f]/u.test(label);

/** Whether a declination input carries one of the defects the package refuses (section 4.3). */
export function declinationDefect({ bodies, obliquity }) {
  if (typeof obliquity !== 'number' || !Number.isFinite(obliquity) || obliquity < 0 || obliquity > 90) return true;
  if (!Array.isArray(bodies) || bodies.length > 256) return true;
  if (new Set(bodies.map((row) => row?.body)).size !== bodies.length) return true;
  return bodies.some((row) => badLabel(row?.body) || typeof row?.lon !== 'number' || !Number.isFinite(row.lon)
    || typeof row?.lat !== 'number' || !Number.isFinite(row.lat) || row.lat < -90 || row.lat > 90);
}

/** Whether a sect input, as the package is given it, carries one of the defects the package refuses. */
export function sectDefect({ packageInput }) {
  const input = packageInput;
  if (!input || typeof input !== 'object') return true;
  const keys = Object.keys(input);
  if (input.convention !== 'altitude' && input.convention !== 'ecliptic') return true;
  const allowed = ['convention', input.convention === 'altitude' ? 'sunAltitude' : 'ascendant', 'sunLon', 'mercuryLon'];
  if (keys.some((key) => !allowed.includes(key))) return true;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  if (input.convention === 'altitude' && (!finite(input.sunAltitude) || Math.abs(input.sunAltitude) > 90)) return true;
  if (input.convention === 'ecliptic' && !finite(input.ascendant)) return true;
  if (!finite(input.sunLon)) return true;
  return input.mercuryLon !== null && input.mercuryLon !== undefined && !finite(input.mercuryLon);
}

/** Whether a pair of composite lists carries a name outside the twelve bodies, a body twice or a longitude that is not finite. */
export function compositeDefect({ a, b }) {
  const bad = (list) => !Array.isArray(list)
    || list.some((row) => !BODY_NAMES.includes(row?.body) || typeof row?.lon !== 'number' || !Number.isFinite(row.lon))
    || new Set(list.map((row) => row?.body)).size !== list.length;
  return bad(a) || bad(b);
}

const neutral = (result) => result.ok && (result.value === null || result.value === false || (Array.isArray(result.value) && result.value.length === 0));

const PREDICATES = {
  'ecliptic-clamp': (d) => (d.kind === 'row-flag' || d.kind === 'row-dec') && d.lat === 0
    && d.s.outOfBounds === true && d.x.outOfBounds === false
    && Math.abs(d.s.dec) > d.obliquity && Math.abs(d.s.dec) - d.obliquity <= THRESHOLD,
  'sun-bound-exemption': (d) => d.kind === 'row-flag' && d.body === 'Sun'
    && d.s.outOfBounds === true && d.x.outOfBounds === false && Math.abs(d.lat) <= SUN_BOUND_LATITUDE,
  'bound-boundary': (d) => d.kind === 'row-flag'
    && Math.abs(Math.abs(d.s.dec) - d.obliquity) <= THRESHOLD && Math.abs(Math.abs(d.x.dec) - d.obliquity) <= THRESHOLD,
  'orb-boundary': (d) => d.kind === 'pair-presence' && Math.abs(d.pair.orb - d.maxOrb) <= THRESHOLD,
  'type-tie': (d) => d.kind === 'pair-type' && [d.s.decA, d.s.decB, d.x.decA, d.x.decB].some((value) => Math.abs(value) <= THRESHOLD),
  'order-tie': (d) => d.kind === 'pair-order' && d.inversions.length > 0
    && d.inversions.every((inversion) => inversion.s <= THRESHOLD && inversion.x <= THRESHOLD),
  'declination-formula': (d) => (d.kind === 'row-dec' && Math.abs(d.s.dec - d.x.dec) <= THRESHOLD
      && Math.abs(d.s.dec) <= FORMULA_DECLINATION_LIMIT && Math.abs(d.x.dec) <= FORMULA_DECLINATION_LIMIT)
    || (d.kind === 'pair-number' && ['orb', 'decA', 'decB'].includes(d.field) && d.caseShapeEqual === true
      && Math.abs(d.s[d.field] - d.x[d.field]) <= THRESHOLD
      && [d.s.decA, d.s.decB, d.x.decA, d.x.decB].every((value) => Math.abs(value) <= FORMULA_DECLINATION_LIMIT)),
  'separation-exact': (d) => d.kind === 'pair-separation' && Math.abs(d.s.separation - d.x.separation) <= THRESHOLD,
  'declination-validation': (d) => d.kind === 'refusal' && d.domain === 'declination' && d.s.ok === true && isRangeError(d.x) && declinationDefect(d.input),
  'sect-validation': (d) => d.kind === 'refusal' && d.domain === 'sect' && d.s.ok === true && isRangeError(d.x) && sectDefect(d.input),
  'sect-convention': (d) => d.kind === 'sect-convention' && d.recorded === true && d.s !== d.x,
  'composite-validation': (d) => d.kind === 'refusal' && d.domain === 'composite' && d.s.ok === true && isRangeError(d.x) && compositeDefect(d.input),
  'site-prototype-lookup': (d) => {
    if (d.kind !== 'dignity' || !PROTOTYPE_NAMES.includes(d.planet)) return false;
    const [sFor, , sHas] = d.s;
    const [xFor, , xHas] = d.x;
    return sHas.ok && sHas.value === true && !sFor.ok && sFor.error.name === 'TypeError'
      && ((xHas.ok && xHas.value === false) || isRangeError(xHas))
      && ((xFor.ok && xFor.value === null) || isRangeError(xFor));
  },
  'dignity-validation': (d) => {
    if (d.kind !== 'dignity') return false;
    if (BODY_NAMES.includes(d.planet) && SIGN_SLUGS.includes(d.sign)) return false;
    const differing = [0, 1, 2].filter((index) => !sameValue(d.s[index], d.x[index]));
    return differing.length > 0 && differing.every((index) => neutral(d.s[index]) && isRangeError(d.x[index]));
  },
};

/** The first cause, in section 4.3's order, whose predicate holds, or "unexplained". */
export function assignCause(difference) {
  for (const cause of CAUSE_ORDER) if (PREDICATES[cause](difference)) return cause;
  return 'unexplained';
}

// ---------------------------------------------------------------- differences

const maxOrbOf = (a, b) => (LUMINARIES.has(a) || LUMINARIES.has(b) ? 1.5 : 1);
const pairKey = (pair) => `${pair.a}\u0000${pair.b}`;
const SITE_ASPECT_KEYS = ['a', 'b', 'decA', 'decB', 'orb', 'separation', 'type'];

/** A long list kept short in the record: its length and its first three items. */
const shortened = (value) => (Array.isArray(value) && value.length > 20 ? { items: value.length, first: value.slice(0, 3) } : value);

/** Two refusals or results that cannot be compared field by field. */
function outcomeDifferences(s, x, domain, input) {
  if (s.ok && isRangeError(x)) return { values: 1, diffs: [{ kind: 'refusal', domain, input, s: { ok: true, value: shortened(s.value) }, x }] };
  if (!s.ok && !x.ok && s.error.name === x.error.name && s.error.message === x.error.message) return { values: 1, diffs: [] };
  return { values: 1, diffs: [{ kind: 'value', path: '(outcome)', s, x }] };
}

/** Declination aspect lists, S's against X's (A, or P in the site's shape). */
export function aspectDifferences(s, x, input) {
  if (!s.ok || !x.ok) return outcomeDifferences(s, x, 'declination', input);
  const sList = s.value;
  const xList = x.value;
  const diffs = [];
  let values = 1;
  const sMap = new Map(sList.map((pair) => [pairKey(pair), pair]));
  const xMap = new Map(xList.map((pair) => [pairKey(pair), pair]));
  const present = { s: [], x: [] };
  for (const [key, pair] of sMap) if (!xMap.has(key)) present.s.push(pair);
  for (const [key, pair] of xMap) if (!sMap.has(key)) present.x.push(pair);
  for (const side of ['s', 'x']) {
    for (const pair of present[side]) {
      values += 1;
      diffs.push({ kind: 'pair-presence', present: side, a: pair.a, b: pair.b, pair, maxOrb: maxOrbOf(pair.a, pair.b) });
    }
  }
  const sCommon = sList.filter((pair) => xMap.has(pairKey(pair)));
  const xCommon = xList.filter((pair) => sMap.has(pairKey(pair)));
  const numbers = [];
  for (const sPair of sCommon) {
    const xPair = xMap.get(pairKey(sPair));
    const keys = [...new Set([...Object.keys(sPair), ...Object.keys(xPair)])].sort();
    for (const key of keys) {
      values += 1;
      if (!Object.hasOwn(sPair, key) || !Object.hasOwn(xPair, key) || !SITE_ASPECT_KEYS.includes(key)) {
        if (!(Object.hasOwn(sPair, key) && Object.hasOwn(xPair, key) && Object.is(sPair[key], xPair[key]))) {
          diffs.push({ kind: 'value', path: `${sPair.a}-${sPair.b}.${key}`, s: sPair[key], x: xPair[key] });
        }
        continue;
      }
      if (Object.is(sPair[key], xPair[key])) continue;
      if (key === 'type') diffs.push({ kind: 'pair-type', a: sPair.a, b: sPair.b, s: sPair, x: xPair });
      else if (key === 'separation') diffs.push({ kind: 'pair-separation', a: sPair.a, b: sPair.b, s: sPair, x: xPair });
      else if (key === 'orb' || key === 'decA' || key === 'decB') numbers.push({ kind: 'pair-number', field: key, a: sPair.a, b: sPair.b, s: sPair, x: xPair });
      else diffs.push({ kind: 'value', path: `${sPair.a}-${sPair.b}.${key}`, s: sPair[key], x: xPair[key] });
    }
  }
  const xOrder = new Map(xCommon.map((pair, index) => [pairKey(pair), index]));
  const inversions = [];
  for (let i = 0; i < sCommon.length; i += 1) {
    for (let j = i + 1; j < sCommon.length; j += 1) {
      if (xOrder.get(pairKey(sCommon[i])) > xOrder.get(pairKey(sCommon[j]))) {
        const xi = xMap.get(pairKey(sCommon[i]));
        const xj = xMap.get(pairKey(sCommon[j]));
        inversions.push({ pairs: [pairKey(sCommon[i]), pairKey(sCommon[j])], s: Math.abs(sCommon[i].orb - sCommon[j].orb), x: Math.abs(xi.orb - xj.orb) });
      }
    }
  }
  if (inversions.length) diffs.push({ kind: 'pair-order', inversions });
  const caseShapeEqual = present.s.length === 0 && present.x.length === 0 && inversions.length === 0
    && !diffs.some((diff) => diff.kind === 'pair-type');
  for (const diff of numbers) diffs.push({ ...diff, caseShapeEqual });
  return { values, diffs };
}

/** Declination rows ({ body, dec, outOfBounds }), S's against X's, for the input bodies at one obliquity. */
export function rowDifferences(s, x, input) {
  if (!s.ok || !x.ok) return outcomeDifferences(s, x, 'declination', input);
  const diffs = [];
  let values = 1;
  if (s.value.length !== x.value.length) {
    return { values, diffs: [{ kind: 'value', path: 'rows.length', s: s.value.length, x: x.value.length }] };
  }
  s.value.forEach((sRow, index) => {
    const xRow = x.value[index];
    const lat = input.bodies[index].lat;
    values += 3;
    if (!Object.is(sRow.body, xRow.body)) diffs.push({ kind: 'value', path: `rows[${index}].body`, s: sRow.body, x: xRow.body });
    const context = { body: sRow.body, lat, obliquity: input.obliquity, s: sRow, x: xRow };
    if (!Object.is(sRow.outOfBounds, xRow.outOfBounds)) diffs.push({ kind: 'row-flag', ...context });
    if (!Object.is(sRow.dec, xRow.dec)) diffs.push({ kind: 'row-dec', ...context });
  });
  return { values, diffs };
}

/** Any two results compared leaf by leaf, with no cause but the refusal of a domain. */
export function valueDifferences(s, x, domain, input) {
  if (!s.ok || !x.ok) return outcomeDifferences(s, x, domain, input);
  const a = new Map(flatten(s.value));
  const b = new Map(flatten(x.value));
  const diffs = [];
  let values = 0;
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    values += 1;
    if (!a.has(path) || !b.has(path) || !Object.is(a.get(path), b.get(path))) {
      diffs.push({ kind: 'value', path, s: a.has(path) ? a.get(path) : 'absent', x: b.has(path) ? b.get(path) : 'absent' });
    }
  }
  return { values, diffs };
}

/** dignityFor, dignitiesFor and hasClassicalDignities for one name and sign, as one case. */
export function dignityDifferences(planet, sign, s, x) {
  const values = 3;
  const same = [0, 1, 2].every((index) => sameValue(s[index], x[index]));
  return { values, diffs: same ? [] : [{ kind: 'dignity', planet, sign, s, x }] };
}

// ---------------------------------------------------------------- the record

const RULES = {
  none: { allowed: [] },
  'D2-A': { allowed: ['orb-boundary', 'type-tie', 'order-tie', 'declination-formula', 'separation-exact'] },
  'D2-R': { allowed: ['ecliptic-clamp', 'sun-bound-exemption', 'bound-boundary', 'declination-formula'] },
  'DG-N': { allowed: ['site-prototype-lookup'] },
  recorded: { recorded: true },
};
const FREQUENT = new Set(['declination-formula', 'separation-exact']);
const LIST_LIMIT = 5000;

function newRecorder() {
  const sections = {};
  const listed = [];
  const unexplained = [];
  let omitted = 0;
  let current = null;
  const compact = (value) => JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) return String(item);
    if (typeof item === 'bigint') return String(item);
    if (item === undefined) return '[undefined]';
    return item;
  }));
  return {
    begin(id, unit, description) {
      sections[id] = { unit, description, comparisons: {} };
      current = id;
    },
    comparison(name, rule, description) {
      sections[current].comparisons[name] = { description, rule: rule.recorded ? 'recorded' : rule.allowed.length ? `no difference but by ${rule.allowed.join(', ')}` : 'no difference', allowed: rule.allowed ?? null, cases: 0, values: 0, agree: 0, differ: 0, causes: {}, maxAbsoluteDifference: {}, examples: {} };
      return name;
    },
    /** One case of a comparison: its differences, each given its cause. */
    record(name, label, result) {
      const row = sections[current].comparisons[name];
      row.cases += 1;
      row.values += result.values;
      if (result.diffs.length === 0) {
        row.agree += 1;
        return;
      }
      row.differ += 1;
      for (const diff of result.diffs) {
        const cause = assignCause(diff);
        row.causes[cause] = (row.causes[cause] ?? 0) + 1;
        const numeric = diff.kind === 'row-dec' ? Math.abs(diff.s.dec - diff.x.dec)
          : diff.kind === 'pair-number' ? Math.abs(diff.s[diff.field] - diff.x[diff.field])
            : diff.kind === 'pair-separation' ? Math.abs(diff.s.separation - diff.x.separation) : null;
        if (numeric !== null && !(numeric <= (row.maxAbsoluteDifference[cause] ?? -1))) row.maxAbsoluteDifference[cause] = numeric;
        const entry = compact({ section: current, comparison: name, label, cause, difference: diff });
        if ((row.examples[cause] ??= []).length < 3) row.examples[cause].push(entry);
        if (cause === 'unexplained') {
          if (unexplained.length < LIST_LIMIT) unexplained.push(entry);
          else omitted += 1;
        } else if (!FREQUENT.has(cause)) {
          if (listed.length < LIST_LIMIT) listed.push(entry);
          else omitted += 1;
        }
      }
    },
    finish() {
      for (const section of Object.values(sections)) {
        for (const row of Object.values(section.comparisons)) {
          const causes = Object.keys(row.causes);
          row.pass = row.rule === 'recorded' ? null : causes.every((cause) => row.allowed.includes(cause));
        }
      }
      return { sections, listed, unexplained, omitted };
    },
  };
}

// ---------------------------------------------------------------- bundling

const HEX40 = /^[0-9a-f]{40}$/u;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function replaceOnce(path, from, to) {
  const text = readFileSync(path, 'utf8');
  if (text.split(from).length !== 2) throw new Error(`expected the text once in ${path}: ${from}`);
  writeFileSync(path, text.replace(from, to));
}

async function bundleSide({ root, work, name, commit, paths, modules, mutations = [], wrappers = {} }) {
  const dir = join(work, name);
  mkdirSync(dir, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${commit} ${paths.join(' ')} | tar -x -C "${dir}"`], { cwd: root });
  for (const { file, from, to } of mutations) replaceOnce(join(dir, file), from, to);
  for (const [file, source] of Object.entries(wrappers)) {
    if (!file.endsWith('.ts')) throw new Error(`a wrapper replaces a .ts module: ${file}`);
    renameSync(join(dir, file), join(dir, file.replace(/\.ts$/u, '.real.ts')));
    writeFileSync(join(dir, file), source);
  }
  const entry = join(work, `${name}-entry.ts`);
  writeFileSync(entry, Object.entries(modules).map(([key, file]) => `export * as ${key} from ${JSON.stringify(`./${name}/${file}`)};`).join('\n'));
  const outfile = join(work, `${name}-bundle.mjs`);
  const result = await esbuild.build({
    entryPoints: [entry],
    outfile,
    absWorkingDir: work,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external: ['@zodiacs/engine', '@zodiacs/engine/*', 'astronomy-engine'],
    define: { 'import.meta.env.SSR': 'true' },
    logLevel: 'error',
    metafile: true,
  });
  const prefix = `${name}/`;
  const files = Object.fromEntries(Object.keys(result.metafile.inputs)
    .filter((input) => input.startsWith(prefix))
    .sort()
    .map((input) => [input.slice(prefix.length), sha256(readFileSync(join(work, input)))]));
  return { module: await import(pathToFileURL(outfile).href), files };
}

function packageEntry(packageDir, subpath) {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const target = manifest.exports?.[subpath]?.import;
  if (!target) throw new Error(`the package exports no ${subpath}`);
  return import(pathToFileURL(join(packageDir, target)).href);
}

async function astronomyOf(packageDir) {
  const require = createRequire(join(packageDir, 'package.json'));
  let directory = dirname(require.resolve('astronomy-engine'));
  const named = (dir) => {
    try {
      return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name === 'astronomy-engine';
    } catch {
      return false;
    }
  };
  while (!named(directory)) {
    if (dirname(directory) === directory) throw new Error('astronomy-engine\'s package.json was not found');
    directory = dirname(directory);
  }
  const own = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  return { module: await import(pathToFileURL(join(directory, own.exports['.'].import)).href), version: own.version };
}

// ---------------------------------------------------------------- the run

export const SECTIONS = Object.freeze(['D2-A', 'D2-R', 'D2-P', 'D2-T', 'D2-X', 'D2-O', 'S2-A', 'S2-B', 'S2-E', 'S2-P', 'S2-X', 'C2-M', 'C2-R', 'C2-P', 'C2-X', 'DG-X', 'DG-N']);
const CHART_SECTIONS = new Set(['D2-A', 'D2-R', 'D2-O', 'S2-A', 'S2-E', 'S2-P']);

/**
 * Runs the comparison and returns its record. `sections` limits the run to
 * some sections; the mutations and wrappers serve the tool's own controls.
 */
export async function runParity({
  root = process.cwd(),
  baseCommit,
  headCommit,
  sections = SECTIONS,
  siteMutations = [],
  headWrappers = {},
  packageMutations = [],
  constructedD2A = [],
  sharedCharts = true,
  seedText = SEED_TEXT,
  plan = null,
} = {}) {
  if (!HEX40.test(baseCommit ?? '')) throw new Error('the base commit must be 40 hexadecimal characters');
  if (plan === null && (constructedD2A.length > 0 || sharedCharts !== true)) {
    throw new Error('constructed cases and sharedCharts: false belong to a control\'s plan, never to the parity record');
  }
  for (const constructed of constructedD2A) {
    if (typeof constructed?.label !== 'string' || !Array.isArray(constructed.bodies) || typeof constructed.obliquity !== 'number') {
      throw new Error('a constructed D2-A case is { label, bodies, obliquity }');
    }
  }
  const head = headCommit ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!HEX40.test(head)) throw new Error('the head commit must be 40 hexadecimal characters');
  const unknown = sections.filter((section) => !SECTIONS.includes(section));
  if (unknown.length) throw new Error(`unknown sections: ${unknown.join(', ')}`);
  const run = new Set(sections);
  const toolPath = fileURLToPath(import.meta.url);
  const work = mkdtempSync(join(tmpdir(), 'zodiacs-lite-parity-'));
  try {
    // ---- the package, linked, or copied when a control changes it ----
    const installed = resolve(root, 'node_modules/@zodiacs/engine');
    const packageDir = join(work, 'node_modules/@zodiacs/engine');
    mkdirSync(join(work, 'node_modules/@zodiacs'), { recursive: true });
    if (packageMutations.length) {
      cpSync(installed, packageDir, { recursive: true, dereference: true });
      for (const { file, from, to } of packageMutations) replaceOnce(join(packageDir, file), from, to);
    } else symlinkSync(installed, packageDir, 'dir');
    symlinkSync(resolve(root, 'node_modules/astronomy-engine'), join(work, 'node_modules/astronomy-engine'), 'dir');

    // ---- the three sides ----
    const site = await bundleSide({
      root, work, name: 's', commit: baseCommit,
      paths: ['src/lib', 'src/islands/chart3d', 'src/islands/synastry'],
      modules: {
        declination: 'src/lib/declination.ts', ecliptic3d: 'src/lib/wheel/ecliptic3d.ts', houses: 'src/lib/engine/houses.ts',
        turning: 'src/islands/chart3d/turning.ts', sect: 'src/lib/sect.ts', composite: 'src/lib/composite.ts',
        dignities: 'src/lib/dignities.ts', full: 'src/lib/engine/full.ts',
        relationship: 'src/islands/synastry/relationshipData.ts', noon: 'src/lib/share-positions-noon.ts',
      },
      mutations: siteMutations,
    });
    const adapters = await bundleSide({
      root, work, name: 'a', commit: head,
      paths: ['src/lib', 'src/islands/synastry'],
      modules: {
        declination: 'src/lib/declination.ts', sect: 'src/lib/sect.ts', composite: 'src/lib/composite.ts',
        dignities: 'src/lib/dignities.ts', relationship: 'src/islands/synastry/relationshipData.ts',
      },
      wrappers: headWrappers,
    });
    const S = site.module;
    const A = adapters.module;
    for (const [module, names] of Object.entries({
      declination: ['findDeclinationAspects', 'declinationRows'], sect: ['sectOf'], composite: ['compositeMidpoints', 'compositeAspects'],
      dignities: ['dignityFor', 'dignitiesFor', 'hasClassicalDignities'], relationship: ['buildCompositeTabData', 'compositeDataKey'],
    })) {
      for (const name of names) if (typeof A[module][name] !== 'function') throw new Error(`the head's ${module} module does not export ${name}()`);
    }
    const P = await packageEntry(packageDir, './lite');
    const root$ = await packageEntry(packageDir, '.');
    const { module: Astronomy, version: astronomyVersion } = await astronomyOf(packageDir);
    const packageManifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
    const liteFiles = ['dist/lite.js', 'dist/lite-declinations.js', 'dist/lite-sect.js', 'dist/lite-composite.js', 'dist/lite-dignities.js', 'dist/lite.d.ts'];

    const recorder = newRecorder();
    const report = {
      schema: 'zodiacs-site-lite-parity/v1',
      generatedAt: new Date().toISOString(),
      node: process.version,
      tz: process.versions.tz ?? null,
      icu: process.versions.icu ?? null,
      esbuild: esbuild.version,
      astronomyEngine: astronomyVersion,
      tool: { path: 'docs/platform/evidence/site-engine-1-1-0-rc2/lite/tools/compare-lite.mjs', sha256: sha256(readFileSync(toolPath)) },
      preregistration: { path: 'docs/platform/evidence/site-engine-1-1-0-rc2/lite/PREREGISTRATION.md', sha256: sha256(readFileSync(join(dirname(toolPath), '../PREREGISTRATION.md'))) },
      base: { commit: baseCommit, files: site.files },
      head: { commit: head, files: adapters.files },
      package: {
        name: packageManifest.name,
        version: packageManifest.version,
        lite: Object.fromEntries(liteFiles.map((file) => [file, sha256(readFileSync(join(packageDir, file)))])),
      },
      seed: { text: seedText, rule: `mulberry32 seeded by the 32-bit FNV-1a of "${seedText}:<section>"; the shared 3,000 charts use the section name "charts"` },
      thresholds: { degrees: THRESHOLD, sunBoundLatitude: SUN_BOUND_LATITUDE, formulaDeclinationLimit: FORMULA_DECLINATION_LIMIT, arbiterMinimumAltitude: ARBITER_MINIMUM_ALTITUDE },
      causes: CAUSES,
      causeOrder: CAUSE_ORDER,
      mapping: {
        declinations: 'S\'s aspects are its findDeclinationAspects; A\'s are the adapter\'s, in the site\'s shape; P\'s are findDeclinationAspects with maximumOrb left out. S\'s rows are the view\'s: declinationOf(lon, lat, obliquity) and Math.abs(dec) > obliquity (EclipticView lines 396, 402, 415 and 421); A\'s are declinationRows(bodies, obliquity).',
        sect: 'S\'s and A\'s sectOf({ sunAltitude, sunLon, mercuryLon }); P\'s sectReading({ convention: "altitude", sunAltitude, sunLon, mercuryLon }) with convention left out and its frozen lists read as lists. S2-E compares P\'s sectReading({ convention: "ecliptic", ascendant, sunLon, mercuryLon }).sect with the root\'s sectOf(ascendant, sunLon).',
        composite: 'compositeMidpoints then compositeAspects of its points, field by field in order; C2-P compares buildCompositeTabData\'s data and compositeDataKey, S\'s at the base and A\'s at the head, on the base\'s pictureBodies.',
        dignities: 'dignityFor, dignitiesFor (as a list) and hasClassicalDignities for each name and sign, as one case; a refusal is compared by its class and message.',
      },
      run: { sections: [...run], plan },
    };

    // ---- the shared charts (section 4.2) ----
    const obliquityAt = (ms) => S.houses.meanObliquity(S.ecliptic3d.julianCenturies(ms));
    const viewBodies = (rows) => rows.filter((row) => VIEW_BODIES.includes(row.body)).map((row) => ({ body: row.body, lon: row.lon, lat: row.lat }));
    let charts = [];
    if (sharedCharts && sections.some((section) => CHART_SECTIONS.has(section))) {
      const random = stream('charts', seedText);
      for (let index = 0; index < 3000; index += 1) {
        const ms = random.instant(FROM, TO);
        let latitude;
        if (index < 2400) latitude = random.uniform(-66, 66);
        else {
          const north = random.next() < 0.5;
          const size = random.uniform(66.6, 88.6);
          latitude = north ? size : -size;
        }
        const longitude = random.uniform(-180, 180);
        const chart = S.full.computeChart({ utc: new Date(ms), latitude, longitude, houseSystem: 'whole', timeKnown: true });
        const bodies = viewBodies(chart.bodies);
        const sun = bodies.find((row) => row.body === 'Sun');
        const mercury = bodies.find((row) => row.body === 'Mercury');
        const frame = S.turning.turnFrame({
          utcMs: ms, latitude, longitude, baseline: chart.angles, baselineCusps: null,
          houseSystem: chart.houses?.system ?? 'whole', polarFallback: false,
        }, 0);
        const sunAltitude = S.ecliptic3d.altitudeOf(sun.lon, sun.lat, frame.zenith);
        charts.push({ index, ms, latitude, longitude, angles: chart.angles, bodies, obliquity: obliquityAt(ms), sun, mercury, sunAltitude });
      }
    }
    const chartLabel = (chart) => ({ chart: chart.index, utc: new Date(chart.ms).toISOString(), latitude: chart.latitude, longitude: chart.longitude });
    const siteRows = (bodies, obliquity, declinationOf) => outcome(() => bodies.map((row) => {
      const dec = declinationOf(row.lon, row.lat, obliquity);
      return { body: row.body, dec, outOfBounds: Math.abs(dec) > obliquity };
    }));
    const packageAspects = (bodies, obliquity) => outcome(() => P.findDeclinationAspects(bodies, obliquity)
      .map(({ a, b, type, orb, decA, decB, separation }) => ({ a, b, type, orb, decA, decB, separation })));
    const referee = { cases: 0, pairs: 0, agree: 0, disagreements: [] };
    const refereeCase = (label, bodies, obliquity) => {
      const rows = P.declinationsForBodies(bodies, obliquity).rows.map(({ body, dec }) => ({ body, dec }));
      const aspects = P.findDeclinationAspects(bodies, obliquity);
      referee.cases += 1;
      referee.pairs += (rows.length * (rows.length - 1)) / 2;
      if (refereeAgrees(rows, aspects)) referee.agree += 1;
      else referee.disagreements.push({ label, expected: refereeAspects(rows), package: aspects.map(({ a, b, type }) => ({ a, b, type })) });
    };

    // ================================================================ declinations
    if (run.has('D2-A')) {
      recorder.begin('D2-A', 'declinations', 'findDeclinationAspects on the 3,000 charts\' ten bodies at C2\'s obliquity (the base\'s meanObliquity(julianCenturies(utcMs)))');
      const sa = recorder.comparison('S-A', RULES['D2-A'], 'S against A');
      const sp = recorder.comparison('S-P', RULES.recorded, 'S against P, recorded with the same causes');
      for (const chart of charts) {
        const input = { bodies: chart.bodies, obliquity: chart.obliquity };
        const s = outcome(() => S.declination.findDeclinationAspects(chart.bodies, chart.obliquity));
        recorder.record(sa, chartLabel(chart), aspectDifferences(s, outcome(() => A.declination.findDeclinationAspects(chart.bodies, chart.obliquity)), input));
        recorder.record(sp, chartLabel(chart), aspectDifferences(s, packageAspects(chart.bodies, chart.obliquity), input));
        refereeCase(chartLabel(chart), chart.bodies, chart.obliquity);
      }
      // A control's constructed cases (its plan's constructedD2A), after the charts; never in the parity record.
      for (const constructed of constructedD2A) {
        const label = { constructed: constructed.label };
        const input = { bodies: constructed.bodies, obliquity: constructed.obliquity };
        const s = outcome(() => S.declination.findDeclinationAspects(constructed.bodies, constructed.obliquity));
        recorder.record(sa, label, aspectDifferences(s, outcome(() => A.declination.findDeclinationAspects(constructed.bodies, constructed.obliquity)), input));
        recorder.record(sp, label, aspectDifferences(s, packageAspects(constructed.bodies, constructed.obliquity), input));
        refereeCase(label, constructed.bodies, constructed.obliquity);
      }
    }
    if (run.has('D2-R')) {
      recorder.begin('D2-R', 'declinations', 'each body\'s declination and out-of-bounds flag on the 3,000 charts: S\'s declinationOf and Math.abs(dec) > obliquity against A\'s declinationRows');
      const sa = recorder.comparison('S-A', RULES['D2-R'], 'S against A');
      for (const chart of charts) {
        const input = { bodies: chart.bodies, obliquity: chart.obliquity };
        recorder.record(sa, chartLabel(chart), rowDifferences(siteRows(chart.bodies, chart.obliquity, S.ecliptic3d.declinationOf),
          outcome(() => A.declination.declinationRows(chart.bodies, chart.obliquity)), input));
      }
    }
    if (run.has('D2-P')) {
      recorder.begin('D2-P', 'declinations', 'as D2-R for a second chart\'s bodies as the view passes them: 500 charts at another chart\'s obliquity, every other one with every latitude exactly 0');
      const sa = recorder.comparison('S-A', RULES['D2-R'], 'S against A');
      const random = stream('D2-P', seedText);
      for (let index = 0; index < 500; index += 1) {
        const own = random.instant(FROM, TO);
        const partner = random.instant(FROM, TO);
        const obliquity = obliquityAt(own);
        const flat = index % 2 === 1;
        const bodies = viewBodies(S.full.computeBodies(new Date(partner))).map((row) => (flat ? { ...row, lat: 0 } : row));
        const input = { bodies, obliquity };
        recorder.record(sa, { case: index, own: new Date(own).toISOString(), partner: new Date(partner).toISOString(), flat },
          rowDifferences(siteRows(bodies, obliquity, S.ecliptic3d.declinationOf), outcome(() => A.declination.declinationRows(bodies, obliquity)), input));
      }
    }
    if (run.has('D2-T')) {
      recorder.begin('D2-T', 'declinations', 'named fixtures, under D2-A\'s rules for the aspects and D2-R\'s for the rows');
      const aspects = recorder.comparison('S-A aspects', RULES['D2-A'], 'S against A, aspects');
      const rows = recorder.comparison('S-A rows', RULES['D2-R'], 'S against A, rows');
      const site = S.ecliptic3d.OBLIQUITY;
      const fixtures = [
        ['declinations 13.3 and 12.3 at obliquity 0 (a parallel at orb 1)', [{ body: 'Mars', lon: 10, lat: 13.3 }, { body: 'Venus', lon: 200, lat: 12.3 }], 0],
        ['declinations 8.3 and 7.3 at obliquity 0', [{ body: 'Mars', lon: 10, lat: 8.3 }, { body: 'Venus', lon: 200, lat: 7.3 }], 0],
        ['declinations 1.1 and 0.1 at obliquity 0', [{ body: 'Mars', lon: 10, lat: 1.1 }, { body: 'Venus', lon: 200, lat: 0.1 }], 0],
        ['two bodies on the equator (obliquity 0, latitude 0)', [{ body: 'Mars', lon: 10, lat: 0 }, { body: 'Venus', lon: 200, lat: 0 }], 0],
        ['a luminary pair at orb 1.5 (obliquity 0, declinations 10 and 8.5)', [{ body: 'Sun', lon: 10, lat: 10 }, { body: 'Moon', lon: 200, lat: 8.5 }], 0],
        ['the Sun at 90 degrees, latitude 0', [{ body: 'Sun', lon: 90, lat: 0 }], site],
        ['the Sun at 270 degrees, latitude 0', [{ body: 'Sun', lon: 270, lat: 0 }], site],
        ['the Sun at 90 degrees, latitude +0.0005', [{ body: 'Sun', lon: 90, lat: 0.0005 }], site],
        ['the Sun at 90 degrees, latitude -0.0005', [{ body: 'Sun', lon: 90, lat: -0.0005 }], site],
        ['the Sun at 270 degrees, latitude +0.0005', [{ body: 'Sun', lon: 270, lat: 0.0005 }], site],
        ['the Sun at 270 degrees, latitude -0.0005', [{ body: 'Sun', lon: 270, lat: -0.0005 }], site],
        ['a node at longitude 90 degrees, latitude 0', [{ body: 'North Node', lon: 90, lat: 0 }], site],
      ];
      for (const [label, bodies, obliquity] of fixtures) {
        const input = { bodies, obliquity };
        recorder.record(aspects, { fixture: label }, aspectDifferences(outcome(() => S.declination.findDeclinationAspects(bodies, obliquity)),
          outcome(() => A.declination.findDeclinationAspects(bodies, obliquity)), input));
        recorder.record(rows, { fixture: label }, rowDifferences(siteRows(bodies, obliquity, S.ecliptic3d.declinationOf),
          outcome(() => A.declination.declinationRows(bodies, obliquity)), input));
        refereeCase({ fixture: label }, bodies, obliquity);
      }
    }
    if (run.has('D2-X')) {
      recorder.begin('D2-X', 'declinations', 'inputs the package refuses (recorded): cause declination-validation');
      const sa = recorder.comparison('S-A', RULES.recorded, 'S against A');
      const sp = recorder.comparison('S-P', RULES.recorded, 'S against P');
      const pair = (first, second = { body: 'Venus', lon: 20, lat: 1 }) => [first, second];
      const many = Array.from({ length: 257 }, (_, index) => ({ body: `B${index}`, lon: index, lat: 0 }));
      const inputs = [
        ['a label with a control character', pair({ body: 'Ma\u0007rs', lon: 10, lat: 1 }), 23.44],
        ['a label that is not trimmed', pair({ body: ' Mars', lon: 10, lat: 1 }), 23.44],
        ['an empty label', pair({ body: '', lon: 10, lat: 1 }), 23.44],
        ['a label of 81 characters', pair({ body: 'X'.repeat(81), lon: 10, lat: 1 }), 23.44],
        ['a body named twice', pair({ body: 'Venus', lon: 10, lat: 1 }), 23.44],
        ['257 bodies', many, 23.44],
        ['a longitude that is not a number', pair({ body: 'Mars', lon: Number.NaN, lat: 1 }), 23.44],
        ['an infinite latitude', pair({ body: 'Mars', lon: 10, lat: Number.POSITIVE_INFINITY }), 23.44],
        ['a latitude of 91', pair({ body: 'Mars', lon: 10, lat: 91 }), 23.44],
        ['an obliquity of -1', pair({ body: 'Mars', lon: 10, lat: 1 }), -1],
        ['an obliquity of 91', pair({ body: 'Mars', lon: 10, lat: 1 }), 91],
        ['an obliquity that is not a number', pair({ body: 'Mars', lon: 10, lat: 1 }), Number.NaN],
      ];
      for (const [label, bodies, obliquity] of inputs) {
        const input = { bodies, obliquity };
        const s = outcome(() => S.declination.findDeclinationAspects(bodies, obliquity));
        recorder.record(sa, { input: label }, aspectDifferences(s, outcome(() => A.declination.findDeclinationAspects(bodies, obliquity)), input));
        recorder.record(sp, { input: label }, aspectDifferences(s, packageAspects(bodies, obliquity), input));
      }
    }
    if (run.has('D2-O')) {
      const d2o = { charts: 0, errors: 0, chartsWithPairSetChange: 0, pairsOnlyAtMean: 0, pairsOnlyAtTrue: 0, rowsWithFlagChange: 0, maximumObliquityDifference: 0, examples: [] };
      for (const chart of charts) {
        const result = outcome(() => {
          const trueObliquity = root$.chartDeclinations({ utc: new Date(chart.ms), timeKnown: false }).trueObliquity;
          return { trueObliquity, mean: P.declinationsForBodies(chart.bodies, chart.obliquity), true: P.declinationsForBodies(chart.bodies, trueObliquity) };
        });
        d2o.charts += 1;
        if (!result.ok) {
          d2o.errors += 1;
          continue;
        }
        const { trueObliquity, mean, true: tru } = result.value;
        d2o.maximumObliquityDifference = Math.max(d2o.maximumObliquityDifference, Math.abs(trueObliquity - chart.obliquity));
        const meanKeys = new Set(mean.aspects.map(pairKey));
        const trueKeys = new Set(tru.aspects.map(pairKey));
        const onlyMean = [...meanKeys].filter((key) => !trueKeys.has(key));
        const onlyTrue = [...trueKeys].filter((key) => !meanKeys.has(key));
        const flags = mean.rows.filter((row, index) => row.outOfBounds !== tru.rows[index].outOfBounds).length;
        if (onlyMean.length || onlyTrue.length) d2o.chartsWithPairSetChange += 1;
        d2o.pairsOnlyAtMean += onlyMean.length;
        d2o.pairsOnlyAtTrue += onlyTrue.length;
        d2o.rowsWithFlagChange += flags;
        if ((onlyMean.length || onlyTrue.length || flags) && d2o.examples.length < 20) {
          d2o.examples.push({ ...chartLabel(chart), meanObliquity: chart.obliquity, trueObliquity, onlyMean, onlyTrue, flags });
        }
      }
      report.d2o = { description: 'Recorded, no pass condition (informs OQ4 only): P\'s declinationsForBodies on the 3,000 charts\' ten bodies at the true obliquity of date (the root\'s chartDeclinations at the instant) against C2\'s mean obliquity: pair sets and flags that change.', ...d2o };
    }

    // ================================================================ sect
    const siteSect = (input) => outcome(() => S.sect.sectOf(input));
    const adapterSect = (input) => outcome(() => A.sect.sectOf(input));
    const packageSect = (packageInput) => {
      const result = outcome(() => P.sectReading(packageInput));
      if (!result.ok) return result;
      const { sect, sunAltitude, light, mercury, inSect, outOfSect } = result.value;
      return { ok: true, value: { sect, sunAltitude, light, mercury, inSect: [...inSect], outOfSect: [...outOfSect] } };
    };
    const altitudeInput = (input) => {
      const packageInput = { convention: 'altitude', sunAltitude: input.sunAltitude, sunLon: input.sunLon };
      if (Object.hasOwn(input, 'mercuryLon')) packageInput.mercuryLon = input.mercuryLon;
      return packageInput;
    };
    const chartSectInput = (chart) => ({ sunAltitude: chart.sunAltitude, sunLon: chart.sun.lon, mercuryLon: chart.mercury?.lon ?? null });
    if (run.has('S2-A')) {
      recorder.begin('S2-A', 'sect', 'the site\'s sectOf against A\'s and P\'s on the 3,000 charts, the Sun\'s altitude from the view\'s frame at scrub zero (EclipticView line 538)');
      const sa = recorder.comparison('S-A', RULES.none, 'S against A: every field equal');
      const sp = recorder.comparison('S-P', RULES.none, 'S against P: sect, light, Mercury, the two lists and the altitude equal');
      for (const chart of charts) {
        const input = chartSectInput(chart);
        const s = siteSect(input);
        recorder.record(sa, chartLabel(chart), valueDifferences(s, adapterSect(input), 'sect', { siteInput: input, packageInput: altitudeInput(input) }));
        recorder.record(sp, chartLabel(chart), valueDifferences(s, packageSect(altitudeInput(input)), 'sect', { siteInput: input, packageInput: altitudeInput(input) }));
      }
    }
    if (run.has('S2-B')) {
      recorder.begin('S2-B', 'sect', 'constructed: altitude 0, -0, plus and minus Number.MIN_VALUE and 1e-12; Mercury on the Sun, opposite it, absent as null and as undefined; longitudes -10, 370 and 720');
      const sa = recorder.comparison('S-A', RULES.none, 'S against A');
      const sp = recorder.comparison('S-P', RULES.none, 'S against P');
      const cases = [];
      for (const sunAltitude of [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, 1e-12, -1e-12]) cases.push([`altitude ${Object.is(sunAltitude, -0) ? '-0' : sunAltitude}`, { sunAltitude, sunLon: 100, mercuryLon: 80 }]);
      for (const sunAltitude of [10, -10]) {
        cases.push([`Mercury on the Sun, altitude ${sunAltitude}`, { sunAltitude, sunLon: 100, mercuryLon: 100 }]);
        cases.push([`Mercury opposite the Sun, altitude ${sunAltitude}`, { sunAltitude, sunLon: 100, mercuryLon: 280 }]);
        cases.push([`Mercury null, altitude ${sunAltitude}`, { sunAltitude, sunLon: 100, mercuryLon: null }]);
        cases.push([`Mercury undefined, altitude ${sunAltitude}`, { sunAltitude, sunLon: 100, mercuryLon: undefined }]);
        cases.push([`Mercury left out, altitude ${sunAltitude}`, { sunAltitude, sunLon: 100 }]);
        for (const lon of [-10, 370, 720]) {
          cases.push([`Sun at ${lon}, altitude ${sunAltitude}`, { sunAltitude, sunLon: lon, mercuryLon: 0 }]);
          cases.push([`Mercury at ${lon}, altitude ${sunAltitude}`, { sunAltitude, sunLon: 100, mercuryLon: lon }]);
        }
      }
      for (const [label, input] of cases) {
        const s = siteSect(input);
        recorder.record(sa, { input: label }, valueDifferences(s, adapterSect(input), 'sect', { siteInput: input, packageInput: altitudeInput(input) }));
        recorder.record(sp, { input: label }, valueDifferences(s, packageSect(altitudeInput(input)), 'sect', { siteInput: input, packageInput: altitudeInput(input) }));
      }
    }
    if (run.has('S2-E')) {
      recorder.begin('S2-E', 'sect', 'P\'s ecliptic convention against the root\'s sectOf(ascendant, sun) on the 3,000 charts, and with the Sun exactly on each angle');
      const pr = recorder.comparison('P-root', RULES.none, 'sectReading({ convention: "ecliptic" }).sect against the root\'s sectOf');
      for (const chart of charts) {
        const { asc, mc, dsc, ic } = chart.angles;
        for (const [where, sunLon] of [['the chart\'s Sun', chart.sun.lon], ['the Sun on the ascendant', asc], ['the Sun on the midheaven', mc], ['the Sun on the descendant', dsc], ['the Sun on the imum coeli', ic]]) {
          const p = outcome(() => P.sectReading({ convention: 'ecliptic', ascendant: asc, sunLon, mercuryLon: chart.mercury?.lon ?? null }).sect);
          const r = outcome(() => root$.sectOf(asc, sunLon));
          recorder.record(pr, { ...chartLabel(chart), where }, valueDifferences(p, r, 'sect', { siteInput: null, packageInput: { convention: 'ecliptic', ascendant: asc, sunLon } }));
        }
      }
    }
    if (run.has('S2-P')) {
      recorder.begin('S2-P', 'sect', 'recorded, no pass condition (informs OQ4 only): the altitude rule against the ecliptic rule on the 3,000 charts, each disagreement judged by the Sun\'s geometric altitude from astronomy-engine where it exceeds 0.01 degrees in size');
      const rules = recorder.comparison('altitude-ecliptic', RULES.recorded, 'the site\'s sect by the altitude against the root\'s sectOf(ascendant, sun)');
      const s2p = { charts: 0, disagreements: 0, judged: 0, unjudged: 0, altitudeRuleRight: 0, eclipticRuleRight: 0, siteAltitudeAgainstArbiter: [], examples: [] };
      for (const chart of charts) {
        s2p.charts += 1;
        const altitudeSect = chart.sunAltitude >= 0 ? 'day' : 'night';
        const eclipticSect = root$.sectOf(chart.angles.asc, chart.sun.lon);
        const diffs = altitudeSect === eclipticSect ? [] : [{ kind: 'sect-convention', recorded: true, s: altitudeSect, x: eclipticSect }];
        recorder.record(rules, chartLabel(chart), { values: 1, diffs });
        if (!diffs.length) continue;
        s2p.disagreements += 1;
        const time = Astronomy.MakeTime(new Date(chart.ms));
        const observer = new Astronomy.Observer(chart.latitude, chart.longitude, 0);
        const equator = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
        const arbiter = Astronomy.Horizon(time, observer, equator.ra, equator.dec).altitude;
        const example = { ...chartLabel(chart), siteAltitude: chart.sunAltitude, arbiterAltitude: arbiter, altitudeSect, eclipticSect };
        if (Math.abs(arbiter) <= ARBITER_MINIMUM_ALTITUDE) {
          s2p.unjudged += 1;
        } else {
          s2p.judged += 1;
          const day = arbiter > 0;
          if ((altitudeSect === 'day') === day) s2p.altitudeRuleRight += 1;
          else s2p.siteAltitudeAgainstArbiter.push(example);
          if ((eclipticSect === 'day') === day) s2p.eclipticRuleRight += 1;
        }
        if (s2p.examples.length < 20) s2p.examples.push(example);
      }
      report.s2p = {
        description: 'Judged where the arbiter\'s altitude exceeds 0.01 degrees in size: astronomy-engine 2.1.19, Equator of date with aberration and Horizon without refraction, at the chart\'s instant and place. siteAltitudeAgainstArbiter lists the judged charts where the site\'s altitude and the arbiter disagree in sign; any entry there is a question for the owner before anything else is done (section 4.1).',
        ...s2p,
        ownerQuestion: s2p.siteAltitudeAgainstArbiter.length > 0,
      };
    }
    if (run.has('S2-X')) {
      recorder.begin('S2-X', 'sect', 'inputs the package refuses (recorded): cause sect-validation');
      const sa = recorder.comparison('S-A', RULES.recorded, 'S against A');
      const sp = recorder.comparison('S-P', RULES.recorded, 'S against P');
      const inputs = [
        ['an altitude that is not a number', { sunAltitude: Number.NaN, sunLon: 100, mercuryLon: 80 }],
        ['an infinite altitude', { sunAltitude: Number.POSITIVE_INFINITY, sunLon: 100, mercuryLon: 80 }],
        ['an altitude of 91', { sunAltitude: 91, sunLon: 100, mercuryLon: 80 }],
        ['an altitude of -91', { sunAltitude: -91, sunLon: 100, mercuryLon: 80 }],
        ['a Sun longitude that is not a number', { sunAltitude: 10, sunLon: Number.NaN, mercuryLon: 80 }],
        ['a Mercury longitude that is not a number', { sunAltitude: 10, sunLon: 100, mercuryLon: Number.NaN }],
        ['an infinite Mercury longitude', { sunAltitude: 10, sunLon: 100, mercuryLon: Number.POSITIVE_INFINITY }],
      ];
      for (const [label, input] of inputs) {
        const s = siteSect(input);
        const context = { siteInput: input, packageInput: altitudeInput(input) };
        recorder.record(sa, { input: label }, valueDifferences(s, adapterSect(input), 'sect', context));
        recorder.record(sp, { input: label }, valueDifferences(s, packageSect(altitudeInput(input)), 'sect', context));
      }
      const plain = { sunAltitude: 10, sunLon: 100, mercuryLon: 80 };
      for (const [label, packageInput] of [
        ['an unknown key', { convention: 'altitude', sunAltitude: 10, sunLon: 100, mercuryLon: 80, extra: 1 }],
        ['an unknown convention', { convention: 'horizon', sunAltitude: 10, sunLon: 100, mercuryLon: 80 }],
      ]) {
        recorder.record(sp, { input: label }, valueDifferences(siteSect(plain), packageSect(packageInput), 'sect', { siteInput: plain, packageInput }));
      }
    }

    // ================================================================ composite
    const compositeOf = (midpoints, aspects) => (a, b) => outcome(() => {
      const points = midpoints(a, b);
      return { points: [...points], aspects: [...aspects(points)] };
    });
    const siteComposite = compositeOf((a, b) => S.composite.compositeMidpoints(a, b), (points) => S.composite.compositeAspects(points));
    const adapterComposite = compositeOf((a, b) => A.composite.compositeMidpoints(a, b), (points) => A.composite.compositeAspects(points));
    const packageComposite = compositeOf((a, b) => P.compositeMidpoints(a, b), (points) => P.compositeAspects(points));
    const compareComposite = (sa, sp, label, a, b) => {
      const s = siteComposite(a, b);
      recorder.record(sa, label, valueDifferences(s, adapterComposite(a, b), 'composite', { a, b }));
      recorder.record(sp, label, valueDifferences(s, packageComposite(a, b), 'composite', { a, b }));
    };
    if (run.has('C2-M')) {
      recorder.begin('C2-M', 'composite', '500 pairs of body lists with exact coincidences, exact oppositions and near-oppositions, as rc.16\'s C-M');
      const sa = recorder.comparison('S-A', RULES.none, 'S against A');
      const sp = recorder.comparison('S-P', RULES.none, 'S against P');
      const random = stream('C2-M', seedText);
      for (let index = 0; index < 500; index += 1) {
        const a = random.shuffle(BODY_NAMES).slice(0, random.integer(1, 12)).map((body) => ({ body, lon: random.uniform(0, 360) }));
        const b = random.shuffle(BODY_NAMES).slice(0, random.integer(1, 12)).map((body) => {
          const own = a.find((point) => point.body === body);
          const roll = random.next();
          if (own && roll < 0.1) return { body, lon: own.lon };
          if (own && roll < 0.2) return { body, lon: (own.lon + 180) % 360 };
          if (own && roll < 0.25) return { body, lon: (own.lon + 180 + (random.next() < 0.5 ? -1e-9 : 1e-9)) % 360 };
          return { body, lon: random.uniform(0, 360) };
        });
        compareComposite(sa, sp, { case: index }, a, b);
      }
    }
    if (run.has('C2-R')) {
      recorder.begin('C2-R', 'composite', '500 pairs of the site\'s own charts (computeBodies at invented instants 1800 to 2199)');
      const sa = recorder.comparison('S-A', RULES.none, 'S against A');
      const sp = recorder.comparison('S-P', RULES.none, 'S against P');
      const random = stream('C2-R', seedText);
      for (let index = 0; index < 500; index += 1) {
        const first = random.instant(FROM, TO);
        const second = random.instant(FROM, TO);
        const a = S.full.computeBodies(new Date(first));
        const b = S.full.computeBodies(new Date(second));
        compareComposite(sa, sp, { case: index, a: new Date(first).toISOString(), b: new Date(second).toISOString() }, a, b);
      }
    }
    if (run.has('C2-P')) {
      recorder.begin('C2-P', 'composite', '300 pairs as the relationship page passes them: the base\'s pictureBodies of timed and untimed persons, then buildCompositeTabData, S\'s at the base and A\'s at the head; compositeDataKey equal');
      const sa = recorder.comparison('S-A', RULES.none, 'S against A, with compositeDataKey');
      const random = stream('C2-P', seedText);
      const bodiesAt = (utc) => S.full.computeBodies(utc);
      const person = () => {
        const timeKnown = random.next() < 0.5;
        let ms = random.instant(FROM, TO);
        if (timeKnown) {
          if (random.next() < 0.25) ms = Math.round(ms / 60_000) * 60_000;
          return { bodies: bodiesAt(new Date(ms)).map(({ body, lon }) => ({ body, lon })), timeKnown: true, utc: new Date(ms) };
        }
        return { bodies: bodiesAt(new Date(ms)).map(({ body, lon }) => ({ body, lon })), timeKnown: false, untimedDate: isoDate(ms) };
      };
      for (let index = 0; index < 300; index += 1) {
        const first = person();
        const second = person();
        const label = { case: index, a: first.timeKnown ? new Date(first.utc).toISOString() : first.untimedDate, b: second.timeKnown ? new Date(second.utc).toISOString() : second.untimedDate };
        const pictured = outcome(() => [S.noon.pictureBodies(first, bodiesAt), S.noon.pictureBodies(second, bodiesAt)]);
        if (!pictured.ok) {
          recorder.record(sa, label, { values: 1, diffs: [{ kind: 'value', path: '(pictureBodies)', s: pictured, x: null }] });
          continue;
        }
        const [a, b] = pictured.value;
        const certainty = { aTimeKnown: first.timeKnown, bTimeKnown: second.timeKnown };
        const s = outcome(() => {
          const data = S.relationship.buildCompositeTabData(a, b, certainty);
          return { data, key: S.relationship.compositeDataKey(data) };
        });
        const x = outcome(() => {
          const data = A.relationship.buildCompositeTabData(a, b, certainty);
          return { data, key: A.relationship.compositeDataKey(data) };
        });
        recorder.record(sa, label, valueDifferences(s, x, 'composite', { a, b }));
      }
    }
    if (run.has('C2-X')) {
      recorder.begin('C2-X', 'composite', 'lists the site never builds (recorded): rc.16\'s three, a body twice in the second list, a longitude that is not finite; cause composite-validation');
      const sa = recorder.comparison('S-A', RULES.recorded, 'S against A');
      const sp = recorder.comparison('S-P', RULES.recorded, 'S against P');
      const lists = [
        [[{ body: 'Chiron', lon: 10 }, { body: 'Sun', lon: 20 }], [{ body: 'Sun', lon: 40 }]],
        [[{ body: 'Sun', lon: 10 }, { body: 'Sun', lon: 20 }], [{ body: 'Sun', lon: 40 }]],
        [[{ body: 'ASC', lon: 10 }], [{ body: 'ASC', lon: 50 }]],
        [[{ body: 'Sun', lon: 10 }], [{ body: 'Sun', lon: 40 }, { body: 'Sun', lon: 50 }]],
        [[{ body: 'Sun', lon: Number.NaN }], [{ body: 'Sun', lon: 10 }]],
      ];
      lists.forEach(([a, b], index) => compareComposite(sa, sp, { list: index }, a, b));
    }

    // ================================================================ dignities
    const dignityRow = (side, planet, sign) => [
      outcome(() => side.dignityFor(planet, sign)),
      outcome(() => [...side.dignitiesFor(planet, sign)]),
      outcome(() => side.hasClassicalDignities(planet)),
    ];
    if (run.has('DG-X')) {
      recorder.begin('DG-X', 'dignities', 'dignityFor, dignitiesFor and hasClassicalDignities for every body in every sign (144)');
      const sa = recorder.comparison('S-A', RULES.none, 'S against A');
      const sp = recorder.comparison('S-P', RULES.none, 'S against P');
      for (const planet of BODY_NAMES) {
        for (const sign of SIGN_SLUGS) {
          const s = dignityRow(S.dignities, planet, sign);
          recorder.record(sa, { planet, sign }, dignityDifferences(planet, sign, s, dignityRow(A.dignities, planet, sign)));
          recorder.record(sp, { planet, sign }, dignityDifferences(planet, sign, s, dignityRow(P, planet, sign)));
        }
      }
    }
    if (run.has('DG-N')) {
      recorder.begin('DG-N', 'dignities', 'rc.16\'s seven names and signs and five names Object.prototype carries, each with leo');
      const sa = recorder.comparison('S-A', RULES['DG-N'], 'S against A');
      const sp = recorder.comparison('S-P', RULES.recorded, 'S against P, recorded with dignity-validation or site-prototype-lookup');
      const names = [['Chiron', 'aries'], ['Ascendant', 'leo'], ['', 'leo'], ['sun', 'leo'], ['Sun', 'Leo'], ['Sun', ''], ['Mars', 'ophiuchus'],
        ...PROTOTYPE_NAMES.map((planet) => [planet, 'leo'])];
      for (const [planet, sign] of names) {
        const s = dignityRow(S.dignities, planet, sign);
        recorder.record(sa, { planet, sign }, dignityDifferences(planet, sign, s, dignityRow(A.dignities, planet, sign)));
        recorder.record(sp, { planet, sign }, dignityDifferences(planet, sign, s, dignityRow(P, planet, sign)));
      }
    }

    // ---- summary ----
    const { sections: recorded, listed, unexplained, omitted } = recorder.finish();
    report.sections = recorded;
    report.referee = { description: 'For every pair P gives in D2-A and D2-T, the type, the inclusion under the maximum orb and the order, from P\'s own declination doubles in BigInt; a disagreement fails the record.', ...referee };
    const units = {};
    for (const [id, section] of Object.entries(recorded)) {
      const unit = (units[section.unit] ??= { sections: [], cases: 0, values: 0, agree: 0, differ: 0, causes: {}, failedComparisons: [] });
      unit.sections.push(id);
      for (const [name, row] of Object.entries(section.comparisons)) {
        unit.cases += row.cases;
        unit.values += row.values;
        unit.agree += row.agree;
        unit.differ += row.differ;
        for (const [cause, count] of Object.entries(row.causes)) unit.causes[cause] = (unit.causes[cause] ?? 0) + count;
        if (row.pass === false) unit.failedComparisons.push(`${id} ${name}`);
      }
    }
    report.units = units;
    report.differences = listed;
    report.unexplained = unexplained;
    report.listOmitted = omitted;
    const failed = Object.values(units).flatMap((unit) => unit.failedComparisons);
    report.verdict = {
      unexplained: unexplained.length + omitted,
      failedComparisons: failed,
      refereeDisagreements: referee.disagreements.length,
      ownerQuestion: report.s2p?.ownerQuestion ?? null,
      pass: plan === null && unexplained.length === 0 && omitted === 0 && failed.length === 0 && referee.disagreements.length === 0,
      units: Object.fromEntries(Object.entries(units).map(([name, unit]) => [name, unit.failedComparisons.length === 0
        && !unexplained.some((entry) => recorded[entry.section]?.unit === name)])),
    };
    return report;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- command line

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const baseCommit = args[0];
  const option = (name) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  if (!HEX40.test(baseCommit ?? '')) {
    console.error('usage: compare-lite.mjs <40-hex base commit> [--head <40-hex>] [--plan <file.json>]');
    process.exit(2);
  }
  const planPath = option('--plan');
  const plan = planPath ? JSON.parse(readFileSync(planPath, 'utf8')) : null;
  const report = await runParity({
    baseCommit,
    headCommit: option('--head'),
    sections: plan?.sections ?? SECTIONS,
    siteMutations: plan?.siteMutations ?? [],
    headWrappers: plan?.headWrappers ?? {},
    packageMutations: plan?.packageMutations ?? [],
    constructedD2A: plan?.constructedD2A ?? [],
    sharedCharts: plan?.sharedCharts ?? true,
    plan,
  });
  process.stdout.write(`${JSON.stringify(report, (_key, value) => (typeof value === 'number' && !Number.isFinite(value) ? String(value) : value), 2)}\n`);
  process.exitCode = report.verdict.pass ? 0 : 1;
}
