// S1 (the engine's time-entry PREREGISTRATION.md, section 8, at 806f76b): the
// site generator's own check, retargeted at the package. Before it writes
// src/lib/engine/time-basis.mjs, scripts/build-time-basis.mjs (site main
// 0bf69bd5) checks its bundle against the package's public API: at every
// instant of its checkInstants (every tenth day at noon from 1800 while before
// 2200, and 31 edges at -1,000, -1, 0, +1 and +1,000 ms: 14,765 instants),
// timeBasis(t, "utc") must give the deltaT and timeScale natalChart reports
// (isDeepStrictEqual), and astronomy-engine's vectors, taken as the package
// takes them and turned by the frame of date, must give each of natalChart's
// 12 longitudes (Object.is): 177,180 longitudes. This tool runs that check
// unchanged with @zodiacs/engine/time in place of the bundled module:
// timeBasis, eclipticFrame, meanEcliptic, eclipticOfDate and EPHEMERIS_SPAN
// from the entry, natalChart and EPHEMERIS_SPAN from the root.
//
// Controls, T5's two (the same preregistration, section 6), each of which must
// fail at every instant:
//   a  astronomy-engine's own Ecliptic() (its five-term nutation) in place of
//      eclipticOfDate for the Sun, the planets and the Moon: at every instant
//      at least one longitude differs;
//   b  natalChart given a deltaT 1 ms off the basis: every record differs.
//
// The package is the one installed in this checkout unless --package names
// another directory; entries are imported by the files its "exports" name, and
// astronomy-engine as the package resolves it (./load.mjs), so the check and
// the engine share one astronomy-engine module and its ΔT setting.
//
//   node generator-check.mjs [--package <dir>] [--control a|b] [--out <file>]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { k1 } from "./corpora.mjs";
import { astronomy, entry, finish, manifest, options } from "./load.mjs";

const opts = options();
const control = opts.control;
if (control !== undefined && !["a", "b"].includes(control)) throw new Error(`unknown control ${control}`);
const SITE = fileURLToPath(new URL("../../../../../../", import.meta.url));
const PACKAGE = typeof opts.package === "string" ? opts.package : join(SITE, "node_modules/@zodiacs/engine");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const time = await entry(PACKAGE, "./time");
const root = await entry(PACKAGE, ".");
const { deltaT } = await entry(PACKAGE, "./deltat");
const { module: Astronomy, version: astronomyVersion } = await astronomy(PACKAGE);

/** The generator's instants, verbatim from scripts/build-time-basis.mjs (site main 0bf69bd5). */
function checkInstants() {
  const DAY = 86_400_000;
  const instants = [];
  for (let t = Date.UTC(1800, 0, 1, 12); t < Date.UTC(2200, 0, 1); t += 10 * DAY) instants.push(t);
  // Every leap second of the list and the ends of the IERS table, to the millisecond on each side.
  const edges = [Date.UTC(1972, 0, 1), Date.UTC(1973, 0, 2), Date.UTC(2027, 9, 2), Date.UTC(2027, 5, 28)];
  for (const [year, month] of [[1972, 6], [1973, 0], [1974, 0], [1975, 0], [1976, 0], [1977, 0], [1978, 0],
    [1979, 0], [1980, 0], [1981, 6], [1982, 6], [1983, 6], [1985, 6], [1988, 0], [1990, 0], [1991, 0],
    [1992, 6], [1993, 6], [1994, 6], [1996, 0], [1997, 6], [1999, 0], [2006, 0], [2009, 0], [2012, 6],
    [2015, 6], [2017, 0]]) edges.push(Date.UTC(year, month, 1));
  for (const edge of edges) instants.push(edge - 1_000, edge - 1, edge, edge + 1, edge + 1_000);
  return instants;
}

