# Track 2 — numerical references, time and frame conventions, error analysis

Working directory: `/home/user/precision/numerics`. Nothing under `/home/user/site`
was edited. Swiss Ephemeris is used only as a measuring instrument; no Swiss
code, data or output was a fitting target anywhere in this work.

Date: 2026-09-20. Kernel: `/tmp/claude-0/swisslab/de440s.bsp`
(sha256 `c1c7fee…a49f2`, 32,726,016 bytes). Swiss: pyswisseph 2.10.03, every
call's return flag checked to be SWIEPH.

---

## Headline

| | max | p50 | p95 | n |
| --- | --- | --- | --- | --- |
| cell D as published (prototype, matched clock) | 0.134444″ | 0.038260″ | 0.117433″ | 160 |
| **cell D after this track's reduction** | **0.010730″** | **0.000295″** | **0.001544″** | **160** |

Factor 12.5 on the maximum, 130 on the median, with no new data: the kernel,
the corpus, the comparator and the clock are all unchanged.

What the 0.134″ was made of. Each row puts ONE effect back to the prototype's
choice, leaving the rest at their best, and re-measures — so the figures are
attributions, not a decomposition (they do not sum, see below):

| effect restored to the prototype's choice | max″ | p50″ | cost over the best model |
| --- | --- | --- | --- |
| *(best model, nothing restored)* | 0.010730 | 0.000295 | — |
| omitted solar light deflection | 0.145044 | 0.003204 | +0.134″ max |
| astronomy-engine's 5-term nutation | 0.120869 | 0.034731 | +0.110″ max, +0.034″ p50 |
| no ICRF→dynamical-J2000 frame bias | 0.018214 | 0.006931 | +0.0075″ max, +0.0066″ p50 |
| first-order instead of full aberration | 0.010362 | 0.000422 | ±0.0004″ |
| TT used as TDB | 0.010685 | 0.000283 | ±0.00005″ |
| light-time at 1 iteration | 0.010061 | 0.000384 | ±0.0007″ |
| observer velocity by central difference | 0.010730 | 0.000295 | none at this precision |
| **unexplained remainder** | **0.010730** | **0.000295** | worst row `Moon@historic-02` (1850-07-04) |

They do not sum, and they partly cancel: removing only the nutation error
(`P1`) *raises* the maximum from 0.1344″ to 0.1385″ while dropping the median
from 0.0383″ to 0.0072″, because the nutation and deflection errors had
opposite signs on the worst case. Only the full set collapses the maximum.

---

## 1. The nutation attribution — CONFIRMED, independently, and it is worse than reported

The integrator's regression said the common-mode residual tracks
(astronomy-engine dpsi − Swiss dpsi) with r = 0.99992. That is confirmed, by a
route that does not use the corpus, the prototype or any regression.

`tools/t1-nutation-node.mjs` and `tools/t1-nutation-swiss.py` evaluate nutation
on a **shared TT grid** — `swe.calc`, not `swe.calc_ut`, so Delta-T cannot
enter — at 1,964 epochs from 1850-01-01 to 2150-01-01, stepped 37.211 days so
the sample does not sit on one phase of the 18.6-year cycle.

| comparison (nutation in longitude, arcsec) | n | mean | rms | max\|·\| | p95\|·\| |
| --- | --- | --- | --- | --- | --- |
| astronomy-engine `e_tilt` − Swiss | 1964 | +0.001198 | 0.075908 | **0.267695** | 0.151535 |
| published IAU 2000B − Swiss | 1964 | −0.000122 | 0.000394 | 0.001347 | 0.000946 |
| published IAU 2000A − Swiss | 1964 | +0.000132 | 0.000560 | 0.002249 | 0.001092 |
| IAU 2000B − IAU 2000A | 1964 | −0.000254 | 0.000731 | 0.003499 | 0.001486 |

