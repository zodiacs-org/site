# What has been measured about this engine, and what has not

One page for a question that was answered in five places. Each section below
says what was measured, against what, what came out, and — the part that
matters most — what the result does not establish.

Read it with one thing in mind: **every position comparison here is against
another program, not against the sky.** No position in this directory was
checked against an observation. The one observed quantity used is the Earth's
rotation: ΔT, which the engine's clock takes from the IERS and US Naval
Observatory records since 0.1.1-rc.8, and which section 1 checks against the
IERS values. It checks the clock rather than a position.

The shared lineage is real but not uniform, and the difference matters for the
two bodies that produce the extremes below. Swiss Ephemeris and JPL Horizons
read JPL development ephemerides directly. Astronomy Engine's planets come
from VSOP87, whose lineage runs back to DE200 — so for those, agreement is
largely consistency rather than corroboration. Its Moon does not: that is the
Nautical Almanac Office's *Improved Lunar Ephemeris*, from E. W. Brown's
analytic theory, which predates the DE series. Its Pluto is a custom
integrator, because VSOP87 has no Pluto model. Moon and Pluto are therefore
less derivative of the reference than the rest, which makes their residuals
more informative rather than less — but it is still one implementation against
another, and none of it is an observation.

Software under test: `@zodiacs/engine` (the site runs the same package;
`src/lib/engine/package-integration.test.ts` pins the two to one version).
Its positional series come from [Astronomy
Engine](https://github.com/cosinekitty/astronomy) by Don Cross, MIT, built on
VSOP87 and NOVAS with the Nautical Almanac Office's *Improved Lunar
Ephemeris* for the Moon. Zodiacs did not write those models.

| dimension | measured against | result | where |
| --- | --- | --- | --- |
| Positions | JPL Horizons vectors, in-suite (provider version unrecorded) | 14.77″ worst | `src/lib/engine/engine.test.ts` |
| Positions | Swiss 2.10.03 / DE441, 6 frozen cases | 6.07″ node longitude | [`swiss-node-polar/`](swiss-node-polar/) |
| Positions | Swiss 2.10.03 / DE441, 8 epoch and station cases | inside frozen gates (a pass, not a residual) | [`swiss-eight-cases/`](swiss-eight-cases/) |
| Positions | Swiss 2.10.03 / `.se1`, 180-measurement distribution | 18.64″ within 1801–2026 | [`../platform/evidence/swiss-benchmark/`](../platform/evidence/swiss-benchmark/) |
| Positions | Swiss 2.10.03 / `.se1`, every tenth day 1800–2199, ten bodies and the true node | 22.92″ to 2026 at the same UT (Venus, 1878); 29.12″ to 2199 at the same TT (Pluto) | [`multiyear-1800-2199.json`](../platform/evidence/swiss-benchmark/multiyear-1800-2199.json) |
| Clock (ΔT) | IERS EOP 20 C04 and finals2000A, twelve preregistered dates and every day from 1962 | 0.031 s on the twelve dates; 0.083 s worst day | [`../platform/evidence/deltat-2026-09-25/`](../platform/evidence/deltat-2026-09-25/) |
| Angles and houses | Swiss `houses_ex`: three polar cases and five Placidus cases in the suite; the audit's latitude grid | 1.58″ worst angle and exact whole-sign cusps in the polar cases; ascendant within 6.4″ of an ERFA arbiter on the grid since rc.7 (up to 512″ near 66° before) | [`swiss-node-polar/`](swiss-node-polar/), [audit](../platform/evidence/engine-audit-2026-09-22/LEDGER.md) |
| Houses, twelve systems | Swiss 2.10.03 `swe_houses_armc` given the same sidereal time, latitude and obliquity: a 5,616-case ladder from 55° to 66.6° and 20,000 draws over every latitude; `swe_houses_ex` end to end | 0.0096″ given the same inputs (Placidus; the other eleven 0.00005″ or less); end to end from 1850 to 2049, 1.95″ broad and one Koch case of 353 on the ladder at 3.73″ | [`../platform/evidence/houses-2026-09-26/`](../platform/evidence/houses-2026-09-26/) |
| Local time | host IANA/ICU, two Node majors and a browser | no disagreement in the cases run (a pass, not a residual) | [`../platform/evidence/site-engine-rc6/`](../platform/evidence/site-engine-rc6/) |
| Event search | Swiss hourly scans, independent roots | one contract **failed-incomplete** | [`transit-windows/`](transit-windows/), [`swiss-lunar-return/`](swiss-lunar-return/) |
| Runtime support | Node 22.22.2 and Node 24.21.0 for rc.9, rc.8 and rc.7; Node 22.23.2, Node 24.19.0 and Chrome 152 for rc.6 | parity in the cases run (a pass, not a residual) | [`../platform/evidence/site-engine-rc9/`](../platform/evidence/site-engine-rc9/), [`../platform/evidence/site-engine-rc8/`](../platform/evidence/site-engine-rc8/), [`../platform/evidence/site-engine-rc7/`](../platform/evidence/site-engine-rc7/), [`../platform/evidence/site-engine-rc6/`](../platform/evidence/site-engine-rc6/) |

## 1. Positions

**In-suite JPL gate.** `src/lib/engine/engine.test.ts` compares apparent
geocentric true-of-date ecliptic longitudes against JPL Horizons vectors
(`QUANTITIES='31'`, `CENTER='500@399'`) at 2020-01-01 and 1907-07-06. Measured
residuals, not the gates:

```
2020-01-01  Neptune 14.77"  Jupiter 4.06"  Uranus 3.06"  Saturn 1.93"
            Mars 1.34"  Pluto 0.74"  Venus 0.52"  Moon 0.51"
            Sun 0.05"  Mercury 0.02"
1907-07-06  Mars 6.25"  Moon 2.35"  Sun 0.67"
```

The gates themselves are looser than that on purpose: 0.05° for planets, 0.15°
for the Moon, 0.2° for the 1907 Moon. They are engineering acceptance limits
chosen to fail loudly on a real regression, not claims about typical error.

**Frozen Swiss packs.** All four directories here hold Swiss Ephemeris 2.10.03
oracles acquired through pinned, unmodified pyswisseph 2.10.3.2 against the
official DE441 files, with an acceptance policy each pack records as written
and reviewed *before* the application was run, byte-hashed inputs, and
extractors that perform no calculation of their own. The order is the packs'
own record: the 2026-09-22 audit found the policies and fixtures first
committed together, so it could not confirm it independently. The node/polar pack's measured maxima were
0.001685457° (6.07″) in node longitude, 0.000350604°/day in node speed, and
0.000434825° (1.57″) in polar angles — recorded against `@zodiacs/engine`
0.1.0, not the rc.6 named at the top of this page. The fixtures are frozen and
the current suite still passes them, but those maxima are that run's.

**The distribution.** [`swiss-benchmark/`](../platform/evidence/swiss-benchmark/)
answers a different question from the packs: not "did this case stay inside its
gate" but "how far apart are the two implementations, typically and at worst".
The corpus is 180 measurements, declared before any number was taken. On
0.1.1-rc.8 (2026-09-25, `report-measure-rc8.json`), over the 160 between 1801
and 2026 the median longitude disagreement is 1.60″, the 95th percentile
12.09″ and the worst 18.64″ (Pluto, 1801). Over all 180, which brings in the
far-future cases below, it is 1.65″, 12.63″ and 24.77″. Each set is quoted
with its own denominator, because mixing them is how a distribution gets
flattered.

**The dense run.** Dates picked in advance can miss a body's worst moments,
so the same configuration was run every tenth day from 1800 to 2199 at noon
UTC, for the ten bodies and the true node
([`multiyear-1800-2199.json`](../platform/evidence/swiss-benchmark/multiyear-1800-2199.json),
statistics only, by `tools/multiyear-zodiacs.mjs` and `tools/multiyear_swiss.py`
beside it), first on 2026-09-23 and again on rc.8. Up to 2026, at the same
UT, the 91,201 longitudes have a median difference of 1.96″, a 95th
percentile of 11.90″ and a largest of 22.92″ (Venus, 1878), where the sample's
worst was 18.64″. At the same TT, which takes the clock out, the largest over
the whole span is 29.12″ (Pluto, 2199), and the Moon stays within 7.15″ from
2150 to 2199, where at the same UT it reaches 20.47″: past the IERS
predictions the two programs' clocks are two extrapolations.

None of the 180 exceeds one arcminute on rc.8. The far-future Moon is 7.5″
from Swiss at 2100 and 15.3″ at 2190, and the clock is still most of it: the
two programs extrapolate ΔT past the IERS predictions differently — Swiss
93.18 s at 2100, the engine 78.93 s with a 1-σ of 42.39 s, 14.25 s apart — and
the Moon moves about 0.549″ per second of time, 7.8″ for that gap. Up to rc.7
the engine's clock read 202.65 s at 2100, and two of the 180 exceeded one
arcminute, both the Moon: 64.8″ at 2100 and 159.4″ at 2190. Pinning ΔT to the
reference collapsed **the DE440s prototype's** 2100 case from 63.887″ to
−0.025″; the shipped engine was never re-run that way, and the same correction
would land near 0.9″ rather than near zero. The 2150 and 2190 cases were never
decomposed — they fall outside DE440s coverage. Reporting any of these
residuals as an ephemeris error would be wrong about the cause.

*Correction, 2026-09-23.* "A clock difference" is right about the far future
and silent about the present, where ΔT is measured. The formula the engine uses
(astronomy-engine's `DeltaT_EspenakMeeus`) reads 75.497 s on 2026-09-22 where
the IERS value is 69.196 s, 6.3 s ahead and growing about 1.2 s a year; at the
Moon's mean rate that is 3.46″ today. The values, for 2017, 2020, 2024 and
2026, and the script that derives them from the IERS finals file are in
[`../platform/evidence/deltat-2026-09-23/`](../platform/evidence/deltat-2026-09-23/).
Step 1.4 of the engine brief replaces the formula with observed ΔT.

*Addition, 2026-09-25.* It has. From 0.1.1-rc.8 the engine's ΔT is model
`zodiacs-deltat/1`: Stephenson, Morrison and Hohenkerk's 2016 reconstruction
to 1941, US Naval Observatory and IERS records after it, the IERS Bulletin A
predictions, then an extrapolation whose 1-σ band grows with the years. It
reads 69.20 s on 2026-09-22, and from 1962 to 2026-09-24 it is within 0.084 s
of the IERS value on every day (RMS 0.022 s); every chart returns its value,
band and table. The model, its sources and the gates it was held to before any
code are in
[`../platform/evidence/deltat-2026-09-25/`](../platform/evidence/deltat-2026-09-25/).
Before about 1955 the Moon moves further from Swiss at the same UT than it
was — a median of 3.9″ rather than 2.9″ over 1850–1899 — because rc.7's clock
error there partly offset the analytic Moon's own; that is the Moon's error,
now shown whole.

**Neptune is the worst modern body in both comparisons** — a single-epoch
14.77″ against Horizons, a median of 11.5″ against Swiss. Those are different
statistics and should not be read as one number seen twice, and the two
references are not independent of each other, so this is not two witnesses
agreeing. What it suggests, weakly, is a truncated outer-planet series rather
than a convention mismatch, since a convention error would not single out one
planet. Neptune is not the worst body overall: in the 180 on rc.8, Pluto
reaches 24.77″ and the Moon 15.34″, both at 2190.

Not established: that any of this is observational accuracy, or that the
residuals hold between the epochs measured. The measured span is 1801–2026
densely for the distribution plus three point epochs (1800, 2000, 2199) in the
eight-case pack — the range zodiacs.org accepts is touched at its edges and
sampled sparsely in between, which is not the same as measured across it.

And the package bounds nothing. `1800–2199` is this site's own form validation
(`src/lib/share.ts`, `src/lib/engine/transit-window-core.ts`); `natalChart`
will compute year 900 or year 3500 and return a chart with no error. Nothing
here says anything about those, and since rc.8 the chart says so: outside
1800–2200 it carries the `outside-reference-span` flag.

## 2. Angles and houses

Swiss `swe.houses_ex(jdUT1, lat, lon, b'W', 0)` at Tromsø, Longyearbyen and
Longyearbyen's southern mirror: measured angle residual 0.000439812° (1.58″)
with rc.7 and rc.8 and 0.000434825° (1.57″) with engine 0.1.0 when the pack
was frozen,
and every whole-sign cusp matched exactly. The suite's five Placidus cases, at
latitudes up to 60.2°, pass gates of 0.1° for ASC/MC and 0.2° for cusps. The
2026-09-22 audit measured more widely: on its latitude grid the ascendant was
up to 512″ off near 66° and 22″ at the 95th percentile, because the engine
paired apparent sidereal time with the mean obliquity (finding
angles-houses-aspects-1; step 1.3 of the engine brief). Since 0.1.1-rc.7 it
uses the true obliquity of date. On the preregistered 3,128-case grid against
an ERFA arbiter the ascendant is within 6.36″, 0.24″ at the 95th percentile and
0.36″ within 45° of the equator (`scripts/angles-grid.test.mjs`).

Placidus is where the two programs deliberately differ. At 90° minus the
obliquity or more, about 66.56° absolute latitude, Swiss returns C status −1
and its conventional Porphyry fallback array. Since rc.7 this engine refuses
Placidus at the same limit, but falls back to **whole sign** and sets
`polar-fallback`; up to rc.6 it fell back above 66°.
Both behaviours are compared against the same Swiss `W` tuples, so the
fallback is checked rather than excused.

Since rc.9 the engine offers twelve systems. Koch, Regiomontanus, Campanus,
Topocentric (Polich–Page), Alcabitius, Equal, Vehlow, Meridian (axial
rotation) and Morinus join whole sign, Placidus and Porphyry, each following
the definition Swiss uses. The 2026-09-26 record measures them against Swiss
in two ways:

- **Given the same inputs.** Each system and Swiss's `swe_houses_armc` get the
  same sidereal time, latitude and obliquity. Every system agrees to 0.0096″
  or better: Placidus, which iterates, reaches 0.0096″, and the other eleven
  0.00005″ or less. That covers a 5,616-case ladder from 55° to 66.6° in both
  hemispheres and 20,000 draws over every latitude. Polar status agrees in
  every case.
- **End to end.** Each side computes from a UTC instant with its own sidereal
  time and obliquity. From 1850 to 2049, where the two programs' sidereal
  times agree, eleven systems are within 3″ of `swe_houses_ex`. Koch reaches
  3.73″ in one ladder case of 353, at 65.6° N. Given Swiss's own inputs there,
  it agrees to 0.0000000004″, so the 3.73″ is Koch magnifying a small input
  difference near the polar circle.

Koch, like Placidus, is undefined inside the polar circle; it falls back to
whole sign with `polar-fallback`. There Regiomontanus, Campanus, Topocentric,
Equal and Vehlow turn with the ascendant, as Swiss's do.

Outside 1850–2050 Swiss's sidereal time switches to a long-term model. At 2051
it is 1.908″ from ERFA's IAU 2006/2000A value, where the engine's is within
0.113″ at every date sampled from 1820 to 2190. End-to-end differences there
measure that model rather than the houses
([`houses-2026-09-26/`](../platform/evidence/houses-2026-09-26/README.md)).

Not established: exact geographic poles and degenerate horizon intersections
remain outside verified scope; Swiss's house model is itself a convention, so
cusp agreement is convention agreement. The package and the MCP adapter offer
all twelve systems; the site's own forms still offer whole sign and Placidus.

## 3. Local time

`@zodiacs/engine/geo` resolves a local wall time and IANA zone through the
host's `Intl`/ICU data — never a hand-rolled offset table — and so does the
site's `src/lib/time/localToUtc.ts` from 1970 on and wherever no birthplace is
given; before 1970 the site reads the pinned tables described below. The
2026-09-22 audit counted 326 tests on that path; more have been added since. The rc.6 evidence ledger
records 16 historical receipts that became valid under the seconds-and-
milliseconds comparison correction, nine civil controls that stayed valid, and
96 rc.5/rc.6 chart comparisons preserving every value but the version field,
executed on two Node majors and again in Chrome 152 offline.

Conventions, stated rather than implied: a spring-forward gap shifts forward;
a fall-back fold selects the earlier instant; both are flagged. The engine
audit's all-zone round-trip scan is a test
(`src/lib/time/localToUtc-roundtrip.test.ts`): every offset change the host
knows in every zone, with the wall minutes around each compared against a
brute-force reading of every nearby offset. By default, as CI runs it, it
covers 1850 to 2037, steps two weeks to find changes and tests each edge and
midpoint: 26,403 changes and 184,817 wall minutes on Node 22.22 (ICU 78.2,
tzdata 2025c). `TZ_SCAN=full` repeats the audit's scope, 1850 to 2100 with a
daily step and wider sampling: 42,861 changes and 1,675,757 wall minutes in
418 zones. Neither finds a disagreement. Offsets with
seconds survive (Mexico City's −6:36:36 before 1922 is a live case).

Since 2026-09-23 the site, though not `@zodiacs/engine/geo`, reads a birth
from before its place adopted a legal time on the birthplace's own local mean
time: 240 seconds of time per degree of longitude, rounded to the second. The
time zone data records mean time only for each zone's reference city, so a
Buffalo birth in 1870 had been read on New York's clock, 19 min 29 s early. The
date each zone's local mean time ended comes from a table generated from a
pinned tzdb release, 2025c, with backzone (`src/data/tz-lmt.json`, by
`scripts/build-tz-lmt.mjs`), and the legal offsets after it come from the same
release (next paragraph). Checked: the table against that release, by
`node scripts/build-tz-lmt.mjs --check`, which downloads the release and runs
in CI's time zone data drift job, while tests pin ten era ends and the
generator's rules. Tested: every wall minute within 26 hours of sixteen era ends, for
twenty-one towns east and west of the reference meridian, against a separate
model of the birthplace clock, with receipts validated; at each of the 338
era ends (of 518) where the host's history agrees with the table, the zone's
own meridian giving exactly the zone clock's answer around the change; the date-line days of
Alaska, Manila, Pohnpei and Apia inside eras; a bound that ignores a longitude
more than three hours from the zone's mean time. Not established:
agreement with other programs' era ends.

Since the same day, the legal offsets of a birthplace time before 1970 come
from that pinned release too, backzone included (`src/data/tz-history/`, by
`scripts/build-tz-history.mjs`, which compiles it with zic): the host's data
is tzdb's default build, which gives a merged place another city's history
before 1970. For 85 of the 356 zones in the birthplace index the two differ
at some point in the legal time from 1900 to 1970, 55 of them by an hour or
more ([`tz-history-2025c/`](../platform/evidence/tz-history-2025c/));
Stockholm on 1 July 1947 resolves on Sweden's +1:00, not Berlin's +2:00, and
Amsterdam in 1900 on Amsterdam Mean Time's +0:19:32, not Brussels's +0:00.
From 1970 on the host decides. Seventeen names keep the host's history
throughout, none in the birthplace index: sixteen whose pinned history also
differs after 1970, and Asia/Hanoi, which the host does not know.

Not established: which IANA version any given visitor's runtime carries. From
1970 on the history is the host's, so two machines can legitimately disagree
on a birth there. Before 1970, in the zones of the birthplace index, the
offsets no longer come from the host, but the host still decides whether it
knows the zone name at all, whether an unknown-time noon falls on the birth
date, and the offsets of wall times late on 31 December 1969 west of
Greenwich, whose instants fall in 1970. Nor is backzone established as
right: its maintainers call it less reliable than the main data. Signed fixed-offset receipt syntax and exact-pole
coverage are declared limitations, and the separate local-date endpoint
interval and policy defects are recorded as unresolved, not fixed.

## 4. Event search

This is the weakest dimension and the honest place to say so.

[`transit-windows/`](transit-windows/) compares nine A–I cases and 30 aspect
branches against Swiss hourly unwrapped scans with independently refined
roots. It carries a **failure that has not been cleared**: the original v2/v3
Uranus D exact-topology contract remains `failed-incomplete`, its 0.044188°
turning-point margin sits under the original 0.05° model budget, and the
second period's exact-pass count cannot be certified. The v6 re-acquisition
qualified period membership and the alignment region without retiring that.
The second period must be described as having uncertain exact topology.

[`swiss-lunar-return/`](swiss-lunar-return/) checks six lunar-return cases end
to end — complete chronology, selected first event, chart components — against
frozen ±0.15°/±0.30° branches. It also records a real model difference rather
than papering over it: the reviewed `EclipticGeoMoon` path applies no explicit
light-time, aberration or deflection pass, so the two correction paths are
**not** claimed to be identical, only to agree inside the stated budget.

The event times the site publishes were measured against Swiss Ephemeris on
2026-09-23 and again on rc.8's catalog on 2026-09-25
([`events-vs-swiss-2026-09-25/`](../platform/evidence/events-vs-swiss-2026-09-25/)):
from 2026 to 2030, all 124 new and full moons are within 5.2 seconds and the
24 eclipse peaks within 10.5 seconds, the 92 stations within 41 minutes
(Pluto), and the sign changes and exact aspects of Uranus, Neptune or Pluto
within 6.4 hours.
Those slow events are ill-conditioned: a few arcseconds of position error in
an outer planet, or in the ±0.25-day speed estimate the station finder uses,
moves the instant by minutes to hours. The pages state these limits, and
`scripts/claims-bindings.test.mjs` holds the copy to the measurement.

Since rc.8 the package and the site use one longitude-crossing solver
(`@zodiacs/engine/crossings`, and `findLongitudeCrossings` on the engine's own
longitudes). It has no sample budget; `searchLongitudeCrossings` takes an
optional one and refuses a search whole, rather than throwing, when the budget
would be exceeded. Sampling can miss an event between steps, and direction at
a window endpoint rests on one-sided evidence. The solver also examines each
sampled turn of the motion, which finds the grazing passes a coarse step
misses: all 4,941 cases of a station-graze corpus
([`phase1-events/`](../platform/evidence/phase1-events/)), where the plain
sign-change search found 3,627.

Return and year scans stop at the end of 2199, the span the engine is checked
over. A Saturn return search that reaches past it is clipped, so a birth after
about 2108 shows fewer Saturn seasons. The result records the clipping
(`rangeClipped`), but the pages do not yet say so: that notice needs text in
the locale catalogs (step 1.7 of the engine brief).

Not established: complete event discovery. Nothing here is a guarantee that
every event in a window is found; the solver's own documentation says it is
tested, not proven complete.

## 5. Runtime support

ESM only, TypeScript declarations included, no CommonJS export. The manifest
declares Node ≥18. What was actually executed is narrower: for rc.9 and rc.8,
Node 22.22.2 and 24.21.0 for the parity matrix and the public-download
consumer check; for rc.6, Node 22.23.2 and 24.19.0, and Chrome 152 for the browser run,
with thirteen network, storage and cookie observer negative controls showing
zero calls during calculation.

Not established: every Node version the manifest allows, or every browser. A
finite matrix is a finite matrix.

## What none of this is

- Not independent astronomical validation. Every position oracle here is
  another implementation of the same JPL family; the one observed input, the
  IERS value of ΔT, checks the clock rather than a position.
- Not human practitioner certification, and not a review by anyone outside
  this project.
- Not evidence that astrological interpretation is scientifically valid. The
  engine returns geometry; meaning is a separate tradition and is labelled as
  one everywhere it appears.
- Not a claim that the engine is the most accurate available. On the
  measurements here a DE440s-backed prototype, with ΔT matched to Swiss's,
  agrees with Swiss to 0.16″ worst case on the rows inside DE440s's coverage,
  where this engine, on its own ΔT, reaches 17.40″ (Neptune, rc.8; 64.8″, the
  Moon at 2100, up to rc.7). It costs 2.06× the warm p50 runtime — 3.39× at
  the warm p95 — and 31 MiB of data. That prototype has not been adopted and does not
  run in production; its gates are in
  [`swiss-benchmark/NEXT.md`](../platform/evidence/swiss-benchmark/NEXT.md).

## Reproducing any of it

Each subdirectory's README carries its own pinned provider version, file
hashes, acquisition receipts and exact commands. The benchmark directory
carries its corpus, its per-call record of which Swiss backend answered, and
its raw rows.

Three things here are not reproducible from the repository, and naming them is
the point of the rest of it. The JPL Horizons values the suite checks
(`src/lib/engine/fixtures/horizons-reference.json`) record their query, and
the audit's re-fetch on 2026-09-22 (API version 1.2, DE441) matched six of
the seven 2020 values exactly and Neptune to 0.004″, but the provider version
of the original fetch is not recorded, and `swiss-eight-cases/README.md` says
it "remains unknown". The Swiss ΔT of
93.18 s at 2100 was transcribed from a run rather than committed as a receipt;
since 2026-09-25 it is committed with the tool that reads it
(`../platform/evidence/deltat-2026-09-25/outputs/swiss-deltat.json`, by
`tools/moon/swiss_deltat.py`). And the benchmark's
performance table has no committed JSON; its `prototype, engine ΔT` row, which
had none either, was recovered and committed on 2026-09-20
(`precision-2026-09-20/raw/recovered-report-proto-engine-deltat.json`).
Everything else can be re-derived.

## Corrections

Building the claims ledger on 2026-09-23 (step 1.14 of the engine brief)
corrected these published passages in place. Their earlier wording is kept
here as the record:

- the table's angles row: "Swiss `houses_ex`, polar and ordinary" and "1.57″
  worst angle, cusps exact";
- section 1, on the frozen packs: "with the acceptance policy written and
  reviewed *before* the application was run";
- section 2, before the polar figures: "plus ordinary latitudes";
- section 2, on Placidus: "Above 66° absolute latitude Swiss returns C status
  −1";
- section 4: "Each longitude-crossing search caps ephemeris evaluations at
  10,000";
- the prototype, under what none of this is: "agrees with Swiss to 0.16″ worst
  case against this engine's 64.8″ on the same rows";
- the benchmark, under reproducing any of it: "the benchmark's `prototype,
  engine ΔT` row and its performance table have no committed JSON beside the
  four that do".

Vendoring engine 0.1.1-rc.8 on 2026-09-25 corrected these in place, with the
engine's new clock and the re-runs it needed. Their earlier wording is kept
here as the record:

- the introduction: "the IERS value of ΔT, in section 1, which checks the
  engine's clock rather than a position";
- the table's every-tenth-day row: "22.96″ to 2026 at the same UT (Venus,
  1878)"; its runtime row: "Node 22.22.2 and Node 24.21.0 for rc.7";
- section 1, the distribution: "the median longitude disagreement is 1.62″,
  the 95th percentile 12.08″ … Over all 180, which brings in the two far-future
  cases below, it is 1.88″, 14.90″ and 159.38″", measured on rc.6;
- section 1, the dense run: "a median difference of 1.94″ … and a largest of
  22.96″ … where at the same UT it reaches 183.12″: the far-future Moon
  residuals are the clock";
- section 1, the far future: "Two of the 180 exceed one arcminute, both the
  Moon far in the future: 64.8″ at 2100 and 159.4″ at 2190. That is a clock
  difference … 109.5 s apart at 2100 … which accounts for 60.1″ of the 64.8″";
- section 1, on Neptune: "Pluto reaches 25.01″ and the Moon 159.38″";
- section 1, on bounds: "return a chart with no error and no flag";
- section 4, event times: "all 124 new and full moons and 24 eclipse peaks are
  within 14 seconds";
- section 4, the search: "The package's longitude-crossing search
  (`findLongitudeCrossings`) caps ephemeris samples at 10,000 and refuses
  larger requests; the site's own solver has no such cap", and "the cap is a
  sampling bound rather than a time limit";
- section 5: "Node 22.23.2 and 24.19.0 for the parity matrix and the
  public-download consumer check, and Chrome 152 for the browser run";
- the prototype: "where this engine, on its own ΔT, reaches 64.8″ (about 0.9″
  would remain with the same correction)";
- reproducing it: "(astronomy-engine's 202.65 s is reproducible offline)".

Vendoring engine 0.1.1-rc.9 on 2026-09-26 corrected these in place. Their
earlier wording is kept here as the record:

- the table's runtime row: "Node 22.22.2 and Node 24.21.0 for rc.8 and rc.7";
- section 5: "for rc.8, Node 22.22.2 and 24.21.0 for the parity matrix and the
  public-download consumer check".