const RAD = 180 / Math.PI;
const PLANETS = ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
// The generator's longitudes, with the entry's frame; control a turns the
// vectors with astronomy-engine's own Ecliptic() instead.
const lonOf = (vector, at) => (control === "a" ? Astronomy.Ecliptic(vector).elon : time.eclipticOfDate(vector.x, vector.y, vector.z, at.tt).lon);
const longitudes = (basis) => {
  const seconds = basis.deltaT.seconds;
  Astronomy.SetDeltaTFunction(() => seconds);
  try {
    const at = Astronomy.MakeTime(basis.ut1Days);
    const out = new Map();
    for (const name of PLANETS) out.set(name, lonOf(Astronomy.GeoVector(Astronomy.Body[name], at, true), at));
    out.set("Moon", lonOf(Astronomy.GeoMoon(at), at));
    const state = Astronomy.GeoMoonState(at);
    const frame = time.eclipticFrame(at.tt);
    const [x, y] = time.meanEcliptic(
      frame,
      state.y * state.vz - state.z * state.vy,
      state.z * state.vx - state.x * state.vz,
      state.x * state.vy - state.y * state.vx
    );
    const node = ((Math.atan2(x, -y) * RAD + frame.tilt.dpsi / 3600) % 360 + 360) % 360;
    out.set("North Node", node);
    out.set("South Node", ((node + 180) % 360 + 360) % 360);
    return out;
  } finally {
    Astronomy.SetDeltaTFunction(deltaT);
  }
};

const instants = checkInstants();
const sameAsK1 = isDeepStrictEqual(instants, k1());
const spanEqual = isDeepStrictEqual(time.EPHEMERIS_SPAN, root.EPHEMERIS_SPAN);
let records = 0;
let recordDifferences = 0;
let bodies = 0;
let longitudeDifferences = 0;
let instantsWithLongitudeDifferences = 0;
const examples = [];
for (const ms of instants) {
  const basis = time.timeBasis(ms, "utc");
  const input = { utc: new Date(ms), timeKnown: false };
  if (control === "b") input.deltaT = basis.deltaT.seconds + 0.001;
  const chart = root.natalChart(input);
  records += 1;
  if (!isDeepStrictEqual(basis.deltaT, chart.deltaT) || !isDeepStrictEqual(basis.timeScale, chart.timeScale)) {
    recordDifferences += 1;
    if (examples.length < 20) examples.push({ ms, what: "record" });
  }
  const framed = longitudes(basis);
  let differs = false;
  for (const body of chart.bodies) {
    bodies += 1;
    if (!Object.is(framed.get(body.body), body.lon)) {
      longitudeDifferences += 1;
      differs = true;
      if (examples.length < 20) examples.push({ ms, body: body.body, entry: framed.get(body.body) ?? null, chart: body.lon });
    }
  }
  if (differs) instantsWithLongitudeDifferences += 1;
}

const sitePackage = JSON.parse(readFileSync(join(SITE, "package.json"), "utf8"));
const dependency = sitePackage.dependencies?.["@zodiacs/engine"] ?? null;
const vendored = typeof dependency === "string" && dependency.startsWith("file:vendor/") ? dependency.slice("file:".length) : null;
const pass = sameAsK1 && spanEqual && recordDifferences === 0 && longitudeDifferences === 0 && records === 14_765 && bodies === 177_180;
const behaved = {
  a: () => records === 14_765 && instantsWithLongitudeDifferences === records,
  b: () => records === 14_765 && recordDifferences === records
};
await finish({
  check: "S1",
  tool: "generator-check.mjs",
  retargets: "scripts/build-time-basis.mjs's check (site main 0bf69bd5) at @zodiacs/engine/time",
  package: { name: manifest(PACKAGE).name, version: manifest(PACKAGE).version },
  siteDependency: dependency,
  vendoredArchiveSha256: vendored ? sha256(readFileSync(join(SITE, vendored))) : null,
  astronomyEngine: astronomyVersion,
  control: control ?? null,
  controlBehaved: control ? behaved[control]() : null,
  instantsAreK1: sameAsK1,
  ephemerisSpanEqual: spanEqual,
  counts: { instants: records, longitudes: bodies },
  differences: { records: recordDifferences, longitudes: longitudeDifferences, instantsWithLongitudeDifferences },
  examples,
  node: process.version,
  pass
}, opts.out);
