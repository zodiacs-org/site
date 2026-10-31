/**
 * The offline, deterministic data-pack compiler.
 *
 *   node compile.mjs --kernel=PATH [--candidate=A|B|D] [--out=PATH]
 *                    [--fromYear=YYYY] [--toYear=YYYY] [--bodies=a,b,...]
 *                    [--producer-name=TEXT] [--producer-institution=TEXT]
 *   node compile.mjs --help
 *
 * No network. No LLM. No clock, hostname, path or process detail enters the
 * output, so the same kernel and the same settings produce a byte-identical
 * pack; `npm run` is not involved and nothing is read from the environment
 * except the flags above. Since 2.0.0 the cosines come from `cheb.mjs`'s own
 * arithmetic rather than `Math.cos`, so that holds across machines too.
 *
 * Candidates, declared before measurement (see RESULTS.md for the hypotheses):
 *   A  keep the kernel's own segmentation; truncate the high-order Chebyshev
 *      coefficients and quantise the rest under an explicit error budget.
 *   B  refit adaptive segments -- interval length and degree chosen per body
 *      from validation error -- with float64 coefficients.
 *   C  a compact residual correction over astronomy-engine's own model.
 *      Refused since 2.0.0: its error has no proven bound (see below).
 *   D  B plus the same quantiser A uses. Declared after A/B/C and before it
 *      was measured, on the reasoning that A and B attack different costs
 *      (bits per coefficient vs number of coefficients) and compose.
 *
 * Three structural facts about the DE kernels are exploited by EVERY
 * candidate, and are reported as a separate line item because they are not
 * compression:
 *   1. segment 399/3 (Earth relative to the Earth-Moon barycentre) equals
 *      -(1/EMRAT) times segment 301/3, to 1 ulp. It is stored as that one
 *      scalar, not as 8.57 MiB of duplicate coefficients.
 *   2. segments 199/1 and 299/2 are identically zero: the Mercury and Venus
 *      body centres coincide with their barycentres.
 *   3. the DAF file's own headers, comment area and reserved records are not
 *      data and are not carried.
 *
 * ## 2.0.0 (2026-10-31): version 1's M2.1
 *
 * - The span comes from the kernel: the stretch every segment the pack reads
 *   covers. 1.x gridded every body over DE440s's 109,600 days whatever the
 *   kernel, so DE440 compiled to records ending in 1850 and was refused when
 *   opened, and DE432s's last records ran up to 1,816 days past the kernel,
 *   where the SPK reader extrapolated its last polynomial.
 * - B and D lay nrec = ceil(span / L) records of span / nrec each, so the
 *   last record ends on the coverage stop. Shortening every record a little
 *   rather than clipping the last one keeps the runtime's records uniform,
 *   which its validated searches assume; nothing is extrapolated either way.
 * - Every body is PROVEN inside its position budget or nothing is written:
 *   the fit is held to half the budget by adding Chebyshev coefficients two
 *   at a time (up to 64), quantisation takes the other half, and a body
 *   that still does not fit is a typed refusal. 1.x proved its bounds and
 *   wrote the pack anyway, with every body over budget.
 * - `--kernel` is required, `--out` defaults to the working directory,
 *   `--help` prints this usage, and every refusal is typed.
 * - The header is format version 2: enumerated convention tokens the
 *   runtime checks, and a `provenance` block with the producer, the source
 *   kernel, its hash and citation, and the modification note NAIF's rules
 *   ask of a modified kernel.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { SpkRef } from './spkref.mjs';
import { chebNodes, chebFit, clenshaw, cosPi } from './cheb.mjs';
import { BODY_SEGS, BUDGET_KM, DAY } from './sources.mjs';
import { MAGIC, align, widthForHalf, writeField, WIDTH_ORDER } from './format.mjs';

export const COMPILER_VERSION = '2.0.0';
export const FORMAT_VERSION = 2;
/** The tokens a format-2 header's `conventions` carries; the runtime enumerates the same. */
export const CONVENTION_TOKENS = Object.freeze({ chebyshev: 'spk-type-2', units: 'km,km/s' });
/** The most Chebyshev coefficients the fit may grow to before the body is refused. */
export const MAX_NCOEF = 64;
const SQRT3 = Math.sqrt(3);
const here = (f) => new URL(`./${f}`, import.meta.url);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const J2000_UNIX = 946728000;

/** A refusal with a code a caller can branch on. Nothing is written when one is thrown. */
export class CompileRefusal extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CompileRefusal';
    this.code = code;
    this.details = details;
  }
}

/** Usage errors exit 2; refusals about the kernel or the result exit 3. */
const USAGE_CODES = new Set(['bad-arguments', 'kernel-required']);

export const USAGE = `Compile a JPL SPK kernel into a zodiacs ephemeris pack (ZODEPH01).

  node compile.mjs --kernel=PATH [options]

  --kernel=PATH                the SPK kernel to read (required; nothing is fetched)
  --candidate=A|B|D            A, B or D (default D); C is refused, see compile.mjs
  --out=PATH                   where to write the pack (default: ./<kernel>-<candidate>.zeph
                               in the working directory)
  --fromYear=YYYY --toYear=YYYY
                               compile only from 1 January of one year to 1 January of
                               another; both must lie inside the kernel
  --bodies=a,b,...             a subset of bodies; emb, moon and sun are always included
  --producer-name=TEXT         who made this pack (default: Zodiacs)
  --producer-institution=TEXT  their institution (default: zodiacs.org)
                               NAIF's rules ask a modified kernel to name its last
                               modifier: a pack you distribute must name you
  --help                       print this and exit

Every body is proven inside its position budget, or nothing is written and the
refusal is printed as JSON on stderr (exit 3; usage errors exit 2). Seal the
result with tools/seal.mjs before opening it with the runtime.
`;

