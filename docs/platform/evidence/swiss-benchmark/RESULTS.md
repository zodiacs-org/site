# Zodiacs against Swiss Ephemeris, and one prototype — measured 2026-09-20

Configuration, checksums and the convention-matching evidence are in
[`CONFIGURATION.md`](CONFIGURATION.md). Licensing is in
[`LICENSING.md`](LICENSING.md). The corpus was written before any number was
taken and is committed beside the results.

## This is not the first Swiss comparison here

`docs/engine-validation/` already holds four Swiss Ephemeris 2.10.03 / DE441
validation packs — node/polar, eight epoch-and-station cases, lunar return and
transit windows — with pre-declared gates, byte-hashed oracles acquired before
any application comparison, and an extractor that performs no calculation of
its own. That work is older, independent of this, and stands.

What it does is different from what this directory does, and the distinction is
worth stating rather than blurring:

- those packs are **pass/fail gates** on specific, carefully chosen cases; they
  answer "did the engine stay inside its declared tolerance here?";
- this directory reports a **distribution** over a stratified corpus, which
  answers "how far apart are the two implementations, typically and at worst?",
  and gives a baseline a prototype can be measured against.

Neither supersedes the other. Anything below that reads like a first result is
a first result *for the distribution*, not for Swiss comparison at Zodiacs.

## What is being measured, and what it cannot show

Ecliptic longitude, apparent geocentric, of date, tropical — the convention the
Zodiacs receipt declares, matched on the Swiss side and verified by toggling
each effect rather than assumed.

Both implementations descend from JPL development ephemerides. **Agreement
between them is consistency, not independent observational accuracy.** Nothing
here was checked against an observation, so nothing here establishes that
either is physically more correct. Every figure below is a disagreement with a
reference, and that is all it is.

Every Swiss call recorded which ephemeris actually answered it. All runs report
`SWIEPH`; none fell back to Moshier. Before the `.se1` files were fetched, the
same code recorded `MOSEPH` while `FLG_SWIEPH` was requested — which is exactly
why the check exists.

## Baseline: the shipped engine against Swiss

18 cases x 10 bodies = 180 measurements, no exclusions.

| | max | p50 | p95 |
| --- | --- | --- | --- |
| `@zodiacs/engine` 0.1.1-rc.6 | 159.379″ | 1.884″ | 14.903″ |

By stratum, the shape matters more than the headline:

| stratum | n | max | p50 | p95 |
| --- | --- | --- | --- | --- |
| future | 20 | 159.379″ | 7.279″ | 69.499″ |
| historical | 30 | 18.638″ | 2.222″ | 16.767″ |
| ordinary | 60 | 17.403″ | 1.150″ | 12.082″ |
| unknown-time | 10 | 15.755″ | 2.834″ | 13.077″ |
| polar | 20 | 14.892″ | 1.474″ | 8.939″ |
| boundary | 20 | 11.512″ | 1.442″ | 11.417″ |
| geometry | 20 | 11.101″ | 1.823″ | 11.101″ |

For ordinary modern charts the median disagreement is about 1.2 arcseconds.
A zodiac sign is 108 000 arcseconds wide, so this is nowhere near a visible
difference in an astrological reading; it matters for claims about the engine,
not for anyone's chart.

## The finding that changed the experiment

The far-future stratum looked like an ephemeris problem and was not.

At 2100-01-01 the Swiss ΔT model gives 93.18 s and astronomy-engine's gives
202.65 s — they disagree by 109.5 s. The Moon moves about 0.549″/s, so that
alone displaces it by 60.1″. The shipped core's residual at that case is
64.768″, so ΔT accounts for about 93% of it and roughly 4.7″ is something else
— close to the largest non-future Moon residual in the whole set (5.17″), which
is where an unexplained few arcseconds would be expected to sit. ΔT past the
observed record is an extrapolation of the Earth's rotation, which is not
predictable; two models diverging there is a **time-scale convention
difference, not an algorithmic defect**, and neither model is "wrong".

