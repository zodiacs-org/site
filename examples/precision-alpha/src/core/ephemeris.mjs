/**
 * Chebyshev evaluation over a validated pack.
 *
 * Environment-neutral: it reads through the byte source in `./source.mjs`,
 * so the same evaluator serves a pack held in memory and a pack left on disk.
 * Each read takes one transient window, which is why a quantised record is
 * fetched as a single `stride`-byte view rather than field by field.
 *
 * Velocity is the ANALYTIC derivative of the same polynomial, taken in the
 * same pass. A finite difference would be a different function with its own
 * truncation error — the shipped site engine differentiates longitude over a
 * 0.25-day step and pays up to 4.24 arcsec/day on the Moon for it — and
 * stations and crossings depend on the derivative being consistent with the
 * position it came from.
 */
import { fail } from './errors.mjs';

/** Read one little-endian signed field of `w` bytes. */
function readField(dv, base, w) {
  switch (w) {
    case 0: return 0;
    case 1: return dv.getInt8(base);
    case 2: return dv.getInt16(base, true);
    case 3: { const lo = dv.getUint16(base, true); const hi = dv.getInt8(base + 2); return hi * 65536 + lo; }
    case 4: return dv.getInt32(base, true);
    case 5: { const lo = dv.getUint32(base, true); const hi = dv.getInt8(base + 4); return hi * 4294967296 + lo; }
    case 6: {
      const lo = dv.getUint32(base, true); const mid = dv.getUint8(base + 4); const hi = dv.getInt8(base + 5);
      return hi * 281474976710656 + mid * 4294967296 + lo;
    }
    default: return dv.getFloat64(base, true);
  }
}

export class Ephemeris {
  /**
   * @param {object} source  a byte source (see ./source.mjs)
   * @param {object} parsed  output of parseContainer
   */
  constructor(source, parsed) {
    this.src = source;
    this.header = parsed.header;
    this.coverage = parsed.header.coverage;
    this.emrat = parsed.header.derived?.earth399?.emrat;
    this.k = this.emrat === undefined ? undefined : 1 / this.emrat;
    this.bodies = new Map();
    for (const b of parsed.header.bodies) {
      const fields = 3 * b.ncoef;
      this.bodies.set(b.name, {
        ...b,
        coefficients: new Float64Array(fields),
        cachedRecord: -1,
        mids: b.layout.enc === 'q' ? this.#readMids(b, fields) : null,
      });
    }
    this.scratch = new Float64Array(6);
    this.scratch2 = new Float64Array(6);
    this.observer = new Float64Array(6);
  }

