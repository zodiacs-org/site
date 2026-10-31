# The partition evaluation, version 2: the Moon enclosure fix

Written on 31 October 2026 (Asia/Bangkok), before any run this file scores.
Version 1 is [PARTITION-EVALUATION.md](PARTITION-EVALUATION.md) and its
verdict, PARTIAL, is in [PARTITION-RESULTS.md](PARTITION-RESULTS.md). That
verdict stays as it is. This is a new version run beside it, as version 1's
brief asks (BRIEF-v1 section M4 item 3), and the two are reported together.

## 1 · Why there is a version 2

Version 1 failed P-3 (the Moon's boundary was 5.266 per cent of its window,
against 1 per cent) and P-4 (3.17x on F2 and A2 and 3.95x on F7, against
4x). PARTITION-RESULTS.md put the Moon's boundary down to the mean-value
enclosure scaling with the cell. The engine audit measured otherwise
(finding alpha-search-partition-2): over a 60-second Moon cell the
cos(elongation) enclosure was 2,893 times the cosine's true variation, at
60, 600 and 3,600 seconds alike, so smaller cells could not help. Two
causes:

1. The geocentric vector was enclosed as `r_T(t - tau) - r_O(t)` with the
   target and the observer enclosed apart. Both carry the Earth-Moon
   barycentre, whose 30 km/s then entered twice and cancelled nowhere:
   5,852 km wide where the vector moves 58 km.
2. `-(e . d)/|d|` was composed from span-wide intervals, with `d` in the
   numerator and the denominator and each product enclosed on its own.

## 2 · What version 2 changes, and nothing else

In `src/core/`:

- **The geocentric vector from merged weights.**
  `d(t) = [r_T(t) - r_O(t)] + [r_T(t - tau) - r_T(t)]`: the first bracket
  as one weight map at one instant (`mergedWeights`; for the Moon, the Moon
  series alone with weight 1 + 1/EMRAT), the second by Taylor with
  remainder, `-tau v_T(t) + (tau^2/2) a_T(xi)`. It is met with the split
  enclosure, and both contain `d(t)`. Used where the target is one
  polynomial over every emission time the cell reaches (records are
  separate fits and do not join smoothly).
  - In the partition (`domain-partition.mjs`), for every body.
  - In the search's cells (`retardedCell`), only where the target and the
    observer share a stored series, which is the Moon. Every other body's
    search is unchanged, bit for bit.
- **A centred cosine.** In the partition only: the cosine at the cell's
  midpoint, plus the most it can move from there, `|g'| <= (|e'| + |dh'|)
  sin E` (derived in `elongationCosCentred`), met with the interval form.
  Used where every series it rests on is one polynomial over the
  half-open cell.
- **A new contract id**, `zodiacs-domain-partition/2`, and a
  `NUMERICS_POLICY` whose fingerprint is in every partition key (audit
  finding alpha-search-partition-5). A version-1 plan does not pass for a
  version-2 one.
- **`acceptPartialPlan` searches what the plan classified** (finding
  alpha-search-partition-1). The plan's own status still becomes the
  request's.
- **`tauPadFactor` is removed**: nothing read it (finding 6).

Not changed: the deflection profile and its five-degree floor, the two
knobs (`boundaryToleranceSec` 60, `relightWidthRatio` 8), every budget
(4,000,000 evaluations, 400,000 cells, 300,000 ms), the root tolerance
(1e-3 s), the match window (1 s), the reference, and the harness
`tools/measure/partition-evaluation.mjs`, which runs unchanged.

## 3 · The pack

The DE440s pack compiled by the compiler on `main` (1.1.0, the source the
version-1 pack came from), on this machine: payload SHA-256 `0c7e1c93…`,
container `9856b50f…`. Version 1 named payload `0a218764…`, compiled
elsewhere; the same source and kernel give different last bits on the two
machines, because `Math.cos` differs (recorded in
`docs/platform/evidence/pack-compiler-20261031/`). On this pack version 1's
code reproduces version 1's committed partition figures exactly (F2: 939,176
evaluations, 158,121 cells, 5.266 per cent boundary; F3, F4, F5 and F7
likewise), so the two packs are interchangeable for these figures, and the
version-1 code is run on this pack too wherever a comparison needs it.

