# Track 3 — Event search and the Uranus D failure

Working directory: `/home/user/precision/search`. Nothing under `/home/user/site`
was modified; the repository was read only, for the fixture, the v6 policy and
the DE prototype module.

Regenerate everything with `sh run-all.sh` (5.5 s wall, 13 tests, four raw
JSON files).

**The original contract is unchanged.** The v2/v3 Uranus D exact-topology
contract is still `failed-incomplete` at its own 0.05° budget, with its
recorded 0.044188° witness intact. Nothing below lowers that tolerance,
weakens that policy, relabels a missing pass, or offers a denser scan as a
resolution. What is new is a separate, explicitly versioned contract with a
different backend and a separately argued budget, reported alongside the
original rather than in place of it.

---

## 1. Reproduction of the original failure

`node reproduce.mjs` → `raw/reproduction.json`

The case: Uranus, conjunction with the frozen external literal
T = 32.6940395°, over 2019-01-01 .. 2020-12-31, clock UTC → TT, angular budget
B = 0.05°. The recorded failed witness is a turning point (`turn:2`,
role `exact`) whose circular distance to the exact level is 0.04418806505509565°
where the conditioning gate requires more than B + 1e-9 = 0.050000001°.

Everything that is undecided reduces to the sign of one scalar:

> **g\* = longitude(t\*) − T** at the January 2020 turning point.
> g\* < 0 → two crossings. g\* = 0 → a tangency. g\* > 0 → none.

Three independent position sources, station located independently by each:

| source | station (UTC) | \|g\*\| (deg) | vs recorded (arcsec) | clears the 0.050000001° gate |
| --- | --- | --- | --- | --- |
| Swiss 2.10.03, flags 258, v6 clock | not kept (below) | 0.04418806605816883 | +0.0000036 | no |
| DE440s prototype, TT pinned to UTC+69.184 s | 2020-01-11T02:10:34.210Z | 0.044174733140231 | −0.0480 | no |
| shipped core engine (`@zodiacs/engine/internal`) | 2020-01-11T02:10:47.833Z | 0.043326341573135 | −3.1022 | no |

Swiss reproduces the recorded witness to 3.6e-6 arcsec — that is the same
instrument and the same clock recipe, so it is a check on the harness. The DE
prototype reproduces it to **0.048 arcsec** from a completely independent
position series, which is the substantive confirmation. The failure is real and
is not an artefact of any one implementation.

Put to the bounded search at the original budget (ε = 0.05°, 1-ms clock,
100-ms subdivision floor):

| component | recorded | search verdict | count |
| --- | --- | --- | --- |
| D-component-1 (2019-02-27 .. 2019-06-24) | 1 exact pass, `resolved` | `crossing`, certified | 1 |
| D-component-2 (2019-09-30 .. 2020-04-10) | source count 2, `uncertain` | `unresolved-interval`, incomplete | null, possible {0,1,2} |

Identical on both backends. That is the recorded contract exactly.

### What the original contract can and cannot decide

**Decides.** Component membership: 28 threshold margins clear B, giving four
ordered physical threshold roots, two complete components, the real gap between
them, and five membership witness cells. The first component's single exact
pass with its conditioned timing band. Crop membership at both closed halves
(`membershipAmbiguousWithinBudget` is false at every crop boundary).

**Cannot decide.** The exact-pass count inside the second component
(`unresolved-cross-model-count`). Whether that component has a peak at all, and
whether it would be an exact pass or a positive closest approach
(`globalMinimum` is null). The crop exact-count at the 2020-01-01 boundary
(`exactCountAmbiguousWithinBudget` is true on both halves). Any local-minimum
count inside the second component, which the same ambiguity can create or
destroy.

### Why 0.044188 vs 0.05 blocks certification

Not because 0.044188° was measured as an error. B = 0.05° is the case's
*declared* angular acceptance budget, and the conditioning gate compares
turning-point margins against it. A function displaced anywhere inside a
±0.05° allowance can put that turning point on either side of the level, so
root counts of 2, 1 and 0 are all consistent with the allowance simultaneously.
Shrinking B to fit 0.044188 would be choosing the tolerance after seeing the
margin — which the policy's own `limitsPolicy` and `failure` clauses forbid
outright, and which is not done anywhere in this track.

---

## 2. The four-way decomposition