const FLAGS = ['candidate', 'kernel', 'out', 'fromYear', 'toYear', 'bodies', 'producer-name', 'producer-institution'];

/** Parse `--flag=value` arguments. Unknown, repeated or empty flags are refused, not ignored. */
export function parseArgs(argv) {
  const opts = {};
  for (const a of argv) {
    if (a === '--help' || a === '-h') return { help: true };
    const m = /^--([A-Za-z-]+)=([\s\S]*)$/.exec(a);
    if (!m || !FLAGS.includes(m[1])) throw new CompileRefusal('bad-arguments', `unknown argument ${JSON.stringify(a)}; see --help`);
    if (m[1] in opts) throw new CompileRefusal('bad-arguments', `--${m[1]} is given twice`);
    if (m[2] === '') throw new CompileRefusal('bad-arguments', `--${m[1]} is empty`);
    opts[m[1]] = m[2];
  }
  if (opts.kernel === undefined) {
    throw new CompileRefusal('kernel-required', 'name the kernel with --kernel=PATH; there is no default kernel');
  }
  const candidate = (opts.candidate ?? 'D').toUpperCase();
  if (!/^[ABCD]$/.test(candidate)) throw new CompileRefusal('bad-arguments', `unknown candidate ${JSON.stringify(opts.candidate)}`);
  for (const k of ['fromYear', 'toYear']) {
    if (opts[k] !== undefined && !/^-?\d{1,4}$/.test(opts[k])) throw new CompileRefusal('bad-arguments', `--${k} must be a year, got ${JSON.stringify(opts[k])}`);
  }
  return {
    candidate,
    kernel: opts.kernel,
    out: opts.out ?? null,
    fromYear: opts.fromYear === undefined ? null : Number(opts.fromYear),
    toYear: opts.toYear === undefined ? null : Number(opts.toYear),
    bodies: opts.bodies ?? null,
    producer: {
      name: opts['producer-name'] ?? 'Zodiacs',
      institution: opts['producer-institution'] ?? 'zodiacs.org',
    },
  };
}

/* ------------------------------------------------------------------ sources */

/** Position of a body in its fitting frame, km. Vectors only; no angles. */
function frameSource(ref, body, frame) {
  const seg = ref.segment(body.target, body.center);
  const a = new Float64Array(6); const b = new Float64Array(6);
  if (frame === 'sun') {
    const sun = ref.segment(10, 0);
    return (et, out) => {
      ref.state(seg, et, a); ref.state(sun, et, b);
      out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
    };
  }
  return (et, out) => { ref.state(seg, et, a); out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; };
}

/* --------------------------------------------------------------- refitting */

/** Fit one body on a uniform grid of `nrec` intervals of `Lsec`. Record-major coefficients. */
function refit(source, initEt, Lsec, nrec, ncoef) {
  const nodes = chebNodes(ncoef);
  const radius = Lsec / 2;
  const coef = new Float64Array(nrec * 3 * ncoef);
  const fv = [new Float64Array(ncoef), new Float64Array(ncoef), new Float64Array(ncoef)];
  const p = new Float64Array(3);
  for (let i = 0; i < nrec; i += 1) {
    const mid = initEt + i * Lsec + radius;
    for (let j = 0; j < ncoef; j += 1) {
      source(mid + nodes[j] * radius, p);
      fv[0][j] = p[0]; fv[1][j] = p[1]; fv[2][j] = p[2];
    }
    for (let c = 0; c < 3; c += 1) {
      const ck = chebFit(fv[c], ncoef);
      coef.set(ck, (i * 3 + c) * ncoef);
    }
  }
  return coef;
}

/* ------------------------------------------------- proven bounds (no sampling) */

/**
 * PROVEN refit bound -- no sampling anywhere in the argument.
 *
 * Cut the span at the union of (a) every refit-record boundary and (b) every
 * source-record boundary of every segment the fitting frame is built from. On
 * each resulting elementary interval BOTH sides are single polynomials, so
 * their difference g is a polynomial of degree D = max(degrees). Interpolating
 * g at D+1 Chebyshev nodes of that interval recovers its coefficients EXACTLY,
 * and then, writing g(cos theta) = sum_k g_k cos(k theta),
 *
 *     |dg/dtheta| <= sum_k k |g_k|       (differentiate term by term)
 *
 * so evaluating g on a theta grid of M points, spacing pi/M, gives
 *
 *     max |g| <= max over the grid + (pi / 2M) * sum_k k |g_k|
 *
 * which is an upper bound over the WHOLE interval, not over the points looked
 * at. For the derivative, |dT_k/dtau| = |k U_{k-1}| <= k^2 gives
 *
 *     |dg/dt| <= (1/radius) * sum_k k^2 |g_k|.
 *
 * The three components' bounds S_x, S_y, S_z on one interval combine as
 * sqrt(S_x^2 + S_y^2 + S_z^2), which bounds |g| there because each
 * component is bounded separately; 1.x multiplied the largest S by sqrt(3)
 * instead, also a bound and a looser one. The worst interval is the bound.
 *
 * Both are proven. The only caveat, stated rather than hidden: the
 * re-expansion runs in float64, so the bound itself carries round-off of
 * order 1e-12 km.
 */
