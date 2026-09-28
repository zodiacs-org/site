/*
 * The engine's Equal-from-midheaven cusps, Vertex and East Point, given the
 * sidereal time, latitude and obliquity directly, so a comparison sees those
 * definitions alone. Two sets: the 55°–66.6° ladder, every 0.1° in both
 * hemispheres at 24 RAMCs, and 20,000 draws over every latitude and the
 * obliquities of 1800–2200.
 *
 *   node tools/dump-given.mjs > "$WORK/given.jsonl"
 */
import { computeAngles, eastPointOf, equalMcCusps, vertexOf } from '@zodiacs/engine/internal/math';

let seed = 20260927;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const cases = [];
for (let tenth = 550; tenth <= 666; tenth += 1)
  for (const sign of [1, -1])
    for (let k = 0; k < 24; k += 1) cases.push({ set: 'ladder', ramc: k * 15 + 7.5, lat: (sign * tenth) / 10, eps: 23.4393 });
for (let i = 0; i < 20000; i += 1)
  cases.push({ set: 'broad', ramc: random() * 360, lat: -89.9 + random() * 179.8, eps: 23.42 + random() * 0.05 });
for (const c of cases) {
  const input = { gastHours: c.ramc / 15, latitude: c.lat, longitude: 0, obliquity: c.eps };
  const angles = computeAngles(input);
  process.stdout.write(`${JSON.stringify({
    ...c,
    equalMc: equalMcCusps(angles),
    vertex: vertexOf(input, angles),
    eastPoint: eastPointOf(input),
  })}\n`);
}
