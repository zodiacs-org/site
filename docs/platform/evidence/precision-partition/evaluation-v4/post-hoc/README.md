# The partition evaluation, version 4: runs after the verdict

Post hoc and unscored. These runs were made on 2026-11-01, after version 4's
verdict, by the investigation that found the programme's versions 2 and 3
of this evaluation on branch `moon-enclosure`. They are what
[`PARTITION-RESULTS-V4.md`](../../../../../../examples/precision-alpha/PARTITION-RESULTS-V4.md)
reports under "After the verdict" and "P-2 at record joins", and the
partition counts under V-1. No rule scores any of them, and nothing here
changes a verdict.

The files one level up are version 4's scored runs. Their `-v2` suffix
(`regression-run-v2.json`, `holdout-2007-run-v2.json`,
`holdout-2040-run-v2.json`, `matrix-v2.json`) means version 4, which was
called version 2 until 2026-11-01, and `corpus-v4.json` is rule V-4's
output.

## Why none of it is scored

- The 1912 and 2103 holdouts were drawn and opened by versions 2 and 3. For
  version 4's code they are previously seen data. Running it there is not a
  rerun of version 3, whose holdout main's
  `docs/platform/programme/HANDOFF-2026-09-30.md` says must not be rerun.
- The audit's matrix, the five-rung ladder, the domain agreement, the
  record-join spans and the pack reproduction run on development data
  (synthetic fixtures, or the twenty regression cases from 1975 that
  version 1 opened), and version 4's rule names none of these checks.
- The review cases are the reviewers' own synthetic packs.

## What ran, and on what

Everything ran on one Mac (darwin-arm64), with Node 22.22.2 under
`nice -n 10`, one heavy job at a time. Wall times are not scored.

| placeholder | what it stands for |
| --- | --- |
| `<860-export>` | a copy of this branch at `ad346680`, its `examples/precision-alpha` (146 files) and its evidence folder, checked blob by blob: version 4's code as the scored runs used it at `7287ab66`, plus P4.2's container format check, merged at `c19fc424` |
| `<v1-export>` | a copy of version 1, its `examples/precision-alpha` at `23dd8cb7` (138 files, checked blob by blob), the tree main's `931e3281` has |
| `<moon-enclosure-export>` | a copy of `moon-enclosure` at `dfa19aa9`, from the owner's bundle (its `examples/precision-alpha`, 164 files, and its evidence folders, checked blob by blob); not on GitHub |
| `<packs>` | the folder holding the pack, `D-de440s.sealed.zeph`: DE440s compiled by compiler 1.1.0 on this Mac, container `9856b50f…`, payload `0c7e1c93…`, file SHA-256 `00a56b4c…`, 1,737,664 bytes, the scored runs' pack; not committed |
| `<post-hoc>` | this folder, where the investigation wrote its outputs |
| `<repo>`, `<scratch>`, `<editor-scratch>`, `<node-22.22.2>`, `<workspace>` | this repository's checkout, scratch folders and the pinned Node on that machine |

Every absolute path from that machine was replaced by these placeholders
after the runs, in outputs and scripts alike, as the scored records' paths
were. So the scripts do not run as committed: set the placeholders to your
own copies first. Nothing else in any file was changed. No coefficient, no
pack and no Swiss Ephemeris output is here; the outputs hold counts, times,
digests, verdicts and the closest approaches to the floor that P-2 samples.

| folder | what | made by |
| --- | --- | --- |
| `holdouts/` | version 4's harness on the 1912 and 2103 holdouts, the driver that ran it beside version 1, and the record-join check | the holdouts investigator |
| `matrix/` | the audit's matrix on version 1 and on version 4 | the matrix investigator |
| `ladder/` | F1 to F10 through the five rungs, both versions | the ladder investigator |
| `record/checks/` | the holdout draws recomputed, record joins near the Sun, and review A's and review B's cases | the record investigator |
| `integrity/` | the domain agreement, the partition alone on this pack, and the case lists compared | the integrity investigator |
| `numerics/` | where the worst P-2 spans lie, and the join elongations recomputed | the numerics review |
| `editor/` | review B's cases on this branch after the B-2 fix | the editor of these records |

## holdouts/

The cases come from versions 2's and 3's own records on `moon-enclosure`
(`docs/platform/evidence/precision-partition-v2/holdout/run.json` and
`precision-partition-v3/holdout/run.json`): body, window and target as
recorded, with each record's case-list digest (`23d98094…`, `057fec7f…`)
recomputed and matched.

