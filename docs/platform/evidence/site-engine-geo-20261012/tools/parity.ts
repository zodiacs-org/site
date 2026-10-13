// Parity between the site's local-time resolution (src/lib/time/localToUtc.ts)
// and @zodiacs/engine 1.0.0's (geo entry), over synthetic wall times.
// Bundled with esbuild (static imports of the site checkout's files), then: node parity.mjs <out.json>
import { writeFileSync } from 'node:fs';

import * as site from '<site checkout at the base>/src/lib/time/localToUtc.ts';
import * as engine from '<site checkout at the base>/node_modules/@zodiacs/engine/dist/geo.js';
const out = process.argv[2];

const zones: string[] = (Intl as any).supportedValuesOf('timeZone');
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

// Deterministic PRNG (mulberry32).
let seed = 0x5eed1234;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Case = { zone: string; date: string; time: string; longitude?: number };
const results = { cases: 0, agree: 0, bothThrow: 0, siteOnlyThrow: 0, engineOnlyThrow: 0, disagree: 0 };
const buckets = new Map<string, any>();
const bucketOf = (c: Case) => {
  const year = Number(c.date.slice(0, 4));
  const era = year < 1900 ? '1800-1899' : year < 1970 ? '1900-1969' : year < 2038 ? '1970-2037' : '2038-2199';
  return `${era}|${c.longitude === undefined ? 'no longitude' : 'longitude'}`;
};

function compare(c: Case) {
  results.cases += 1;
  const key = bucketOf(c);
  const bucket = buckets.get(key) ?? { cases: 0, disagree: 0, examples: [], kinds: {}, flagKinds: {}, zonesWithInstant: {}, maxAbsDeltaSeconds: 0, examplesByKind: {} };
  buckets.set(key, bucket);
  bucket.cases += 1;
  const options = c.longitude === undefined ? {} : { longitude: c.longitude };
  let a: any; let b: any; let ea: unknown; let eb: unknown;
  try { a = site.resolveLocalToUtc(c.date, c.time, c.zone, options); } catch (error) { ea = error; }
  try { b = engine.resolveLocalToUtc(c.date, c.time, c.zone, options); } catch (error) { eb = error; }
  if (ea && eb) { results.bothThrow += 1; return; }
  if (ea || eb) {
    if (ea) results.siteOnlyThrow += 1; else results.engineOnlyThrow += 1;
    bucket.disagree += 1;
    if (bucket.examples.length < 8) bucket.examples.push({ ...c, site: ea ? String((ea as Error).message) : summary(a), engine: eb ? String((eb as Error).message) : summary(b) });
    return;
  }
  const instant = a.utc.getTime() === b.utc.getTime();
  const offset = a.offsetMinutes === b.offsetMinutes;
  const flags = JSON.stringify([...a.flags].sort()) === JSON.stringify([...b.flags].sort());
  const lmt = JSON.stringify(a.localMeanTime ?? null) === JSON.stringify(b.localMeanTime ?? null);
  if (instant && offset && flags && lmt) { results.agree += 1; return; }
  results.disagree += 1;
  bucket.disagree += 1;
  const kind = !instant ? 'instant' : !offset ? 'offset only' : !flags && lmt ? 'flags only' : flags && !lmt ? 'localMeanTime only' : 'flags and localMeanTime';
  const flagKind = !flags ? `site [${[...a.flags].sort()}] engine [${[...b.flags].sort()}]` : 'same flags';
  bucket.kinds[kind] = (bucket.kinds[kind] ?? 0) + 1;
  bucket.flagKinds[flagKind] = (bucket.flagKinds[flagKind] ?? 0) + 1;
  if (kind === 'instant') {
    const dz = (bucket.zonesWithInstant[c.zone] ??= 0); bucket.zonesWithInstant[c.zone] = dz + 1;
    const delta = (b.utc.getTime() - a.utc.getTime()) / 1000;
    bucket.maxAbsDeltaSeconds = Math.max(bucket.maxAbsDeltaSeconds, Math.abs(delta));
  }
  const list = bucket.examplesByKind[kind] ??= [];
  if (list.length < 6) list.push({ ...c, site: summary(a), engine: summary(b) });
}
const summary = (r: any) => ({ utc: r.utc.toISOString(), offsetMinutes: r.offsetMinutes, flags: r.flags, localMeanTime: r.localMeanTime ?? null });

const started = Date.now();
for (const zone of zones) {
  const cases: Case[] = [];
  // Fixed grid: years across the range, two days a month, five times a day.
  for (const year of [1800, 1850, 1880, 1890, 1900, 1905, 1910, 1915, 1920, 1925, 1930, 1935, 1940, 1942, 1944, 1945, 1946, 1950, 1955, 1960, 1965, 1969, 1970, 1975, 1980, 1990, 2000, 2010, 2020, 2026, 2037, 2040, 2100, 2199]) {
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [1, 15]) {
        for (const time of ['00:30', '01:30', '02:30', '03:30', '12:00']) cases.push({ zone, date: `${year}-${pad(month)}-${pad(day)}`, time });
      }
    }
  }
  // Random wall times, 1800-2199.
  for (let i = 0; i < 300; i += 1) {
    const year = 1800 + Math.floor(rand() * 400);
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    const minute = Math.floor(rand() * 1440);
    cases.push({ zone, date: `${year}-${pad(month)}-${pad(day)}`, time: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}` });
  }
  // Each case again with a birthplace longitude: random, and the zone's own offset in degrees.
  const withLongitude = cases.map((c, index) => ({ ...c, longitude: index % 2 === 0 ? Math.round((rand() * 360 - 180) * 1e4) / 1e4 : undefined }))
    .filter((c) => c.longitude !== undefined) as Case[];
  for (const c of [...cases, ...withLongitude]) {
    if (Number(c.date.slice(0, 4)) <= 1970) {
      await Promise.all([site.prepareLocalTime(c.date, c.zone).catch(() => {}), engine.prepareLocalTime(c.date, c.zone).catch(() => {})]);
    }
    compare(c);
  }
}
const record = { schema: 'zodiacs.geo-parity.v1', engine: '1.0.0', zones: zones.length, node: process.version,
  icu: process.versions.icu, tz: process.versions.tz, seconds: (Date.now() - started) / 1000, results,
  buckets: Object.fromEntries([...buckets].sort()) };
if (out) writeFileSync(out, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ ...record, buckets: Object.fromEntries([...buckets].sort().map(([k, v]) => [k, { cases: v.cases, disagree: v.disagree, kinds: v.kinds, flagKinds: v.flagKinds, zonesWithInstant: Object.keys(v.zonesWithInstant).length, maxAbsDeltaSeconds: v.maxAbsDeltaSeconds }])) }, null, 2));
