/**
 * MEASUREMENT ONLY. A `Reducer` backend over the uncompressed DE kernel, so
 * configurations A and B of the four-configuration measurement run the very
 * same reduction code as C and D and differ ONLY in where the coordinates
 * came from.
 *
 * Not part of the shipped package: it imports the research track's Node-only
 * SPK reader and needs a local kernel. `src/node.mjs` does not reference it.
 */
import { Spk2, NAIF } from '../../../docs/platform/evidence/precision-2026-09-20/numerics/src/spk2.mjs';

const ROUTE = {
  Sun: [[NAIF.SUN, NAIF.SSB]],
  Mercury: [[NAIF.MERCURY_BARY, NAIF.SSB]],
  Venus: [[NAIF.VENUS_BARY, NAIF.SSB]],
  Mars: [[NAIF.MARS_BARY, NAIF.SSB]],
  Jupiter: [[NAIF.JUPITER_BARY, NAIF.SSB]],
  Saturn: [[NAIF.SATURN_BARY, NAIF.SSB]],
  Uranus: [[NAIF.URANUS_BARY, NAIF.SSB]],
  Neptune: [[NAIF.NEPTUNE_BARY, NAIF.SSB]],
  Pluto: [[NAIF.PLUTO_BARY, NAIF.SSB]],
  Moon: [[NAIF.EMB, NAIF.SSB], [NAIF.MOON, NAIF.EMB]],
  Earth: [[NAIF.EMB, NAIF.SSB], [NAIF.EARTH, NAIF.EMB]],
};

export class SpkBackend {
  constructor(kernelPath) {
    this.spk = new Spk2(kernelPath);
    this.segCache = new Map();
    const segs = [...new Set(Object.values(ROUTE).flat().map(([t, c]) => `${t}/${c}`))].map((k) => {
      const [t, c] = k.split('/').map(Number);
      return this.#seg(t, c);
    });
    this.coverage = {
      startEtSecTdb: Math.max(...segs.map((s) => s.start)),
      stopEtSecTdb: Math.min(...segs.map((s) => s.stop)),
    };
  }

  #seg(target, center) {
    const key = `${target}/${center}`;
    if (!this.segCache.has(key)) this.segCache.set(key, this.spk.segment(target, center));
    return this.segCache.get(key);
  }

  covers(et) {
    return Number.isFinite(et) && et >= this.coverage.startEtSecTdb && et <= this.coverage.stopEtSecTdb;
  }

  /** The Earth-Moon barycentre from the SSB, and the Moon and the Earth from it, as the kernel stores them. */
  lunar(et, emb, moon, earth) {
    for (const [t, c, out] of [[NAIF.EMB, NAIF.SSB, emb], [NAIF.MOON, NAIF.EMB, moon], [NAIF.EARTH, NAIF.EMB, earth]]) {
      const s = this.spk.state(this.#seg(t, c), et);
      out[0] = s.pos[0]; out[1] = s.pos[1]; out[2] = s.pos[2];
      out[3] = s.vel[0]; out[4] = s.vel[1]; out[5] = s.vel[2];
    }
  }

  state(body, et, out) {
    out.fill(0);
    for (const [t, c] of ROUTE[body]) {
      const s = this.spk.state(this.#seg(t, c), et);
      out[0] += s.pos[0]; out[1] += s.pos[1]; out[2] += s.pos[2];
      out[3] += s.vel[0]; out[4] += s.vel[1]; out[5] += s.vel[2];
    }
    return out;
  }
}