const THETA_GRID = 256;

/**
 * Rigorous supremum bound for a Chebyshev series on [-1,1]:
 * the maximum over a theta grid of spacing pi/M, plus (pi/2M) * sum_k k|c_k|,
 * which bounds how far the function can move between grid points because
 * |d/dtheta sum c_k cos(k theta)| <= sum_k k |c_k|.
 */
function supBound(c, n) {
  if (n <= 0) return 0;
  let s1 = 0;
  for (let k = 0; k < n; k += 1) s1 += Math.abs(c[k]) * k;
  let peak = 0;
  for (let j = 0; j <= THETA_GRID; j += 1) {
    const x = Math.abs(clenshaw(c, 0, n, cosPi(j, THETA_GRID)));
    if (x > peak) peak = x;
  }
  return peak + (Math.PI / (2 * THETA_GRID)) * s1;
}

/** Chebyshev coefficients of the derivative of a Chebyshev series (exact). */
function chebDeriv(c, n) {
  const d = new Float64Array(Math.max(n - 1, 1));
  if (n < 2) return d;
  for (let k = n - 1; k >= 1; k -= 1) {
    const prev = k + 1 < d.length ? d[k + 1] : 0;
    d[k - 1] = prev + 2 * k * c[k];
  }
  d[0] *= 0.5;
  return d;
}

function provenRefitBound(parts, coefFit, initEt, Lsec, nrec, ncoef, T0, T1) {
  // breakpoints: every place either side can change polynomial
  const marks = new Set();
  for (let i = 0; i <= nrec; i += 1) marks.add(initEt + i * Lsec);
  for (const { seg } of parts) {
    for (let r = 0; r <= seg.nrec; r += 1) marks.add(seg.init + r * seg.intlen);
  }
  const cuts = [...marks].filter((t) => t >= T0 - 1e-6 && t <= T1 + 1e-6).sort((a, b) => a - b);
  let D = ncoef - 1;
  for (const { seg } of parts) D = Math.max(D, seg.ncoef - 1);
  const m = D + 1;
  const nodes = chebNodes(m);
  const g = new Float64Array(m);
  const radiusFit = Lsec / 2;
  let worstPos = 0; let worstVel = 0; let worstAt = 0;

  const srcAt = (seg, t, c) => {
    let r = Math.floor((t - seg.init) / seg.intlen);
    if (r < 0) r = 0; if (r > seg.nrec - 1) r = seg.nrec - 1;
    const off = r * seg.rsize;
    return clenshaw(seg.data, off + 2 + c * seg.ncoef, seg.ncoef, (t - seg.data[off]) / seg.data[off + 1]);
  };

  for (let p = 0; p + 1 < cuts.length; p += 1) {
    const a = cuts[p]; const b = cuts[p + 1];
    if (b - a < 1e-6) continue;
    const mid = (a + b) / 2; const rad = (b - a) / 2;
    let i = Math.floor((mid - initEt) / Lsec);
    if (i < 0) i = 0; if (i > nrec - 1) i = nrec - 1;
    const midF = initEt + i * Lsec + radiusFit;
    let pos2 = 0; let vel2 = 0;
    for (let c = 0; c < 3; c += 1) {
      for (let j = 0; j < m; j += 1) {
        const t = mid + nodes[j] * rad;
        let v = -clenshaw(coefFit, (i * 3 + c) * ncoef, ncoef, (t - midF) / radiusFit);
        for (const { seg, sign } of parts) v += sign * srcAt(seg, t, c);
        g[j] = v;
      }
      const gk = chebFit(g, m);
      const dk = chebDeriv(gk, m);      // exact Chebyshev coefficients of dg/dtau
      const sp = supBound(gk, m);
      const sv = supBound(dk, m - 1) / rad;
      pos2 += sp * sp; vel2 += sv * sv;
    }
    const sp = Math.sqrt(pos2); const sv = Math.sqrt(vel2);
    if (sp > worstPos) { worstPos = sp; worstAt = mid; }
    if (sv > worstVel) worstVel = sv;
  }
  return { posKm: worstPos, velKmS: worstVel, atEt: worstAt, pieces: cuts.length - 1, gridPoints: THETA_GRID };
}

/**
 * PROVEN quantisation bound. Round-to-nearest with step q gives |delta_k| <= q/2
 * for every stored coefficient, so per component
 *     |dp| <= sum_k |delta_k| |T_k| <= n q / 2
 *     |dv| <= (1/R) sum_k |delta_k| k^2 <= (q / 2R) * (n-1)n(2n-1)/6
 * and the three components combine as a vector with a factor sqrt(3).
 *
 * The equal step across all coefficient indices is not a convenience: with
 * bits_k = log2(2 M_k / q_k), minimising sum_k bits_k subject to sum_k q_k = 2e
 * gives q_k constant (the Lagrange stationarity condition is 1/(q_k ln2) = L).
 * So the uniform step IS the optimal bit allocation for this error model.
 */
