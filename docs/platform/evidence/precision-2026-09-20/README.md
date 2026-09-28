# Zodiacs precision research — 2026-09-20

Everything in this directory was measured. Where a figure could not be
established it says so, and where a check refuted a claim the refutation is
recorded next to the claim rather than after it.

Read in this order: [`PREREGISTRATION.md`](PREREGISTRATION.md) (targets, frozen
before any fitting), [`CONTROLLED-BASELINE.md`](CONTROLLED-BASELINE.md) (the
clock/series separation), then the three tracks.

## The one-line result

With the clock held fixed, replacing the position series takes worst-case
agreement with Swiss from **17.40″ to 0.134″**; fixing the reduction takes it
from 0.134″ to **0.0107″**; and a compiled pack does the first of those in
**1.66 MiB** instead of 31.21 MiB. None of it is a claim about physical
accuracy — every oracle here descends from the same JPL family.

## Targets, as frozen

| # | target | outcome |
| --- | --- | --- |
| T1 | ≤ 7.80 MiB over matched coverage | **pass** — 1.6567 MiB, 18.84× the kernel (13.63× after the lossless structural baseline) |
| T2 | ≤ 0.05″ extra longitude vs the uncompressed prototype | **pass** — 0.004875″ max over 120,000 rows |
| T3 | ≤ 0.5″ vs Swiss under matched conventions | **pass** — 0.0107″ max after the reduction fix |
| T4 | warm latency better than the prototype, no regression elsewhere | **pass** — resident and low-memory modes both, bit-identical outputs |
| T5 | no download or precision init in the default site path | **pass** — `report-bundles` unchanged, nothing added to `src/` or `public/` |
| T6 | ≤ 2 km outer planets, ≤ 0.2 km Moon vs the raw kernel | **FAIL for the barycentric Moon on the proven bound**: 0.449 km. Geocentrically the EMB term cancels against the observer and it is 0.0224 km. Nothing was retuned after seeing this |
| T7 | velocity ≤ 1e-4 km/s | **pass** — analytic derivative of the same polynomial, measured separately from position |

## What each track established

**Numerics.** astronomy-engine's function named `iau2000b` keeps only the
**first five of the published 77 luni-solar terms**; its mean obliquity is fine
(0.000078″) and the whole error is nutation, up to 0.2677″. Implementing
IAU2000B properly, from ERFA-derived published series and never from Swiss,
plus the ICRF↔dynamical frame bias, takes cell D from **0.1344″ to 0.0107″
max** and **0.0383″ to 0.000295″ median**. An independently written Python SPK
reader agrees with `spk.mjs` to 1.7 ulp, so the custom reader is not being
validated against itself. The ablation that matters most is counter-intuitive:
omitting gravitational deflection is the single largest term at the maximum
(+0.134″), and the effects do not sum — fixing nutation alone *raises* the max
to 0.1385″ while dropping the median to 0.0072″.

**Compiler.** Four candidates, hypotheses written before measurement. D wins at
1.6567 MiB. Candidate C (residual over the lightweight model) failed on every
axis exactly as its pre-registered hypothesis predicted, and the failure is
recorded rather than deleted. Three lossless structural facts — `399/3 =
−(1/EMRAT)·301/3` to 1 ulp, `199/1` and `299/2` identically zero, DAF headers
not being data — are worth 1.38× and are reported **apart** from the
compression claim. Four analytic bounds are proven and kept separate from
sampled error. Cropping coverage or the body set is reported as a different
experiment, not as compression.

**Search.** The Uranus D failure reproduces from three independent position
sources: the recorded 0.044188° turning-point margin is matched by Swiss to
3.6e-6″ and by DE440s to 0.048″. **The original contract stays
failed-incomplete** — it was not cleared by lowering a tolerance, and at the
original 0.05° budget the bounded search returns exactly the recorded outcome.
Under a separately argued new contract (`transit-window-search-s1`, DE440s,
ε = 0.001°) the second component has exactly **2** exact passes and the window
**3**. The 2020-01-01 crop-boundary side remains genuinely undecidable and is
reported that way rather than resolved by assertion.

## What the verification pass refuted, and what I could confirm

Each track was checked by a fresh context told to refute it. All three headline
results reproduced; six claims did not survive, and I re-tested the three that
mattered myself rather than taking either side on trust.

| claim | verdict |
| --- | --- |
| Pack integrity is checked | **Refuted, and I reproduced it.** The header has carried `payloadSha256` and `payloadEndOffset` throughout and nothing read them. A flipped bit, a replaced byte, an edited `intervalSec` and a 30%-truncated file all opened silently. **Fixed** in `compiler/runtime.mjs`: structural extent checks plus digest verification, every failure a typed `PackError`, and the constructor now also accepts an ArrayBuffer so a browser can open a pack. Four corruption cases refuse; 12/12 of the track's own tests still pass |
| Nutation grid spanned 1850–2150 | **Refuted.** `JD_END = 2469808.5` is 2050-01-01, not 2150. The grid is 1850–2049. Re-run over the real range, astronomy-engine's max is unchanged at 0.267695″ but IAU2000B-vs-Swiss rises from 0.001347″ to 0.001534″ |
| Barycentre error quantified for Mars..Pluto | **Refuted.** Four narrow, disjoint, undisclosed windows (Saturn only 35 of 300 years), and Uranus and Mars were never measured at all |
| Mercury's Sun-relative frame saved 5 KiB | **Refuted.** Recompiling with Mercury forced to SSB gives a byte-identical pack. The gap exists only in the cost model |
| A cropped pack refuses out-of-coverage instants | **Refuted** by the verifier; folded into the integrity work above |
| The search never publishes a partial list as complete | **Reproduced, 2026-09-20 — this line previously said "not reproduced" and was wrong.** With the exact case (Moon, 100°, 2019) and `buildLevelProblem`'s own defaults, the search returns `certified, complete, rootCount 2` where the truth is 13, at every allowance from 1e-9 to 0.5 — which is why varying ε alone did not find it. Sixteen of eighteen cells are closed by the exclusion test and eleven of the thirteen crossings are inside them: the mean-value value-enclosure is applied to the wrapped circular difference, which jumps a full turn thirteen times in the window, so the declared derivative range is not a bound anywhere near the antipode. The defect is in the harness, not in `classifyInterval`, which returns the right 27 when given the continuous `sin` form. See [`search/MOON-2-VS-13.md`](search/MOON-2-VS-13.md) |
| The derivative "bounds" are bounds | **Confirmed as a labelling defect.** They are a 400-sample maximum multiplied by 10. On a Mars window the dense 1-minute maximum equals the sampled maximum exactly, so the safety factor is the entire margin and nothing guarantees it is enough. These are inflated empirical estimates and must not be called bounds or support the word "certified" |

## Standing limits

- No coefficient pack is committed — see [`RIGHTS.md`](RIGHTS.md), which
  replaces an earlier assumption that NASA involvement implied public domain
  with what NAIF's rules actually say.
- The production engine is unchanged. Nothing here is wired into the site, the
  default bundle, the schemas or any saved record.
- The numerics fix does **not** transfer to the shipped core as a measurable
  win: against the core's own 1.4–17″ error it moves the statistics both ways.
  The brief's assumption that it would transfer does not hold.
- Bulk raw outputs over 1 MiB are excluded by size with hashes and
  regeneration commands in [`EXCLUDED-RAW.md`](EXCLUDED-RAW.md).
- Swiss's raw output left this directory on 2026-09-28, under
  [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md);
  statistics and digests stay, and
  [`SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md)
  lists what went, with its SHA-256 and how to regenerate it.
