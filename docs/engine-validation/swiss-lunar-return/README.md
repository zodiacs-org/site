# Independent lunar-return validation

The engine computes the first geocentric tropical Moon return strictly after
a recorded reference, using the numeric natal Moon longitude of date. The
scan covers `(after, after + 40 days]` with an explicit six-hour step. It does
not advance the natal frame or substitute a lunar phase or mean period.

The six source cases and their numerical gates were frozen and reviewed
before application execution. A standalone Swiss Ephemeris hourly unwrapped
scan retained every crossing in each complete window, independently refined
roots and longitude-derived timing bands, and chart components at precisely
recorded clocks. Tests compare the complete natal-derived chronology, the
selected first event, and independent chart components separately.

## Scope and clocks

The numeric transport interval is `1800-01-02T00:00:00.000Z` through
`2199-12-31T23:59:59.999Z`, inclusive. The latest reference is
`2199-11-21T23:59:59.999Z`, leaving the full 40-day horizon. Birth must be
no later than the reference. The implementation rejects invalid dates,
coordinates, unknown birth time, and supplied `no-time`, `dst-gap` or
`dst-fold` flags. The caller must resolve the original local birth data with
the existing IANA resolver and preserve its flags; a plausible UTC timestamp
alone cannot establish that a cache came from complete birth data.

Modern fixtures use Swiss's checked UTC-to-TT/UT1 conversion, preserving the
intended TT-minus-nominal-UTC offsets of 57.184, 64.184 or 69.184 seconds as
applicable. Historical/future endpoint fixtures use coherent nominal UT1
throughout. Their ISO `Z` strings are millisecond transport, not claims of
exact historical or future civil UTC. Astronomy Engine approximates UTC and
UT1 as equal and uses its own Delta-T model; the oracle is not retimed to it.

The provider is unmodified pyswisseph 2.10.3.2 / Swiss Ephemeris 2.10.03,
using the pinned DE441 files and apparent geocentric tropical position flags
258 (`SWIEPH | SPEED`). Raw C tuples, returned flags, warnings, TT/UT1 clocks,
loaded-file receipts and house results are retained. All 4,460 distinct
primary evaluations and 66 supplemental evaluations are finite, return 258,
and contain no warnings or fallback. The application's reviewed
`EclipticGeoMoon` path has no explicit light-time, aberration or deflection
pass. The two correction paths are not described as identical.

## Frozen acceptance contracts

| Independent comparison | Maximum circular residual / band |
| --- | --- |
| Natal Moon longitude | 0.15 degrees |
| Transit Moon at independent instant | 0.15 degrees |
| Fixed external-target event time | Independently acquired +/-0.15-degree branch |
| Complete natal-derived event time | Independently acquired +/-0.30-degree branch |
| Returned-chart Moon | 0.15 degrees |
| Other planetary longitudes | 0.05 degrees |
| True North Node longitude / speed | 0.1 degrees / 0.02 degrees per day |
| Ascendant and Midheaven | 0.1 degrees |
| House cusps | 0.2 degrees |

The timing bands add one second of formatting allowance. Root brackets are
at most 0.1 seconds wide. Those refinement widths are numerical precision,
not physical accuracy. The product's 0.00001-degree own-target residual is
a separate same-engine solver check. The 0.15-degree Moon budget is an
explicit conservative engineering contract inherited from the site's
positional acceptance gate, not a provider-published accuracy bound or a
budget derived from product residuals. Two endpoint budgets give the
natal-derived 0.30-degree branch.

| Case | First independent event transport | Complete root count | Clock |
| --- | --- | --- | --- |
| L-modern-a | 2026-03-20T23:14:55.358Z | 1 | UTC |
| L-modern-b | 2026-03-12T15:11:55.512Z | 2 | UTC |
| L-wrap | 2026-03-19T04:02:58.391Z | 1 | UTC |
| L-year-boundary | 2026-01-28T08:05:36.208Z | 1 | UTC |
| L-range-start | 1800-01-29T08:53:08.040Z | 1 | nominal UT1 |
| L-range-end | 2199-12-19T09:09:13.298Z | 1 | nominal UT1 |