function provenQuantBound(ncoef, q, radiusSec) {
  const sumK2 = ((ncoef - 1) * ncoef * (2 * ncoef - 1)) / 6;
  return { posKm: SQRT3 * ncoef * (q / 2), velKmS: (SQRT3 * (q / 2) * sumK2) / radiusSec };
}

/* --------------------------------------------------------------- quantising */

/** Quantise a record-major coefficient array with a single step q. */
function quantise(coef, nrec, ncoef, q) {
  const nf = 3 * ncoef;
  const mids = new Float64Array(nf);
  // Float64, not Int32: the integer for a low-order coefficient of a body with a
  // large orbit exceeds 2^31 and silently wrapped when this was an Int32Array,
  // which produced a pack that decoded to the wrong number without any error.
  const halves = new Float64Array(nf);
  for (let f = 0; f < nf; f += 1) {
    let lo = Infinity; let hi = -Infinity;
    for (let i = 0; i < nrec; i += 1) { const v = coef[i * nf + f]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const mid = (lo + hi) / 2;
    mids[f] = mid;
    let half = 0;
    for (let i = 0; i < nrec; i += 1) {
      const iv = Math.abs(Math.round((coef[i * nf + f] - mid) / q));
      if (iv > half) half = iv;
    }
    halves[f] = half;
  }
  const widths = new Uint8Array(nf);
  for (let f = 0; f < nf; f += 1) widths[f] = widthForHalf(halves[f]);
  // field order keeps the 4- and 8-byte reads naturally aligned within a record
  const rank = (w) => WIDTH_ORDER.indexOf(w);
  const order = [...widths.keys()].sort((a, b) => (rank(widths[a]) - rank(widths[b])) || (a - b));
  const fieldOffset = new Int32Array(nf);
  let stride = 0;
  for (const f of order) { fieldOffset[f] = stride; stride += widths[f]; }
  // A body with one record stores every coefficient as its own midpoint, so
  // every width is 0; the runtime refuses a zero stride, so such a record
  // still takes four (empty) bytes. 1.x wrote stride 0 there, and any crop
  // shorter than one record of an outer planet compiled to a pack that
  // could not be opened.
  stride = Math.max(4, align(stride, 4));
  return { mids, widths, fieldOffset, stride, q };
}

/* -------------------------------------------------------------------- build */

function encodeBody(spec) {
  const { enc, nrec, ncoef, coef } = spec;
  if (enc === 'f64') {
    const bytes = nrec * 3 * ncoef * 8;
    const buf = Buffer.alloc(bytes);
    const dv = new DataView(buf.buffer, buf.byteOffset, bytes);
    for (let i = 0; i < nrec * 3 * ncoef; i += 1) dv.setFloat64(i * 8, coef[i], true);
    return { buf, layout: { enc: 'f64', stride: 3 * ncoef * 8 } };
  }
  const { mids, widths, fieldOffset, stride, q } = spec.quant;
  const nf = 3 * ncoef;
  const head = nf * 8;
  const buf = Buffer.alloc(head + nrec * stride);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.length);
  for (let f = 0; f < nf; f += 1) dv.setFloat64(f * 8, mids[f], true);
  for (let i = 0; i < nrec; i += 1) {
    const rb = head + i * stride;
    for (let f = 0; f < nf; f += 1) {
      const w = widths[f];
      if (w === 0) continue;
      const v = coef[i * nf + f];
      writeField(dv, rb + fieldOffset[f], w, w === 8 ? v : Math.round((v - mids[f]) / q));
    }
  }
  return {
    buf,
    layout: {
      enc: 'q', q, stride, midsOffset: 0, recordsOffset: head,
      widths: Array.from(widths), fieldOffset: Array.from(fieldOffset),
    },
  };
}

/* --------------------------------------------------------------- the kernel */

function openKernel(kernelPath) {
  let kernelBytes;
  try {
    kernelBytes = readFileSync(kernelPath);
  } catch (error) {
    throw new CompileRefusal('kernel-unreadable', `cannot read ${kernelPath}: ${error.code ?? error.message}`);
  }
  let ref;
  try {
    ref = new SpkRef(kernelPath);
  } catch (error) {
    throw new CompileRefusal('not-an-spk', `${basename(kernelPath)} is not a little-endian DAF/SPK kernel: ${error.message}`);
  }
  return { kernelBytes, ref };
}

/**
 * Every segment the pack reads, checked before anything is fitted: present,
 * Chebyshev position-only (SPK type 2) in the J2000 frame, and with records
 * that cover the segment's own start and stop.
 */
