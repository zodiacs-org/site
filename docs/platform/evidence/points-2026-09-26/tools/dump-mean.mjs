/*
 * The engine's mean lunar node and Black Moon Lilith (the mean apogee), with
 * their speeds, every 3.7 days from 1800 to 2199 at 12:00 UTC, and the TT the
 * engine computed each at, so a comparison can ask Swiss for the same instant.
 *
 *   node tools/dump-mean.mjs > "$WORK/mean.jsonl"
 */
import { chartPoints } from '@zodiacs/engine';
import { deltaT } from '@zodiacs/engine/deltat';

const J2000 = Date.UTC(2000, 0, 1, 12);
const start = Date.UTC(1800, 0, 1, 12);
const end = Date.UTC(2200, 0, 1);
for (let t = start; t < end; t += 3.7 * 86_400_000) {
  const utc = new Date(t);
  const ut = (t - J2000) / 86_400_000;
  const tt = ut + deltaT(ut) / 86_400;
  const byName = Object.fromEntries(chartPoints({ utc }).points.map((p) => [p.point, p]));
  const node = byName['Mean Node'];
  const lilith = byName['Black Moon Lilith'];
  process.stdout.write(`${JSON.stringify({
    utc: utc.toISOString(), tt,
    node: [node.lon, node.speed],
    lilith: [lilith.lon, lilith.lat, lilith.speed],
  })}\n`);
}