Obliquity: astronomy-engine's **mean** obliquity matches Swiss to 0.000078″ max
(both are the IAU 2006 P03 polynomial), but its **true** obliquity is off by up
to 0.078″ — the whole error is nutation, none of it is precession.

The cause, read out of `node_modules/astronomy-engine/esm/astronomy.js`: the
function named `iau2000b` keeps only the **first five** of the published
77 luni-solar terms, plus the two constant planetary-bias offsets. It is not
IAU 2000B; it is a five-term truncation of it. `src/nutation.mjs`
reimplements exactly those five terms and reproduces the library bit-for-bit
(max difference 0.000000″ over 1,964 epochs), which is how the attribution was
made without patching the library.

**The corpus understates the ceiling.** Cell D's 0.134″ is what sixteen
epochs happen to sample. Over the kernel's full 1850–2150 range the
astronomy-engine nutation error reaches **0.250267″** (n = 15,010 body-epochs,
`raw/t4-summary.json`), and it is common-mode: the figure is identical to
1e-6″ for all ten bodies, Moon and Pluto included.

## 2. A real nutation — IAU 2000B, and why not 2000A

`src/nutation.mjs` implements both models from the published series, parsed by
`tools/parse-erfa-tables.py` out of ERFA (BSD-3-Clause, derived with permission
from IAU SOFA; the series itself is MHB2000 and McCarthy & Luzum 2003). The
parser asserts the published term counts — 77 for 2000B, 678 + 687 = 1365 for
2000A — and the module refuses to load if they are wrong. The Wallace &
Capitaine (2006) P03 consistency adjustment is applied. Vendored sources and
the ERFA licence are in `vendor/`.

**2000B is the justified choice, and it is a conditional judgement, not a
preference.**

| | table (raw JSON) | per evaluation | worst disagreement with 2000A |
| --- | --- | --- | --- |
| astronomy-engine 5-term | — | 0.460 µs | 0.2665″ |
| IAU 2000B (77 terms) | 2,788 B | 4.593 µs | 0.002661″ (n = 15,010, on longitude) |
| IAU 2000A (1365 terms) | 46,510 B | 77.525 µs | — |

2000A costs 17× the table and 17× the compute to buy at most 0.0027″ of
longitude — which is *below* the 0.0107″ the Moon still contributes and far
below the 0.083″ barycentre error in §4. **If** the Moon and barycentre items
were fixed, 2000A would become the next term worth having; today it is not.
Measured against Swiss, 2000B is in fact the *better* of the two (§1), but that
must not be the reason to choose it — agreement with Swiss is not accuracy, and
choosing a model because it matches the instrument is fitting.

### What it buys the shipped core: almost nothing, and that is the honest answer

Because the mean and true ecliptic of date are the same plane, changing the
nutation series shifts every longitude by exactly the change in dpsi. (The
sweep confirms this: the effect is identical across all ten bodies to 1e-6″.)
So the counterfactual can be formed exactly, and the control check passes —
patching cell D this way reproduces the independently recomputed variant to
3.3e-7″.

| cell (160 common rows) | max before → after | p50 before → after | p95 before → after |
| --- | --- | --- | --- |
| A core, engine time | 64.768228 → 64.781926 | 1.665090 → 1.756839 | 12.081680 → 12.047785 |
| B core, matched time | 17.403621 → 17.427798 | 1.446054 → 1.417766 | 11.816808 → 11.748064 |
| C prototype, engine time | 63.887274 → 63.900972 | 0.082327 → **0.013520** | 1.863555 → 1.875958 |
| D prototype, matched time | 0.134444 → 0.138452 | 0.038260 → **0.007212** | 0.117433 → 0.026708 |

For the shipped core the fix is **not measurable**: a 0.25″ correction
interferes randomly with a 1.4–17″ error and moves the statistics both ways.
It removes a known systematic and is worth doing on correctness grounds, but
no accuracy claim should be attached to it until the position series is good
enough for nutation to be the limiting term. That is a correction to the
brief's premise, which assumed the win transfers.