`node decompose.mjs` → `raw/decomposition.json`

Each source is sized as its contribution to **g\***, the decision variable, and
separately as its contribution to crossing *times* where those differ. They are
kept apart because they have different sizes, different provenance and
different remedies.

| # | source | contribution to g\* (deg) | how measured, with denominator |
| --- | --- | --- | --- |
| 1 | root-finding | 5.9e-19 (+1.4e-14 floating point) | 1-ms bisection residual × measured curvature, second order; ULP of a longitude near 32° |
| 2a | ephemeris/model, DE vs Swiss | 1.33e-5 | the two independently located station values, clocks matched |
| 2b | ephemeris/model, core vs Swiss | 8.62e-4 | same, with the core engine's own Delta-T |
| 3 | time-model | ≤ 6e-14 | pinned-TT perturbed by a full second, 10⁴× the policy's 0.001 s guard |
| 4 | root-count ambiguity | **not an error term** | the declared allowance, 0.05°, against \|g\*\| = 0.0442° |

**1. Root-finding.** At a turning point the first derivative vanishes, so a
timing residual δt costs \|f''\|·δt²/2 in value, not \|f'\|·δt. At the measured
curvature (8.576e-4 °/day² at the station) a 1-ms residual is worth 5.9e-19°.
Crossing *locations* are a different matter and behave linearly: the slope at
each January pass is 0.00874 °/day, so the 100-ms bracket floor costs 1.0e-8°,
and even the policy's own 0.1-second bracket costs under 1e-7°. Seventeen
orders of magnitude below the margin. Root-finding is not why this failed.

**2. Ephemeris / model disagreement.** Measured against Swiss as an instrument,
clocks held fixed. Nothing is fitted to Swiss; Swiss and DE440s both descend
from JPL development ephemerides, so this is *consistency*, not accuracy.

| grid | n | DE − Swiss max / p50 / p95 (arcsec) | core − Swiss max / p50 / p95 (arcsec) |
| --- | --- | --- | --- |
| second component, 6-hourly | 774 | 0.2365 / 0.0502 / 0.1619 | 3.4519 / 3.1703 / 3.3752 |
| the undecided region, hourly | 913 | 0.1089 / 0.0619 / 0.0965 | 3.1645 / 3.0120 / 3.1522 |

On the decision variable itself: DE differs from Swiss by 0.048 arcsec
(1.33e-5°), the core engine by 3.10 arcsec (8.62e-4°). This is the only source
with a size comparable to a plausible budget, and it is still 3300× smaller
than the margin it would have to cover. Its known ceiling is the prototype's
reuse of `astronomy-engine`'s truncated nutation series — a reduction-model
choice, not the position series.

**3. Time-model.** This window is historical, so TT − UTC is exactly 69.184 s
(37 leap seconds + 32.184) throughout; no leap second falls inside it and no
Delta-T extrapolation enters. Swiss's own TT − UTC differs from it only by its
Julian-day rounding, under 0.0001 s, well inside the policy's 0.001 s guard.
Perturbing the pinned TT:

| shift | station moves | g\* changes |
| --- | --- | --- |
| 0.001 s | −0.001 s | 1.4e-14° (one ULP) |
| 0.1 s | −0.1 s | 0 |
| 1 s | −1 s | 0 |
| 10 s | −10 s | 1.4e-14° (one ULP) |

The structure, not the numbers, is the point: a uniform clock shift moves the
turning point in time by exactly that shift and changes its *value* only at
second order, so the clock reaches the count only through a term of size
\|f''\|·δt²/2. It moves the crossing *timestamps* one-for-one, which matters
for publication and not at all for topology.

One measured side-finding: `astronomy-engine`'s Delta-T at 2020 is 71.593 s
(the Espenak–Meeus polynomial), against the policy's TT − UTC of 69.184 s — a
2.41 s difference. At Uranus's speed that is 1.7e-6° of longitude, so it
explains none of the core engine's 3.1 arcsec offset from Swiss. The core
engine's gap is series and nutation, not clock.

**4. Genuine ambiguity in the number of roots.** This is a decision, not an
error. The count is decidable exactly when the declared allowance is smaller
than \|g\*\|. The critical value is \|g\*\| itself: 0.044188 (Swiss), 0.044175
(DE), 0.043326 (core). The original 0.05° budget exceeds it by 0.0058°.