- `unmodified-harness-1912.json` and `unmodified-harness-2103.json`, with
  their logs: version 4's harness, `tools/measure/partition-evaluation.mjs`
  (SHA-256 `1b41c4bb…`, the same file in version 1), run unchanged,
  `node <860-export>/examples/precision-alpha/tools/measure/partition-evaluation.mjs --pack=<packs>/D-de440s.sealed.zeph --epoch=1912-12-12T00:00:00Z --label=holdout-1912-unmodified-harness --out=…`,
  and the same with `--epoch=2103-01-23T00:00:00Z`. It rebuilds the cases
  from the epoch, and they equal the earlier records' (`integrity/`). Its
  verdicts are PARTIAL (P-2) and PASS. These give every number the results
  quote from version 4's own scoring.
- `holdout-driver.mjs`, its outputs `holdout-1912-run.json` and
  `holdout-2103-run.json`, and their logs: the harness copied and changed
  only as `driver-vs-harness.diff` shows. Applied to the harness in this
  tree, that diff gives `holdout-driver.mjs` byte for byte. The driver reads
  the cases from the earlier records instead of rebuilding them, runs
  version 1's plain search and partitioned path in the same invocation,
  writes extra raw fields (every span, every P-2 probe, the reference roots,
  the event lists) and adds an `additional` block: the earlier versions' P-4
  with version 1's plain search as the denominator, their P-5 and P-8,
  version 4's V-2, and the conjunction classes of the two versions compared.
- `crosscheck-unmodified-1912.json` and `-2103.json`, from
  `compare-unmodified.mjs`: the driver and the unmodified harness agree on
  every field the harness writes, wall times and the label set aside.
- `joins-1912.json` and `joins-2103.json`, from `joins.mjs`: the record
  joins of the Moon's, the barycentre's and the Sun's series in each Moon
  window, and the floor crossings of the tier-B deflected reference. Joins
  within half a day of a crossing were selected, and the 1915 join by name,
  and every boundary or unresolved span within a day of a selected join was
  probed as P-2 probes. In 1912 only the Moon's join of 1915-08-11 lies
  within half a day of a floor crossing; in 2103 none does.
- `mechanism-1915.json`, from `mechanism.mjs`: the cells at the 1915 join
  rebuilt with version 4's exported functions. It is a reconstruction with a
  wider light-time interval than the run used, not a trace of the run, and
  supports only the direction of the argument.
- `summary.json`, from `summarise.mjs`: the investigator's tables.

Declared by the investigator:

1. A driver instead of the harness, for the reasons and with the changes
   above. The harness's scoring and verdict code is unchanged, and the
   unmodified harness matches the driver field for field.
2. The pack is version 4's, not the one versions 2 and 3 ran (compiler
   1.0.0, container `4cc6f85a…`, payload `0a218764…`). On it version 1
   reproduces its recorded partitioned counts on all 20 cases of 1912 and on
   18 of 20 of 2103 (F1 and A1 give 601 against 600), and its plain-search
   counts differ from the records by 1 to 4 evaluations on some bodies. Every
   target recomputed on this pack equals the recorded one.
3. The earlier rule's P-4 takes its classes from version 4's partition,
   checked against version 1's (all agree), takes version 1's plain search
   in the same invocation as its denominator, and keeps the earlier
   harness's condition that the partitioned run finished (all did).
4. P-7 is reported, not scored.
5. The run outputs list no record joins, so the joins come from the pack's
   record structure, times only, with no coefficient read or printed. Floor
   crossings come from the reference sampled every 300 s and bisected, so two
   crossings closer than 300 s would be missed. The barycentre's and the
   Sun's joins were checked as a supplement.
6. The harness's repeated-query block ran as in the harness; it has no
   target.
7. Beyond the ask, labelled so: a V-4-like comparison on these cases (the
   18 cases other than the Moon's are bit-identical between the versions,
   evaluation counts included, and no version-1 Moon event is lost), and the
   reconstruction in `mechanism.mjs`.