## 3. The −0.0075″ constant — it is the frame bias, CONFIRMED

DE kernels are in the ICRF. VSOP87-based astronomy-engine works in the
dynamical mean equinox of J2000. The prototype feeds the first into the second
without the bias rotation between them.

`src/frames.mjs` builds the chain explicitly (IAU 2006 Fukushima–Williams
precession angles, published IAU 2000 frame-bias constants
dpsi_b = −0.041775″, deps_b = −0.0068192″, dRA0 = −0.0146″). Two checks:

- With the bias step **removed** and astronomy-engine's own nutation fed in, my
  chain reproduces `A.Rotation_EQJ_EQD` to **6.3e-7 arcsec** (300 epochs ×
  3 axes, 1850–2149). That both validates my precession construction against an
  independent implementation and **proves astronomy-engine's EQJ is the
  bias-free dynamical frame**, not ICRS.
- With the bias step **present**, the same probe differs from astronomy-engine
  by **0.02212″** at every epoch — the 22 mas the brief suspected.

Applying the bias to the DE vectors shifts apparent longitude by
**−0.006855″ ± 0.000840″** (n = 160), against the −0.0075″ constant the
integrator's regression left over. Confirmed. Across 15,010 body-epochs the
term is 0.010492″ max, 0.006780″ p50 — near-constant, exactly the signature a
common-mode regression leaves behind.

## 4. Output-contract audit

Effect sizes are **differential** — model against model, on the model's own
output — so they do not depend on Swiss at all. Grid: 1,501 epochs × 10 bodies
= 15,010 rows, 1850–2150, stepped 73.03 days. Deflection and conjunction
figures come from a separate daily scan, 109,591 days per body.

| effect | bodies affected | geometry where it bites | size (arcsec) | prototype handles it? |
| --- | --- | --- | --- | --- |
| **Nutation series** (5-term vs IAU2000B) | all ten, identically | everywhere; worst near dpsi extrema | max 0.2503, p50 0.0529, p95 0.1472 | **no** — inherits astronomy-engine's `Rotation_EQJ_ECT` |
| **Frame bias** ICRF→dynamical J2000 | all ten | everywhere, near-constant | max 0.0105, p50 0.0068 | **no** — omitted entirely |
| **Gravitational deflection (Sun)** | all planets; not the Moon (max 6e-6) | solar conjunction; peaks 1–2 days *off* minimum elongation, where the offset stops being purely latitudinal | outside the solar disc: 0.399 (Mercury) to 1.090 (Saturn); through the disc: up to 190.9 (Mercury). 0.0027 p50, 0.0334 p95 on a blind grid | **no** — declared omitted |
| ↳ how often it matters | each planet | any day | of 109,591 days: \|Δλ\| > 0.05″ on 2,070 (Mercury), 4,837 (Venus), 5,459 (Mars), 5,563 (Jupiter), 5,246 (Saturn), 5,648 (Uranus), 5,474 (Neptune), 613 (Pluto); > 0.01″ on 23,785–27,051, i.e. **a fifth to a quarter of all days for every planet** | — |
| **Body centre vs planetary-system barycentre** | Mars..Pluto (de440s has barycentre segments only); Mercury/Venus unaffected (their 199←1 / 299←2 segments are **identically zero**, verified over 3,000 samples) | outer planets at perihelic opposition; Pluto worst | Jupiter 0.0665 (p50 0.0181), Saturn 0.0497 (p50 0.0276), Neptune 0.0035, Pluto 0.0833 lon / 0.0836 lat. Measured with real NAIF satellite kernels, not estimated | **no** — reports the barycentre and calls it the planet |
| **Second-order aberration** | all ten | maximal at ~45° from the apex of the Earth's motion | max 0.000527, p50 0.000319 | **no** — first order only |
| **Aberration at all** | all ten | everywhere | max 21.50, p50 17.45 | yes |
| **TT used as TDB** | Moon materially; others ≤0.00014 | everywhere; scales with apparent rate | max 0.001057 (Moon), p50 0.0000072 | **no** — the code comments call TDB−TT "negligible"; it is, except for the Moon |
| **Light-time iteration** | Mercury and the Moon converge slowest relative to their rate | none — converges everywhere | after 1 iteration 0.003939; after 2, 5.4e-6; after 3, 1.0e-9 | yes — 5 iterations is ample |
| ↳ **coverage padding it needs** | Pluto sets the requirement | within ~0.3 d of a segment's start | max light time 25,091.5 s = 0.2904 d; plus 60 s for the h=60 observer velocity | **partly** — it refuses rather than extrapolating (fail-safe), but the message says the *instant* is outside coverage when it is the light-time lookback, and ~0.29 d of nominal coverage is silently unusable |
| **Central-difference observer velocity** | all ten (aberration) | none | h=60 s: 8.19e-10; h=600 s: 5.75e-8 | yes — and h could be 600 s with no cost |

