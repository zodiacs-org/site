/**
 * Numerics review, post hoc and unscored. The solar elongation of the Moon at
 * every record join (moon, emb, sun series) inside the Moon window of each
 * series, through #860's tier-B deflected reference on the pack #860 used:
 * times and angles only. About 70 reference calls.
 *
 *   node check-joins-elongation.mjs > joins-elongation.json
 */
const SCR = '<scratch>';
const HEAD = `${SCR}/p45/prior-versions/head/examples/precision-alpha`;
const { openPackFile } = await import(`${HEAD}/src/node.mjs`);
const { makeDeflectedReference } = await import(`${HEAD}/test/tier-b/_deflected-reference.mjs`);
const rt = await openPackFile(`${SCR}/p42/base/D-de440s.sealed.zeph`);
const eph = rt.ephemeris;
const ref = makeDeflectedReference(eph);
const DAY = 86400;
const J2000_UTC = Date.UTC(2000, 0, 1, 12);
const tdb = (iso) => (Date.parse(iso) - J2000_UTC) / 1000 + 69.184;
const plus = (iso, days) => `${new Date(Date.parse(iso) + days * DAY * 1000).toISOString().slice(0, 10)}T00:00:00Z`;
const isoTdb = (t) => `${new Date(J2000_UTC + t * 1000).toISOString().slice(0, 19)} TDB`;
const out = { packDigest: rt.integrity.computedDigest, series: {} };
for (const epoch of ['1975-01-01', '2007-03-15', '1912-12-12', '2103-01-23', '2040-01-01']) {
  const fromIso = plus(`${epoch}T00:00:00Z`, 900); // the Moon is the second body: F2/A2
  const toIso = plus(fromIso, 300);
  const a = tdb(fromIso); const b = tdb(toIso);
  const joins = [];
  for (const name of ['moon', 'emb', 'sun']) {
    const s = eph.bodies.get(name);
    for (let k = Math.ceil((a - s.initEt) / s.intervalSec); ; k += 1) {
      const t = s.initEt + k * s.intervalSec;
      if (t >= b) break;
      if (t > a) joins.push({ series: name, at: isoTdb(t), tdbSec: t, elongationDeg: ref.elongationDeg('Moon', t) });
    }
  }
  joins.sort((x, y) => x.elongationDeg - y.elongationDeg);
  out.series[epoch] = { moonWindow: [fromIso, toIso], joins: joins.length, insideFloor: joins.filter((j) => j.elongationDeg < 5), within10Deg: joins.filter((j) => j.elongationDeg < 10).length, nearest: joins.slice(0, 2) };
}
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