Pinning **the prototype's** TT to the reference's own ΔT collapses the
prototype's 2100 case from 63.887″ to −0.025″. That is a statement about the
prototype, not about the shipped engine: the shipped engine was never re-run
with a pinned ΔT, and subtracting the prototype's improvement from its own
residual would put it near 0.9″ rather than near zero. The comparison below is
therefore reported both ways, and both ways are the prototype.

*Correction, 2026-09-23.* "Neither model is wrong" holds only past the
observed record. Today ΔT is measured, and astronomy-engine's formula reads
75.497 s on 2026-09-22 where the IERS value is 69.196 s: 6.3 s, or 3.46″ of
Moon at its mean rate. See
[`../deltat-2026-09-23/values.json`](../deltat-2026-09-23/values.json).

The 2190 case (159.379″) has no such decomposition. It falls outside DE440s
coverage, so it was excluded from the prototype and could not be ΔT-pinned; the
same mechanism plainly dominates there, but that is an expectation rather than
a measurement and is not counted as established below.

One figure in this section still has no committed report of its own and is
transcribed from the run: the Swiss ΔT of 93.18 s at 2100. (astronomy-engine's
202.65 s is reproducible offline — `A.MakeTime('2100-01-01Z')`; the Swiss side
needs the provider.)

The `prototype, engine ΔT` row no longer belongs on that list. Its original
comparator output was recovered from the run directory and committed as
`../precision-2026-09-20/raw/recovered-report-proto-engine-deltat.json`.
Reading it back corrected this table: the p95 was transcribed as 1.834″ where
the comparator wrote **1.8636″**.

## Prototype: JPL DE440s positions, same reduction

The isolated change is one thing — where positions come from. Light-time,
aberration and the rotation into the true ecliptic of date are held fixed and
reuse the same astronomy-engine machinery the production core uses, so a
measured difference is attributable to the series. Source: `de440s.bsp`,
31.21 MiB, JPL/NAIF, public domain. No Swiss code, data or output was used as
an input; Swiss is only the instrument.

Matched subset, 160 measurements (the two cases outside DE440s coverage are
excluded from **both** sides, so the denominators are equal):

| configuration | max | p50 | p95 |
| --- | --- | --- | --- |
| current core rc.6 | 64.768″ | 1.6651″ | 12.082″ |
| prototype, engine ΔT | 63.887″ | 0.0823″ | 1.8636″ |
| prototype, ΔT matched to the reference | **0.134″** | **0.0383″** | **0.117″** |

Every percentile in this file is `compare.mjs`'s own interpolating quantile.
An earlier revision of the two core rows took the floor order statistic
instead while the prototype rows beside them were interpolated — two
conventions in one table, both labelled p95, which understated the core by
0.005″ here and by 0.17″ in the holdout table below.

Holdout — six cases never looked at while the prototype was being built, and
never used to tune anything. 40 matched measurements:

| configuration | max | p50 | p95 |
| --- | --- | --- | --- |
| current core rc.6 | 17.288″ | 1.6141″ | 14.010″ |
| prototype, ΔT matched | **0.157″** | **0.0951″** | **0.150″** |

The holdout reproduces the measurement set. Nothing was re-tuned between them.

Those 40 rows are the DE440s-matched subset, and that exclusion exists for the
prototype's sake, not the core's. On all 60 holdout rows the shipped core is
**max 107.940″, p50 2.294″, p95 14.358″** — the maximum being the Moon at 2150,
a third far-future case of the same kind as 2100 and 2190. It is stated here
because a reader comparing engines wants the matched denominators, and a reader
asking how far the shipped engine can be wrong wants this number, and the
matched table alone understates it sixfold.

## Resource cost

Ten bodies per iteration, 200 repetitions, data acquisition excluded from every
timed kernel.

| | current core | prototype |
| --- | --- | --- |
| warm, 10 bodies, p50 | 0.157 ms | 0.324 ms |
| warm, 10 bodies, p95 | 0.316 ms | 1.071 ms |
| cold start incl. first chart, p50 | — | 1.694 ms |
| data transfer | 0 | 31.21 MiB |
| process RSS after run | — | 63.57 MiB |