The ladder, DE backend, second component:

| ε (deg) | verdict | count |
| --- | --- | --- |
| 0.05 | `unresolved-interval` | {0,1,2} |
| 0.0442 | `unresolved-interval` | {0,1,2} |
| 0.044 | `multiple-crossings` | 2 |
| 0.02 … 0.0001 | `multiple-crossings` | 2 |

So the contract is ambiguous by **0.0058° of budget**, not by 0.0058° of
measured error. Sources 1–3 together contribute under 1e-3°; the remaining
0.049° of the 0.05 budget is headroom the contract spends without exercising.
Collapsing the four into one error bar would hide exactly that.

---

## 3. The bounded search

`lib/interval-search.mjs`. Built on the repository's own machinery: the shipped
engine (`@zodiacs/engine/internal`), the repository's DE prototype
(`docs/platform/evidence/swiss-benchmark/prototype/apparent.mjs`) and Swiss as
the oracle through `lib/swiss-longitudes.py` on the v6 clock recipe. No second
event system.

### Typed verdicts

`crossing` · `no-crossing` · `stationary-touch` · `multiple-crossings` ·
`boundary-event` · `unresolved-interval`

`no-crossing` is an addition to the five requested names. The empty case is a
real, certifiable outcome; reporting it as `unresolved-interval` would be a
false negative. An orthogonal `outcome` field says what the verdict is worth:
`certified`, `incomplete`, or `refused`.

### Method

The interval is decomposed by adaptive subdivision into cells, each closed by
one of two tests — rigorous *given the declared derivative enclosure* — or left
open at a declared floor width:

- **exclusion** — the mean-value enclosure of f over the cell misses
  [−ε, +ε] entirely. No root, and the sign cannot change, whatever happens
  inside. Turning points inside an excluded cell are irrelevant to the count.
- **monotone** — the derivative enclosure excludes zero. At most one root,
  settled by the two end values.
- **floor** — neither test closed it. The cell stays **open** and the search
  refuses to certify a count.

Adjacent cells that behave identically are merged into runs, so a root can never
land on a junction the subdivision itself invented, and every junction next to a
closed cell is further than ε from the level. Adjacent open runs merge into one
open *region*: a single undecided turning point normally leaves a monotone run
open on either side of it, and counting those separately would inflate the
ambiguity (it did, in the first version of this code — it reported {0,1,2,3,4}
where {0,1,2} was correct).

This is what a dense scan cannot do. A scan can only say "no sign change was
seen between the samples I took". The exclusion and monotone tests say "no sign
change *exists* in this cell, given the declared bound". That is why a
derivative enclosure is required rather than optional.

### Honest incompleteness and refusal

- Budget exhaustion returns `outcome: 'refused'` with
  `reason: 'evaluation-budget-exhausted:<stage>'` and `crossings: null`.
- Any uncertified verdict sets `crossings` to null and puts whatever was found
  under `partialUncertifiedFindings`, whose `warning` begins **"NOT
  EXHAUSTIVE"**. There is no path by which a partial list is returned in the
  field a caller would read as complete.
- `possibleRootCounts` is a set when the open regions can be bounded, and
  **null** when they cannot — which happens when no second-derivative enclosure
  is supplied or it fails to exclude zero over the region. "Unbounded" is
  reported as unbounded, not as a wide guess.
- Bad preconditions refuse before any evaluation.

### Provenance, carried on every verdict and never inferred

`boundKind: 'proven'` means the derivative enclosure is closed-form interval
arithmetic and the completeness claim is a theorem. `boundKind: 'empirical'`
means it holds if the declared curvature bound holds; the astronomical harness
measures |f''|, |f'''| and |f''''| on a 401-point grid and inflates them
tenfold, and says so in the output.

`exactArithmetic` is a separate declaration by the caller. **Only under it may
a tangency be certified**, because a tangency is a measure-zero event that no
finite sampling of an inexact function can distinguish from a 1e-33-deep
crossing or a 1e-33-high near miss. That route requires ε = 0, an exactly zero
turning-point value and a certified one-sided curvature. It is closed to every
ephemeris-backed function, permanently.

One capability was deliberately removed: an earlier version tried to pin an
open region's count by parity when its outer signs differed. With a certified
single turning point the outer signs are always *equal*, so the branch was
unreachable, and shipping unreachable code that claims a certification is worse
than not having it.

