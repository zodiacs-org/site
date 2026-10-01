# Market Lens lunar-direction experiment

The experiment does not demonstrate a consistent incremental predictive benefit from the tested lunar features. Public model forecasts remain disabled.

Generated 2026-10-01T10:57:29.660Z. **Private retrospective research; no public model forecasts or trading policy.**

## Frozen question and protocol

Does a fixed set of lunar-phase features improve next UTC daily close direction predictions relative to a fixed technical-analysis feature set?

Manifest: `market-lens-lunar-direction-v1`, SHA-256 `656f73307f7ae005e244ec88eb1b76bb93933f74d44d66eb6b55778cfee5eadf`. Model-selection freeze SHA-256: `8fade7fbd87d68a502de0eacb2ef810c1d5152c74068e19f744d86909f00cf8b`.

The target is the direction from finalized close t to finalized close t+1. The forecast cutoff is UTC midnight after bar t; all market features use bar t and earlier. Zero returns are class 0. No missing bars are filled. Feature rows require 61 consecutive daily bars; RSI uses Wilder smoothing initialized after 14 changes within each contiguous segment.

TA features are 1/7/30-day log returns, SMA20/50 price gaps, 20-day close-return population standard deviation, centered RSI14, and log1p(volume) minus log1p(20-day mean volume). Lunar features are sine/cosine of Moon–Sun elongation and fixed ≤12° proximity flags for new/full phase, evaluated with the pinned engine at the forecast cutoff. These flags are not exact event timestamps.

Development precedes 2021. Two expanding validation folds cover 2021 and 2022. The final holdout starts 2023-01-01T00:00:00.000Z and ends with targets finalized by 2026-10-01T00:00:00.000Z. Training labels ending at or after an evaluation start are purged. Validation labels reaching the holdout are also purged. All scaling fits training data only.

Each of TA-only, lunar-only, and combined logistic models tries only L2 penalties 0.01, 0.1, and 1, selected by sample-weighted validation log loss. All candidates are retained in results.json. After selection, models refit on pre-holdout data once; holdout performance does not influence model selection.

## Verified source and coverage

Venue: Coinbase Exchange, BTC-USD and ETH-USD spot; UTC daily opening timestamps, volume in the asset's base currency. Requested history starts 2015-07-20T00:00:00.000Z. Raw responses, response hashes, retrieval receipts, features, fitted weights and holdout predictions are stored outside the public site. **Public display/redistribution rights have not been established.**

Astronomy: @zodiacs/engine 0.1.1-rc.15, astronomy-engine 2.1.19. Vendored archive SHA-256: `24eeb597b0157598c0faa26bb615c0cb5dfaaeac0393d62c73fbd37c5da4d348`.

## BTC-USD

Observed bars: 4091, 2015-07-20T00:00:00.000Z through 2026-09-30T00:00:00.000Z; 0 missing daily bars within observed coverage. Usable rows: 4030; development: 1930; final training: 2660; final test: 1369.

Holdout cutoffs: 2023-01-01T00:00:00.000Z through 2026-09-30T00:00:00.000Z; positive target rate 50.26%; approximately 46.3 lunar cycles, not thousands of independent lunar events. Dataset SHA-256: `725bf049f356140f65eec07ecf9af783e7ea690dd0c73b1339df6ca405f1f1b4`.

| Model | Selected L2 | Brier ↓ | Log loss ↓ | Direction accuracy |
|---|---:|---:|---:|---:|
| unconditional | — | 0.25107 | 0.69529 | 50.26% |
| persistence | — | 0.25079 | 0.69475 | 50.26% |
| taOnly | 0.01 | 0.25257 | 0.69834 | 49.60% |
| astroOnly | 1 | 0.25101 | 0.69516 | 50.26% |
| combined | 0.1 | 0.25119 | 0.69553 | 49.67% |

**Primary paired comparison, combined minus TA-only Brier:** -0.00137; 95% interval [-0.00233, -0.00035]; conservative 97.5% interval [-0.00247, -0.00008].

Secondary log-loss difference: -0.00281; 95% interval [-0.00483, -0.00072].

Exploratory incremental improvement in this fixed holdout; independent review and prospective testing still required.

### Combined model reliability

| Predicted range | Days | Mean prediction | Observed positive rate |
|---|---:|---:|---:|
| 0.00%–20.00% | 0 | — | — |
| 20.00%–40.00% | 0 | — | — |
| 40.00%–60.00% | 1339 | 53.61% | 49.74% |
| 60.00%–80.00% | 30 | 61.21% | 73.33% |
| 80.00%–100.00% | 0 | — | — |

### Attribution limits and post-hoc diagnostic

The primary comparison uses separately selected penalties (TA 0.01; combined 0.1). It compares complete modeling pipelines and cannot isolate an effect from adding lunar features. Combined minus persistence Brier is 0.00040; a positive value means the combined model is worse than that simpler benchmark.

