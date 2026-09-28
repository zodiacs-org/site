# The controlled baseline — separating the clock from the series

The previous study reported that the DE440s prototype took worst-case
agreement with Swiss from **64.8″ to 0.134″**. That comparison had a confound
its own report named: the prototype's figure was taken with Delta-T pinned to
the reference's value, and the shipped core was never re-run the same way. A
difference measured like that mixes the time scale with the position series.

This is the missing cell, and the corrected attribution.

## The control

`tools/dump-core-controlled.mjs` runs the shipped `@zodiacs/engine` twice over
the same corpus, changing exactly one input: the Delta-T model.
astronomy-engine exposes `SetDeltaTFunction`, so the core's own model can be
replaced, for the life of one process, by the reference's per-case value. No
package is patched, no default changes, and the production path never reaches
this file. Each run records the engine's own Delta-T, the reference's, and
which was applied, and asserts that the override actually took — a control
that silently no-ops is worse than no control.

The prototype cells use the existing `prototype/dump-prototype.mjs` unchanged.

## The 2×2

Common denominator: the **160** body-rows present in all four cells (the two
corpus cases outside DE440s coverage are excluded from every cell, not just
from the prototype). Swiss Ephemeris 2.10.03, `SWIEPH` verified on every call,
`isFullSwissConfiguration: true` in all four comparator outputs.

| | max | p50 | p95 |
| --- | --- | --- | --- |
| **A** core, engine time policy | 64.768″ | 1.6651″ | 12.082″ |
| **B** core, matched time policy | **17.404″** | 1.4461″ | 11.817″ |
| **C** prototype, engine time policy | 63.887″ | 0.0823″ | 1.864″ |
| **D** prototype, matched time policy | **0.134″** | 0.0383″ | 0.117″ |

Read down a column to isolate the series; read across to isolate the clock.

| comparison | what it isolates | max |
| --- | --- | --- |
| A → B | the clock, on the core | 64.768″ → 17.404″ |
| C → D | the clock, on the prototype | 63.887″ → 0.134″ |
| A → C | the series, at the engine's clock | 64.768″ → 63.887″ |
| **B → D** | **the series, with the clock held fixed** | **17.404″ → 0.134″** |

**The honest headline is B → D: 17.40″ to 0.134″, a 130× reduction in worst
case attributable to the position series.** Not 64.8″ → 0.134″, which credited
the series with a clock difference it had nothing to do with. At the median the
series accounts for 1.4461″ → 0.0383″, 38×.

A → C shows why the old framing was misleading: at the engine's own clock the
series change buys almost nothing in worst case (64.768″ → 63.887″), because
the far-future Delta-T term swamps it.

## Where the core's remaining 17.4″ lives

With the clock matched, the far-future stratum stops being exceptional:

| stratum | n | cell A max | cell B max | cell A p50 | cell B p50 |
| --- | --- | --- | --- | --- | --- |
| future | 20 | 159.379″ | **24.798″** | 7.279″ | **1.334″** |
| historical | 30 | 18.638″ | 18.642″ | 2.222″ | 2.207″ |
| ordinary | 60 | 17.403″ | 17.404″ | 1.150″ | 1.222″ |
| polar | 20 | 14.892″ | 14.892″ | 1.474″ | 1.507″ |
| unknown-time | 10 | 15.755″ | 15.755″ | 2.834″ | 2.832″ |
| boundary | 20 | 11.512″ | 11.510″ | 1.442″ | 1.003″ |
| geometry | 20 | 11.101″ | 11.101″ | 1.823″ | 1.824″ |

Everything but `future` is unchanged, as it must be: inside the observed
record the two Delta-T models agree to a fraction of a second. The core's
worst rows under the control are Pluto (−24.80″ at 2190, 18.64″ at 1801) and
Neptune (17.40″, 17.20″, −16.23″) — the outer planets, which is the same place
the in-suite JPL Horizons comparison puts its worst residual.

## What the 0.134″ in cell D actually is

