/*
 * The site's local-time resolver (src/lib/time/localToUtc.ts) against
 * @zodiacs/engine rc.15's (@zodiacs/engine/geo), both given the birthplace's
 * longitude, over the city index: the three largest places of every zone in
 * public/data/cities/, at two wall times a year from 1850 to 1969, twenty
 * seeded random ones, and every ten minutes for two hours either side of the
 * zone's local mean time era end (src/data/tz-lmt.json). Counts the
 * resolutions whose instant or flags differ, with up to twelve examples of
 * each. The wall times are synthetic; no birth data is read.
 *
 *   npx vite-node --script docs/platform/evidence/site-engine-rc15/tools/compare-local-time.ts > local-time.json
 *
 * Run at b1a20dcc, the commit before the site adopted rc.15's meaning of `lmt`,
 * it gives the old rule's differences (docs/platform/evidence/site-engine-rc15/README.md).
 */
import { readFileSync } from 'node:fs';
import { prepareLocalTime as pkgPrepare, resolveLocalToUtc as pkgResolve } from '@zodiacs/engine/geo';
import { prepareLocalTime, resolveLocalToUtc } from '../../../../../src/lib/time/localToUtc';

const index = JSON.parse(readFileSync('public/data/cities/index.json', 'utf8'));
const lmt = JSON.parse(readFileSync('src/data/tz-lmt.json', 'utf8'));
const byZone = new Map<string, { name: string; lat: number; lon: number; pop: number }[]>();
for (const shard of index.shards as string[]) {
  const rows = JSON.parse(readFileSync(`public/data/cities/${shard}.json`, 'utf8'));
  for (const row of rows) {
    const tz = index.tz[row[6]];
    const list = byZone.get(tz) ?? [];
    list.push({ name: row[0], lat: row[4] / 100, lon: row[5] / 100, pop: row[7] ?? 0 });
    byZone.set(tz, list);
  }
}
const pad = (n: number) => String(n).padStart(2, '0');
const wall = (ms: number) => {
  const d = new Date(ms);
  return [`${String(d.getUTCFullYear()).padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`];
};
const counts = { cities: 0, resolutions: 0, sameInstant: 0, instantDiffers: 0, flagsDiffer: 0, lmtDiffers: 0, siteOnlyLmt: 0, packageOnlyLmt: 0, errors: 0 };
const zonesSiteOnly = new Set<string>(); const zonesPackageOnly = new Set<string>();
const examples: Record<string, string[]> = { instant: [], flags: [], lmt: [], error: [] };
const note = (kind: string, text: string) => { if (examples[kind].length < 12) examples[kind].push(text); };
let seed = 12345;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

for (const [tz, cities] of [...byZone.entries()].sort()) {
  if (/^(?:Etc\/|UTC$)/.test(tz)) continue;
  const chosen = cities.sort((a, b) => b.pop - a.pop).slice(0, 3);
  // Wall times: two a year 1850–1969, twenty random ones, and every 10 minutes
  // for two hours either side of the zone's local mean time era end.
  const walls: number[] = [];
  for (let year = 1850; year < 1970; year += 1) {
    walls.push(Date.UTC(year, 0, 1, 0, 30), Date.UTC(year, 6, 1, 12, 0));
  }
  for (let i = 0; i < 20; i += 1) walls.push(Date.UTC(1850, 0, 1) + Math.floor(random() * 120 * 365.25 * 86400) * 1000 - (Math.floor(random() * 120 * 365.25 * 86400) * 1000) % 60000);
  const eraEnd = lmt.eras[tz];
  if (typeof eraEnd === 'number') {
    for (let m = -120; m <= 120; m += 10) walls.push(Math.floor((eraEnd * 1000) / 60000) * 60000 + m * 60000);
  }
  for (const city of chosen) {
    counts.cities += 1;
    for (const w of walls) {
      const [date, time] = wall(w - (w % 60000));
      if (Number(date.slice(0, 4)) < 1800 || Number(date.slice(0, 4)) > 1969) continue;
      try {
        await prepareLocalTime(date, tz);
        await pkgPrepare(date, tz);
        const site = resolveLocalToUtc(date, time, tz, { longitude: city.lon });
        const pkg = pkgResolve(date, time, tz, { longitude: city.lon });
        counts.resolutions += 1;
        const sameInstant = site.utc.getTime() === pkg.utc.getTime();
        if (sameInstant) counts.sameInstant += 1;
        else { counts.instantDiffers += 1; note('instant', `${tz} ${city.name} ${date} ${time}: site ${site.utc.toISOString()} (${site.offsetMinutes}) pkg ${pkg.utc.toISOString()} (${pkg.offsetMinutes})`); }
        const sf = [...site.flags].sort().join(',');
        const pf = [...pkg.flags].sort().join(',');
        if (sf !== pf) {
          counts.flagsDiffer += 1;
          if (site.flags.includes('lmt') !== pkg.flags.includes('lmt')) { counts.lmtDiffers += 1; if (site.flags.includes('lmt')) { counts.siteOnlyLmt += 1; zonesSiteOnly.add(tz); } else { counts.packageOnlyLmt += 1; zonesPackageOnly.add(tz); } note('lmt', `${tz} ${city.name} ${date} ${time}: site [${sf}] pkg [${pf}]`); }
          else note('flags', `${tz} ${city.name} ${date} ${time}: site [${sf}] pkg [${pf}]`);
        }
      } catch (error) {
        counts.errors += 1;
        note('error', `${tz} ${city.name} ${date} ${time}: ${String((error as Error).message).slice(0, 120)}`);
      }
    }
  }
}
console.log(JSON.stringify({
  schema: 'zodiacs-site-local-time-comparison/v1',
  generatedAt: new Date().toISOString(),
  node: process.version,
  counts,
  zonesSiteOnly: [...zonesSiteOnly].sort(),
  zonesPackageOnly: zonesPackageOnly.size,
  examples,
}, null, 1));