After inspecting the first holdout, we added a **post-hoc, exploratory** TA-only control using the combined model's selected L2 (0.1). Its Brier score is 0.25136. Combined minus matched-penalty TA Brier is -0.00016 with a 95% block interval [-0.00043, 0.00012]. This diagnostic is not a new confirmatory or unseen test.

## ETH-USD

Observed bars: 3786, 2016-05-18T00:00:00.000Z through 2026-09-30T00:00:00.000Z; 2 missing daily bars within observed coverage. Usable rows: 3722; development: 1622; final training: 2352; final test: 1369.

Holdout cutoffs: 2023-01-01T00:00:00.000Z through 2026-09-30T00:00:00.000Z; positive target rate 51.06%; approximately 46.3 lunar cycles, not thousands of independent lunar events. Dataset SHA-256: `a693f3209af5d74f9f134c15e1b6c2b16bcd8b0c52b5eaf7014cdda2860ca9f3`.

| Model | Selected L2 | Brier ↓ | Log loss ↓ | Direction accuracy |
|---|---:|---:|---:|---:|
| unconditional | — | 0.24989 | 0.69294 | 51.06% |
| persistence | — | 0.24939 | 0.69192 | 52.37% |
| taOnly | 0.1 | 0.25032 | 0.69379 | 50.40% |
| astroOnly | 1 | 0.24981 | 0.69277 | 51.06% |
| combined | 1 | 0.24976 | 0.69266 | 51.86% |

**Primary paired comparison, combined minus TA-only Brier:** -0.00057; 95% interval [-0.00166, 0.00057]; conservative 97.5% interval [-0.00186, 0.00071].

Secondary log-loss difference: -0.00113; 95% interval [-0.00347, 0.00116].

No incremental benefit demonstrated by the primary holdout comparison; uncertainty includes no difference.

### Combined model reliability

| Predicted range | Days | Mean prediction | Observed positive rate |
|---|---:|---:|---:|
| 0.00%–20.00% | 0 | — | — |
| 20.00%–40.00% | 0 | — | — |
| 40.00%–60.00% | 1369 | 50.58% | 51.06% |
| 60.00%–80.00% | 0 | — | — |
| 80.00%–100.00% | 0 | — | — |

### Attribution limits and post-hoc diagnostic

The primary comparison uses separately selected penalties (TA 0.1; combined 1). It compares complete modeling pipelines and cannot isolate an effect from adding lunar features. Combined minus persistence Brier is 0.00037; a positive value means the combined model is worse than that simpler benchmark.

After inspecting the first holdout, we added a **post-hoc, exploratory** TA-only control using the combined model's selected L2 (1). Its Brier score is 0.24984. Combined minus matched-penalty TA Brier is -0.00009 with a 95% block interval [-0.00027, 0.00010]. This diagnostic is not a new confirmatory or unseen test.

## Uncertainty and interpretation

Paired circular moving-block bootstrap uses 30-day blocks, 1,000 deterministic replicates, and the same daily rows for both models. Blocks stop at missing-day gaps. Central 97.5% intervals conservatively address the two primary asset comparisons; other model scores, accuracy, year slices and calibration bins are exploratory. Daily dependence, correlated assets, model selection and market regime change limit inference.

- Only a fixed lunar feature set was tested; this does not establish or refute every astrological method.
- Same-venue daily OHLCV from public Coinbase Exchange responses; no futures, fees, spreads or execution simulation.
- Retrospective fixed holdout, not a prospectively timestamped paper forecast; repeated evaluation is reproducibility checking, not a new unseen test.
- Moving-block bootstrap is an uncertainty approximation, not a guarantee under regime changes. BTC/ETH observations are correlated.
- Two primary asset comparisons use conservative 97.5% intervals; other score/model/year/calibration comparisons are exploratory.
- Classification scores do not establish trading profitability. API availability does not establish public redistribution rights.
- UTC cutoff assumes finalized close availability. A public prospective system must define and record actual data-publication latency.

## Reproduce and evidence gate

From the site checkout: `node scripts/market-lens-research.mjs acquire --dir /workspace/.onboarding/lens-research/v1`, then `node scripts/market-lens-research.mjs run --dir /workspace/.onboarding/lens-research/v1`. Run verifies every source-response/dataset hash and can operate offline. `./node_modules/.bin/vitest run research/market-lens/core.test.mjs --maxWorkers=1 --minWorkers=1` tests leakage boundaries, deterministic lunar features, gaps, fixtures, metrics and model behavior.

A rerun of this holdout verifies reproducibility; it is not a new unseen evaluation. Any protocol change needs a new manifest/version and fresh evaluation plan. No public model forecast is enabled. Independent review and a prospectively timestamped paper-forecast period are prerequisites.