Not the ephemeris. The residual is **common-mode**: at a given instant all ten
bodies move together, and the two corpus cases that share an instant
(`geo-01`, `geo-02`) give byte-identical offsets, so it is a function of time
alone and not of geometry. Per-body signed means are all within 0.004–0.011″
of each other while each body swings ±0.11″.

Regressing the per-case common-mode term on the two libraries'
nutation-in-longitude difference, `dpsi(astronomy-engine) − dpsi(Swiss)`:

```
  case          observed    dpsi difference    residual
  historic-02     0.0256"          0.03264"     -0.0070"
  historic-01     0.0137"          0.02271"     -0.0090"
  modern-02       0.0219"          0.02945"     -0.0075"
  geo-01         -0.1159"         -0.10789"     -0.0080"
  modern-03       0.1127"          0.11930"     -0.0066"
  modern-05       0.1004"          0.10830"     -0.0079"
  modern-06      -0.0762"         -0.07018"     -0.0060"
  future-01      -0.0220"         -0.01332"     -0.0087"

  Pearson r = 0.99992    slope = 1.0005
```

A nutation-in-longitude difference moves the equinox along the ecliptic, so
every body's ecliptic longitude shifts by the same amount — exactly the
observed signature. astronomy-engine uses a truncated nutation series; Swiss
uses IAU2000A. The prototype reuses `Rotation_EQJ_ECT` deliberately, to isolate
the series, and in doing so inherits that ceiling.

**So the DE positions agree with Swiss substantially better than 0.134″, and
cell D is measuring the reduction rather than the ephemeris.** A constant
−0.0075″ survives the regression, which is the right order for the frame bias
between ICRF (what DE kernels use) and the dynamical mean equinox of J2000
(what a VSOP87-based library uses). Both are being chased down separately.

## Raw outputs

Every figure above comes from a committed file in `raw/`:
`cellA-core-own.json`, `cellB-core-pinned.json`, `cellC-proto-own.json`,
`cellD-proto-pinned.json`, their four `cmp-*.json` comparator outputs, and
`controlled-2x2.json`. Reproduce with:

```sh
node docs/platform/evidence/precision-2026-09-20/tools/dump-core-controlled.mjs \
  /tmp/claude-0/swisslab/swiss-measure.json           > cellA-core-own.json
node docs/platform/evidence/precision-2026-09-20/tools/dump-core-controlled.mjs \
  /tmp/claude-0/swisslab/swiss-measure.json --pinned  > cellB-core-pinned.json
node docs/platform/evidence/swiss-benchmark/tools/compare.mjs <cell> <swiss.json>
```

## One recovered receipt, and one corrected transcription

`raw/recovered-report-proto-engine-deltat.json` is the original comparator
output for the `prototype, engine ΔT` row that `swiss-benchmark/RESULTS.md`
published without a committed report. It was recovered from the original run
directory, not re-acquired and not re-created — it is that run's own output.

Reading it back showed the published p95 for that row was transcribed as
**1.834″** when the comparator wrote **1.8636″**. RESULTS.md is corrected. The
corrected value is slightly worse than the published one, which is the only
direction a correction to one's own headline is worth trusting.

## What this does not establish

The clock control is a **benchmark control**. Pinning the core's Delta-T to
Swiss's value makes the series comparable; it is not a finding that Swiss's
future Earth-rotation model is correct, and it is not authorisation to adopt
that model in production. Delta-T past the observed record is an extrapolation
of something unpredictable, and gate 4 of `swiss-benchmark/NEXT.md` still
stands: choosing a Delta-T model is a separate decision from choosing an
ephemeris.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the
per-case Swiss values left the cells: `raw/cellA-core-own.json` and
`raw/cellB-core-pinned.json` lost each case's Swiss ΔT
(`deltaTReferenceSeconds`, and in cell B, which was pinned to it,
`deltaTAppliedSeconds`), and `raw/cmp-*.json` and
`raw/recovered-report-proto-engine-deltat.json` lost their per-row
differences. The positions the engine computed and every statistic stay,
and each file records the SHA-256 of what it lost under `swissOutputRemoved`.
Commit `2ca93d41` still has the values, and `tools/dump-core-controlled.mjs`
regenerates the cells. The record of everything removed is
[`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