---

## 4. The analytic suite

`analytic-cases.mjs`, `test-analytic.mjs` → `raw/analytic-results.json`.
All enclosures are closed-form interval arithmetic, so these completeness
claims are **proven**, not sampled. 13 tests, all passing.

| case | function | expected | got | count | evals |
| --- | --- | --- | --- | --- | --- |
| A transversal crossing | sin t − 0.5 on [0, 1.4] | `crossing` | `crossing` | 1 | 43 |
| B exact tangency | t² on [−1, 1], ε = 0 | `stationary-touch` | `stationary-touch` | 1 | 86 |
| C near-tangency, no crossing | t² + 1e-9, ε = 0 | `no-crossing` | `no-crossing` | 0 | 3 |
| C2 same, ε = 1e-8 > the 1e-9 miss | t² + 1e-9 | `unresolved-interval` | `unresolved-interval` | {0,1,2} | 86 |
| D two roots 2e-6 apart | t² − 1e-12, ε = 0 | `multiple-crossings` | `multiple-crossings` | 2 | 103 |
| D2 same, ε = 1e-11 > the 1e-12 dip | t² − 1e-12 | `unresolved-interval` | `unresolved-interval` | {0,1,2} | 106 |
| E root on the left boundary | sin t on [0, 1] | `boundary-event` | `boundary-event` | 1 | 2 |
| E2 root on the right boundary | t − 1 on [0, 1] | `boundary-event` | `boundary-event` | 1 | 2 |
| F two well-separated roots | cubic on [−1, 1] | `multiple-crossings` | `multiple-crossings` | 2 | 87 |
| G budget refusal | t², maxEvaluations = 20 | `refused` | `refused` | null | 21 |
| H no curvature enclosure supplied | t² + 1e-9, ε = 1e-8 | counts unbounded | `possibleRootCounts: null` | — | 83 |

Each certified verdict is additionally asserted to bracket every true root and
to invent none. Each uncertified verdict is asserted to expose no root list and
to carry the "NOT EXHAUSTIVE" label.

The paired cases are the point. C and C2 are the *same function*: a 1e-9 miss
is certified as no-crossing when ε = 0 and correctly refused when ε = 1e-8.
D and D2 likewise. Whether the topology is knowable is a property of the
function *and* the declared allowance together, never of the function alone —
which is the whole Uranus D situation in miniature.

---

## 5. Stationary geometry — the division that must not happen

Position uncertainty is **not** converted into timing uncertainty by dividing
by a near-zero velocity anywhere in this track, and the audit below found it
nowhere in the repository either.

What it would have produced, on this case, at B = 0.05°:

| sampled where | speed (°/day) | ε / \|f'\| (days) |
| --- | --- | --- |
| 30 days before the station | 0.02425 | 2.06 |
| 10 days before | 0.008662 | 5.77 |
| 1 day before | 0.0008593 | 58.19 |
| 0.1 day before | 0.00008578 | 582.9 |
| at the station | 7.7e-12 | 6.5e9 |

There is no value to pick: the quotient diverges as the sample approaches the
event it is meant to describe. A full day out it already returns 58 days,
**3.93×** the correct half-width, and the shape is wrong regardless — near a
turning point the function is quadratic, not linear.

The correct treatment, and the check that the recorded envelope used it:

| quantity | value |
| --- | --- |
| curvature at the station | 8.576e-4 °/day² |
| rise from g\* to the +B level | 0.09417° |
| quadratic half-width √(2·rise/\|f''\|) | 14.819 days → 29.639 days full |
| level set `{\|g\| ≤ B}` solved on the DE function | 2019-12-27T07:41:55Z .. 2020-01-25T19:20:25Z, **29.485 days** |
| recorded v6 `possibleExactRegion` (Swiss) | **29.483 days** (its ends are not kept, below) |