function neededSegments(ref, bodies) {
  const want = new Map();
  const need = (target, center, why) => {
    const key = `${target}/${center}`;
    if (!want.has(key)) want.set(key, { target, center, why });
  };
  for (const b of bodies) need(b.target, b.center, b.name);
  need(10, 0, 'the Sun, which sun-framed bodies are fitted against');
  need(301, 3, 'the Moon relative to the Earth-Moon barycentre');
  need(399, 3, 'the Earth relative to the Earth-Moon barycentre, for EMRAT');
  need(199, 1, 'Mercury relative to its barycentre, checked to be zero');
  need(299, 2, 'Venus relative to its barycentre, checked to be zero');
  const segs = [];
  for (const { target, center, why } of want.values()) {
    const seg = ref.byKey.get(`${target}/${center}`);
    if (!seg) throw new CompileRefusal('segment-missing', `the kernel has no segment ${target}/${center} (${why})`, { target, center });
    if (seg.type !== 2 || seg.frame !== 1) {
      throw new CompileRefusal('segment-type', `segment ${target}/${center} is SPK type ${seg.type} in frame ${seg.frame}; this compiler reads type 2 in frame 1 (J2000)`, { target, center, type: seg.type, frame: seg.frame });
    }
    const recordsStop = seg.init + seg.nrec * seg.intlen;
    if (seg.init > seg.start || recordsStop < seg.stop) {
      throw new CompileRefusal('segment-coverage', `segment ${target}/${center} claims ${seg.start}..${seg.stop} s but its records cover ${seg.init}..${recordsStop} s`, { target, center });
    }
    segs.push(seg);
  }
  return segs;
}

/** The ephemeris named in the segment names, e.g. "DE-0440LE-0440" -> "DE440". */
function ephemerisOf(ref) {
  const names = new Set(ref.segments.map((s) => /DE-0*(\d+)LE-0*\d+/.exec(s.name ?? '')?.[1]).filter(Boolean));
  return names.size === 1 ? `DE${[...names][0]}` : null;
}

/** Citations this compiler can state for itself; any other ephemeris is named without one. */
const CITATIONS = {
  DE440: {
    text: 'Park, R. S., Folkner, W. M., Williams, J. G., and Boggs, D. H. (2021). The JPL Planetary and Lunar Ephemerides DE440 and DE441. The Astronomical Journal 161(3), 105.',
    doi: '10.3847/1538-3881/abd414',
  },
};

function provenanceOf(ref, kernelPath, kernelBytes, producer) {
  const ephemeris = ephemerisOf(ref);
  const doiInKernel = /DOI:\s*(10\.\d{4,9}\/[^\s]+)/.exec(ref.comment ?? '')?.[1] ?? null;
  return {
    producer: { name: producer.name, institution: producer.institution },
    source: {
      file: basename(kernelPath),
      bytes: kernelBytes.length,
      sha256: sha256(kernelBytes),
      ephemeris,
      originalProducer: 'Jet Propulsion Laboratory, California Institute of Technology, distributed by NAIF',
      citation: CITATIONS[ephemeris] ?? null,
      doiInKernelComments: doiInKernel,
    },
    modification: 'Not a NAIF kernel and not a SPICE kernel. The positions of the source kernel above were refitted as Chebyshev series per body and quantised by the compiler named in this header; each body\'s proven position error against the source is in bodies[].provenPosKm. NAIF\'s rules ask that a modified kernel name whoever made the last modification, here the producer, in place of the original producer, and carry a different file name.',
    rulesPage: 'https://naif.jpl.nasa.gov/naif/rules.html',
  };
}

/* ------------------------------------------------------------------ compile */

/**
 * Compile in memory. Returns the ZODEPH01 bytes and the header, or throws a
 * CompileRefusal; it writes nothing.
 */