**The prototype is about 2.1× slower per chart and costs 31 MiB of data it must
obtain from somewhere.** That is the price of the accuracy column above. It is
not a free win and must not be presented as one.

## What this does and does not establish

Established:

- With the time scale matched, DE440s positions plus the existing reduction
  agree with the full Swiss configuration to **0.16″ worst case** across 200
  measurements spanning two independent sets, against 64.8″ for the shipped
  core.
- At 2100, about 93% of the shipped engine's 64.768″ disagreement is ΔT model
  divergence rather than ephemeris error: the two ΔT models are 109.5 s apart
  and the Moon moves 0.549″/s, which is 60.1″ of it. Anyone reporting that
  residual as an accuracy gap would be wrong about its cause. The same
  mechanism is expected to dominate at 2150 and 2190 and was not measured
  there, so those two are not part of this claim.
- The improvement costs 2.06× compute at the warm p50 and 3.39× at the warm
  p95, plus 31 MiB of data. Quoting only the p50 ratio flatters it.

Not established, and not claimed:

- That the prototype is **physically** more accurate. It agrees better with
  Swiss. Both descend from JPL. Demonstrating physical accuracy needs
  independent observations, which were not used.
- Anything outside 1850–2150. DE440s does not cover it; two corpus cases and
  two holdout cases were excluded for exactly that reason and are named in the
  committed reports.
- Anything about gravitational deflection. The prototype does not apply it —
  a stated convention, not an oversight. It reaches ~1.7″ only at the solar
  limb and is well under 0.05″ away from the Sun, which is consistent with the
  0.13–0.16″ floor observed.
- Any latency claim against Swiss. Swiss was run through a Python binding in a
  separate process; that difference is language and binding overhead, not
  algorithm, and no cross-language timing is reported here.

## Recommendation

This supports a recommendation, not an adoption. The prototype is an
experiment; it is not wired into the site, the default bundle, the schemas or
any saved record, and production chart values are unchanged.

If it were ever adopted it would have to be as an **optional** backend, because
31 MiB cannot go into a browser bundle whose budget is measured in kilobytes,
and because fetching a data pack on demand would reveal a date range to whoever
serves it — which an interface advertised as device-only must not do silently.
Gates for that conversation are in [`NEXT.md`](NEXT.md).

## Addition, 2026-09-23: every tenth day, 1800 to 2199

The 180 measurements above are dates picked in advance, and a picked date can
miss a body's worst moment. The engine audit's completeness critic first ran
the comparison densely (`../engine-audit-2026-09-22/CRITIC.md`);
[`multiyear-1800-2199.json`](multiyear-1800-2199.json) is that run again,
committed as statistics without its per-instant Swiss values, by
`tools/multiyear-zodiacs.mjs` and `tools/multiyear_swiss.py` in the
configuration above: every tenth day from 1800 to 2199 at noon UTC, the ten
bodies and the true node, 14,610 instants, every Swiss call answered from the
`.se1` files.

| longitude, all eleven bodies | median | 95th percentile | largest |
| --- | ---: | ---: | ---: |
| to 2026, same UT (91,201) | 1.94″ | 11.90″ | 22.96″, Venus 1878 |
| 2027–2199, same UT (69,509) | 5.55″ | 65.63″ | 183.12″, Moon 2199 |
| to 2026, same TT | 1.96″ | 11.90″ | 22.92″, Venus 1878 |
| 2027–2199, same TT | 2.19″ | 15.03″ | 29.12″, Pluto 2199 |

The sample's 18.64″ was not the worst up to 2026: Venus reaches 22.96″ in
1878. Beyond 2026 the same-UT figures are mostly the clock: at the same TT the
Moon stays within 7.15″ from 2150 to 2199, where at the same UT it reaches
183.12″. The file has each body by half-century.

