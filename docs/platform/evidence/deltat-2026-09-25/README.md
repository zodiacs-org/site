# ΔT model zodiacs-deltat/1: definition, sources and measurements

Step 1.4 of the engine brief (version 1, rule 1c), under amendment A2 as
adopted on 2026-09-25 (`../engine-beyond-swiss/PREREGISTRATION.md`). This
folder is committed before any engine code. It defines the model the engine
will ship as `src/deltat.ts`, names every source by digest, and holds the
tools and the statistics measured on the reference implementation. None of
the numbers below is a verdict. The verdicts are recorded in the
preregistration after `@zodiacs/engine` 0.1.1-rc.8 is vendored, on the
vendored code.

The reference implementation is `tools/deltat-reference.ts` (sha256
`3dea107e9bc0f1f8acea5737d369e09d571c22b3d1f82efe9dc9184f2bfe99d6`). The
engine's `src/deltat.ts` must be byte-identical to it at rc.8, or
`tools/parity.py <module>` and `tools/gate1.py <module>` must be re-run on
the shipped module and recorded.

## 1. The model

ΔT = TT − UT1, in seconds. The engine reads the instant as UT1 (UTC is
taken as UT1, as in rc.7 and in Swiss Ephemeris's `calc_ut`; UT1 − UTC and
leap seconds belong to M3). The argument is astronomy-engine's `ut`, days
since 2000-01-01T12:00Z, and y = 2000 + ut / 365.25 in Julian years. So
y = 1962 is 1962-01-01T00:00Z and y = 2027 is 2027-01-01T06:00Z.

| segment | range | value |
| --- | --- | --- |
| long-term | y < −720 | ΔT(−720) + L(y) − L(−720), where L is the integral of SMH 2016 eq. (5.1), lod = 1.78t − 4.0 sin(2πt/15) ms, t = (y − 1825)/100: L(y) = 36.525 (0.89 t² + (30/π) cos(2πt/15)) s. |
| reconstructed | −720 ≤ y < 1941 | Table S15 of Stephenson, Morrison & Hohenkerk 2016 (SMH), as the C2 cubic spline through its 32 knots from −720 to 1945 (values in 0.01 s) with the end second derivatives of its rows, 0.018915 s/yr² at −720 and −0.09856 s/yr² at 1945. Rebuilt on first use. No tidal term: SMH's lunar tidal acceleration, −25.82″/cy², is kept. |
| reconstructed | 1941 ≤ y < 1956 | Whole-year knots from USNO `historic_deltat.data`, linear between. |
| observed | 1956 ≤ y ≤ observedTo | Whole-year knots: USNO to 1961, then IERS. IERS values by the per-era source rule: 20 C04 through 1973-01-01, finals2000A rows flagged I from 1973-01-02. TT − UT1 = 32.184 + (TAI − UTC) − (UT1 − UTC), with TAI − UTC from `tai-utc.dat` including the 1961–1971 formulas, linear between the daily values at 0h UTC. Then a knot at the last observed day. |
| predicted | observedTo < y ≤ predictedTo | Four knots evenly spaced from the last observed day to the last predicted day, from finals2000A rows flagged P (Bulletin A). |
| extrapolated | y > predictedTo | ΔT_n + s·15(1 − e^(−g/15)) + L(y) − L(y_n) − L′(y_n)·g, with g = y − y_n, y_n the last predicted day, and s the slope over the prediction window, (ΔT_n − ΔT(observedTo)) / (y_n − observedTo). |
| pinned | a caller's value | As given. Set by the engine, not by this module. |