Deflection by solar elongation, blind grid (n in each bin):

| elongation | n | max″ | p50″ |
| --- | --- | --- | --- |
| 0–1° | 123 | 1.7445 | 0.0427 |
| 1–2° | 139 | 0.3443 | 0.0766 |
| 2–5° | 384 | 0.1932 | 0.0449 |
| 5–10° | 700 | 0.0870 | 0.0236 |
| 10–20° | 1515 | 0.0444 | 0.0116 |
| 20–45° | 2978 | 0.0222 | 0.0066 |
| 45–90° | 2963 | 0.0097 | 0.0047 |
| 90–135° | 2453 | 0.0042 | 0.0022 |
| 135–180° | 2254 | 0.0018 | 0.0005 |

At quadrature it is 0.005″ and looks ignorable. That is the reading a
quadrature-only test would produce, and it is wrong for a quarter of all days.

**One implementation trap, found and fixed here.** ERFA's `eraLdsun` clamps
`q·(q+e)` at 1e-6, which silently caps the deflection near the limb at about a
tenth of an arcsecond. Copying that constant hides exactly the geometry the
audit exists to measure. `src/apparent2.mjs` keeps a clamp (the formula does
diverge) but at 1e-14, and reports whether it bound.

**What fixing the barycentre would take.** A satellite-ephemeris SPK per body,
carrying the centre-relative-to-barycentre segment: jup348 60 MB, sat480
12.6 MB, nep097 105 MB, plu060 135 MB — about 313 MB against the 31 MB of
de440s, and the full-fidelity alternatives are larger still (jup365 1.14 GB,
sat441 661 MB). So it is a 10× data cost for ≤0.084″, versus simply *declaring*
the barycentre convention. **Swiss appears to adopt the same convention**: after
the improved reduction, Jupiter, Saturn, Neptune and Pluto agree with Swiss to
0.00044″, 0.00154″, 0.00055″ and 0.00086″ respectively — one to two orders
below the 0.02–0.08″ barycentre/centre separation, which is only possible if
Swiss is reporting barycentres too. **Agreement with Swiss cannot detect this
class of error at all**, because the instrument shares the convention.

### What is left, and it is the Moon

Best-model residual against Swiss, signed, by body (n = 16 each):

| body | mean″ | max\|·\|″ |
| --- | --- | --- |
| Moon | −0.001749 | **0.010730** |
| Venus | −0.000304 | 0.003122 |
| Saturn | −0.000214 | 0.001537 |
| Mars | −0.000084 | 0.001476 |
| Sun | −0.000269 | 0.001241 |
| Mercury | −0.000183 | 0.001072 |
| Pluto | −0.000024 | 0.000856 |
| Uranus | −0.000115 | 0.000772 |
| Neptune | −0.000074 | 0.000553 |
| Jupiter | −0.000063 | 0.000439 |