8. No definition was changed after a result was seen.
9. `<860-export>` differs from version 1 also in `src/core/container.mjs`
   (P4.2's format check), which version 4's rule does not list. Both trees
   open the pack to the same digest.
10. Context, not a holdout result: the investigator attributed the
    regression corpus's worst P-2 span to the barycentre's join of
    1978-04-08 and gave it as 42.19 s at 0.3355 degrees. The numerics review
    found that span does not exist; the real one is 36.918 s at 0.336257
    degrees, starting exactly at the join (`numerics/`).

## matrix/

The audit's own matrix script is `moon-enclosure`'s
`tools/measure/fixture-matrix.mjs` (commit `304776162`, SHA-256
`457254cb…`); its bracket-recording companion is `fixture-events.mjs` there.
Neither is copied here. `scripts/run-matrix.sh` ran both in place, with
`--tree` naming `<v1-export>` and then `<860-export>`.

- `raw/matrix-v1.json` and `raw/matrix-head.json`: the matrix on version 1
  and on version 4. The two files are byte for byte the same (SHA-256
  `660b2b6d…`, 49,197 bytes): all 120 results identical in every field.
- `logs/score-v1-vs-head.stdout.log`, from `scripts/score.mjs`: the earlier
  rules' E-1, E-2 (read by R-1) and E-3 sense 2 on the pair, all holding.
  The score's full output (196 KB) and the two events files (7 MB each) are
  not committed; `score.mjs` reads the events files, which `fixture-events.mjs`
  makes again.
- `raw/e3-sense1-apparent-grid.json` and its log, from
  `scripts/apparent-grid.mjs`: `apparent()` on the earlier rule's grid, ten
  bodies at 100 instants over the F windows, on both trees, digests only.
  None of the 1,000 calls differs.
- `raw/diagnostic-pair1ms-sensitivity.json` and `-head.json`, from
  `scripts/pair1ms-sensitivity.mjs`: version 1's output here differs from the
  copy committed on `moon-enclosure` (made on another machine,
  `docs/platform/evidence/precision-partition-v2/regression/fixtures/matrix-v1.json`)
  in one result of 120, pair-1ms on the geometric rung, and scaling that
  fixture's displacement by one rounding unit reproduces the committed
  result bit for bit. Both trees respond the same way: a last-bit difference
  in the synthetic pack, not a code difference.

Declared by the investigator:

1. The bundle's own harness, `partition-evaluation-v2.mjs`, was not run: it
   needs a git checkout and the earlier rule's pack, and it runs the bundle's
   version 2. Scoring used a copy of its matrix code, `score.mjs`, checked by
   recomputing the committed record's fixture rows and E parts from the
   committed bundle files.
2. `fixture-events.mjs` ran at `3a30ed38` rather than `35176187`; the only
   difference is extra recorded fields.
3. E-3's first sense ran on version 4's pack, not the earlier rule's.
4. The only adapter is the row-shape mapping used to apply version 4's V-3
   to this matrix; none was needed to run the audit's script on version 4's
   code.
5. The inventory script was corrected after its first output (it compared
   record-join offsets as exact doubles), and the scorer gained a null check
   after it stopped on the older events file. Neither touches a scoring
   definition.
6. Supplementary and unscored: a rerun of version 4's rebuilt matrix (it
   reproduced the committed files apart from wall times and the tree path),
   the cross-machine pairings and the pair-1ms diagnostic.
7. Nothing was run on the earlier holdouts.
8. Only read-only git was used in the repository.
9. Three verification listings were first written to the scratch folder's
   root and moved into the output folder at once.

## ladder/

`tools/ladder.mjs` rebuilds the five-rung corpus of version 2's rule
(section 3b) with the construction in that branch's harness: F1 to F10, the
1975 windows and targets, each through the validated-geometric,
validated-retarded-geometric, -aberrated, -aberrated-of-date and
-aberrated-deflected-of-date rungs, both trees in one process. It scores
version 2's section 5 rules and E-1, E-2's second bullet and E-3, unamended
and under amendment A-1. `run/run.json` holds the scores and the Moon's rows,
`run/tables.txt` every (case, rung) with its events (version 1 finds 106 in
all, version 4 115), and `provenance.json` the blob checks of both trees.

Declared by the investigator:

1. The pack is version 4's; the earlier harness refuses any but its own.
   Against the ladder version 2's record kept for version 1, 7 of 50 results
   differ in evaluations only, by 1 to 20; cells, status, completeness and
   events are identical in all 50.
2. The earlier rule's section 2 precondition, that the original runtime
   reproduce the committed twenty-case run, was not checked.
3. "v2" in the earlier rule is the bundle's code; version 4's takes its
   place.
4. The tree check covers `src/` and the deflected reference, not the whole
   package directory.
5. The deflected rung was run directly with the same arguments, instead of
   reusing a twenty-case baseline run.
6. A check of rungs 2 to 4 against the tier-B references, and a whole-result
   comparison, go beyond the earlier harness; the reference check was
   decided after the main run was seen. Both are supplementary; the
   reference check's output is not committed.
