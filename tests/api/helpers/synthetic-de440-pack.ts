/**
 * A DE440 pack in the format the engine reads, with one linear record per
 * body and made-up motions (as the engine's src/de440.test.ts builds one), so
 * that tests can exercise the de440 backend without NAIF's kernel. Its
 * positions mean nothing.
 */
import { createHash } from 'node:crypto';

const AU = 149597870.7;
/** TDB seconds either side of J2000: 1778 to 2221, past the API's 1800 to 2199. */
export const RADIUS = 7e9;

/** A pack of the engine's format with one linear record per body (as src/de440.test.ts in the engine builds one). */
export function syntheticPack(): Uint8Array {
  const bodies: [string, string, number[], number[]][] = [
    ['sun', 'native', [0, 0, 0], [0, 0, 0]],
    ['emb', 'ssb', [AU, 0, 0], [0, 29.78, 0]],
    ['moon', 'native', [384400, 0, 20000], [0, 1.02, 0.05]],
    ['mercuryBary', 'ssb', [-0.39 * AU, 0.1 * AU, 0], [0, -47.4, 0]],
    ['venusBary', 'ssb', [0, 0.72 * AU, 0], [-35, 0, 0]],
    ['marsBary', 'ssb', [-1.52 * AU, 0, 0.02 * AU], [0, -24.1, 0]],
    ['jupiterBary', 'ssb', [0, -5.2 * AU, 0], [13.1, 0, 0]],
    ['saturnBary', 'ssb', [9.5 * AU, AU, 0], [0, 9.7, 0]],
    ['uranusBary', 'ssb', [-19.2 * AU, 0, 0], [0, -6.8, 0]],
    ['neptuneBary', 'ssb', [0, 30.1 * AU, 0.5 * AU], [-5.4, 0, 0]],
    ['plutoBary', 'ssb', [20 * AU, -30 * AU, 5 * AU], [3, 2, -1]],
  ];
  const headerLen = 4096;
  const payloadOffset = 16 + headerLen;
  const stride = 48;
  const payloadEnd = payloadOffset + bodies.length * stride;
  const header = {
    format: 'zodiacs-ephemeris-pack',
    formatVersion: 2,
    conventions: { chebyshev: 'spk-type-2', units: 'km,km/s' },
    coverage: { startEtSecTdb: -RADIUS, stopEtSecTdb: RADIUS },
    derived: { earth399: { emrat: 81.30056822149722 } },
    bodies: bodies.map(([name, frame], i) => ({
      name, frame, ncoef: 2, nrec: 1, offset: payloadOffset + i * stride, initEt: -RADIUS, intervalSec: 2 * RADIUS,
      layout: { enc: 'f64', stride, midsOffset: 0, recordsOffset: 0 },
    })),
    payloadEndOffset: payloadEnd,
  };
  const bytes = new Uint8Array(payloadEnd + 32);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('ZODEPH02'), 0);
  view.setUint32(8, headerLen, true);
  view.setUint32(12, payloadOffset, true);
  bytes.fill(0x20, 16, payloadOffset);
  bytes.set(new TextEncoder().encode(JSON.stringify(header)), 16);
  bodies.forEach(([, , position, velocity], i) => {
    for (let axis = 0; axis < 3; axis += 1) {
      view.setFloat64(payloadOffset + i * stride + axis * 16, position[axis]!, true);
      view.setFloat64(payloadOffset + i * stride + axis * 16 + 8, velocity[axis]! * RADIUS, true);
    }
  });
  bytes.set(createHash('sha256').update(bytes.subarray(0, payloadEnd)).digest(), payloadEnd);
  return bytes;
}