export async function compilePack(opts) {
  const { candidate } = opts;
  if (candidate === 'C') {
    throw new CompileRefusal('no-proven-bound',
      'candidate C stores a residual over astronomy-engine, which is not a polynomial, so its error has no proven bound; this compiler writes only packs whose every body is proven inside its budget');
  }
  const { kernelBytes, ref } = openKernel(opts.kernel);

  const REQUIRED = new Set(['emb', 'moon', 'sun']);
  let selected = null;
  if (opts.bodies !== null) {
    const asked = opts.bodies.split(',');
    const unknown = asked.filter((n) => !BODY_SEGS.some((b) => b.name === n));
    if (unknown.length) throw new CompileRefusal('bad-arguments', `unknown bodies: ${unknown.join(', ')}`);
    // Earth, and therefore the observer, is built from emb and moon, and any
    // sun-framed body needs the Sun, so a subset always carries those three.
    selected = new Set([...asked, ...REQUIRED]);
  }
  const bodySet = BODY_SEGS.filter((b) => !selected || selected.has(b.name));

  // --- the span, from the kernel ---
  const segs = neededSegments(ref, bodySet);
  const T0 = Math.max(...segs.map((s) => s.start));
  const T1 = Math.min(...segs.map((s) => s.stop));
  if (!(T1 > T0)) throw new CompileRefusal('empty-window', 'the segments this pack reads share no common time span');
  // setUTCFullYear, because Date.UTC reads a year below 100 as 1900 + year.
  const yearEt = (y) => new Date(0).setUTCFullYear(y, 0, 1) / 1000 - J2000_UNIX;
  const covFrom = opts.fromYear === null ? T0 : yearEt(opts.fromYear);
  const covTo = opts.toYear === null ? T1 : yearEt(opts.toYear);
  if (covFrom < T0 || covTo > T1) {
    throw new CompileRefusal('window-outside-kernel',
      `the requested window ${new Date((covFrom + J2000_UNIX) * 1000).toISOString()}..${new Date((covTo + J2000_UNIX) * 1000).toISOString()} is not inside the kernel's ${new Date((T0 + J2000_UNIX) * 1000).toISOString()}..${new Date((T1 + J2000_UNIX) * 1000).toISOString()}`,
      { kernelStartEtSecTdb: T0, kernelStopEtSecTdb: T1 });
  }
  if (!(covTo > covFrom)) throw new CompileRefusal('empty-window', 'the coverage window is empty');
  const cropped = opts.fromYear !== null || opts.toYear !== null || selected !== null;

  // --- structural fact 1: Earth/EMB is a scalar multiple of Moon/EMB ---
  const s301 = ref.segment(301, 3); const s399 = ref.segment(399, 3);
  const emrat = -s301.data[2] / s399.data[2];
  let emratWorstKm = 0;
  for (let i = 0; i < s301.data.length - 4; i += 1) {
    if (i % s301.rsize < 2) continue;
    const d = Math.abs(-s301.data[i] / emrat - s399.data[i]);
    if (d > emratWorstKm) emratWorstKm = d;
  }
  ref.emrat = emrat;
  // --- structural fact 2: Mercury/Venus body centres are identically zero ---
  const zeroSegs = [[199, 1], [299, 2]].map(([t, c]) => {
    const s = ref.segment(t, c);
    let mx = 0;
    for (let i = 0; i < s.data.length; i += 1) if (i % s.rsize >= 2 && i < s.data.length - 4) mx = Math.max(mx, Math.abs(s.data[i]));
    return { target: t, center: c, maxAbsCoefKm: mx };
  });

  const choice = JSON.parse(readFileSync(here('raw/choice.json'), 'utf8'));
  const bodies = [];
  const blocks = [];
  const overBudget = [];

  for (const body of bodySet) {
    const seg = ref.segment(body.target, body.center);
    const budget = BUDGET_KM[body.name];
    const epsFit = 0.5 * budget; const epsQ = 0.5 * budget;
    let frame; let Lsec; let ncoef; let nrec; let enc; let coef; let bodyInit;
    let provenFit; let fitTrail = null; let nominal = null;

    if (candidate === 'A') {
      // keep the kernel's own segmentation exactly; truncate, then quantise.
      frame = 'native'; enc = 'q';
      Lsec = seg.intlen;
      const recFrom = Math.max(0, Math.floor((covFrom - seg.init) / seg.intlen));
      const recTo = Math.min(seg.nrec, Math.ceil((covTo - seg.init) / seg.intlen));
      nrec = recTo - recFrom;
      bodyInit = seg.init + recFrom * seg.intlen;
      const tail = [];                                  // tail[K] = sum_{k>=K} max_r |c_k|, per component
      const mx = Array.from({ length: 3 }, () => new Float64Array(seg.ncoef));
      for (let r = 0; r < seg.nrec; r += 1) {
        const off = r * seg.rsize;
        for (let c = 0; c < 3; c += 1) for (let k = 0; k < seg.ncoef; k += 1) {
          const a = Math.abs(seg.data[off + 2 + c * seg.ncoef + k]); if (a > mx[c][k]) mx[c][k] = a;
        }
      }
      for (let K = 1; K <= seg.ncoef; K += 1) {
        let s2 = 0;
        for (let c = 0; c < 3; c += 1) { let s = 0; for (let k = K; k < seg.ncoef; k += 1) s += mx[c][k]; s2 += s * s; }
        tail[K] = Math.sqrt(s2);
      }
      ncoef = seg.ncoef;
      for (let K = 1; K <= seg.ncoef; K += 1) if (tail[K] <= epsFit) { ncoef = K; break; }
      coef = new Float64Array(nrec * 3 * ncoef);
      for (let r = 0; r < nrec; r += 1) {
        const off = (r + recFrom) * seg.rsize;
        for (let c = 0; c < 3; c += 1) for (let k = 0; k < ncoef; k += 1) coef[(r * 3 + c) * ncoef + k] = seg.data[off + 2 + c * seg.ncoef + k];
      }
      // truncation, proven from the coefficient envelope
      let sv2 = 0;
      for (let c = 0; c < 3; c += 1) {
        let s = 0;
        for (let r = 0; r < seg.nrec; r += 1) {
          const off = r * seg.rsize;
          let ss = 0; for (let k = ncoef; k < seg.ncoef; k += 1) ss += Math.abs(seg.data[off + 2 + c * seg.ncoef + k]) * k * k;
          if (ss > s) s = ss;
        }
        sv2 += (s / (seg.intlen / 2)) ** 2;
      }
      provenFit = { posKm: tail[ncoef] ?? 0, velKmS: Math.sqrt(sv2), truncatedFrom: seg.ncoef };
    } else {
      const pick = choice[body.name][candidate === 'B' ? 'float64' : 'quant'];
      frame = pick.frame; enc = candidate === 'B' ? 'f64' : 'q';
      nominal = { Ldays: pick.Ldays, ncoef: pick.ncoef };
      // nrec = ceil(span / L) records of span / nrec each: the last record
      // ends on the coverage stop, and no record reaches past the kernel.
      const span = covTo - covFrom;
      nrec = Math.max(1, Math.ceil(span / (pick.Ldays * DAY) - 1e-9));
      Lsec = span / nrec;
      bodyInit = covFrom;
      const source = frameSource(ref, body, frame);
      const parts = frame === 'sun'
        ? [{ seg, sign: 1 }, { seg: ref.segment(10, 0), sign: -1 }]
        : [{ seg, sign: 1 }];
      fitTrail = [];
      for (ncoef = pick.ncoef; ; ncoef += 2) {
        coef = refit(source, bodyInit, Lsec, nrec, ncoef);
        provenFit = provenRefitBound(parts, coef, bodyInit, Lsec, nrec, ncoef, bodyInit, bodyInit + nrec * Lsec);
        fitTrail.push({ ncoef, provenFitKm: provenFit.posKm });
        if (provenFit.posKm <= epsFit || ncoef + 2 > MAX_NCOEF) break;
      }
    }

    let quant = null; let q = 0;
    if (enc === 'q') {
      q = (2 * epsQ) / (SQRT3 * ncoef);
      quant = quantise(coef, nrec, ncoef, q);
    }
    const provenQ = enc === 'q' ? provenQuantBound(ncoef, q, Lsec / 2) : { posKm: 0, velKmS: 0 };
    const provenPosKm = provenFit.posKm + provenQ.posKm;
    if (!(provenPosKm <= budget)) {
      overBudget.push({ body: body.name, provenPosKm, budgetKm: budget, provenFitKm: provenFit.posKm, ncoef, fitTrail });
      continue;
    }
    const { buf, layout } = encodeBody({ enc, nrec, ncoef, coef, quant });
    blocks.push(buf);
    bodies.push({
      name: body.name, target: body.target, center: body.center,
      frame, encoding: enc, model: null,
      initEt: bodyInit, intervalSec: Lsec, intervalDays: Lsec / DAY, nrec, ncoef,
      budgetKm: budget, epsFitKm: epsFit, epsQuantKm: epsQ,
      provenPosKm,
      provenVelKmS: provenFit.velKmS + provenQ.velKmS,
      provenParts: { refit: provenFit, quantisation: provenQ },
      fit: nominal === null ? null : { nominal, ncoefAdded: ncoef - nominal.ncoef, trail: fitTrail },
      layout, bytes: buf.length,
    });
  }
  if (overBudget.length) {
    throw new CompileRefusal('over-budget',
      `${overBudget.map((b) => `${b.body} is proven only to ${b.provenPosKm} km against a ${b.budgetKm} km budget`).join('; ')}; nothing was written`,
      { bodies: overBudget });
  }

  // ------------------------------------------------------------- container
  const header = {
    format: 'zodiacs-ephemeris-pack',
    formatVersion: FORMAT_VERSION,
    candidate,
    compiler: { name: 'zodiacs precision compiler', version: COMPILER_VERSION, sourceSha256: sourceHashes() },
    input: { file: basename(opts.kernel), bytes: kernelBytes.length, sha256: sha256(kernelBytes) },
    provenance: provenanceOf(ref, opts.kernel, kernelBytes, opts.producer),
    settings: {
      budgetsKm: BUDGET_KM,
      budgetSplit: 'half of each body\'s position budget to the fit and half to quantisation, each proven; the pack is written only if every body\'s proven total is inside its budget',
      fitRule: candidate === 'A'
        ? 'the kernel\'s own records, truncated to the fewest coefficients whose proven tail is inside half the budget'
        : `start from raw/choice.json's interval and degree; while the proven fit bound exceeds half the budget, add two Chebyshev coefficients, up to ${MAX_NCOEF}`,
      grid: candidate === 'A'
        ? 'the kernel\'s own records that meet the coverage window'
        : 'nrec = ceil(span / L) records of span / nrec each, from the coverage start to the coverage stop',
      quantiser: 'uniform step q = 2*eps/(sqrt(3)*ncoef) per body, round to nearest, per-(component,index) midpoint and byte-aligned width',
      choiceSource: candidate === 'A' ? 'the kernel\'s segmentation, unchanged' : 'raw/sweep.json -> raw/choice.json, swept on DE440s',
    },
    coverage: {
      startEtSecTdb: covFrom, stopEtSecTdb: covTo,
      startUtcApprox: new Date((covFrom + J2000_UNIX) * 1000).toISOString(),
      stopUtcApprox: new Date((covTo + J2000_UNIX) * 1000).toISOString(),
      kernelStartEtSecTdb: T0, kernelStopEtSecTdb: T1,
      croppedFromKernel: cropped,
      bodySubset: selected ? [...selected].sort() : null,
      timeScale: 'TDB seconds past J2000; the runtime is fed TT, and |TDB-TT| < 2 ms is below every budget here',
      spanDays: (covTo - covFrom) / DAY,
      kernelSpanDays: (T1 - T0) / DAY,
    },
    conventions: {
      chebyshev: CONVENTION_TOKENS.chebyshev,
      units: CONVENTION_TOKENS.units,
      meaning: {
        chebyshev: 'p(tau) = sum_k c_k T_k(tau), tau = (t - mid)/radius, c_0 NOT halved (SPK type-2 convention)',
        units: 'positions in km, velocities in km/s',
      },
      frame: 'ICRF / J2000 mean equator and equinox (SPK segment frame id 1)',
      origin: 'per body: see bodies[].frame -- "native" = the DE segment centre, "sun" = heliocentric, "ssb" = solar-system barycentre',
      velocity: 'the analytic derivative of the stored polynomial, not a finite difference',
      angles: 'none are stored; every quantity in this pack is a vector component',
    },
    derived: {
      earth399: { rule: 'r(399 rel 3) = -(1/EMRAT) * r(301 rel 3)', emrat, worstResidualKm: emratWorstKm, note: 'exact in the DE kernels to 1 ulp; verified over every coefficient of both segments' },
      mercury199: { rule: 'r(199 rel 1) = 0', evidence: zeroSegs[0] },
      venus299: { rule: 'r(299 rel 2) = 0', evidence: zeroSegs[1] },
    },
    dependencies: dependencies(),
    bodies,
    payloadSha256: '0'.repeat(64),
  };

  let payloadOffset = align(16 + Buffer.byteLength(JSON.stringify(header)) + 4096);
  // two-pass: body offsets depend on the header size, which depends on the offsets
  for (let pass = 0; pass < 3; pass += 1) {
    let off = payloadOffset;
    for (let i = 0; i < bodies.length; i += 1) { bodies[i].offset = off; off = align(off + blocks[i].length); }
    header.payloadEndOffset = off;
    const hl = Buffer.byteLength(JSON.stringify(header));
    const want = align(16 + hl + 16);
    if (want === payloadOffset) break;
    payloadOffset = want;
  }
  const payload = Buffer.alloc(header.payloadEndOffset - payloadOffset);
  for (let i = 0; i < bodies.length; i += 1) blocks[i].copy(payload, bodies[i].offset - payloadOffset);
  header.payloadSha256 = sha256(payload);

  const hjson = Buffer.from(JSON.stringify(header), 'utf8');
  const out = Buffer.alloc(header.payloadEndOffset);
  out.write(MAGIC, 0, 'latin1');
  out.writeUInt32LE(hjson.length, 8);
  out.writeUInt32LE(payloadOffset, 12);
  hjson.copy(out, 16);
  payload.copy(out, payloadOffset);
  return { bytes: out, header, headerBytes: hjson.length };
}

