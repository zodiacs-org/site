# The partition evaluation, version 2: the result

The rule is [PARTITION-EVALUATION-V2.md](PARTITION-EVALUATION-V2.md),
committed (as `7287ab66`) before any run it scores. Version 1's verdict,
PARTIAL, stands in [PARTITION-RESULTS.md](PARTITION-RESULTS.md); this is the
new version beside it.

## The verdict

**PASS.** V-1 to V-4 all hold, and the fresh holdout passes every target it
scores.

| rule | verdict | the numbers |
| --- | --- | --- |
| **V-1** P-1 to P-7 on the regression cases | **PASS** | every target held; P-3 worst 0.0114 % (F2), P-4 worst 5.44x (F2 and A2) |
| **V-2** the deflected Moon search finishes | **PASS** | F2 and A2: plain search 1,594,431 evaluations, partitioned 292,612, both `finished` |
| **V-3** the twenty-fixture matrix | **PASS** | 116 known-root checks, 0 false proofs, 0 lost events, every planet-like rung bit-identical |
| **V-4** the ten-case corpus | **PASS** | 0 lost events; the nine bodies other than the Moon bit-identical, evaluation counts included |

The runs are in
[`docs/platform/evidence/precision-partition/evaluation-v2/`](../../docs/platform/evidence/precision-partition/evaluation-v2/),
on the DE440s pack compiled on this machine by compiler 1.1.0, then on
`main` (container `9856b50f…`; section 3 of the rule says why it stands in for
version 1's). Node 22.22.2, darwin-arm64, on 31 October 2026 between 23:47
and 23:54 Bangkok time. Evaluations are the currency, as in version 1, and
they are deterministic; wall times are not scored. Ratios below are rounded
down and boundary shares up, so neither flatters version 2.

## V-1: the regression cases

[regression-run-v2.json](../../docs/platform/evidence/precision-partition/evaluation-v2/regression-run-v2.json),
the unchanged harness. Each main case and its antipode share a window and
gave the same figures, so one row each:

| case | plain search | partitioned, cold | ratio | boundary | version 1: plain, partitioned, ratio, boundary |
| --- | ---: | ---: | ---: | ---: | --- |
| F1 Sun | 635 | 635 | 1.00x | 0 | 635, 635, 1.00x, 0 |
| F2 Moon | 1,594,431 | 292,612 | **5.44x** | **0.0114 %** | 4,000,001 exhausted, 1,260,163, 3.17x, 5.266 % |
| F3 Mercury | 1,917,153 | 57,310 | 33.45x | 0.00635 % | 1,917,153, 208,088, 9.21x, 0.497 % |
| F4 Venus | 515,262 | 31,298 | 16.46x | 0.00306 % | 515,262, 87,675, 5.88x, 0.154 % |
| F5 Mars | 285,751 | 19,737 | 14.47x | 0.0018 % | 285,731, 52,846, 5.41x, 0.090 % |
| F6 Jupiter | 2,105 | 2,314 | 0.90x | 0 | 2,106, 2,172, 0.97x, 0 |
| F7 Saturn | 63,956 | 8,790 | **7.27x** | 0.000326 % | 63,960, 16,195, 3.95x, 0.020 % |
| F8 Uranus | 58,351 | 7,958 | 7.33x | 0.000326 % | 58,353, 14,831, 3.93x, 0.018 % |
| F9 Neptune | 55,409 | 8,422 | 6.57x | 0.000326 % | 55,409, 14,891, 3.72x, 0.017 % |
| F10 Pluto | 5,092 | 5,045 | 1.00x | 0 | 5,092, 5,202, 0.98x, 0 |

- **P-3**, the target version 1 failed: the Moon's boundary is 0.0114 % of
  its window, against 1 %. It was 5.266 %.
- **P-4**, the other one: every conjunction-heavy case is at least 5.44x
  cheaper than the same version's plain search. Against version 1's plain
  search, which exhausted the budget on the Moon, F2 is at least 13.6x.
- **P-1, P-2, P-5, P-6 and P-7 still hold.** P-6: 37 plain-search events
  inside proved-admissible spans, none lost, every matched root bracketed,
  worst shift 6.0e-5 s. P-7: still 6 of 20 by the original rule, on both
  paths.
- The partition alone: the Moon's cost falls from 939,176 evaluations and
  158,121 cells to 262,535 and 11,409.

The version-1 columns are its committed run, on its own pack. Version 1's
code on this machine's pack gives the same partition figures exactly, and
plain-search counts that differ by a few evaluations for four bodies (Mars
285,751 here against 285,731 there, Saturn 63,956 against 63,960, Uranus
58,351 against 58,353, Jupiter 2,105 against 2,106): the two packs' last
bits, not the code (V-4 below compares the two versions on one pack).

## V-2: the Moon finishes

On F2 and A2 the plain deflected search, with no partition, now finishes in
1,594,431 evaluations and finds 11 events; version 1's stopped at
4,000,001 with 2. The partitioned search finishes in 292,612 (version 1:
1,260,163). The change that does it is the merged-weight vector in the
search's own cells, which only the Moon's cells use.

## V-3: the twenty-fixture matrix

[`tools/measure/fixture-matrix.mjs`](tools/measure/fixture-matrix.mjs)
rebuilds the audit's matrix from its description: 20 exact-polynomial
fixtures with a planet-like target and 6 of them again with a Moon-like
target sharing an EMB that moves at 30 km/s, 26 rows, each through six
rungs. [matrix-v1.json](../../docs/platform/evidence/precision-partition/evaluation-v2/matrix-v1.json)
and [matrix-v2.json](../../docs/platform/evidence/precision-partition/evaluation-v2/matrix-v2.json)
are the two runs, [matrix-verdict.json](../../docs/platform/evidence/precision-partition/evaluation-v2/matrix-verdict.json)
the comparison.

- **No false proof**, in either version: 116 results that said
  `established` had known roots to check, 58 in each version, and each had
  the true count and every true root inside a reported bracket.
- **No lost event**: every event version 1 found, version 2 found, same
  direction, within 1e-3 s.
- **Bit-identical where nothing changed**: all 120 planet-like rungs.
- On the Moon-like rows the two versions found the same events with the
  same completeness. Version 2 spent more evaluations in the
  non-deflected rungs, up to 17.4 per cent (M19 retarded: 2,764 to
  3,244): each Moon cell now builds two more enclosures, and on these
  small, already-easy fixtures there are few cells to save. On the real
  Moon window the same change saves at least 60 per cent (version 1
  stopped at the budget).

The fixtures' bytes come from this tree's test helpers, so both versions
searched identical packs. The tool was fixed once before its first
version-2 run: on version 1, the Moon-like reception roots it solved came
back unbracketed, because the EMB's motion over the light-time moves them
by tens to thousands of seconds; it now scans the whole window.

## V-4: the ten-case corpus

[corpus-v4.json](../../docs/platform/evidence/precision-partition/evaluation-v2/corpus-v4.json),
from [`tools/measure/corpus-versions.mjs`](tools/measure/corpus-versions.mjs):
both versions' plain deflected search on F1 to F10, on one pack. For the
nine bodies other than the Moon the events and the evaluation counts are
identical. For the Moon, version 1 exhausted the budget with 2 events and
version 2 finished with 11, among them both of version 1's.

## The holdouts

- **Version 1's holdout** (epoch 2007-03-15), opened once in version 1 and
  regression data now: every target held
  ([holdout-2007-run-v2.json](../../docs/platform/evidence/precision-partition/evaluation-v2/holdout-2007-run-v2.json)).
  The Moon: plain search 1,740,272 evaluations, finished (version 1:
  4,000,001, exhausted); partitioned 291,281, 5.97x; boundary 0.0122 %
  (version 1: 5.587 %). Neptune, which failed P-4 there at 3.63x, is at
  6.16x.
- **The fresh holdout** (epoch 2040-01-01), generated by the same
  construction and opened once, after V-1 to V-4 had run: every target it
  scores held
  ([holdout-2040-run-v2.json](../../docs/platform/evidence/precision-partition/evaluation-v2/holdout-2040-run-v2.json)).
  P-7 is not scored off the regression corpus, as in version 1. The Moon:
  plain search 1,742,474, partitioned 279,757, 6.22x, boundary 0.0191 %,
  the lowest ratio of any conjunction-heavy case there.

## What this does not establish

- Correctness by passing tests. The enclosures are arguments, written out
  in `domain-partition.mjs` (`localGeometry`), `retarded-search.mjs`
  (`mergedRetardation`) and `deflection.mjs` (`elongationCosCentred`); the
  tier-A tests (a co-moving Moon among them, where two mutations of the
  argument were caught), the reference sampling of section 5 of the rule,
  and this evaluation corroborate them.
- Anything about accuracy. The deflection layer's own usefulness verdict
  is unchanged.
- The rest of version 1's M4 list: local per-cell derivative bounds (the
  triple root is still undecided in every rung, as in version 1), merging
  the geometric mode's unresolved spans, the declared trig bound in the
  projection weights, explicit pads, endpoint-root ownership, and
  `buildPartitionedResult`. They are not this unit's rule.