Modern B's second root is `2026-04-08T23:14:20.202Z`. The wrap natal input
was independently selected before full acquisition as the first Swiss Moon
zero crossing after 2000-01-01, rounded once to
`2000-01-12T18:48:22.048Z`. The selected timestamp's actual Swiss longitude
is retained; it was not replaced with an exact zero. The original candidate
policy, separately authorized preparatory lookup and amended v2 are all
preserved.

All six natal-derived comparisons remain required. Only the three
nonidentity windows (modern A, modern B, wrap) admit the additional fixed
external-target comparison under the pre-output applicability amendment.
For the other three cases, birth equals the reference: the excluded identity
is relative to each model's own natal longitude. Replacing that target with
another model's literal longitude can select a different revolution. Those
three fixed-target identity checks are explicitly **omitted**, not passing
or waived. Their full natal-derived chronology and chart checks still run.

The source-only conditioning audit found six complete 961-sample windows,
seven roots, interior disjoint timing bands and the required nonidentity
endpoint margins. The maximum sampled six-hour motion was 3.785056 degrees;
every first return was within 27.382 days. Modern A/B's source speed contrast
of 2.370532 degrees/day met the diagnostic threshold. These sampled checks
do not prove the whole supported date interval.

## Same-time chart supplement and measured results

After the primary oracle was reviewed, the first product output receipt was
preserved. A separate policy froze its six literal returned timestamps and
the seven original locations, including relocation, before Swiss acquisition
at those clocks. Only timestamps came from the product; all expected
coordinates came from Swiss. The original event-time bands stayed unchanged.
Tests require exact applicability of these chart clocks before comparing
components. A changed solver timestamp needs a separately retained Swiss
supplement, not a shifted house comparison or a tighter event-time claim.

The six natal-derived cases, all seven roots, three applicable fixed-target
events and fourteen charts passed the original gates. The maximum observed
natal-derived timestamp residual was 7.730 seconds; fixed-target residuals
were at most 7.778 seconds. Maximum observed natal-Moon residual was
0.0486362 degrees. Across independent and returned same-time charts, the
largest body, angle and cusp residuals were respectively 0.0499866,
0.0036131 and 0.0036215 degrees. These are measured results for this pack.
The frozen selected-event engineering bands extend approximately
28.56–35.95 minutes on each side; neither those bands nor the much smaller
observed residuals establish a uniform event-time accuracy guarantee.

Validation passed 49 lunar tests and 84 related engine/return/progression
tests (133 total), plus a targeted strict TypeScript check. An initial
combined run hit an inherited direct-ESM loader failure because the shared
dependency symlink resolved outside Vite's allowed root. The preserved
successful retry used a scratch-only test filesystem allowlist; no repository
Vite configuration or tests were suppressed. Full cumulative build, Astro
check, complete tests and browser/release validation remain integration gates.
This change adds no user interface, profile schema or export behavior.

## Evidence and reproducible extraction

The raw package is retained separately at
`/workspace/scratch/17dfd01b9330/wave20-lunar-acquisition/`. Its immutable
policy status text records the stage at which it was frozen; later approval
receipts authorize each subsequent stage without rewriting the policy.

| Artifact | SHA-256 |
| --- | --- |
| `lunar-return-policy.v2.json` | `16c807cfb7374c340200064ba6f4332b98923f77b05f6f24f62ea5541d5aa146` |
| `lunar-return-oracle.raw.json` | `599fdf9d1655e1677c144f74927d573a0073e8dae85d3ea3f2514dc1d98032c4` |
| `lunar-return-evaluations.jsonl.gz` | `c3812cf8e83da0e2ace78bd665eefd26494969b9f90c29a8ef17a3f189dea84e` |
| `fixed-target-applicability-amendment.json` | `2f9056c0f93b22e3270bf1f496d804759a9057ac6b3e5a142604248ba1dddb1a` |
| `lunar-returned-chart-policy.v1.json` | `5aa2b8c203811d0e004c1b4af44d96076e64fe04abf6c179387d15b0f0706e1d` |
| `lunar-returned-charts.raw.json` | `22482ee42813c8cba04226233bb793ab20d82cd5a9932a40ba16ae2e0b8d5e34` |
| `lunar-product.preliminary.json` | `4328b29a3d3680afadff5ece17f3fbf82f9826be2f90cac2e4511f910815c6ae` |
| `lunar-product.final.json` | `42716d6b31afcc057787b78085a3c308101df0b053b7dbf6e266491a1d063e0e` |
| `lunar-comparison-integrity-review.json` | `23f843f484764af7059a6fbbb97dbc10f82ab17e453a438b93d4636c9e1b98a4` |

