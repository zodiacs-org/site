/**
 * P4.1's holdout, by the programme's standing rule ("Fresh holdouts",
 * docs/platform/evidence/engine-beyond-swiss/PREREGISTRATION.md) as step 1.4
 * implemented it (docs/platform/evidence/deltat-2026-09-25/tools/holdout.ts):
 * mulberry32 seeded with the first 32 bits (big-endian) of SHA-256 of the id;
 * 200 positions, each a UTC instant in whole milliseconds over
 * [1800-01-01T00:00Z, 2200-01-01T00:00Z), then a latitude in [-66.5, 66.5]
 * and a longitude in [-180, 180) (unused by P4.1, drawn so that the instants
 * are the standard ones). P4.1 uses only the positions part, which is drawn
 * first, so the later parts of holdout.ts cannot change it.
 *
 *   node holdout.mjs [id]        (id: zodiacs-holdout/P4.1, drawn only in S5)
 */
import { createHash } from 'node:crypto';

export const HOLDOUT_ID = 'zodiacs-holdout/P4.1';

export function drawHoldout(id = HOLDOUT_ID) {
  const seed = createHash('sha256').update(id).digest().readUInt32BE(0);
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const FROM = Date.UTC(1800, 0, 1);
  const TO = Date.UTC(2200, 0, 1);
  const positions = Array.from({ length: 200 }, () => {
    const utc = new Date(FROM + Math.floor(r() * (TO - FROM))).toISOString();
    const latitude = -66.5 + 133 * r();
    const longitude = -180 + 360 * r();
    return { utc, latitude, longitude };
  });
  const positionsSha256 = createHash('sha256').update(JSON.stringify(positions)).digest('hex');
  return { id, seed, positionsSha256, positions };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.stdout.write(`${JSON.stringify(drawHoldout(process.argv[2]), null, 1)}\n`);
}
