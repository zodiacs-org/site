# Independent references for the engine tests

Until 2026-09-28 five engine test packs were held to Swiss Ephemeris output
committed under `src/lib/engine/fixtures/`. The owner decided that Swiss's raw
output leaves the tree
([DECISIONS-2026-09-28 §3](../../platform/programme/DECISIONS-2026-09-28.md),
audit finding F-22), and that the tests move to independent arbiters. This
directory builds those arbiters' references: NASA JPL Horizons (DE441) for
positions and event times, and ERFA for sidereal time, obliquity, angles and
house cusps. What was removed, with its SHA-256 and how to regenerate it, is
in [`../SWISS-OUTPUT-REMOVAL.md`](../SWISS-OUTPUT-REMOVAL.md).

Each pack keeps its cases, its predeclared gates and the shape its test
reads. Only the arbiter changed. No gate was widened, and no assertion that
did not depend on Swiss was dropped.

| Test | Reads now | Replaces | Gates |
| --- | --- | --- | --- |
| `engine.test.ts`, true node and polar | `independent-node-polar.json` (`trueNode`, `polar`) | `swiss-node-polar.fixture.json` | `swiss-node-polar-policy.json`, unchanged |
| `engine.test.ts`, five Placidus charts | `independent-node-polar.json` (`houses`) | the inline Swiss `houses_ex` vectors | 0.1° ASC/MC, 0.2° cusps, unchanged |
| `engine.test.ts` epochs, `transit-scan.test.ts` stations, `solar-return.test.ts`, `returns.test.ts` Saturn | `independent-eight-cases.json` | `swiss-eight-cases.fixture.json` | `swiss-eight-cases-policy.json`, unchanged |
| `progressions.test.ts` | `horizons-reference.json`, 2020-01-01 | the same ten JPL longitudes, which the eight-case fixture carried | unchanged |
| `lunar-return.test.ts` | `independent-lunar-returns.json`, `independent-lunar-return-policy.json` | `swiss-lunar-returns.fixture.json`, `swiss-lunar-returned-charts.fixture.json`, `swiss-lunar-return-policy.json` | the Swiss policy's, carried over unchanged |
| `transit-window-independent.test.ts` | `transit-window-horizons.json` | `transit-window-independent.json` | the A–I budgets, unchanged |
| `scripts/platform-engine-report.mjs` | `independent-node-polar.json` | `swiss-node-polar.fixture.json` | `swiss-node-polar-policy.json` |

The three `swiss-*` files still read are the packs' policies and the lunar
applicability amendment. They hold cases, gates and digests, and no value
Swiss returned.

## Arbiters

- **Positions.** The Horizons API (version 1.2, DE441), observer quantity 31:
  the geocentric (`500@399`) apparent ecliptic longitude of date, with
  light-time, gravitational deflection and stellar aberration, airless, on a
  TT clock. Mars to Pluto are their system barycentres (NAIF 4 to 9), as the
  conformance suite's L1 arbiter takes them.
- **True node.** The ascending node of the Moon's osculating orbit, from
  Horizons DE441 geometric geocentric state vectors in ICRF: `h = r × v`,
  rotated into the true ecliptic and equinox of date with ERFA's `pnm06a` and
  the true obliquity, and the node's longitude is that of `z × h`. Its speed is
  a central difference over ±0.001 day.
- **Angles and houses.** ERFA 2.0.1 through pyerfa 2.0.1.5: apparent sidereal
  time `gst06a` (IAU 2006/2000A) and the true obliquity `obl06` plus the
  nutation in obliquity of `nut06a`. The ascendant, midheaven and Placidus
  cusps follow the conformance suite's L2 construction, copied into
  `tools/geometry.py` from zodiacs-org/engine commit `8c4946b1`
  (`conformance/arbiters/l2/build.py`, CC0 1.0). Where the absolute latitude
  is 90° minus the true obliquity or more, Placidus has no cusps; the
  reference records that and gives whole-sign cusps from the ascendant, which
  is the product's fallback.
- **Events.** Return, station and crossing instants are roots of the Horizons
  longitude, interpolated from a uniform TT table with a nine-point Lagrange
  polynomial and refined by bisection to 1e-9 day (`tools/series.py`). Each
  band is the connected set, on the root's monotonic branch, where the
  longitude is within the policy's budget of its level, padded by one second.
  A band that reaches a turning point or a query end stops the build as
  ill-conditioned rather than being clipped.