Every finite date gets a value. The value is continuous everywhere except
at 1941, where the spline gives 24.8339 s and the USNO knot 24.82 s (a step
of −0.0139 s). At the last predicted day the value is continuous and the
slope changes from −0.1958 s/yr (the last prediction interval, which carries
the seasonal term) to 0.1273 s/yr (the window's slope)
(`outputs/gate1.json`, `joins`).

### The band σ

σ is a 1-σ band in seconds.

- After the last observed day it depends only on h, the years since that
  day: 0.03 + 0.09·h^0.75 for 0 < h ≤ 1; 0.12·h^1.5 for 1 < h ≤ 10;
  0.61·(h − 10) + 0.12·10^1.5 = 0.61·h − 2.3052668 beyond. It is continuous
  and never decreases: the prediction term 0.001·(365.25h)^0.75 =
  0.0835·h^0.75 became 0.09·h^0.75 (7.7 % larger) so that σ meets
  0.12·h^1.5 at h = 1, and the constant 2.3052668 is 0.61·10 − 0.12·10^1.5
  rounded to seven decimals, so that the linear branch meets it at h = 10.
- The slope beyond ten years is the smallest value, rounded up to 0.01 s a
  year, for which σ is at least the hindcast's p68 error at every
  whole-year horizon from 20 to 100 years in every launch window
  (section 4). The requirement is 0.6028 s a year, set by the 42-year
  horizon for launches 1851–2025 (p68 23.083 s over 134 launches), so the
  slope is 0.61. Checking only the tabulated horizons of 20, 30, 50, 75 and
  100 years would give 0.571 s a year (at 50 years), and a slope of 0.58
  would leave σ below the p68 at every horizon from 37 to 49 years.
- Observed, 1956 to the last observed day: 0.03 s, the error of linear
  interpolation between whole-year knots.
- Before 1956: a band built from measured indicators (section 3), linear
  between the points [640, 83], [900, 230], [1240, 120], [1400, 15],
  [1420, 7.5], [1440, 4.2], [1500, 5.6], [1560, 27], [1670, 15],
  [1710, 3.3], [1720, 3.3], [1760, 1.5], [1800, 1.5], [1810, 0.55],
  [1820, 0.55], [1840, 0.46], [1956, 0.46] (year, s). Before 1620 the band
  is at least 0.6·t² with t = (y − 1825)/100, SMH's published uncertainty of
  their parabola, eq. (4.1), 32.5 ± 0.6 s/cy²; before −720 it is 0.6·t².
  **Before 1620 σ is an estimate, not a calibrated 1-σ.** From 1620 to 1956
  it is a floor set by measurements; no independent truth exists before 1956
  to calibrate it.

### The table this release carries (`table.json`)

- Version `2026-09-24`: the last observed IERS day (MJD 61307). The last
  predicted day is 2027-10-02 (MJD 61680).
- Digest `6371988c510a1c6c`: the first 16 hex digits of SHA-256 over the
  JSON text `[from, observedTo, predictedTo, ...knots]` exactly as the module
  holds them (`table.json`, `digestInput`).
- 91 knots in 0.01 s, the first absolute and the rest differences: 86 whole
  years (1941–2026), the observed knot 69.20 s, and prediction knots 69.30,
  69.37, 69.38 and 69.33 s every 93.25 days.
- The table is deep-frozen. It changes only with an engine release, and a
  receipt names it by version and digest.

`tools/derive_table.py` writes `table.json` from the named sources;
`tools/parity.py` checks the Python twin the replay tools use against the
TypeScript module on 18,384 points from −3000 to 3000, densified at every
join: largest difference 1.5e-11 s in value and 2.2e-16 s in σ, no segment
differs (`outputs/parity.json`).

## 2. Results a receipt carries

`deltaTAt(ut)` returns `{seconds, sigma, model: "zodiacs-deltat/1",
table: "2026-09-24", tableDigest: "6371988c510a1c6c", segment}`; `deltaT(ut)`
returns the seconds alone, without allocating, for astronomy-engine's
`SetDeltaTFunction`. A caller's pin is recorded as `{seconds, sigma: null,
model: "pinned", table: null, tableDigest: null, segment: "pinned"}`. Over
every date a JavaScript Date can hold (±8.64e15 ms), |seconds| stays below
1e10 s and σ between 0 and 1e10 s (unit test).

## 3. How σ before 1956 was built (`tools/derive_sigma.py`, `sigma.json`)

For each bin of years the band is at least the largest of these
indicators:

- **F, the floor: 0.46 s.** RMS of Table S15 (2016) against IERS 20 C04 ΔT
  over every day from 1962-01-01 to 1971-12-31, 0.4545 s (3,652 days,
  largest 0.6767 s), rounded up. It is how far an occultation reconstruction
  sits from the observed value in the first decade where both exist. Over
  1962–1981 the RMS is 0.3516 s, over 1972–1981 0.2016 s and over 1962–2015
  0.2222 s.
- **P, before 1620 only:** 0.6·t² s, SMH's published uncertainty of their
  parabola, taken at the bin's earliest year. From 1620 the occultations
  constrain the curve and D and F apply.
- **R, the authors' revision:** the largest |S15.2020 − S15.2016| in the
  bin. The 2020 table is read for this number only; nothing from it ships.
- **D, from 1620:** SMH's own occultation values (the CC BY file
  `extract-lunarocc.dat`, 120,908 records) about Table S15: the weighted
  mean residual and its standard error, combined as √(mean² + SE²). Weights
  are SMH's (Wt = 0.09/ERR²), SMH's outlier limits are applied about the
  curve (±100 s before 1700, ±25 s after), and SE is scaled by the bin's own
  reduced χ². Decades are pooled until a bin holds 30 observations.

| bin | observations | D (s) | R (s) | band at least (s) |
| --- | ---: | ---: | ---: | ---: |
| 1620–1650 | 37 | 13.894 | 12.458 | 13.894 |
| 1650–1670 | 38 | 14.067 | 2.532 | 14.067 |
| 1670–1680 | 45 | 10.531 | 2.565 | 10.531 |
| 1680–1690 | 50 | 7.853 | 2.360 | 7.853 |
| 1690–1710 | 41 | 2.051 | 1.572 | 2.051 |
| 1710–1720 | 33 | 3.255 | 1.336 | 3.255 |
| 1720–1740 | 60 | 2.341 | 1.531 | 2.341 |
| 1740–1750 | 45 | 1.808 | 1.247 | 1.808 |
| 1750–1760 | 36 | 1.341 | 0.679 | 1.341 |
| 1760–1780 | 61 | 1.435 | 1.001 | 1.435 |
| 1780–1790 | 30 | 0.999 | 1.049 | 1.049 |
| 1790–1800 | 62 | 1.379 | 0.969 | 1.379 |
| 1800–1810 | 144 | 0.508 | 0.423 | 0.508 |
| 1810–1820 | 186 | 0.545 | 0.423 | 0.545 |
| 1820–1830 | 270 | 0.299 | 0.190 | 0.46 (F) |
| 1830–1840 | 481 | 0.206 | 0.064 | 0.46 (F) |
| 1840–1850 | 434 | 0.237 | 0.037 | 0.46 (F) |

From 1850 to 1956 every indicator but F is below F (the tool checks this;
D is at most 0.193 s). Before 1620, in 20-year bins, P covers R up to 660;
R exceeds P in the bins from 660 to 1400 (up to 184.9 s at 962.5) and from
1520 to 1620 (up to 21.574 s), and the table starts at 640. The points in
section 1 are a piecewise-linear upper envelope of the bins' values, at most
1.25 times the larger adjacent bin's value before 1800 and 1.1 times after,
rounded up to two significant figures; the tool checks the result against
every indicator on a 0.25-year grid.

For context (`outputs/revision.json`): USNO's older reduction differs from
Table S15 (2016) by an RMS of 2.739 s in 1657–1700, 6.431 s in 1700–1800,
3.913 s in 1800–1850, 2.022 s in 1850–1900, 0.520 s in 1900–1941 and 0.307 s
in 1941–1956 (largest 0.682 s at 1955.5). From 1956 USNO's values are atomic
time, and Table S15 sits 0.323 s (RMS) from them to 1985. The band treats
the older reduction's differences as that reduction's error, not the
curve's.

## 4. Measured on the reference implementation

### Gate 1 and every IERS day (`tools/gate1.py`, `iers-12.json`, `outputs/gate1.json`)

| date (0h UTC) | source | IERS (s) | model (s) | residual (s) | rc.7 residual (s) |
| --- | --- | ---: | ---: | ---: | ---: |
| 1962-03-15 | C04 | 34.0957 | 34.0939 | −0.0018 | −0.031 |
| 1969-09-15 | C04 | 39.8714 | 39.8902 | +0.0188 | −0.012 |
| 1977-03-15 | finals I | 47.7263 | 47.7226 | −0.0037 | −0.002 |
| 1984-09-15 | finals I | 54.1646 | 54.1777 | +0.0131 | −0.018 |
| 1992-03-15 | finals I | 58.4903 | 58.4730 | −0.0173 | −0.034 |
| 1999-09-15 | finals I | 63.7028 | 63.7231 | +0.0203 | +0.038 |
| 2007-03-15 | finals I | 65.2273 | 65.2117 | −0.0156 | +0.286 |
| 2014-09-15 | finals I | 67.5231 | 67.5333 | +0.0102 | +1.324 |
| 2017-08-21 | finals I | 68.8440 | 68.8316 | −0.0124 | +1.476 |
| 2020-01-01 | finals I | 69.3612 | 69.3598 | −0.0014 | +2.216 |
| 2024-04-08 | finals I | 69.1999 | 69.1693 | −0.0306 | +4.807 |
| 2026-09-22 | finals I | 69.1954 | 69.1993 | +0.0039 | +6.302 |

Largest residual 0.0306 s (2024-04-08) against the 0.2 s gate; rc.7 6.302 s.
For 1977-03-15, C04 gives 47.7238 s, 2.5 ms from the finals value, which is
why the source is fixed per era. The preregistered corpus
`../engine-beyond-swiss/corpora/iers-finals2000A-ut1.csv` was cut from the
2026-09-22 file, where 2026-09-22 is still a prediction (−0.0117110 s); the
gate uses the observed row of the 2026-09-24 file (−0.0114083 s).

- Every IERS day from 1962-01-01 to 2026-09-24 (23,643 days): largest error
  0.0834 s (1998-05-29), RMS 0.0223 s, 83.0 % within ±σ. σ is at least 15.0
  times the IERS formal error of UT1 − UTC on every observed row (M3's band
  rule).
- The 373 predicted rows to 2027-10-02: largest difference 0.0196 s
  (2027-05-06), all within ±σ, σ at least 4.8 times the formal error.
- Table S15 (2016) from −720 to 1941 on a 0.05-year grid: largest
  representation error 0.0187 s (1770.7), from storing the knots in 0.01 s.

### Bulletin A's predictions against what was then observed (`tools/bulletin_a.py`, `outputs/bulletin-a.json`)

Realized RMS error of UT1 − UTC predictions, against σ at the same horizon.
A 1 s step from a leap second not yet announced (2015 and 2016 issues) is
removed.

| horizon | quarterly 2015–2025 (44 issues): RMS, RMS/S_t | weekly 2025-01-02 to 2026-09-17 (90 issues): RMS, RMS/S_t | σ | σ / RMS (quarterly, weekly) |
| --- | --- | --- | ---: | --- |
| 30 d | 0.0037 s, 1.15 | 0.0042 s, 1.31 | 0.0438 s | 11.93, 10.42 |
| 90 d | 0.0135 s, 1.85 | 0.0237 s, 3.24 | 0.0615 s | 4.54, 2.59 |
| 180 d | 0.0305 s, 2.49 | 0.0387 s, 3.15 | 0.0829 s | 2.72, 2.14 |
| 365 d | 0.0841 s, 4.03 | 0.0639 s, 3.06 | 0.1200 s | 1.43, 1.88 |

From 30 days on, Bulletin A's own S_t understates its errors by 1.15 to
4.03 times. σ covers the realized RMS at every horizon, and 81 to 100 % of
the errors.

### The extrapolation rule, hindcast (`tools/hindcast.py`, `outputs/hindcast.json`)

Record: Table S15 (2016) to 1940, USNO 1941–1961, IERS 1962–2026, on
1 January. Launch years 1851–2025; every rule sees only the record up to its
launch year. RMS error in seconds, and p68, the ⌊0.68(n − 1)⌋-th of the n
sorted absolute errors of the model's rule:

| horizon (years) | launches | σ(h) | model: damped τ = 15 + curve | p68 | last slope | hold | slope + parabola |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 175 | 0.120 | 0.101 | 0.088 | 0.101 | 0.657 | 0.101 |
| 2 | 174 | 0.339 | 0.287 | 0.262 | 0.285 | 1.314 | 0.286 |
| 5 | 171 | 1.342 | 1.219 | 1.052 | 1.242 | 3.260 | 1.246 |
| 10 | 166 | 3.795 | 3.261 | 2.693 | 3.446 | 6.389 | 3.459 |
| 20 | 156 | 9.895 | 8.270 | 7.773 | 9.528 | 12.237 | 9.548 |
| 30 | 146 | 15.995 | 13.309 | 13.481 | 16.872 | 17.409 | 16.802 |
| 50 | 126 | 28.195 | 22.187 | 26.635 | 32.205 | 26.259 | 30.873 |
| 100 | 76 | 58.695 | 42.212 | 51.152 | 74.728 | 49.501 | 69.471 |

For these launches, and for launches 1700–2025, the model's rule has the
smallest RMS from 5 years on; the last slope is smaller at 1 to 3 years, by
at most 0.002 s. For launches 1955–2025 the last slope is better at every
horizon, by 1.2 to 10.2 %. For launches 1851–2025, σ(h) is 1.10 to 1.19
times the model's RMS up to 10 years and 1.20 to 1.39 times it from 20 to
100 years. σ(h) is at least the p68 at every whole-year horizon the hindcast
reaches (1 to 100 years; 1 to 71 for launches 1955–2025) in all three launch
windows. It comes closest at 42 years for launches 1851–2025 (1.01 times the
p68), 46 years for 1955–2025 (1.13) and 30 years for 1700–2025 (1.63).
τ = 10, 20 and 30 change the RMS by at most 5.4 % (launches 1851–2025) and
4.4 % (1700–2025); τ is not refitted. All from `outputs/hindcast.json`
(`summary` and `slopeBeyond10`).

### Gate 3: the production-path Moon against Swiss Ephemeris (`tools/moon/`, `outputs/moon-gate3.json`)

Swiss Ephemeris 2.10.03 with `sepl_18.se1` (sha256 `ca1393ce…`) and
`semo_18.se1` (`1ca07bd6…`), flags 258 (SWIEPH | SPEED), the returned flag
read on every call. Swiss is an instrument here, not a target. The rc.7
dump reproduces the committed `zodiacsDumpSha256` 4552e19f… of
`../swiss-benchmark/multiyear-1800-2199.json`.

- **gap**: p50 of |engine − Swiss at the same UT| minus p50 of |engine −
  Swiss at the engine's TT|, p50 the ⌊n/2⌋-th sorted value.
- **paired**: per instant |(engine − Swiss(UT)) − (engine − Swiss(TT))|,
  the Moon displacement due only to the two ΔT values; p95.

| window | model gap (″) | model paired p95 (″) | rc.7 gap (″) | rc.7 paired p95 (″) |
| --- | ---: | ---: | ---: | ---: |
| §5 corpus, 18 MEASURE cases | +0.022 | – | +0.314 | – |
| 1800–1849 | −0.070 | 0.103 | −1.891 | 2.838 |
| 1850–1899 | −0.022 | 0.044 | −1.028 | 1.671 |
| 1900–1949 | −0.009 | 0.119 | −0.166 | 0.609 |
| 1950–1999 | +0.006 | 0.118 | −0.003 | 0.075 |
| 2000–2026 | −0.009 | 0.100 | +0.178 | 3.233 |
| 1962–2026 (reported) | −0.003 | 0.035 | +0.069 | 2.498 |
| 2027–2199 (reported) | +7.590 | 19.386 | +73.332 | 149.225 |
| 1800–2199 (reported) | +2.649 | 17.608 | +3.114 | 136.327 |

Every gated window is within 0.3″ on the reference implementation; rc.7
fails the gap in 1800–1849 and 1850–1899 and the paired p95 in four of five
eras. After 2026 both ΔT values are extrapolations; Swiss's own ΔT is
93.18 s at 2100-01-01 (`outputs/swiss-deltat.json`) where this model gives
78.93 s.

**What gate 3 checks before 1962.** Before 1962, gate 3 mostly checks that
the engine and Swiss use the same reconstruction, both Table S15 of 2016. It
does not check accuracy. From 1800 to 1940 Swiss's ΔT is within 0.189 s of
Table S15 (2016) (0.086 s at 1850, 0.022 s at 1900) and up to 0.536 s from
the 2020 revision; at AD 1000 it differs from the 2016 table by 7.239 s and
from the 2020 one by −175.5 s. From 1800 to 1961.5 it is within 0.291 s of this
model, RMS 0.098 s; the largest difference is at 1945, where the model
follows USNO's values (`outputs/swiss-deltat.json`, on a half-year grid). A
small gap before 1962 shows that the two agree, and it would be just as
small if Table S15 were wrong. How far the reconstruction may be from the
truth is what σ states: at least 0.46 s before 1956, and 1.5 s at 1800.
Nothing independent measures it before 1956. From 1962, accuracy is gate 1's
job: the model against IERS, day by day.

### Said before the result: what gets worse, what gets better

- **Worse before 1955.** Without rc.7's ΔT error partly offsetting the
  analytic Moon's own error, the production-path Moon against Swiss at the
  same UT goes from a p50 of 2.808″ to 3.708″ over 1800–1954.
- **Better after 1955.** 0.641″ → 0.574″ over 1955–2026, 0.714″ → 0.527″
  over 2000–2026, 2.642″ → 0.671″ over 2000–2049.
- **Against Horizons** at the same UT, on the committed 24-instant corpus
  (`outputs/moon-horizons.json`; Horizons applies its own ΔT): before 1962
  (9 instants) the p50 rises from 1.914″ to 2.443″ (largest 2.748″ → 4.170″),
  as rule 1c warns, until M2 replaces the analytic Moon; 1962–2026
  (8 instants) 0.616″ → 0.558″; after 2026 (7 instants) 58.057″ → 2.714″;
  all 24, 1.967″ → 1.800″.

### A4, lunations within 2 s of Swiss (`tools/lunations-a4.mjs`, `outputs/lunations-a4.json`)

The site's lunation search over 2026–2030, put against the Swiss instants
the committed deltas imply (no Swiss call); the rc.7 search reproduces all
124 published instants to 1 ms. With the model: 80 of 124 within 2 s, 123
within 5 s, largest 5.15 s (new moon of 2030-05-02), mean +0.29 s; rc.7:
1 of 124, largest 11.79 s, mean −6.90 s. Expected verdict: FAIL, on the
Moon's geometry, which is M2's work.

## 5. What changes for users (`outputs/what-changes.json`, `outputs/values.json`)

- **Today.** On 2026-09-25 the engine's ΔT goes from 75.502 s (rc.7) to
  69.201 s (−6.301 s). The Moon in a chart for today moves back 3.41″. Moon
  events come later: new and full moons of 2026–2030 by 5.93 to 8.49 s, 7.19 s
  on average; 17 of 124 displayed UTC minutes change.
- **The past.** At 1800-01-01 ΔT goes from 13.772 to 18.708 s (Moon +2.55″),
  at 1850 from 7.102 to 9.321 s (+1.35″), at 1900 from −2.757 to −1.977 s
  (+0.47″), at 1950 by +0.096 s (+0.05″) and at 2000 by −0.017 s (−0.01″).
- **The future.** ΔT on 2050-01-01 is 71.451 ± 11.89 s (rc.7 92.968 s;
  Swiss 74.58 s); on 2100-01-01, 78.927 ± 42.39 s (rc.7 202.652 s; Swiss
  93.18 s); on 2199-12-31, 126.246 ± 103.387 s (rc.7 441.984 s). The Moon in
  a chart of 2100-01-01 moves back 72.23″.
- Values: 1620 67.065 ± 20.455 s; 1700 14.587 ± 6.225 s; 1800 18.710 ±
  1.5 s; 1900 −1.980 ± 0.46 s; 1956 31.350 ± 0.03 s; 2000 63.830 ± 0.03 s;
  y = 2027 69.305 ± 0.064 s; y = 2030 69.602 ± 0.710 s.

## 6. Refresh policy and the weekly monitor (`tools/monitor_replay.py`, `outputs/monitor-replay.json`)

The table lives only in the engine package. It is refreshed at every engine
release and at least once a year, with the yearly sky-data refresh; a refresh
is an engine release, and the site takes it through a normal pull request
with full CI. Nothing refreshes ΔT weekly.

A weekly workflow monitors the vendored table. Each run:

1. Fetches `finals2000A.all` from https://maia.usno.navy.mil/ser7/ and
   https://datacenter.iers.org/data/9/ (three tries each). It validates the
   file: rows parse, MJDs are daily and contiguous, one switch from I to P
   rows, the last I row within 14 days of the run, at least 300 days of P
   rows. When both mirrors answer, their I rows agree to 0.1 ms.
2. Computes, at t₀ = the run date at 0h UTC, ΔT_IERS(t₀) = 32.184 +
   (TAI − UTC) − (UT1 − UTC) from the row for that day, and the vendored
   engine's `deltaTAt` at t₀.
3. Fires when either holds:
   - **value:** |ΔT_model(t₀) − ΔT_IERS(t₀)| > max(0.1 s, σ_model(t₀));
   - **window:** the table's last prediction knot (`predictedTo`) is fewer
     than 90 days after t₀ (a negative count is fewer).
4. Reports in the run summary, and in the issue when it fires, the largest
   |model − IERS| over the file's prediction window.
5. On firing, opens an issue "ΔT table needs a refresh", or comments on the
   open one (one open issue at a time). A run that cannot fetch or validate
   updates the same issue with the failure. The monitor commits nothing.

Replayed over the 90 weekly Bulletin A issues of 2025-01-02 to 2026-09-17
(89 runs, each the day after an issue; tables as of an issue are built by
the same rule from what was known that day):

| cadence | value fires | window fires | runs firing | issues opened | largest \|model − IERS\| at t₀ | largest \|Δ\|/σ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| none (the table of 2025-01-02 throughout) | 0 | 50 (from 2025-10-10) | 50 | 1 | 0.1201 s (2026-09-18) | 0.448 |
| yearly (2025-01-02, 2026-01-01) | 1 (2026-09-18) | 12 (2025-10-10 to 2025-12-26) | 13 | 2 | 0.1055 s (2026-09-18) | 1.058 |

With the yearly cadence the largest |model − IERS| at t₀ over the replay is
0.1055 s, on 2026-09-18, when the table of 2026-01-01 had fallen 0.1055 s
behind a year in which ΔT rose; that run fires (σ was 0.0997 s).

Weekly table commits were measured and rejected. Refreshing the table every
week would have changed ΔT somewhere in the site's 2026–2030 event span by
1 ms or more in 81 of the 89 weeks (median largest change 0.0115 s, largest
0.0772 s). The site's generated data hold millisecond instants that prebuild
checks match exactly (`scripts/verify-events-publication.ts`,
`scripts/verify-horoscope-program.ts`, `scripts/replay-daily-publication.ts`
with its fixed goldens), so each such week would re-issue published data.

## 7. The engine chunk (`tools/bundle/`, `outputs/engine-chunk.json`)

The model is inline in the eager engine chunk, synchronous, with no build
transform of astronomy-engine. Static closure of `full.*.js`, gzip level 9,
as `scripts/report-bundles.mjs` counts it, on a scratch copy of the site at
982caca2:

| engine | engine chunk |
| --- | ---: |
| 0.1.1-rc.7 as vendored | 24,253 B |
| b457204 (rc8-phase1: steps 1.7, 1.10, 1.11) | 24,519 B |
| b457204 + `deltat.ts` + the E2 wiring (prototype) | 25,997 B |

The model and its wiring cost 1,478 B gzipped; the chunk is 397 B over the
25 KB budget (25,600 B), so A2 raises the `engine-chunk` budget to 26 KB
(26,624 B), which leaves 627 B. No route budget changes: every route
measures the same with and without the model (`routesUnchangedByModel`).
The knot table appears in the engine chunk and in the two transit workers
only. rc.7's Espenak–Meeus polynomial stays in the bundle as unused code.

## 8. Sources and licences (`sources.json`)

All retrieved 2026-09-25. Raw files are not committed; the tools find them
in `DELTAT_SOURCES` and refuse a file whose SHA-256 differs.

| file | from | Last-Modified | bytes | sha256 | licence | used for |
| --- | --- | --- | ---: | --- | --- | --- |
| finals2000A.all | https://maia.usno.navy.mil/ser7/finals2000A.all (mirror https://datacenter.iers.org/data/9/finals2000A.all, byte-identical) | 2026-09-24 17:37:44 GMT | 3,768,836 | cc80680ec05c91b65e7d02c6068fe0d44dd0998dc880551975092d2d14aa8e18 | IERS Rapid Service/Prediction Centre at USNO: US Government work; IERS asks that its products be cited | knots from 1973, prediction knots, gate 1 |
| eopc04.1962-now | https://hpiers.obspm.fr/iers/eop/eopc04/eopc04.1962-now | 2026-09-24 13:21:06 GMT | 5,171,976 | 7e39bb43bd1e1920517ed9316d3c5b14f898fe68afe9e0891bf18c4180b9d272 | IERS EOP 20 C04, free with citation | 1962–1972, gate 1, the floor F |
| tai-utc.dat | https://maia.usno.navy.mil/ser7/tai-utc.dat | 2026-06-18 17:26:25 GMT | 3,321 | 3524e1ae34d67e858873a89e59983bbc5bd100221da898e796c1b36036a310c3 | US Government work | TAI − UTC |
| historic_deltat.data | https://maia.usno.navy.mil/ser7/historic_deltat.data | 2026-06-18 17:26:25 GMT | 30,345 | 9f43514119060601a00624a5d9287a91b0b1f5e12bec5209bbabda90b392b70b | US Government work | knots 1941–1961; comparison |
| Table-S15.txt | member of rspa20160404supp2.zip | – | 5,194 | b972e922e6a2b666c7fb4baa4014b84818066458a3c3d300d630d991621cd037 | CC BY 4.0 | the reconstruction |
| extract-lunarocc.dat | member of rspa20160404supp2.zip | – | 13,055,292 | fb29fae0ea6c9a2e87de06b863fbd9a7888a0493b67b0674e265773534ca7277 | CC BY 4.0 (derived by SMH from IOTA/CDS VI/132B) | σ indicator D |
| rspa20160404supp2.zip | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5247521/supplementaryFiles (its MD5 322c18c8… equals the article's JATS record) | – | 1,501,355 | ae44da13701d36e4e449991c59391af5b0ab60d5068cc70f99ab6d24816fb860 | CC BY 4.0 | container |
| rspa20160404supp1.pdf | same, member (MD5 44538a36… as the JATS record) | – | 343,612 | 81c91834caf8fc688921696710d0fa34a30afe0cc688b88d4a13371cb5b85f64 | CC BY 4.0 | how Table S15 is evaluated (S5) |
| PMC5247521.xml | https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5247521/fullTextXML | – | 142,227 | 543c1466ed45225a16eb4f5935dbb67658d37bfa25c7fab0d9db0cce99a715bd | CC BY 4.0 | eq. (4.1), eq. (5.1), −25.82″/cy² |
| Table-S15.2020.txt | https://web.archive.org/web/20220320003423/http://astro.ukho.gov.uk/nao/lvm/Table-S15.2020.txt | – | 5,977 | cfcb7dfcac62484f7175b3ca3831ca0345a79b806e8a3ef218093ffd19e5e723 | none established (HMNAO page Crown copyright; Crossref lists only a text-and-data-mining licence for the addendum) | R only; nothing ships |
| bulletin-a/ (90 issues) | https://datacenter.iers.org/data/6/bulletina-xxxviii-001.txt … bulletina-xxxix-038.txt | – | per file in `sources.json` | per file in `sources.json` | IERS, free with citation | replay, calibration |
| bulletin-a-quarterly/ (44 issues) | same, nos. 1, 13, 26, 39 of volumes XXVIII–XXXVIII | – | per file | per file | IERS | calibration |

Stephenson, F. R., Morrison, L. V. & Hohenkerk, C. Y. 2016, Measurement of
the Earth's rotation: 720 BC to AD 2015. Proc. R. Soc. A 472: 20160404,
doi:10.1098/rspa.2016.0404, published under CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/). The engine ships 32 knot
values of its Table S15, rounded to 0.01 s and rebuilt as the same spline,
and the constants of its eq. (4.1) and (5.1); NOTICE and LICENSING carry the
attribution. The 2020 addendum (Proc. R. Soc. A 477: 20200776) is used only
as a measurement. HMNAO's web pages are not used. The IERS and USNO data
enter the table as 91 values in 0.01 s.

## 9. Files, and how to reproduce

- `README.md` (this file); `sources.json`; `sigma.json` (the σ indicators and
  points); `table.json` (the table and its digest input); `iers-12.json`
  (gate 1's twelve values, their source rows, formal errors and source
  digests; the engine's test fixture is this file).
- `outputs/`: statistics only. No Swiss position is committed. Swiss's only
  values here are its ΔT, in `swiss-deltat.json`: three figures (2026-09-22,
  2050 and 2100), and how far its ΔT sits from Table S15 and from the model
  before 1962.
- `tools/`: `run-all.sh` runs every tool in order. With the raw sources in
  `DELTAT_SOURCES`, Node 22.22.2, Python 3.11 and, for gate 3,
  `SWISS_EPHE` pointing at the two `.se1` files, it reproduces every file
  here byte for byte except `outputs/engine-chunk.json` (checked on a copy
  of the site at 982caca2 with rc.7 vendored). That file comes from the
  bundle measurement, `tools/bundle/run.sh` (three builds with `measure.sh`,
  then `summarize.py`), which is run separately on a scratch copy of the
  site. `tools/engine_fixtures.py` writes the engine's two test fixtures
  (`iers-12.json`, `table-s15-2016.json`).

## 10. The holdout (`tools/holdout.ts`, `tools/holdout_score.py`, `tools/moon/holdout-dump.mjs`)

`zodiacs-holdout/1.4` is generated after step 1.4's code commit by the
preregistered rule and opened once. Draw order, fixed here: 200 positions
(UTC uniform in whole milliseconds over [1800-01-01, 2200-01-01), then
latitude, then longitude), then 50 events without replacement from the
events catalog's events dated 2026-01-01 to 2035-12-31 sorted by instant and
id; the time part (500 zone and wall-minute pairs) does not apply to 1.4.
Scoring: the paired measure p95 ≤ 0.3″ in each era up to 2026, with the p50
gap reported; gate 1 (≤ 0.2 s) at the holdout instants from 1962-01-01 to
the last observed IERS day; the events part is run and reported, not gated:
for each drawn event, the regenerated catalog's instant minus rc.7's and,
with `../events-vs-swiss-2026-09-23/tools/compare.py`, minus Swiss's, as
statistics per event class.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) `outputs/swiss-deltat.json` kept its statistics (the largest
differences from the S15 reconstructions, 1800 to 1940, and from this model,
1800 to 1961, with the latter's RMS) and lost Swiss's ΔT at 2026-09-22, 2050
and 2100 and its differences from S15 at 1800, 1850, 1900 and the year 1000.
The figures quoted above, such as Swiss's 93.18 s at 2100, are as the file
had them. Commit `2ca93d41` still has it whole, the file records the SHA-256
of what it lost under `swissOutputRemoved`, and `tools/moon/swiss_deltat.py`
regenerates it. The record of everything removed is [`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
