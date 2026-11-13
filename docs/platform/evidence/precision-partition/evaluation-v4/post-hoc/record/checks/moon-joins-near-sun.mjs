// Where the Moon cases' windows hold a record join of a series the Moon's
// geocentric direction reads ('moon', 'emb', 'sun'), and the Moon's solar
// elongation at that join, from the tier-B deflected reference of the
// given tree. Only header metadata (record grid) and elongation angles are
// printed; no coefficient is printed or written.
//   node moon-joins-near-sun.mjs --tree=DIR --pack=FILE
// Post hoc and unscored: geometry only, no search of any version is run.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const TREE = pathToFileURL(resolve(args.get('tree'))).href.replace(/\/$/, '');
const { openPackFile } = await import(`${TREE}/src/node.mjs`);
const { makeDeflectedReference } = await import(`${TREE}/test/tier-b/_deflected-reference.mjs`);
const rt = await openPackFile(args.get('pack'));
const eph = rt.ephemeris;
const ref = makeDeflectedReference(eph);
const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const plus = (iso, days) => `${new Date(Date.parse(iso) + days * DAY * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
const isoOfTdb = (t) => new Date(J2000_UTC + (t - 69.184) * 1000).toISOString().replace('.000', '');
const series = ['moon', 'emb', 'sun'];
const grid = Object.fromEntries(series.map((s) => { const b = eph.bodies.get(s); return [s, { intervalDays: b.intervalSec / DAY, nrec: b.nrec }]; }));
const epochs = {
  '1975 regression (all versions)': '1975-01-01T00:00:00Z',
  '2007 v1 holdout (run again by #860, unscored)': '2007-03-15T00:00:00Z',
  '1912 bundle v2 holdout': '1912-12-12T00:00:00Z',
  '2103 bundle v3 holdout': '2103-01-23T00:00:00Z',
  '2040 #860 holdout': '2040-01-01T00:00:00Z',
};
const out = { packDigest: rt.integrity.computedDigest, grid, windows: {} };
for (const [label, epoch] of Object.entries(epochs)) {
  const fromIso = plus(epoch, 900); // the Moon is body index 1: F2 and A2
  const a = tdb(fromIso); const b = tdb(plus(fromIso, 300));
  const joins = [];
  for (const s of series) {
    const g = eph.bodies.get(s);
    const k0 = Math.ceil((a - g.initEt) / g.intervalSec);
    for (let k = k0; ; k += 1) {
      const J = g.initEt + k * g.intervalSec;
      if (J > b) break;
      if (J < a) continue;
      joins.push({ series: s, J, at: isoOfTdb(J), elongationDeg: ref.elongationDeg('Moon', J) });
    }
  }
  joins.sort((x, y) => (x.elongationDeg ?? -1) - (y.elongationDeg ?? -1));
  out.windows[label] = {
    from: fromIso, to: plus(fromIso, 300),
    joins: Object.fromEntries(series.map((s) => [s, joins.filter((j) => j.series === s).length])),
    refused: joins.filter((j) => j.elongationDeg === null).length,
    within10Deg: joins.filter((j) => j.elongationDeg !== null && j.elongationDeg < 10).map((j) => ({ series: j.series, at: j.at, elongationDeg: +j.elongationDeg.toFixed(3) })),
    nearest: joins.filter((j) => j.elongationDeg !== null).slice(0, 3).map((j) => ({ series: j.series, at: j.at, elongationDeg: +j.elongationDeg.toFixed(3) })),
  };
}
rt.dispose();
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
