/**
 * A synthetic DAF/SPK kernel, written byte by byte, for the compiler's tests.
 *
 * Fourteen type-2 segments in the layout the DE kernels use (planet
 * barycentres and the Sun relative to the solar-system barycentre, the Moon
 * and the Earth relative to the Earth-Moon barycentre, and the zero
 * Mercury and Venus centre offsets), each a circle fitted record by record.
 * Positions come from the runtime's own arithmetic-only sine and the
 * compiler's own Chebyshev fit, so the kernel's bytes are the same on every
 * machine and a pack compiled from it can be pinned by digest.
 *
 * Nothing here comes from a JPL kernel: the orbits are round numbers.
 */
import { sinCos } from '../../src/core/trig.mjs';
import { chebNodes, chebFit } from '../../tools/compiler/cheb.mjs';

export const DAY = 86400;
export const AU = 149597870.7;
export const EMRAT = 81.3;
const TWO_PI = 2 * Math.PI;

/** A tilted circle of radius a (km) and period p (days), as a function of TDB seconds. */
export function circle(a, periodDays, phase, tilt = 0.25) {
  const ci = 1 / Math.sqrt(1 + tilt * tilt); const si = tilt * ci;
  return (t, out) => {
    const turns = t / (periodDays * DAY) + phase;
    const x = TWO_PI * (turns - Math.floor(turns) - 0.5);     // in [-pi, pi)
    const { s, c } = sinCos(x);                               // angle = x + pi
    out[0] = -a * c; out[1] = -a * s * ci; out[2] = -a * s * si;
    return out;
  };
}

/** Add a fast, small oscillation along x: what no 64-coefficient refit over weeks can follow. */
export function wiggle(f, amplitudeKm, periodDays) {
  return (t, out) => {
    f(t, out);
    const turns = t / (periodDays * DAY);
    out[0] += amplitudeKm * sinCos(TWO_PI * (turns - Math.floor(turns) - 0.5)).s;
    return out;
  };
}

const zero = (t, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; };

/** The fourteen segments of a DE-shaped kernel. Options change one thing each. */
export function deShaped({ startDays = 0, stopDays, plutoStartDays = startDays, moon = null, moonRecordDays = 4, omit = [] } = {}) {
  const moonFn = moon ?? circle(384400 * (EMRAT / (1 + EMRAT)), 27.32, 0.15, 0.09);
  const earthFn = (t, out) => { moonFn(t, out); out[0] /= -EMRAT; out[1] /= -EMRAT; out[2] /= -EMRAT; return out; };
  const seg = (target, center, fn, recordDays, ncoef, from = startDays) => ({ target, center, fn, recordDays, ncoef, fromDays: from, toDays: stopDays });
  return [
    seg(1, 0, circle(0.387 * AU, 87.97, 0.2), 8, 14),
    seg(2, 0, circle(0.723 * AU, 224.7, 0.3), 16, 10),
    seg(3, 0, circle(AU, 365.25, 0.4, 0.0), 16, 13),
    seg(4, 0, circle(1.524 * AU, 686.98, 0.5), 16, 11),
    seg(5, 0, circle(5.2 * AU, 4332.6, 0.6), 32, 8),
    seg(6, 0, circle(9.58 * AU, 10759, 0.7), 32, 8),
    seg(7, 0, circle(19.2 * AU, 30687, 0.8), 32, 8),
    seg(8, 0, circle(30.05 * AU, 60190, 0.9), 32, 8),
    seg(9, 0, circle(39.5 * AU, 90560, 0.05), 32, 8, plutoStartDays),
    seg(10, 0, circle(7.0e5, 4332.6, 0.1), 16, 11),
    seg(301, 3, moonFn, moonRecordDays, 13),
    seg(399, 3, earthFn, moonRecordDays, 13),
    seg(199, 1, zero, 32, 3),
    seg(299, 2, zero, 32, 3),
  ].filter((s) => !omit.includes(`${s.target}/${s.center}`));
}

/** Write the segments as a little-endian DAF/SPK file. Returns a Uint8Array. */
export function writeSpk(segments, { name = 'DE-0999LE-0999', comment = 'Synthetic kernel for the compiler tests. Not a JPL ephemeris.' } = {}) {
  const RECORD = 1024; const ND = 2; const NI = 6; const SS = ND + Math.ceil(NI / 2);
  const arrays = segments.map((s) => {
    const intlen = s.recordDays * DAY;
    const nrec = Math.round((s.toDays - s.fromDays) / s.recordDays);
    const rsize = 2 + 3 * s.ncoef;
    const data = new Float64Array(nrec * rsize + 4);
    const nodes = chebNodes(s.ncoef);
    const p = new Float64Array(3);
    const fv = [new Float64Array(s.ncoef), new Float64Array(s.ncoef), new Float64Array(s.ncoef)];
    for (let r = 0; r < nrec; r += 1) {
      const mid = s.fromDays * DAY + (r + 0.5) * intlen; const radius = intlen / 2;
      for (let j = 0; j < s.ncoef; j += 1) {
        s.fn(mid + nodes[j] * radius, p);
        fv[0][j] = p[0]; fv[1][j] = p[1]; fv[2][j] = p[2];
      }
      data[r * rsize] = mid; data[r * rsize + 1] = radius;
      for (let c = 0; c < 3; c += 1) data.set(chebFit(fv[c], s.ncoef), r * rsize + 2 + c * s.ncoef);
    }
    data.set([s.fromDays * DAY, intlen, rsize, nrec], nrec * rsize);
    return { s, data, start: s.fromDays * DAY, stop: s.fromDays * DAY + nrec * intlen };
  });

  // record 1: file record; 2: comments; 3: summaries; 4: names; 5 on: data
  const words = arrays.reduce((n, a) => n + a.data.length, 0);
  const dataRecords = Math.ceil(words / 128);
  const out = new Uint8Array((4 + dataRecords) * RECORD);
  const dv = new DataView(out.buffer);
  const ascii = (at, text, len) => { for (let i = 0; i < len; i += 1) out[at + i] = i < text.length ? text.charCodeAt(i) : 32; };
  ascii(0, 'DAF/SPK ', 8);
  dv.setInt32(8, ND, true); dv.setInt32(12, NI, true);
  ascii(16, 'SYNTHETIC', 60);
  dv.setInt32(76, 3, true); dv.setInt32(80, 3, true);
  ascii(88, 'LTL-IEEE', 8);
  const text = `${comment}\0`;
  for (let i = 0; i < text.length; i += 1) out[RECORD + i] = text.charCodeAt(i) === 0 ? 0 : text.charCodeAt(i);
  out[RECORD + text.length] = 4;                       // EOT

  let word = 4 * 128 + 1;                               // first data word, 1-based
  const sum = 2 * RECORD; const names = 3 * RECORD;
  dv.setFloat64(sum, 0, true); dv.setFloat64(sum + 8, 0, true); dv.setFloat64(sum + 16, arrays.length, true);
  arrays.forEach((a, i) => {
    const base = sum + 24 + i * SS * 8;
    dv.setFloat64(base, a.start, true); dv.setFloat64(base + 8, a.stop, true);
    const first = word; const last = word + a.data.length - 1;
    [a.s.target, a.s.center, 1, 2, first, last].forEach((v, k) => dv.setInt32(base + 16 + 4 * k, v, true));
    ascii(names + i * SS * 8, name, SS * 8);
    for (let k = 0; k < a.data.length; k += 1) dv.setFloat64((word - 1 + k) * 8, a.data[k], true);
    word = last + 1;
  });
  dv.setInt32(84, word, true);                          // FREE
  return out;
}
