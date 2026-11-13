// Recomputes the holdout draws the records state, from the rules' own words.
// Seeds: first 32 bits, big-endian, of SHA-256(id); mulberry32; start =
// 1850-01-01 + floor(r * N) days, N = days in [1850-01-01, 2127-01-01).
// Then checks every pair of series (ten windows [s + 900 i, s + 900 i + 300])
// for overlap (touching at an end is not overlap).
import { createHash } from 'node:crypto';
const DAY = 86400000;
const seedOf = (id) => createHash('sha256').update(id).digest().readUInt32BE(0);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lo = Date.UTC(1850, 0, 1); const hi = Date.UTC(2127, 0, 1);
const N = (hi - lo) / DAY;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const out = { daysInRange: N, draws: {} };
for (const id of ['zodiacs-holdout/P4.5', 'zodiacs-holdout/P4.5-v3']) {
  const s = seedOf(id); const r = mulberry32(s)();
  const start = lo + Math.floor(r * N) * DAY;
  out.draws[id] = { seedHex: s.toString(16).padStart(8, '0'), seed: s, firstR: r, startDay: Math.floor(r * N), start: iso(start) };
}
const series = {
  '1975 regression': Date.UTC(1975, 0, 1), '2007 v1 holdout': Date.UTC(2007, 2, 15),
  '1912 bundle v2 holdout': Date.UTC(1912, 11, 12), '2103 bundle v3 holdout': Date.UTC(2103, 0, 23),
  '2040 #860 holdout': Date.UTC(2040, 0, 1),
};
const windows = (s) => Array.from({ length: 10 }, (_, i) => [s + 900 * i * DAY, s + (900 * i + 300) * DAY]);
out.series = Object.fromEntries(Object.entries(series).map(([k, s]) => [k, { first: iso(s), lastWindowEnds: iso(windows(s)[9][1]) }]));
out.overlaps = [];
const names = Object.keys(series);
for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) {
  for (const [a0, a1] of windows(series[names[i]])) for (const [b0, b1] of windows(series[names[j]])) {
    if (a0 < b1 && b0 < a1) out.overlaps.push([names[i], iso(a0), names[j], iso(b0)]);
  }
}
console.log(JSON.stringify(out, null, 1));
