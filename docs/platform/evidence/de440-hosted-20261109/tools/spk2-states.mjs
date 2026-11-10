/**
 * For erfa_chain.py's reader self-check (PREREGISTRATION.md, "The chain of
 * (viii)"): states from the research reader of 20 September 2026
 * (docs/platform/evidence/precision-2026-09-20/numerics/src/spk2.mjs) at the
 * double epochs the chain read, so the chain's exact reader can be checked
 * against an independent one.
 *
 *   node spk2-states.mjs <de440.bsp> <queries.json> <out.json>
 *
 * queries.json: [[target, center, et], ...]; out.json: [[x, y, z, vx, vy, vz], ...].
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Spk2 } from '../../precision-2026-09-20/numerics/src/spk2.mjs';

const [kernel, queries, out] = process.argv.slice(2);
const spk = new Spk2(kernel);
const segments = new Map();
const rows = JSON.parse(readFileSync(queries, 'utf8')).map(([target, center, et]) => {
  const key = `${target}/${center}`;
  if (!segments.has(key)) segments.set(key, spk.segment(target, center));
  const s = spk.state(segments.get(key), et);
  return [...s.pos, ...s.vel];
});
writeFileSync(out, `${JSON.stringify(rows)}\n`);
