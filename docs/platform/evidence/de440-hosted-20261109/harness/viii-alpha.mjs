/**
 * Rule (viii) for the research runtime, as a tier-B gate: its Reducer with
 * CORRECTED on the raw de440.bsp through tools/spk-backend.mjs, against the
 * ERFA chain's places (../oracles/erfa-places.json), every row within 1e-6
 * arcsecond, the angle between two directions being atan2(|u x w|, u . w).
 * C3 ran the same gate once on the unchanged runtime (S2), where it failed
 * for the Moon as preregistered.
 *
 *   node viii-alpha.mjs <de440.bsp> [--json]
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CORRECTED, Reducer } from '../../../../../examples/precision-alpha/src/core/reduce.mjs';
import { SpkBackend } from '../../../../../examples/precision-alpha/tools/spk-backend.mjs';

const ORACLE = new URL('../oracles/erfa-places.json', import.meta.url);
const ORACLE_SHA256 = '7d56d6ea938cd90df04a5b902f3ff3fddd5d3535efc886d2dac1fd9dc58831cd';
const KERNEL_SHA256 = 'a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5';
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const GATE_ARCSEC = 1e-6;
const RAD = Math.PI / 180;

export function viiiAlpha(kernel) {
  if (createHash('sha256').update(readFileSync(kernel)).digest('hex') !== KERNEL_SHA256) throw new Error('not the pinned de440.bsp');
  const bytes = readFileSync(ORACLE);
  if (createHash('sha256').update(bytes).digest('hex') !== ORACLE_SHA256) throw new Error('the oracle is not the committed one');
  const places = JSON.parse(bytes.toString('utf8'));
  const reducer = new Reducer(new SpkBackend(kernel));
  const unit = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
  const angle = (a, b) => {
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return (Math.atan2(Math.hypot(...c), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / RAD) * 3600;
  };
  const byBody = {};
  let failures = 0;
  for (const row of places.rows) {
    let d;
    try {
      const r = reducer.apparent(row.body, (row.ttMs - J2000_MS) / 86_400_000, CORRECTED);
      d = [r.lon, r.lat].every(Number.isFinite) ? angle(unit(r.lon, r.lat), unit(Number(row.lon), Number(row.lat))) : NaN;
    } catch {
      d = NaN;
    }
    const b = (byBody[row.body] ??= { rows: 0, maxArcsec: 0, over: 0 });
    b.rows += 1;
    if (!Number.isFinite(d)) { failures += 1; b.over += 1; continue; }
    b.maxArcsec = Math.max(b.maxArcsec, d);
    if (d > GATE_ARCSEC) b.over += 1;
  }
  const over = Object.values(byBody).reduce((n, b) => n + b.over, 0);
  return { rule: 'viii', reducer: 'research runtime (CORRECTED) on de440.bsp', rows: places.rows.length, gateArcsec: GATE_ARCSEC, byBody, failures, over, verdict: over === 0 && places.rows.length === 2000 ? 'PASS' : 'FAIL' };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = viiiAlpha(process.argv[2]);
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
  else for (const [body, b] of Object.entries(result.byBody)) console.log(`${body.padEnd(8)} max ${b.maxArcsec.toExponential(3)} arcsec, over ${b.over} of ${b.rows}`);
  console.error(`rule (viii), research runtime: ${result.verdict}`);
  process.exit(result.verdict === 'PASS' ? 0 : 1);
}