`audit-lunar-source.py` and `audit-lunar-comparison.py` independently reconcile
recorded values without importing either engine. The latter reconciles all
425 source mappings in the compact fixtures and checks repeated product
outputs, raw tuple integrity, clocks and unchanged acceptance gates.

The two recipes here hash-check their raw inputs, copy retained values with
JSON-pointer source maps, and refuse to overwrite an output. They do not
run an ephemeris or application. For example, from the repository root with
the retained package mounted at `$LUNAR_EVIDENCE`:

```sh
python3 docs/engine-validation/swiss-lunar-return/extract-fixture.py "$LUNAR_EVIDENCE" /tmp/lunar-returns-new.json
python3 docs/engine-validation/swiss-lunar-return/extract-returned-charts.py "$LUNAR_EVIDENCE" /tmp/lunar-returned-charts-new.json
cmp /tmp/lunar-returns-new.json src/lib/engine/fixtures/swiss-lunar-returns.fixture.json
cmp /tmp/lunar-returned-charts-new.json src/lib/engine/fixtures/swiss-lunar-returned-charts.fixture.json
```

The committed policy and applicability amendment are byte-identical copies
of their approved inputs. The compact fixture SHA-256 values are respectively
`22e4a55652e12541d01cbd46c7efad018a06e60169fb399e2d02a6ab2ab6d5d5`
and `daa41662758d7c1f4dfa234e2dfbd33a884d11b343d94af605b28a537c18b410`.
All preparatory source receipts, failed-loader log, successful retry, product
preflights and actual-clock acquisition records remain separate evidence.

## Addition, 2026-09-25: engine 0.1.1-rc.8

`@zodiacs/engine` 0.1.1-rc.8 computes on observed ΔT instead of Astronomy
Engine's own Delta-T model, so each product return instant moved: L-modern-a
+6.042 s (both charts), L-modern-b +6.009 s, L-wrap +6.027 s, L-year-boundary
−0.182 s, L-range-start −0.116 s and L-range-end +10.571 s. Every independent
event-time band above still holds, unchanged, and no fixture or gate was
edited.

The returned-chart supplement was acquired at the rc.7 instants, and the raw
package and pinned DE441 files it came from are not available here, so it was
not re-acquired. The test now holds the product to it in three parts: the
returned chart is exactly the chart computed at its own instant; the product's
chart at the supplement's recorded clock meets every returned-chart gate; and
the two instants differ by at most 15 seconds. A solver change beyond that
still needs a new acquisition, with the original evidence retained.

## Addition, 2026-09-28: the fixtures left the tree

Under [DECISIONS-2026-09-28 §3](../../platform/programme/DECISIONS-2026-09-28.md)
three files left the tree:

| File | SHA-256 |
| --- | --- |
| `src/lib/engine/fixtures/swiss-lunar-returns.fixture.json` | `22e4a55652e12541d01cbd46c7efad018a06e60169fb399e2d02a6ab2ab6d5d5` |
| `src/lib/engine/fixtures/swiss-lunar-returned-charts.fixture.json` | `daa41662758d7c1f4dfa234e2dfbd33a884d11b343d94af605b28a537c18b410` |
| `src/lib/engine/fixtures/swiss-lunar-return-policy.json` | `16c807cfb7374c340200064ba6f4332b98923f77b05f6f24f62ea5541d5aa146` |

The policy went too because its L-wrap birth instant was itself Swiss output.
Commit `2ca93d41` still has all three. The two recipes above regenerate the
fixtures from the retained package: write them outside the repository and
compare them with `git show 2ca93d41:<path>` rather than with the paths the
`cmp` lines name. `lunar-return.test.ts` reads
`independent-lunar-returns.json` under `independent-lunar-return-policy.json`,
which carries this policy's cases, interval, scan contract, gates and
conditioning unchanged and takes the L-wrap birth from the NASA JPL Horizons
Moon instead, 2000-01-12T18:48:22.487Z
([`../independent-references/`](../independent-references/README.md)). The
applicability amendment stays. The figures above are this pack's, measured
against Swiss. The record of everything removed is
[`../SWISS-OUTPUT-REMOVAL.md`](../SWISS-OUTPUT-REMOVAL.md).