The Moon's residual grows backwards in time — 0.0013″ in 2000, 0.0026″ in 1900,
0.0107″ in 1850 — which is the signature of a lunar-ephemeris *version*
difference (Swiss's `semo_18.se1` is a fit to DE431; this kernel is DE440),
not of a reduction error. That is a hypothesis consistent with the data, not a
proven attribution: testing it needs a DE431 kernel, which is not present.
Everything else now sits at 0.4–3 mas, which is the same order as the
0.39–0.56 mas rms by which Swiss's own nutation differs from *both* published
IAU models (§1). **We are at the floor of what "agreement with Swiss" can measure.**
Chasing the last 0.4 mas would be fitting to the instrument.

*Correction, 2026-09-23.* The `.se1` files used here are not a fit to DE431.
Both headers read "Created for Astrodienst in Switzerland 2026/05/26, based
on JPL Ephemeris DE441", and their hashes are the ones pinned in
`../../swiss-benchmark/CONFIGURATION.md`. The engine audit then measured the
attribution this paragraph left open. With the frame residual cancelled
against Horizons, whose Moon is DE441, Swiss's `.se1` Moon agrees with it to
0.0018″ rms and this DE440s kernel's Moon differs from it by up to 0.0103″.
Swiss run on its `.se1` files minus Swiss run on the DE440 binary gives the
same shape: 0.0104″ at 1851, under 0.001″ from 1933 to 2012, 0.0085″ at
2148. The Moon's 0.0107″ is the DE440-versus-DE441 lunar difference
(`../../engine-audit-2026-09-22/LEDGER.md`, swiss-parity-3). Horizons's
geometric vectors confirm it with no frame model. The DE440s Moon is
10.24 mas from DE441 at 1851 and 8.60 mas at 2148, and under 1 mas from
1933 to 2020 (`../../engine-beyond-swiss/horizons-frame/vectors/`).

## 5. Independent SPK reader — the readers agree to 1.7 ulp

`src/spk_independent.py` is a second reader written from the NAIF DAF/SPK
format description, deliberately differing in three ways: the file is
memory-mapped and viewed as one float64 array rather than read record by
record; the covering Chebyshev record is found by **binary search over the
midpoints stored in the data**, with the directory's
`floor((et−init)/intlen)` arithmetic then checked against it; and the
polynomial is evaluated by `numpy.polynomial.chebyshev.chebval` (Clenshaw), a
different algorithm from the explicit forward `T_k` recurrence in `spk.mjs`.

Compared at **13,188 sample states** across all 14 segments — 900 interior
points per segment plus both endpoints and 40 day-boundary-snapped instants:

| | |
| --- | --- |
| max absolute difference | **9.54e-7 km** (0.95 mm) |
| max relative difference | **3.86e-16** (≈1.7 double-precision ulp) |
| rows identical to the last bit | 6,302 / 13,188 |
| worst segment | Neptune and Pluto barycentres, 9.5e-7 km at ~4.3e9 km — 4.6e-11 arcsec |

The difference is floating-point summation order and nothing else. **The
custom reader in `spk.mjs` is confirmed correct.**

Two things the cross-check turned up that a single reader would not:

- 190 of the 13,188 sample instants land exactly on a boundary shared by two
  Chebyshev records, where the directory index and the data index legitimately
  differ by one. Both records return **bit-identical** positions there, which
  is a strong statement about the kernel's own continuity.
- A check that uses neither reader's twin: the mass-weighted sum
  `Σ GM_i·r_i / Σ GM_i` over the ten DE440 point masses sits 103–137 km from
  the origin (n = 23 epochs), varying smoothly over centuries rather than with
  any planetary period, and both readers reproduce it identically. That is
  1e-7 of the Sun's own barycentric excursion and no reader bug would survive
  it. The size and the century-scale drift are consistent with the massive
  trans-Neptunian objects DE440 integrates but de440s carries no segment for —
  **inferred, not proven**.

## 6. Analytic bounds — PROVEN, kept separate from the sampled figures

Sampled maxima above are SAMPLED. These are derived. Inputs measured from the
kernel are in `raw/t6-bound-inputs.json` (6,000 epochs per body).

**B1. Light-time iteration (rigorous).** The iteration is the fixed point of
`T(τ) = |r_B(t−τ) − r_E(t)| / c`, with `T′(τ) = −(û·v_B(t−τ))/c`, so
`|T′| ≤ v_max/c`. Measured over the kernel, `v_max = 58.9901 km/s` (Mercury),
so `k = 1.9677e-4`. Banach gives error after n steps `≤ kⁿ·τ*`, and
`τ* ≤ 25,091.1 s` (Pluto). Hence n=1 ≤ 4.937 s, n=2 ≤ 9.715e-4 s,
n=3 ≤ 1.912e-7 s, n=4 ≤ 3.761e-11 s, n=5 ≤ 7.401e-15 s. Multiplying by the
maximum apparent longitude rate (0.6411 ″/s, the Moon — whose own τ is 1.36 s,
so pairing the two is conservative by four orders): n=3 ≤ 1.23e-7 ″ and
**the prototype's five iterations are provably below 4.75e-15 ″**. Sampled:
1.0e-9 ″ after three iterations, which is the tolerance cut, not the
iteration.

**B2. Barycentre versus body centre (rigorous).** The angular displacement is
exactly `|d_⊥|/ρ ≤ d_max/ρ_min`, with both quantities measured from the
kernels. Jupiter: 220.045 km / 3.9502 au → **≤0.07672″** (sampled lon 0.06650″).
Saturn: 310.540 km / 8.0343 au → ≤0.05329″ (sampled 0.04969″). Neptune:
74.3 km / 28.8197 au → ≤0.00355″ (sampled 0.00352″). Pluto: 2132.05 km /
31.4572 au → **≤0.09345″** (sampled 0.08327″ lon, 0.08360″ lat). Every sampled
figure sits under its bound, and Neptune's is tight to 1%.

**B3. Nutation error propagates one-to-one (rigorous, given the standard
definitions).** Nutation does not move the ecliptic plane, only the equinox
along it, so a change `δψ` in nutation-in-longitude shifts every apparent
ecliptic longitude by exactly `δψ`, independent of latitude. Sampled
confirmation: the effect is 0.250267″ for all ten bodies, agreeing to 1e-6″.

**B4. TT used as TDB (rigorous, given the published series bound).** The
periodic TDB−TT series is bounded by 1.7 ms. With the maximum apparent
longitude rate 0.6411 ″/s (Moon), `|Δλ| ≤ 0.0010899″`. Sampled max 0.001057″ —
the bound is tight to 3%.

**B5. Central-difference observer velocity (proven form, empirical
coefficient).** Taylor with Lagrange remainder gives exactly
`v_cd − v = (h²/6)·r‴(ξ)`. The coefficient is bounded here numerically rather
than symbolically, so this is labelled *proven form*: measured against the
analytic Chebyshev derivative over 4,000 epochs, the Earth's barycentric
velocity error is 1.04e-9 km/s at h=60 s and 8.27e-8 km/s at h=600 s, i.e.
7.2e-10″ and 5.7e-8″ of aberration.

**B6. Deflection (proven to leading order in GM/c²).** `δ = 4GM/(c²b)`, with
`b` the impact parameter; for a source at distance D seen at elongation θ from
an observer at R from the Sun, `b ≈ R·sinθ·(1 − R/D)`. This is a leading-order
Schwarzschild result, not a rigorous bound, and it diverges as `b → 0`; the
sampled figures in §4 are the honest ones.

**B7. Second-order aberration — NOT proven.** The `(v/c)²/2 = 5.1e-9 rad =
1.05 mas` scaling is a leading-order estimate, and the sampled maximum
(0.527 mas over 15,010 rows) respects it, but I did not derive a rigorous
bound on the remainder. Labelled empirical.

---

## Failures, limits, and things this work cannot claim

- **The corpus is spent and small.** Sixteen cases, 160 rows. Cell D is
  reported on it only because that is what makes the number comparable with
  the published 2×2. Everything else here uses grids of 15,010 rows or
  109,591 days. The 0.0107″ is a **sampled** figure on a spent corpus and must
  not be quoted as a bound.
- **"Agreement with Swiss" is not accuracy.** §4 shows the barycentre error —
  up to 0.084″, eight times the residual — is completely invisible to the
  Swiss comparison because Swiss shares the convention. Any headline built on
  Swiss agreement inherits that blind spot.
- **The Moon's 0.0107″ is unexplained.** The DE431-vs-DE440 hypothesis fits the
  epoch dependence but is not tested; no DE431 kernel is present.
  *Correction, 2026-09-23:* explained since, and not by DE431. The `.se1`
  files are DE441-based, and the residual is the DE440-versus-DE441 lunar
  difference (see the correction in §4).
- **Swiss's own nutation matches neither published model.** It is within
  0.0013″ of IAU 2000B and 0.0022″ of IAU 2000A, correlated with the difference
  between them, and identical to neither. The last ~0.4 mas rms is a Swiss
  implementation detail. It is deliberately not chased: doing so would be
  fitting to the instrument.
- **The SSB mass-balance attribution to trans-Neptunian objects is inferred**,
  not demonstrated.
- **Nothing here is wired into the site**, the default bundle, the published
  package, any schema or any saved record.

### A defect in the shared comparator (not fixed — outside this track's write scope)

`docs/platform/evidence/swiss-benchmark/tools/compare.mjs` seeds its
`worstCase` reduce with `m?.dLonArcsec ?? -1` and compares through
`Math.abs`, so the seed behaves as a 1-arcsecond floor: **whenever the worst
row is under 1″, `worstCase` is silently reported as `null`.** Every report at
this track's accuracy level is affected — the reproduced cell D prints
`"worstCase": null`. The summary statistics are unaffected. `tools/t2-report.mjs`
recomputes the worst row itself rather than editing the site file.

---

## Files

| path | what |
| --- | --- |
| `src/nutation.mjs` | IAU 2000A (1365 terms) and 2000B (77 terms) from the published series; the astronomy-engine 5-term series reimplemented for comparison; P03 adjustment |
| `src/nutation-series.json` | the parsed coefficient tables |
| `src/frames.mjs` | IAU 2006 Fukushima–Williams precession, frame bias, nutation, ecliptic of date, as switchable matrices |
| `src/spk2.mjs` | second JS SPK reader, adds analytic Chebyshev-derivative velocities |
| `src/spk_independent.py` | independent Python/numpy reader (mmap, binary search, Clenshaw) |
| `src/apparent2.mjs` | the instrumented reduction; every modelling choice a switch |
| `tools/parse-erfa-tables.py` | extracts the published series from the vendored ERFA sources |
| `tools/t1-nutation-node.mjs`, `t1-nutation-swiss.py`, `t1-analyse.py` | the nutation comparison |
| `tools/t2-sweep.mjs`, `t2-report.mjs` | the 21-variant sweep and its comparison against Swiss |
| `tools/t2-core-counterfactual.mjs` | what the nutation fix does to each 2×2 cell |
| `tools/t4-effects.mjs`, `t4-analyse.py` | the differential effect sweep |
| `tools/t4-deflection.mjs`, `t4-conjunctions.mjs` | deflection where it bites |
| `tools/t4-barycentre.mjs` | barycentre vs body centre, with real satellite kernels |
| `tools/t5-dump-js.mjs`, `t5-compare.py` | the two-reader cross-check |
| `vendor/` | ERFA sources and licence |
| `raw/SUMMARY.json` | **every headline figure in one machine-readable file, each with its denominator** |
| `raw/` | all other JSON outputs, named in the reproduction block below |

## Reproduction

```sh
cd /home/user/precision/numerics
K=/tmp/claude-0/swisslab/de440s.bsp
S=/tmp/claude-0/swisslab/swiss-measure.json
PY=/tmp/claude-0/swisslab/venv/bin/python3

python3 tools/parse-erfa-tables.py vendor src

# 1. nutation attribution
node tools/t1-nutation-node.mjs > raw/t1-node.json
$PY tools/t1-nutation-swiss.py raw/t1-node.json /tmp/claude-0/swisslab/ephe > raw/t1-swiss.json
python3 tools/t1-analyse.py raw/t1-node.json raw/t1-swiss.json raw/t1-summary.json

# 2 and 3. the sweep, and cell D re-measured
node tools/t2-sweep.mjs $K $S raw/sweep
node tools/t2-report.mjs                      # -> raw/t2-sweep-summary.json
node tools/t2-core-counterfactual.mjs raw/counterfactual

# 4. output contract
node --max-old-space-size=4096 tools/t4-effects.mjs $K > raw/t4-effects.json
python3 tools/t4-analyse.py                   # -> raw/t4-summary.json
node tools/t4-deflection.mjs  > raw/t4-deflection.json
node tools/t4-conjunctions.mjs > raw/t4-conjunctions.json
node tools/t4-barycentre.mjs  > raw/t4-barycentre.json

# 5. independent reader
node tools/t5-dump-js.mjs $K raw/t5-js-dump.json
$PY tools/t5-compare.py raw/t5-js-dump.json $K raw/t5-reader-agreement.json

# baseline: the published cell D, reproduced exactly (0.13444391481698403)
P=/home/user/site/docs/platform/evidence/swiss-benchmark
node $P/prototype/dump-prototype.mjs $K $S > raw/repro-cellD-dump.json
node $P/tools/compare.mjs raw/repro-cellD-dump.json $S > raw/repro-cellD-report.json
```

Satellite kernels for §4 (NAIF, public domain), downloaded to
`/tmp/claude-0/satkernels/`: `jup348.bsp`, `sat480.bsp`, `nep097.bsp`,
`plu060.bsp` from
`https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/satellites/`.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../../programme/DECISIONS-2026-09-28.md)
Swiss's raw output left this directory. Four files were removed:

| File | SHA-256 |
| --- | --- |
| `raw/t1-swiss.json` | `31b0970247d489e0940ed391a8f83898ac2dc1df7c468467028bf391d31c938f` |
| `verify/t1-swiss.json` | `31b0970247d489e0940ed391a8f83898ac2dc1df7c468467028bf391d31c938f` |
| `verify/v1-swiss.json` | `aeee17ed869a2e1614d06dfd5781ebb4643e8a539f1597bd5d3e9049bc1ae81d` |
| `verify/v4-dense-diff.json` | `3b3bf96567ea5a63370abaa8e6722c7c6809af141d9c8757a9f81abdab799890` |

The per-row differences also left the sweep, hold-out and reproduction
reports (`raw/sweep/`, `raw/repro-cellD-report.json`, `verify/p8-report.json`,
`verify/repro-cellD-report.json`, `verify/holdout-*-report.json`), and Swiss's
ΔT left the counterfactual cells. Their statistics stay, each file records
the SHA-256 of what it lost under `swissOutputRemoved`, and the figures above
are unchanged. Commit `2ca93d41` still has everything, and the recipes above
regenerate it; point the ones that write `raw/t1-swiss.json` and
`verify/v4-dense-diff.json` outside the repository. The record of everything
removed is
[`../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