## 4 · The rules

Version 1's brief, M4 item 3: "P-3 boundary ≤ 1 % on the Moon and P-4 ≥ 4×
on every conjunction-heavy case under the new version; the deflected Moon
search finishes within the unchanged 4,000,000 budget; the twenty-fixture
matrix and the ten-case regression corpus show zero lost events and
bit-identical events where nothing changed." Made operational:

**V-1 · P-1 to P-7 under version 2.** The harness runs the twenty
regression cases (epoch 1975-01-01) with version 2's code and scores
PARTITION-EVALUATION.md's P-1 to P-7 exactly as written. P-3 and P-4 are
this file's rule; the others must still hold. P-4's baseline is version 2's
own plain search on the same case. The ratio against version 1's recorded
baseline is reported beside it, not scored.

**V-2 · The deflected Moon search finishes.** On F2 and A2, both the
partitioned search (P-1) and the plain deflected search with no partition
reach `finished` within 4,000,000 evaluations. (Version 1's plain search
exhausted the budget on both.)

**V-3 · The twenty-fixture matrix.** The audit's matrix was never
committed; it is rebuilt as `tools/measure/fixture-matrix.mjs`, from the
audit's description (LEDGER.md, alpha-search-partition): twenty
exact-polynomial cases, among them a tangency, a triple root, pairs 10 s,
1 s and 1 ms apart, grazes clearing the target by 10 s, 0.1 s and 0.01 s of
motion, three crossings in one record, roots on and near a record boundary,
and roots at each window edge. Each runs through the geometric, retarded,
aberrated and identity-frame of-date rungs (known roots) and the real-frame
of-date and deflected rungs (count only). Each fixture has a planet-like
target (no stored series shared with the observer); six also run with a
Moon-like target sharing the EMB, which moves at 30 km/s. Version 1's code
and version 2's code run the same matrix on the same machine.
- **No false proof**: every result that says `established` has the true
  count, and every true root inside a reported bracket.
- **No lost event**: every event version 1 finds, version 2 finds, with
  the same direction, within 1e-3 s.
- **Bit-identical where nothing changed**: for every planet-like fixture,
  version 2's events, brackets and completeness equal version 1's exactly,
  in every rung.

**V-4 · The ten-case regression corpus**, taken to be the ten main cases
F1 to F10 (the corpus is never defined in the repository). On the same
pack: every event version 1's plain deflected search finds, version 2's
finds (within 1e-3 s); for the nine bodies other than the Moon, the plain
search's events are bit-identical between the versions; and P-6 holds for
all ten under version 2.

**The holdouts.** Version 1's holdout (epoch 2007-03-15) has been opened
and is now regression data; it is run and reported, not scored. A fresh
holdout is generated by the same construction at epoch **2040-01-01**,
disjoint from both, and is opened once, after V-1 to V-4 have been run. Its
P-1 to P-7 are reported; a failure there is reported as one.

**Verdict.** PASS if V-1 to V-4 all hold. Failing V-1's P-1 or P-6, V-2, or
any no-false-proof or no-lost-event check fails the whole. Anything else
failing is PARTIAL, with the numbers.

## 5 · What was seen before this was written

On the regression cases (already opened in version 1, so development data),
version 2's partition alone: F2 262,535 evaluations and 0.011 per cent
boundary, F3 38,604 and 0.006, F7 2,864 and 0.0003. On F2 in full, the plain
deflected search finished in 1,594,431 evaluations and the partitioned one
in 292,612. Sampling the elongation with the tier-B reference over every
admitted and excluded span of F2 to F10: none on the wrong side of the
floor. No holdout, no fixture of the matrix and no other case has been run
on version 2.

## 6 · What this cannot establish

What version 1's section 8 says: that the partition is correct because its
tests pass. The new enclosures are arguments, in `domain-partition.mjs`,
`retarded-search.mjs` and `deflection.mjs`; the tests, the reference
sampling and this evaluation corroborate them. Nothing here measures
accuracy, and the deflection layer's own usefulness verdict is unchanged.