The DE level set reproduces the recorded Swiss envelope to **0.0025 days** —
about two minutes at each endpoint. The v6 policy states the level-set rule
explicitly (`gates.closestApproachTimeEnvelope`: "solve the connected source set
e(t) <= e_min + 2B") and `gates.minimumEnvelopeFailure` forbids replacing the
envelope with an observed residual. The recorded envelope was built the right
way, and this is independent evidence of that rather than merely the absence of
the wrong formula.

### Repository audit

Searched `src/lib/engine/**`, `scripts/**`, `api/**`,
`docs/engine-validation/**` for any division by a longitude speed, daily motion,
slope or derivative used to turn an angular tolerance into a time tolerance.
**Found: none.**

- `src/lib/engine/transit-window-core.ts` builds all its timing evidence from
  level sets — `certainty.exactPossibleRanges` from
  `track.regions(target, budget + resolution)`, and the uncertain peak envelope
  from `track.regions(target, minimum + 2 * budget)`. No velocity appears.
- `src/lib/engine/transit-scan-core.ts` finds stations by a sign change in
  `longitudeSpeed` and then refines with a direct extremum search; it never
  divides by the speed it just found to be zero.
- `src/lib/engine/longitude-crossings.ts` is pure bisection on the value, with
  no Newton step and so no division by a derivative.
- The v6 policy states the level-set rule and rejects the alternative.

### One separate finding, not a division bug

`findLongitudeCrossingsWith` in `src/lib/engine/longitude-crossings.ts` is a
fixed-step sign-change scan with no station splitting. Two crossings that
straddle a station inside one coarse step cancel into equal-sign endpoints and
**both are dropped silently**. Its callers:

- `src/lib/engine/returns.ts` `saturnReturns` and `src/lib/engine/year-scan.ts`
  (Jupiter and Saturn aspects) call it at the default `stepDays = 5` **with no
  station splitting**. The doc comment on `returns.ts` argues "a triple pass
  spans months, never 5 days", which holds for a well-separated triple pass and
  fails for a grazing one — exactly the Uranus D geometry.
- Not affected: `transit-scan-core.ts` splits every body scan at its stations
  before calling the same solver; `transit-window-core.ts` builds monotone
  branches between turning points; Sun and Moon targets never station in
  longitude.

Demonstrated on the real Uranus trajectory, moving only the target so the
January 2020 station misses it by a chosen amount (DE backend, everything else
unchanged):

| dip below target | predicted pair separation | 5-day scan | 0.5-day scan | interval search, ε = 1e-3 | ε = 1e-4 |
| --- | --- | --- | --- | --- | --- |
| 0.05° | 21.60 days | 2 found | 2 found | 2, certified | 2, certified |
| 0.01° | 9.66 days | 2 found | 2 found | 2, certified | 2, certified |
| 0.002° | 4.32 days | **0 found** | 2 found | 2, certified | 2, certified |
| 0.0005° | 2.16 days | **0 found** | 2 found | **unresolved {0,1,2}** | 2, certified |

Halving the step recovers the 4.3-day pair — and that is the trap. A denser
scan moves the threshold at which it goes blind; it never tells you where that
threshold is. A derivative enclosure does. The bottom-right cell is the search
behaving correctly under test: at a 0.0005° dip with a declared ε of 0.001° it
refuses, and certifies two only once ε is smaller than the dip.

---

## 6. The real Uranus case with the DE backend

`node uranus-d.mjs` → `raw/uranus-d.json`. 2.5 s wall.

### The new contract

`transit-window-search-s1`, version 1, declared as data in the output before
any of it is exercised.

- **Backend.** DE440s (`/tmp/claude-0/swisslab/de440s.bsp`, sha256
  `c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2`, verified)
  through the repository prototype. Light-time iteration, first-order annual
  aberration, `Rotation_EQJ_ECT` into the true ecliptic of date. Gravitational
  deflection is not applied — a stated omission worth about 0.008 arcsec at
  Uranus's January 2020 elongation, which sits *inside* the measured
  DE-vs-Swiss disagreement rather than being additional to it, since Swiss does
  apply it. Clock pinned to TT = UTC + 69.184 s, matching the v6 recipe.
- **Budget.** ε = 0.001° (3.6 arcsec), applying to **topology conditioning
  only** — not to acceptance of product timings against source bands, which is
  a separate question this contract does not ask. Separating those two jobs is
  the substantive difference from the original B, which did both at once.
- **Derivation, in this order.** The terms were measured first, summed, and
  then rounded up to one milli-degree; the margin they would have to beat was
  not consulted while choosing the number.

  | term | degrees | denominator |
  | --- | --- | --- |
  | DE vs Swiss on g\* | 1.333e-5 | one station, located independently by each, clocks matched |
  | DE vs Swiss, worst over the undecided region | 3.024e-5 | n = 913, hourly |
  | DE vs Swiss, worst over the whole component | 6.570e-5 | n = 774, 6-hourly |
  | target literal rounding | 5e-8 | the Horizons literal has 7 decimals |
  | clock at a full second of error | 6e-14 | measured, 10⁴× the policy guard |
  | root-finding and floating point | 1.5e-14 | measured |
  | **sum** | **1.093e-4** | |

  ε = 0.001° is **15.2×** the largest single term and **9.1×** their sum.

### Results

Exact level, full declared window, ε = 0.001°: **`multiple-crossings`,
3 certified passes**, 437 evaluations.

| pass | ε bracket | width |
| --- | --- | --- |
| 1 | 2019-04-25T20:04:39Z .. 2019-04-25T20:54:49Z | 50 minutes |
| 2 | 2019-12-31T21:16:09Z .. 2020-01-01T02:45:45Z | 5.49 hours |
| 3 | 2020-01-21T01:45:49Z .. 2020-01-21T07:12:28Z | 5.44 hours |

Passes 2 and 3 have wide brackets because they happen near the station, where
the longitude moves at 0.0087 °/day. That width is the honest location of a
root known to ±0.001°; it is not a timing error.

Per component: `crossing` (1) and `multiple-crossings` (2) — matching the
recorded source counts of 1 and 2, the second of which the original contract
could not certify.

Membership thresholds: one crossing of T−3 and three of T+3, i.e. **four
ordered physical threshold roots** — independently matching the v6 policy's own
membership statement.

Second component's peak: **there is no positive closest approach.** With two
certified transversal crossings the minimum circular distance is zero and is
attained twice. The January turning point is a local *maximum* of the circular
distance sitting between the two passes. A single peak instant is still not
certified, and collapsing two passes into one would be the fabrication the
original policy forbids.

### Robustness — the budget is not doing the work

Second component, both backends:

| ε (deg) | DE | core |
| --- | --- | --- |
| 1e-5 … 0.04 | 2, certified | 2, certified |
| 0.0441 | 2, certified | unresolved {0,1,2} |
| 0.0442, 0.045, 0.05 | unresolved {0,1,2} | unresolved {0,1,2} |

Both backends give the same count of 2 across a **4000-fold** range of budgets.
The chosen 0.001 sits in the middle of it. The backends part company only
inside the 0.00085° band between their own turning-point margins (0.043326 core,
0.044175 DE) — the inter-model disagreement showing itself as a disagreement
about *decidability* rather than about a position. At and above 0.0442°, which
includes the original 0.05, both refuse, exactly as recorded.

### What is still genuinely uncertain

**Which side of the 2020-01-01T00:00:00Z crop boundary the second pass falls
on.** This is a real `boundary-event`, in real data:

| | value |
| --- | --- |
| DE offset from the level at the boundary instant | 2.729e-7° = 0.00098 arcsec = 2.7 s of Uranus motion |
| Swiss offset, and the recorded v6 crop-boundary orb, which is the same Swiss value | not kept (below) |
| measured DE-vs-Swiss disagreement over the region | 0.109 arcsec max, n = 913 |

Both instruments place the pass just *after* the boundary, but they disagree
about the offset by the ordinary scale of their disagreement, while the offset
itself is smaller than that scale. Deciding the side needs an ε below the
disagreement between the two best instruments available. No justifiable budget
is that small.

So the search returns `boundary-event` for both closed halves, each reporting
2. Those two counts must be **deduplicated by root identity** to the
full-window 3, not summed to 4 — which is the v6 policy's own `queryDomain`
rule, arrived at here independently. The half-brackets union exactly to the
full-window bracket:

```
first half   ... 2019-12-31T21:16:09Z .. 2020-01-01T00:00:00Z]
second half  [2020-01-01T00:00:00Z .. 2020-01-01T02:45:45Z ...
full window   2019-12-31T21:16:09Z .. 2020-01-01T02:45:45Z
```

The recorded `exactCountAmbiguousWithinBudget` flags on both halves therefore
**survive the stronger backend**. What changes is that the reason can now be
stated in arcseconds instead of left inside an allowance.

---

## 7. Answer

**Resolvable, partly.**

Resolved under `transit-window-search-s1`: the exact-pass count of the second
component is **2**; of the full declared window, **3**; of the first component,
**1**. The four ordered threshold roots are confirmed. The second component has
no positive closest-approach peak.

Still uncertain: the side of the 2020-01-01 crop boundary on which the second
pass falls, and therefore the exclusive half-open exact-pass counts of the two
crop halves. Also uncertain, permanently: any point timestamp for a pass. Only
the ε brackets are meaningful.

Conditional on: an empirical derivative enclosure (measured on a 401-point
grid, inflated tenfold); two implementations that share a JPL ancestry, so
their agreement is consistency and not accuracy; sampled maxima over finite
grids for this one case, which generalise to nothing without being re-measured.

**The original v2/v3 contract remains `failed-incomplete` at its own budget.**
Its 0.044188° witness is reproduced here to 0.048 arcsec by an independent
position source, which strengthens the original record rather than overturning
it.

---

## Files

| path | what |
| --- | --- |
| `lib/interval-search.mjs` | the bounded typed-verdict search; enclosure helpers; `stationaryTimeEnvelope` |
| `lib/astro-harness.mjs` | wires a longitude backend to the search; measures and declares derivative bounds |
| `lib/backends.mjs` | core engine, DE prototype, Swiss bridge, shared helpers |
| `lib/swiss-longitudes.py` | batched Swiss longitudes on the v6 clock recipe, with the 258-flag and 69.184 s guards |
| `analytic-cases.mjs` | eleven analytic cases with known topology and proven enclosures |
| `test-analytic.mjs` | the assertions; writes `raw/analytic-results.json` |
| `reproduce.mjs` | task 1 |
| `decompose.mjs` | tasks 2 and 5 |
| `uranus-d.mjs` | task 6 and the new contract |
| `run-all.sh` | regenerates everything in order |
| `raw/*.json` | every figure above, with its denominator and the command that produced it |

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../../programme/DECISIONS-2026-09-28.md)
the fixture this analysis read, `src/lib/engine/fixtures/transit-window-independent.json`
(SHA-256 `db4ddce1d2761ad0ada1ab7aaf456d74d2f79b6b6a3434b1b8f6b9895ad66c3a`),
left the tree. So did Swiss's own figures for the D station in
`raw/reproduction.json` and `verify/raw-original/reproduction.json`
(`independentReproduction.swiss`: its instant, longitude and speed), and
Swiss's longitude at the turning point in both `decomposition.json` files.
The differences, margins and other figures this analysis cites stay, as the
figures above do. `verify/swiss-station.py` and `lib/swiss-longitudes.py`
regenerate the Swiss figures. The record of everything removed is
[`../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).

## Swiss output removed, 2026-09-29

Under [DECISIONS-2026-09-29 §2](../../../programme/DECISIONS-2026-09-29.md)
the rest of Swiss's figures for D left the raw files, because each gave a
Swiss value back or was one:

- `reproduction.json`: the two components' ends and possible-exact and
  possible-minimum regions, which were Swiss's hourly scan; Swiss's station
  minus the target, which with the target beside it gives Swiss's station
  longitude; and Swiss's own TT − UTC;
- `decomposition.json`: the DE prototype's and the engine's difference from
  Swiss at the turning point, which with their longitudes beside them give
  Swiss's; Swiss's TT − UTC and its difference from 69.184 s; the 6-hourly
  grid over the second component, which starts at Swiss's component start;
  and the ends of the recorded possible-exact region in the
  stationary-geometry audit (its width, 29.483 days, stays);
- `uranus-d.json`: the component ends it searched between, the crop-boundary
  orbs, and Swiss's offset from the level at the 2020-01-01 boundary.

The copies under `verify/raw-original/` lost the same. The tables above no
longer carry Swiss's station instant, its possible-exact region or its
boundary offset, and the verification scripts no longer hold the component
ends or the region. Each margin stays: it is the smallest distance of a
longitude from the target, the figure the analysis rests on.

`reproduce.mjs`, `decompose.mjs`, `uranus-d.mjs` and the `verify/` scripts
that need the fixture read it from outside the repository, as an argument or
from `SWISS_WINDOW_FIXTURE`, and refuse a path inside it
(`lib/backends.mjs`). `run-all.sh` writes their output to a directory outside
the repository, because it holds Swiss's figures.