Run again on 2026-09-24 with 0.1.1-rc.7, which changed no positions: all
14,610 position lines matched rc.6's byte for byte, the statistics came out
identical, and the file now names rc.7 and that dump's digest.

## Addition, 2026-09-25: engine rc.8's clock

`@zodiacs/engine` 0.1.1-rc.8 computes on observed ΔT (model
`zodiacs-deltat/1`, `../deltat-2026-09-25/`) where rc.6 and rc.7 used
astronomy-engine's 2004 polynomial. Positions at a given TT are unchanged;
every chart's TT, and so every position at a given UT, moved. Both
comparisons were run again on the vendored rc.8, in the configuration above,
with every Swiss call answered from the `.se1` files.

The 180 measurements, by `tools/dump-zodiacs.mjs`, `tools/dump_swiss.py` and
`tools/compare.mjs`, are [`report-measure-rc8.json`](report-measure-rc8.json);
`report-measure.json` stays as rc.6's run, the one the tables above describe.

| longitude | median | 95th percentile | largest |
| --- | ---: | ---: | ---: |
| all 180, rc.6 | 1.884″ | 14.903″ | 159.379″, Moon 2190 |
| all 180, rc.8 | 1.649″ | 12.627″ | 24.770″, Pluto 2190 |
| the 160 from 1801 to 2026, rc.8 | 1.6″ | 12.1″ | 18.6″, Pluto 1801 |
| the Moon's 16 from 1801 to 2026, rc.6 | 1.1″ | | 5.2″ |
| the Moon's 16 from 1801 to 2026, rc.8 | 0.9″ | | 7.6″, 1801 |

The two far-future Moon cases fall from 64.8″ to 7.5″ at 2100 and from
159.4″ to 15.3″ at 2190: the model reads ΔT at 2100 as 78.93 s with a 1-σ of
42.39 s, where rc.7 read 202.65 s and Swiss 93.18 s. No measurement exceeds
one arcminute. The Moon at 1801 moves from 5.2″ to 7.6″, as amendment A2 of
the preregistration said it would before 1955: rc.7's ΔT error there partly
offset the analytic Moon's own.

The every-tenth-day comparison, [`multiyear-1800-2199.json`](multiyear-1800-2199.json),
now holds rc.8's run; `tools/multiyear-zodiacs.mjs` installs the engine's
clock before it reads the engine's TT.

| longitude, all eleven bodies, rc.8 | median | 95th percentile | largest |
| --- | ---: | ---: | ---: |
| to 2026, same UT (91,201) | 1.96″ | 11.90″ | 22.92″, Venus 1878 |
| 2027–2199, same UT (69,509) | 2.87″ | 15.42″ | 29.10″, Pluto 2199 |
| to 2026, same TT | 1.96″ | 11.90″ | 22.92″, Venus 1878 |
| 2027–2199, same TT | 2.19″ | 15.03″ | 29.12″, Pluto 2199 |

From 2150 to 2199 the Moon is within 7.15″ at the same TT and 20.47″ at the
same UT, where rc.7 reached 183.12″. By half-century the Moon's median at the
same UT moves from 4.78″ to 6.60″ over 1800–1849 and from 2.64″ to 0.67″ over
2000–2049; the file has every body by half-century.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the
per-row differences left the five `report-*.json` here: 180 rows each in
`report-measure.json` and `report-measure-rc8.json`, 60 in
`report-holdout-core.json`, 40 in `report-holdout-prototype.json` and 160 in
`report-prototype-matched.json`. Their aggregates (overall, by body, by
stratum, and the excluded list) stay, and each file records the SHA-256 of
the rows it lost under `swissOutputRemoved`. `report-measure-rc8.json` also
gained a `statistics` block: the figures the site's copy states, computed
from its rows by the formulas its tests used, before the rows went. Commit
`2ca93d41` still has the rows, and `tools/` regenerates them as above. The
figures in this file are unchanged. `prototype/spk.test.mjs` no longer pins
Swiss's ΔT at 2100; it pins a round 90 s. The record of everything removed is
[`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