Transit windows use the A–I cases' 3° orb and budgets. Their components,
threshold and exact bands, closest-approach envelopes (the connected set
within `e_min + 2B`) and crops are rebuilt on the Horizons longitude. Uranus
turns 0.0442° from the D target in its second period, inside the 0.05°
budget, so that period keeps an uncertain exact topology: a possible-exact
region (`e ≤ B`) and a possible-minimum region (`e ≤ 2B`), as the v6 policy in
[`../transit-windows/`](../transit-windows/) defines them, and no exact-pass
count.

The lunar pack's `L-wrap` case was born at the first 0° crossing of Swiss's
Moon after 2000-01-01. That instant was Swiss output, so the carried-over
policy takes the first 0° crossing of the Horizons Moon instead,
2000-01-12T18:48:22.487Z (`python3 tools/build.py select-wrap`), and names the
Horizons response it came from. Its cases, interval, scan contract, gates and
conditioning are the Swiss policy's, which it names with its SHA-256; its
arbiter, clock and product-model disclosure describe Horizons and ERFA.

## Clock

Every reference is evaluated at the engine's own TT for its instant: UT is
the instant, and TT = UT + ΔT from the engine's model (`zodiacs-deltat/1`),
read through astronomy-engine's `MakeTime` with the engine's clock installed
(`tools/engine-clock.ts`). The ERFA angle arbiter of
`../../platform/evidence/engine-beyond-swiss/corpora/angle-grid-erfa.json`
works the same way. So these comparisons measure positions, angles and event
geometry, not the two programs' ΔT; the clock is checked against the IERS in
[`../../platform/evidence/deltat-2026-09-25/`](../../platform/evidence/deltat-2026-09-25/).
UT1 is taken as the instant, as the engine takes it.

The returned-chart references, for the solar return and the seven lunar
charts, are evaluated at the instants the product returned when the
references were built. Nothing else about them comes from the product. The
tests allow those instants to drift by at most 15 seconds before they ask
for a rebuild.

Each file records the engine version and ΔT table it was built against
(`engineClock`), the SHA-256 of every source that made it (`generator`), the
Horizons responses it read (`horizonsManifest`) and the policy that gates it.
`src/lib/engine/independent-references-clock.test.ts` fails when the
installed engine carries a different ΔT model or table from the one a file
records: every reference instant would have moved under it, so a new table
means running `tools/build.py` again and committing the new files and pins.

### Where this clock departs from the policies

The policies were written for Swiss's clock, and the carried-over ones keep
their text. Taking the engine's clock instead changes two things.

- **UTC-labelled cases.** The eight-case policy declares TT − UTC for the
  cases it labels UTC: 64.184 s for E2000 (2000-02-29T12:00Z), 57.184 s at
  the Solar1990 birth and 69.184 s over its 2025 search. The engine takes the
  instant as UT1 and adds its own ΔT, 63.872 s, 56.921 s and 69.137 s there,
  so those references sit 0.312 s, 0.263 s and 0.047 s earlier in TT than the
  policy's clock text: UT1 − UTC on those days, which the engine does not
  apply. At the Moon's half an arcsecond per second that is at most 0.17″,
  against a Moon gate of 0.15° and a planet gate of 0.05°.
- **Event times.** A return, station or crossing is found on TT and carried
  back to UT with the engine's ΔT, so the reference's UTC carries the
  engine's clock, and far from the present, where ΔT is an extrapolation, it
  carries the engine's extrapolation. The event tests therefore check the
  engine's search and positions, not its clock. The clock is checked
  separately: `scripts/deltat-monitor.mjs` compares the engine's ΔT table
  with the IERS values every week, and
  [`../../platform/evidence/deltat-2026-09-25/`](../../platform/evidence/deltat-2026-09-25/)
  records how closely they agree.

## Rebuilding

Every Horizons response the build reads is kept byte for byte in
`horizons/`, with its query, retrieval time and SHA-256 in
`horizons/MANIFEST.json`, so a rebuild needs no network and gives the same
bytes. From this directory, with pyerfa 2.0.1.5 installed and the
repository's `node_modules` present:

```sh
python3 tools/build.py             # the four reference files, from the kept responses
python3 tools/build.py --refresh   # ask Horizons again and keep the new responses
python3 tools/build.py select-wrap # print the L-wrap birth the policy records
```

The tests pin each reference file's SHA-256. A rebuild that changes a file
fails those pins until they are updated in the same commit, which is the
point: a new reference is a reviewed change.

## What this does not establish

- Horizons and ERFA are independent of Swiss Ephemeris and of this engine's
  code, not of the JPL development ephemerides the engine's reference
  measurements already share. Agreement is still two implementations
  agreeing.
- The Moon here has Horizons' light-time and aberration and the engine's Moon
  has neither; the eight-case and lunar policies disclose that, and their
  0.15° Moon gates are unchanged.
- The cases are the packs' finite cases. They do not certify every date.