  #readMids(b, fields) {
    const out = new Float64Array(fields);
    const dv = this.src.window(b.offset + b.layout.midsOffset, fields * 8);
    for (let i = 0; i < fields; i += 1) out[i] = dv.getFloat64(i * 8, true);
    return out;
  }

  #decode(b, record) {
    if (b.cachedRecord === record) return;
    const L = b.layout;
    const fields = 3 * b.ncoef;
    const base = b.offset + (L.enc === 'f64' ? 0 : L.recordsOffset) + record * L.stride;
    // One window per record. The container has already proved every field
    // ends inside `stride`, so nothing here can read past it.
    const dv = this.src.window(base, L.enc === 'f64' ? fields * 8 : L.stride);
    if (L.enc === 'f64') {
      for (let f = 0; f < fields; f += 1) b.coefficients[f] = dv.getFloat64(f * 8, true);
    } else {
      const { widths, fieldOffset, q } = L;
      for (let f = 0; f < fields; f += 1) {
        const w = widths[f];
        b.coefficients[f] = w === 0 ? b.mids[f]
          : w === 8 ? readField(dv, fieldOffset[f], 8)
            : b.mids[f] + readField(dv, fieldOffset[f], w) * q;
      }
    }
    b.cachedRecord = record;
  }

  /** Is `et` (TDB seconds past J2000) inside the pack's declared coverage? */
  covers(et) {
    const c = this.coverage;
    return Number.isFinite(et) && et >= c.startEtSecTdb && et <= c.stopEtSecTdb;
  }

  /**
   * Position (km) and velocity (km/s) of one stored body, in whatever frame
   * the pack stored it. Written into `out` (length 6) to avoid allocating on
   * a hot path.
   */
  raw(name, et, out) {
    const b = this.bodies.get(name);
    if (!b) fail('unknown-body', `this pack does not contain ${name}`);
    // No clamp. Clamping hands back a record whose |tau| exceeds 1, where
    // `sum|c_k|` stops being a bound on the series -- and the validated
    // mode's whole completeness argument is that bound. A caller outside
    // the records gets a refusal, not a silent extrapolation.
    const span = b.nrec * b.intervalSec;
    if (et < b.initEt || et > b.initEt + span) {
      fail('out-of-coverage',
        `${name} has records from ${b.initEt} to ${b.initEt + span} s TDB; ${et} is outside them`,
        { et, recordSpanEtSec: [b.initEt, b.initEt + span] });
    }
    let index = Math.floor((et - b.initEt) / b.intervalSec);
    if (index < 0) index = 0;
    if (index > b.nrec - 1) index = b.nrec - 1;
    // `et - b.initEt` is a rounded subtraction, so for an `et` a hair
    // below a record boundary the quotient can round UP to the boundary
    // and the floor hands back the NEXT record -- which does not contain
    // `et`, and whose series is then evaluated at |tau| slightly above 1,
    // exactly where `sum |c_k|` stops bounding it. Measured on a real
    // pack: tau = 1.0000000000000202, and a value 22.5 m outside the
    // enclosure built from it. The promise three lines above is no clamp
    // and no silent extrapolation; keep it.
    while (index > 0 && b.initEt + index * b.intervalSec > et) index -= 1;
    while (index < b.nrec - 1 && b.initEt + (index + 1) * b.intervalSec <= et) index += 1;
    this.#decode(b, index);

    const mid = b.initEt + (index + 0.5) * b.intervalSec;
    const radius = b.intervalSec / 2;
    const tau = (et - mid) / radius;
    const n = b.ncoef;
    const c = b.coefficients;

    // Clenshaw for the value and for the derivative in one pass. The
    // derivative is d/dtau, converted to per second by dividing by `radius`.
    for (let comp = 0; comp < 3; comp += 1) {
      const off = comp * n;
      let b1 = 0; let b2 = 0; let d1 = 0; let d2 = 0;
      for (let k = n - 1; k >= 1; k -= 1) {
        const t = b1;
        b1 = 2 * tau * b1 - b2 + c[off + k];
        b2 = t;
        const td = d1;
        d1 = 2 * tau * d1 - d2 + 2 * t;
        d2 = td;
      }
      out[comp] = tau * b1 - b2 + c[off];
      out[comp + 3] = (tau * d1 - d2 + b1) / radius;
    }
    return out;
  }

  /**
   * The active Chebyshev record for one stored body, with the geometry
   * needed to reason about it as a polynomial: where it starts and ends,
   * what tau maps to, and the coefficients themselves.
   *
   * The validated mode needs the COEFFICIENTS, not just values sampled
   * from them, because a bound taken from the coefficients is true of the
   * polynomial and a maximum taken from samples is not.
   */
  seriesAt(name, et) {
    const b = this.bodies.get(name);
    if (!b) fail('unknown-body', `this pack does not contain ${name}`);
    // No clamp. Clamping hands back a record whose |tau| exceeds 1, where
    // `sum|c_k|` stops being a bound on the series -- and the validated
    // mode's whole completeness argument is that bound. A caller outside
    // the records gets a refusal, not a silent extrapolation.
    const span = b.nrec * b.intervalSec;
    if (et < b.initEt || et > b.initEt + span) {
      fail('out-of-coverage',
        `${name} has records from ${b.initEt} to ${b.initEt + span} s TDB; ${et} is outside them`,
        { et, recordSpanEtSec: [b.initEt, b.initEt + span] });
    }
    let index = Math.floor((et - b.initEt) / b.intervalSec);
    if (index < 0) index = 0;
    if (index > b.nrec - 1) index = b.nrec - 1;
    // `et - b.initEt` is a rounded subtraction, so for an `et` a hair
    // below a record boundary the quotient can round UP to the boundary
    // and the floor hands back the NEXT record -- which does not contain
    // `et`, and whose series is then evaluated at |tau| slightly above 1,
    // exactly where `sum |c_k|` stops bounding it. Measured on a real
    // pack: tau = 1.0000000000000202, and a value 22.5 m outside the
    // enclosure built from it. The promise three lines above is no clamp
    // and no silent extrapolation; keep it.
    while (index > 0 && b.initEt + index * b.intervalSec > et) index -= 1;
    while (index < b.nrec - 1 && b.initEt + (index + 1) * b.intervalSec <= et) index += 1;
    this.#decode(b, index);
    const radius = b.intervalSec / 2;
    const mid = b.initEt + (index + 0.5) * b.intervalSec;
    return {
      name,
      frame: b.frame,
      ncoef: b.ncoef,
      coefficients: b.coefficients,
      recordIndex: index,
      recordStartEt: b.initEt + index * b.intervalSec,
      recordStopEt: b.initEt + (index + 1) * b.intervalSec,
      mid,
      radius,
    };
  }

  /** Body relative to the solar-system barycentre, resolving a 'sun' frame. */
  #ssb(name, et, out) {
    const b = this.bodies.get(name);
    if (!b) fail('unknown-body', `this pack does not contain ${name}`);
    this.raw(name, et, out);
    if (b.frame === 'sun') {
      this.raw('sun', et, this.scratch2);
      for (let i = 0; i < 6; i += 1) out[i] += this.scratch2[i];
    }
    return out;
  }

  /**
   * Barycentric state of an API body. `out` must not be the internal scratch
   * buffer — the Earth/Moon path writes through both, and aliasing them
   * silently corrupted a result in an earlier runtime, so it is refused.
   */
  state(body, et, out) {
    if (out === this.scratch || out === this.scratch2) {
      fail('unsupported-option', 'state(): out must not be an internal scratch buffer');
    }
    if (body === 'Sun') return this.#ssb('sun', et, out);
    if (body === 'Moon' || body === 'Earth') {
      if (this.k === undefined) fail('bad-header', 'pack carries no EMRAT, so Earth and Moon cannot be derived');
      this.#ssb('emb', et, out);
      this.#ssb('moon', et, this.scratch);
      const f = body === 'Moon' ? 1 : -this.k;
      for (let i = 0; i < 6; i += 1) out[i] += f * this.scratch[i];
      return out;
    }
    const key = PACK_NAME[body];
    if (!key) fail('unknown-body', `unknown body ${body}`);
    return this.#ssb(key, et, out);
  }

  /**
   * The Earth-Moon system's parts at `et`: the barycentre from the SSB, and
   * the Moon and the Earth each from the barycentre (the Earth as -k times
   * the Moon), so a reduction can form the geocentric Moon without the
   * barycentre's 1.5e8 km.
   */
  lunar(et, emb, moon, earth) {
    if (this.k === undefined) fail('bad-header', 'pack carries no EMRAT, so Earth and Moon cannot be derived');
    this.#ssb('emb', et, emb);
    this.#ssb('moon', et, moon);
    const f = -this.k;
    for (let i = 0; i < 6; i += 1) earth[i] = f * moon[i];
  }
}

/** API body name -> the name the pack stores it under. */
export const PACK_NAME = Object.freeze({
  Mercury: 'mercuryBary', Venus: 'venusBary', Mars: 'marsBary', Jupiter: 'jupiterBary',
  Saturn: 'saturnBary', Uranus: 'uranusBary', Neptune: 'neptuneBary', Pluto: 'plutoBary',
});

/**
 * Bodies the kernel stores as a PLANETARY-SYSTEM BARYCENTRE, not a physical
 * centre. DE440s has body-centre segments only for Mercury (199), Venus (299),
 * the Moon (301) and the Earth (399); for Mars outward there are none, so what
 * this package returns for them is the system barycentre and is labelled that
 * way in every result rather than passed off as the planet.
 */
export const BARYCENTRE_NOT_CENTRE = Object.freeze(['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
