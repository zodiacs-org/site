/**
 * Reference oracle: the raw DE440s kernel, fully resident, evaluated
 * analytically for BOTH position and velocity.
 *
 * The prototype reader (`.../swiss-benchmark/prototype/spk.mjs`) re-reads the
 * covering record from disk on every call and returns position only. That is
 * fine for a handful of calls, but the measurements here need millions of
 * evaluations and they need the DERIVATIVE of the same polynomial the kernel
 * defines -- not a finite difference of it. A finite difference would fold the
 * differencing error into every velocity number and make the velocity target
 * unmeasurable.
 *
 * Nothing here is derived from Swiss Ephemeris.
 *
 * Corrected 2026-09-20: this comment used to say JPL development ephemerides
 * are US Government work in the public domain. They are not. SPICE and its
 * kernels come from Caltech/JPL under contract to NASA, and NAIF grants a
 * permission with conditions rather than placing anything in the public
 * domain. See RIGHTS.md.
 */
import { openSync, readSync, fstatSync, closeSync } from 'node:fs';

const RECORD = 1024;

export class SpkRef {
  constructor(path) {
    this.path = path;
    const fd = openSync(path, 'r');
    this.size = fstatSync(fd).size;
    const fr = Buffer.allocUnsafe(RECORD);
    readSync(fd, fr, 0, RECORD, 0);
    if (!fr.toString('latin1', 0, 8).trim().startsWith('DAF/SPK')) throw new Error('not an SPK');
    if (fr.toString('latin1', 88, 96).trim() !== 'LTL-IEEE') throw new Error('byte order');
    this.nd = fr.readInt32LE(8);
    this.ni = fr.readInt32LE(12);
    const fward = fr.readInt32LE(76);
    const ss = this.nd + Math.ceil(this.ni / 2);
    // The comment area: records 2 .. fward-1, 1000 characters each, NUL for
    // a line break and EOT at the end. The compiler reads a DOI out of it.
    const comment = [];
    for (let r = 2; r < fward; r += 1) {
      const cr = Buffer.allocUnsafe(1000);
      readSync(fd, cr, 0, 1000, (r - 1) * RECORD);
      comment.push(cr.toString('latin1'));
    }
    const text = comment.join('');
    const eot = text.indexOf('\x04');
    this.comment = (eot === -1 ? text : text.slice(0, eot)).replace(/\0/g, '\n');
    const segs = [];
    let next = fward;
    while (next !== 0) {
      const rec = Buffer.allocUnsafe(RECORD);
      readSync(fd, rec, 0, RECORD, (next - 1) * RECORD);
      // Each summary record is followed by its name record: one name of
      // 8 * ss characters per summary, in the same order.
      const names = Buffer.allocUnsafe(RECORD);
      readSync(fd, names, 0, RECORD, next * RECORD);
      const nxt = rec.readDoubleLE(0);
      const nsum = rec.readDoubleLE(16);
      for (let i = 0; i < nsum; i += 1) {
        const base = 24 + i * ss * 8;
        const ints = base + this.nd * 8;
        segs.push({
          start: rec.readDoubleLE(base),
          stop: rec.readDoubleLE(base + 8),
          target: rec.readInt32LE(ints),
          center: rec.readInt32LE(ints + 4),
          frame: rec.readInt32LE(ints + 8),
          type: rec.readInt32LE(ints + 12),
          first: rec.readInt32LE(ints + 16),
          last: rec.readInt32LE(ints + 20),
          name: names.toString('latin1', i * ss * 8, (i + 1) * ss * 8).trim(),
        });
      }
      next = nxt;
    }
    // Load every segment's doubles into memory once.
    for (const s of segs) {
      const count = s.last - s.first + 1;
      const buf = Buffer.allocUnsafe(count * 8);
      readSync(fd, buf, 0, count * 8, (s.first - 1) * 8);
      const arr = new Float64Array(count);
      for (let i = 0; i < count; i += 1) arr[i] = buf.readDoubleLE(i * 8);
      s.data = arr;
      const d = arr.subarray(count - 4);
      s.init = d[0]; s.intlen = d[1]; s.rsize = d[2]; s.nrec = d[3];
      s.ncoef = (s.rsize - 2) / (s.type === 2 ? 3 : 6);
      s.bytes = count * 8;
    }
    closeSync(fd);
    this.segments = segs;
    this.byKey = new Map(segs.map((s) => [`${s.target}/${s.center}`, s]));
  }

  segment(target, center) {
    const s = this.byKey.get(`${target}/${center}`);
    if (!s) throw new Error(`no segment ${target}/${center}`);
    return s;
  }

  /**
   * Position (km) and velocity (km/s) at TDB seconds past J2000, by Chebyshev
   * evaluation and by the ANALYTIC derivative of the same polynomial.
   * Writes into `out` (length 6) to keep the sampling loops allocation-free.
   */
  state(seg, et, out) {
    const { init, intlen, rsize, nrec, ncoef, data } = seg;
    // Refuse rather than extrapolate: 1.x clamped the record index here, so
    // an instant past the segment silently ran its last polynomial outward.
    if (!(et >= seg.start && et <= seg.stop)) {
      throw new RangeError(`${et} s TDB is outside segment ${seg.target}/${seg.center}, which covers ${seg.start}..${seg.stop}`);
    }
    let idx = Math.floor((et - init) / intlen);
    if (idx < 0) idx = 0;
    if (idx > nrec - 1) idx = nrec - 1;
    const off = idx * rsize;
    const mid = data[off];
    const radius = data[off + 1];
    const tau = (et - mid) / radius;
    // T_k and dT_k/dtau by the standard recurrences.
    const t = TBUF; const u = UBUF;
    t[0] = 1; u[0] = 0;
    if (ncoef > 1) { t[1] = tau; u[1] = 1; }
    for (let k = 2; k < ncoef; k += 1) {
      t[k] = 2 * tau * t[k - 1] - t[k - 2];
      u[k] = 2 * tau * u[k - 1] + 2 * t[k - 1] - u[k - 2];
    }
    for (let c = 0; c < 3; c += 1) {
      let p = 0; let v = 0;
      const b = off + 2 + c * ncoef;
      for (let k = ncoef - 1; k >= 0; k -= 1) { p += data[b + k] * t[k]; v += data[b + k] * u[k]; }
      out[c] = p;
      out[c + 3] = v / radius;
    }
    return out;
  }
}

const TBUF = new Float64Array(64);
const UBUF = new Float64Array(64);

export const NAIF = {
  SSB: 0, MERCURY_BARY: 1, VENUS_BARY: 2, EMB: 3, MARS_BARY: 4, JUPITER_BARY: 5,
  SATURN_BARY: 6, URANUS_BARY: 7, NEPTUNE_BARY: 8, PLUTO_BARY: 9,
  SUN: 10, MOON: 301, EARTH: 399, MERCURY: 199, VENUS: 299,
};