7. A one-case test of the tool, on F1 alone, claims nothing and is not
   committed.

`run/run.json` and `run/tables.txt` call the F windows the earlier holdouts'
windows. They are not: F1 to F10 are ten of the 1975 regression cases,
development data for every version (the numerics review). The run is
unscored because version 4's rule does not name rungs 1 to 4.

## record/checks/

- `holdout-draws.json`, from `holdout-draws.mjs`: the seeds and first draws
  of versions 2's and 3's holdouts recomputed (mulberry32 seeded from
  SHA-256 of `zodiacs-holdout/P4.5` and `zodiacs-holdout/P4.5-v3`), and the
  five series' windows checked for overlap: none.
- `moon-joins-near-sun.json`, from `moon-joins-near-sun.mjs`: the record
  joins in each series' Moon window and the Moon's elongation at each,
  through the tier-B deflected reference (geometry only).
- `a1-sweep-860.json` and `a1-sweep-v1.json`, from `review-a1-sweep.mjs`:
  review A's sweep for its finding A-1, coded as that review's own
  reproduction codes it, on synthetic packs whose records disagree by 0.07
  or 1 km at a join.
- `review-b-860.json` and `review-b-v1.json`, from
  `review-b-plan-checks.mjs`: review B's cases for B-1 to B-5, on the
  synthetic pack.

## integrity/

- `runs/domain-agreement-pr860-regression.json` and
  `runs/domain-agreement-v1-regression-mac-pack.json`, with their logs:
  `tools/measure/domain-agreement.mjs` (SHA-256 `91ba159f…`, the same in all
  three trees) run unchanged from each tree,
  `node tools/measure/domain-agreement.mjs --pack=<packs>/D-de440s.sealed.zeph --out=…`,
  on the default epoch, 1975-01-01. Version 4: 4 contradictions; version 1:
  0.
- `runs/v1-partition-regression-mac-pack.json` and
  `runs/pr860-partition-regression-mac-pack.json`, from
  `scripts/v1-partition-on-mac-pack.mjs`: the partition alone on the ten
  main regression cases, with the harness's own settings, from each tree:
  evaluations, cells and boundary seconds.
- `runs/cases-compare-1912.json` and `-2103.json`, from
  `scripts/cases-compare.mjs`: the cases version 4's unmodified harness
  rebuilt from `--epoch` against the earlier records' cases, 20 of 20 the
  same in each.

The A-1 and review B checks were also run again here, with copies of the
record investigator's scripts; their outputs equal those in
`record/checks/` and are not committed twice.

## numerics/

The numerics review recomputed at least three numbers from each
investigator's outputs, and found two wrong; this folder holds the checks
the results use.

- `regression-f2-join.json` and `holdout2007-f2-join.json`, from
  `check-regression-f2-join.mjs` and `check-f2-join-anyrun.mjs`: version 4's
  cold partition rerun on F2 of the regression corpus and of the 2007
  holdout, under a second each. Each reproduces the committed counts
  exactly, and locates the worst P-2 span: 36.918 s from the barycentre's
  join of 1978-04-08, 0.336257 degrees from the floor, and 42.1875 s from
  the Moon's and the Sun's joins of 2009-11-17, 0.192043 degrees.
- `join-1915-check.json`, from `check-join-1915.mjs`: the 1912 holdout's
  failing span recomputed from the driver's output and sampled again through
  the reference, with the same closest approach and proved-excluded spans on
  both sides.
- `joins-elongation.json`, from `check-joins-elongation.mjs`: the
  elongations at the joins recomputed.

The two numbers it corrected: the record investigator read the partition's
`widestBoundarySec`, the widest single cell, as the widest span (on the
regression corpus's F2 the widest span is 506.25 s), and the holdouts
investigator's 1978 span, given in item 10 above.

## editor/

`review-b-after-fix.json`: `record/checks/review-b-plan-checks.mjs` run on
this branch after the B-2 fix (2026-11-01). B-2's relabelled plan is now
refused; B-1, B-3, B-4 and B-5 give what they gave before.

## Not committed

To keep the folder small: the matrix's events files and full score, the
ladder's per-rung JSON, full results and lower-rung reference check, the
cross-machine matrix comparisons, the investigators' inventories, tables
and tree listings, the integrity investigator's span listings, the stdout
copies of the harness runs, the pack's record structure, and the
environment logs, which name the machine. Each either backs a check the
results do not cite or repeats a file that is here.