function sourceHashes() {
  const out = {};
  for (const f of ['compile.mjs', 'cheb.mjs', 'sources.mjs', 'spkref.mjs', 'format.mjs', 'runtime.mjs']) {
    out[f] = sha256(readFileSync(here(f)));
  }
  return out;
}

function dependencies() {
  return [
    {
      what: 'a JPL DE SPK kernel (see provenance.source)',
      role: 'the only source of position data',
      // Corrected 2026-09-20 under compiler 1.1.0. This field previously
      // said "US Government work, public domain (JPL/Caltech-NASA)". That
      // was an inference, and RIGHTS.md shows it is wrong: SPICE and its
      // kernels are produced by Caltech/JPL under contract to NASA, NAIF's
      // rules page never says public domain, and what it grants is a
      // permission with conditions. Packs compiled before this date carry
      // the old string; RIGHTS.md governs either way.
      licence: 'not public domain. Produced by Caltech/JPL under contract to NASA; NAIF grants permission to use and redistribute with conditions (see https://naif.jpl.nasa.gov/naif/rules.html). Whether that rule reaches a derived coefficient set is unsettled -- see docs/platform/evidence/precision-2026-09-20/RIGHTS.md',
      licenceStatement: 'permission-with-conditions, not public domain',
      licenceSource: 'https://naif.jpl.nasa.gov/naif/rules.html, read 2026-09-20',
      derivedCoefficientStatus: 'unsettled; no pack is distributed while it is',
      neededAtRuntime: false,
    },
    { what: 'raw/sweep.json + raw/choice.json', role: 'per-body interval and degree choice', neededAtRuntime: false },
    { what: 'no Swiss Ephemeris code, data or output', role: 'none: Swiss is a measuring instrument elsewhere in this study and was not consulted by the compiler', neededAtRuntime: false },
  ];
}

/** The command line: parse, compile, write, report. Returns the exit code. */
export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.help) { process.stdout.write(USAGE); return 0; }
    const stem = basename(opts.kernel).replace(/\.[^.]*$/, '');
    const outPath = resolve(opts.out ?? `${stem}-${opts.candidate}.zeph`);
    if (outPath === resolve(opts.kernel)) {
      throw new CompileRefusal('out-is-kernel', 'the output path is the kernel itself; a modified kernel must carry a different file name');
    }
    const { bytes, header, headerBytes } = await compilePack(opts);
    try {
      writeFileSync(outPath, bytes);
    } catch (error) {
      throw new CompileRefusal('out-unwritable', `cannot write ${outPath}: ${error.code ?? error.message}`);
    }
    process.stdout.write(`${JSON.stringify({
      candidate: opts.candidate, out: outPath, bytes: bytes.length, mib: +(bytes.length / 1048576).toFixed(4),
      sha256: sha256(bytes), payloadSha256: header.payloadSha256, headerBytes,
      coverage: [header.coverage.startUtcApprox, header.coverage.stopUtcApprox],
      bodies: header.bodies.map((b) => ({ name: b.name, ncoef: b.ncoef, nrec: b.nrec, provenPosKm: b.provenPosKm, budgetKm: b.budgetKm })),
    }, null, 1)}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof CompileRefusal)) throw error;
    process.stderr.write(`${JSON.stringify({ refused: error.code, message: error.message, ...(Object.keys(error.details).length ? { details: error.details } : {}) })}\n`);
    return USAGE_CODES.has(error.code) ? 2 : 3;
  }
}

export { refit, quantise, provenRefitBound, provenQuantBound, frameSource };

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main(process.argv.slice(2));
