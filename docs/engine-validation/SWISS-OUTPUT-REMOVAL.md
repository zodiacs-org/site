# Swiss Ephemeris output removed from the tree

On 2026-09-28 Swiss Ephemeris's raw output left the current tree, under the
owner's decision
[DECISIONS-2026-09-28 §3](../platform/programme/DECISIONS-2026-09-28.md)
(audit finding F-22 in [`FINDINGS.md`](../platform/programme/FINDINGS.md)).
Brief §6 says "no Swiss code, data or output in `src/` or any pack". An
independent review that day found Swiss material the removal had left, and
[DECISIONS-2026-09-29 §2](../platform/programme/DECISIONS-2026-09-29.md) set
what the removal covers:

- no Swiss Ephemeris source code anywhere in the tree;
- no per-case Swiss value kept as data anywhere: not in a file, a field, a
  table, a list or a script, and not as a value that arithmetic on what
  remains gives back;
- no Swiss value in `src/` in any form, prose included: the pages give
  statistics over a stated range, and tests read committed statistics;
- figures quoted in the prose of a dated evidence README, audit record or
  report stay as written; the records are named at the end.

The rest left on 2026-09-29. Statistics and SHA-256 digests stay. Git
history was not rewritten: commit `2ca93d4174822e2ba4b8fc3de0db6551d0c5ba83`,
the base of both removals, is the last with every value, and
`git show 2ca93d41:<path>` gives any of them back.

In all, 10 files were removed, 131 lost the fields that held Swiss's values,
and 21 were replaced by an independent rebuild. Each is listed below and,
field by field with its SHA-256, in
[`swiss-output-removal/manifest.json`](swiss-output-removal/manifest.json).
[`swiss-output-removal/strip.py`](swiss-output-removal/strip.py) made the
change from the base commit's bytes, and `strip.py --check` confirms the tree
still matches it; the `swiss-output-removal` job of
`.github/workflows/site-check.yml` runs it on every pull request and every
push to `main`.

`swiss-output-removal/value-digests.json` holds a digest of each of the
44,071 distinctive numbers and timestamps that left: a number with seven or
more significant digits, a whole number of twelve or more digits (a
millisecond clock) that is not a whole minute, or a timestamp with a
fraction of a second that is not on a whole minute. Each
digest is the first 16 hexadecimal digits of the token's SHA-256, a
membership test rather than a way back to the value. 40,597 of them are
"gone": no data or code file and nothing under `src/` holds them. The other
3,474 are "kept", because they still appear there as inputs, statistics or
reference values; the last sections say which. (Until 2026-09-30 the split was
40,604 and 3,467; "The independent references on engine rc.15's clock" below
says why seven moved.) `strip.py` and
`scripts/lib/swiss-output-scan.mjs` read a token the same way, and the
digests carry calibration texts that hold the two to it.

`scripts/swiss-output-guard.test.mjs` reads the tree by content, not by name.
It walks every tracked file and every file that would be added, and the
members of `.tgz`, `.tar.gz`, `.tar`, `.gz` and `.zip` archives three levels
deep, all but `swiss-output-removal/` itself, whose digests are not values,
and fails on:

- a removed or replaced file's bytes under any name or in any archive;
- a "gone" value in any data or code file (JSON, CSV, text, logs, scripts and
  the like), or in any file under `src/`;
- a Swiss provenance marker (`pyswisseph`, `swisseph`, `SWIEPH`, a `swe.`
  call) under `src/`, beyond the two kept policies, which it pins by
  SHA-256, and the conformance suite's summary, which may carry statistics
  only;
- Swiss Ephemeris source code in any data or code file, or a `patch` in a
  swisseph commit receipt;

and, as before, on a removed file at its old path or a removed field back in
a stripped file. On this tree it reads 14,744 files and 9,758 archive
members in about 20 seconds.

## What counts as Swiss output

A value Swiss Ephemeris returned: a position, a speed, a cusp, an angle, an
event time, a ΔT. Also a table that gives, for every case of a set, Swiss's
value or its difference from something reproducible (the engine, an arbiter,
a published instant), because either gives Swiss's value back; and any value
that arithmetic on what remains gives back, such as a difference kept beside
the other term, a TT instant kept beside its UT, or a position computed at
UT + Swiss's ΔT beside the same program's position at its own clock. And
Swiss Ephemeris source code, which is licensed under the AGPL or
commercially.

What stays:

- statistics: counts, means, percentiles, and extremes with the case they
  came from;
- SHA-256 digests;
- figures quoted in the prose of the dated records listed at the end, as
  part of the finding each records;
- the scripts that call Swiss (pyswisseph), which regenerate its values on
  demand: they read Swiss's inputs from outside the repository and write
  outside it;
- the packs' acceptance policies, which hold cases, gates, inputs and
  digests but no value Swiss returned.

## Removed files

Ten files. Each was last in commit `2ca93d41`.

| Path | Bytes | SHA-256 | What it held |
| --- | ---: | --- | --- |
| `docs/platform/evidence/precision-2026-09-20/numerics/raw/t1-swiss.json` | 380,798 | `31b0970247d489e0940ed391a8f83898ac2dc1df7c468467028bf391d31c938f` | Swiss nutation and obliquity at 1,964 instants |
| `docs/platform/evidence/precision-2026-09-20/numerics/verify/t1-swiss.json` | 380,798 | `31b0970247d489e0940ed391a8f83898ac2dc1df7c468467028bf391d31c938f` | the same 1,964 instants, rerun |
| `docs/platform/evidence/precision-2026-09-20/numerics/verify/v1-swiss.json` | 570,916 | `aeee17ed869a2e1614d06dfd5781ebb4643e8a539f1597bd5d3e9049bc1ae81d` | Swiss nutation and obliquity at 2,945 instants |
| `docs/platform/evidence/precision-2026-09-20/numerics/verify/v4-dense-diff.json` | 415,730 | `3b3bf96567ea5a63370abaa8e6722c7c6809af141d9c8757a9f81abdab799890` | prototype minus Swiss for ten bodies at 600 instants, beside the prototype's own values in v4-dense.json |
| `src/lib/engine/fixtures/swiss-eight-cases.fixture.json` | 47,130 | `e51073b6c78ce721a4cd284d6626566c1c267c63075e6c81654302d6d5f9c7ed` | Swiss positions at three epochs, two stations, a solar return with two charts and a Saturn return |
| `src/lib/engine/fixtures/swiss-lunar-return-policy.json` | 22,350 | `16c807cfb7374c340200064ba6f4332b98923f77b05f6f24f62ea5541d5aa146` | the lunar-return policy, whose L-wrap birth instant was the first 0-degree crossing of Swiss's Moon after 2000-01-01; superseded by independent-lunar-return-policy.json, which carries its other cases, its gates and its conditioning unchanged |
| `src/lib/engine/fixtures/swiss-lunar-returned-charts.fixture.json` | 49,768 | `daa41662758d7c1f4dfa234e2dfbd33a884d11b343d94af605b28a537c18b410` | Swiss charts at the seven instants the product returned |
| `src/lib/engine/fixtures/swiss-lunar-returns.fixture.json` | 69,305 | `22e4a55652e12541d01cbd46c7efad018a06e60169fb399e2d02a6ab2ab6d5d5` | Swiss lunar-return instants, bands and charts for six cases |
| `src/lib/engine/fixtures/swiss-node-polar.fixture.json` | 23,525 | `022fbc030185b84aa0954411aab266577cd75f50a1947dc4717e92d8a9db9260` | Swiss true node (three epochs) and whole-sign angles and cusps (three polar places) |
| `src/lib/engine/fixtures/transit-window-independent.json` | 83,570 | `db4ddce1d2761ad0ada1ab7aaf456d74d2f79b6b6a3434b1b8f6b9895ad66c3a` | Swiss transit-window components, bands, minima and crops for the nine A-I cases |

How to regenerate each, with the commands the files' own READMEs record.
Write the output outside the repository.

- The three nutation files: in
  `docs/platform/evidence/precision-2026-09-20/numerics`,
  `python3 tools/t1-nutation-swiss.py <t1-node.json> <ephe>` (`numerics/RESULTS.md`).
- `numerics/verify/v4-dense-diff.json`: in the same directory,
  `node verify/v4-dense-dump.mjs`, then `python3 verify/v4-swiss.py`.
- `swiss-eight-cases.fixture.json`:
  `python3 docs/engine-validation/swiss-eight-cases/extract-fixture.py <retained evidence> <out.json>`.
- `swiss-lunar-returns.fixture.json` and `swiss-lunar-returned-charts.fixture.json`:
  `extract-fixture.py` and `extract-returned-charts.py` in
  `docs/engine-validation/swiss-lunar-return/`, from the retained package;
  `swiss-lunar-return-policy.json` is a byte copy of the approved policy in
  that package.
- `swiss-node-polar.fixture.json`: `acquire.py` and `generate-references.py`
  in `docs/engine-validation/swiss-node-polar/`, as its README's Reproduction
  section runs them.
- `transit-window-independent.json`:
  `python3 docs/engine-validation/transit-windows/project-fixtures.py <extracted archive> --output <out.json>`.

`swiss-lunar-return-policy.json` held no position, but its `L-wrap` case was
born at the first 0° crossing of Swiss's Moon after 2000-01-01, an instant
Swiss gave. `independent-lunar-return-policy.json` carries its other cases,
its gates and its conditioning unchanged, names it by SHA-256, and takes that
crossing from the Horizons Moon instead.

## Stripped on 2026-09-28

In 74 files Swiss's per-case values sat beside statistics (one of them,
`corpus-tt.json`, was replaced on 2026-09-29; below). The values were removed
and every other field kept byte for byte: each file was written back with the
serializer that reproduces its original bytes, and `canon-events.json`, which
is laid out by hand, had its Swiss column cut from the text. Each now carries
a `swissOutputRemoved` block naming the decision, the fields removed, the
SHA-256 and size of what was removed, the file's SHA-256 before, the base
commit and the command that regenerates the values.

A digest is taken over the removed values as compact JSON
(`json.dumps(value, separators=(',', ':'), ensure_ascii=False)` in Python):
for `.rows`, the array itself; for `.x[].a|b`, one object per element of `x`
holding the fields removed from it; for `.baseline.<event>.swiss`, an object
from event to value. `report-measure-rc8.json` also gained a `statistics`
block: the figures `scripts/methodology-accuracy-claim.test.mjs` and
`scripts/claims-bindings.test.mjs` used to compute from its rows, computed
from them by the same formulas before they were removed. `sidereal.json`
gained its largest Swiss-minus-ERFA difference, with its date, which its
README quotes.

| File (under `docs/platform/evidence/`) | Removed | Values | SHA-256 of the removed values |
| --- | --- | ---: | --- |
| `deltat-2026-09-25/outputs/swiss-deltat.json` | `.seconds` | 3 | `c38cf2d6ed7143be269e06c29f06ef9744d292aa2beef0d7849ba4ce33979ef7` |
|  | `.before1962.swissMinusS15_2016_at` | 3 | `51b545ab0b77bdd06e886af55bac6f3d706e0b9ec4ba73e8bce7b123602b2dd2` |
|  | `.at1000` | 2 | `32bce87ba0c032f90fae6a96f7bf228a9f7365256a9229a878547ef87623a1e6` |
| `engine-beyond-swiss/corpora/canon-events.json` | `.baseline.<event>.swiss` | 4 | `24b82b33bd2c72d346953e89305734f288d752bd51e94f684debf6d951bc9cbf` |
| `engine-beyond-swiss/corpora/horizons-24/corpus-tt.json` (replaced on 2026-09-29) | `.cases[].deltaTSeconds` | 24 | `ec648e52d9891ba911fc775b90976a30dff7776dabbcfbc2c532c1bb5dc85a7b` |
| `events-vs-swiss-2026-09-23/deltas.json` | `.deltas[].deltaSeconds` | 290 | `b70803665c57a8ca301c408585f5126d7d364acd06072b6e05b2b1b4d665ae48` |
|  | `.summary.swissDeltaTSeconds2026` | 1 | `c0d106f34d96eabb6b53c588fc3b8411ae74fe144004f8bfd2a8608a53648e11` |
| `events-vs-swiss-2026-09-25/deltas.json` | `.deltas[].deltaSeconds` | 290 | `7d813990623fa97345a9d6fafd1e4c8e458d1503efcf78749762da8feac839af` |
|  | `.summary.swissDeltaTSeconds2026` | 1 | `c0d106f34d96eabb6b53c588fc3b8411ae74fe144004f8bfd2a8608a53648e11` |
| `houses-2026-09-26/results/sidereal.json` | `.rows[].swissMinusErfa` | 14 | `55584891877d64f6529b655154957c93ed650568f78cc8c9e5df658c94e46a8e` |
| `independent-node-polar-node22.json` | `.nodes` | 3 | `70f1409edb00fcf4c924619e002ec73ba8cc0f97bfa90b4be6329d983d953a11` |
|  | `.polar` | 6 | `7c141ab7b7843a05fdb8ca6e76f25b3d42e5f2d82f1713d2fe9d8dfb48b0f79e` |
| `independent-node-polar-node24.json` | `.nodes` | 3 | `70f1409edb00fcf4c924619e002ec73ba8cc0f97bfa90b4be6329d983d953a11` |
|  | `.polar` | 6 | `7c141ab7b7843a05fdb8ca6e76f25b3d42e5f2d82f1713d2fe9d8dfb48b0f79e` |
| `phase1-verdicts-2026-09-26/results/holdout-1.4-events.json` | `.rows[].minusSwissSeconds\|rc7MinusSwissSeconds` | 50 | `abf75745832a99067f228e68dd788c3c1eb3e53511a7136b1637e73ec466b025` |
| `precision-2026-09-20/numerics/raw/counterfactual/cellA-core-own-common.json` | `.cases[].deltaTReferenceSeconds` | 16 | `4e676e22efbdd8c6cf7407eae8184db24e5270a578725baa0d27249c187fe53e` |
| `precision-2026-09-20/numerics/raw/counterfactual/cellA-core-own-nut2000b-common.json` | `.cases[].deltaTReferenceSeconds` | 16 | `4e676e22efbdd8c6cf7407eae8184db24e5270a578725baa0d27249c187fe53e` |
| `precision-2026-09-20/numerics/raw/counterfactual/cellA-core-own-nut2000b.json` | `.cases[].deltaTReferenceSeconds` | 18 | `083f8ea37340cacc3314c749eee8c01793879283f74fea3486db8dcc897a8210` |
| `precision-2026-09-20/numerics/raw/counterfactual/cellB-core-pinned-common.json` | `.cases[].deltaTReferenceSeconds\|deltaTAppliedSeconds` | 16 | `cc438f5f95268cbdb65722b5ca943eab4437b135945d30a834c7595d584b3b4a` |
| `precision-2026-09-20/numerics/raw/counterfactual/cellB-core-pinned-nut2000b-common.json` | `.cases[].deltaTReferenceSeconds\|deltaTAppliedSeconds` | 16 | `cc438f5f95268cbdb65722b5ca943eab4437b135945d30a834c7595d584b3b4a` |
| `precision-2026-09-20/numerics/raw/counterfactual/cellB-core-pinned-nut2000b.json` | `.cases[].deltaTReferenceSeconds\|deltaTAppliedSeconds` | 18 | `5c219bf7bae828c46dfba66b5bfad27a1bb194f0071b2db5473570b0760174da` |
| `precision-2026-09-20/numerics/raw/repro-cellD-report.json` | `.rows` | 160 | `87523a7685d858b36accdac443ed30221420ad28f60352177e499615e6243497` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-aberration-first-order.json` | `.rows` | 160 | `22833690adc74f6a99c58ddae479c5511366257427a435c66180b951aba1c013` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-aberration-off.json` | `.rows` | 160 | `c67c8c5611e1c17723d66577c0685d8f8ed31fed7b91de894dc3e007746895d9` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-bias-off.json` | `.rows` | 160 | `1fbe5641eacdfd8677e0eca929f0ab6174fa1d421d881796c5b3e59d372c3f0f` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-deflection-off.json` | `.rows` | 160 | `a48e5aea217cf611cfb6c01a40876f745e7e50605beaefafc65e0ec232c0284b` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-light-time-1-iteration.json` | `.rows` | 160 | `6f5d64a13ea13f75d8f719ad75b83802ec98d21282c96229f4c3e43da6f04211` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-light-time-2-iterations.json` | `.rows` | 160 | `5a79ba5830cb2db1b239fb3333eb06abcc91ed7fbcb4a08d66ab28126211a5e3` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-nutation-back-to-ae.json` | `.rows` | 160 | `ed3f4335d310d76b739968666398067165ee21387816cea181822c7883feddd8` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-observer-velocity-h-600s.json` | `.rows` | 160 | `1ce4cf87ad48ceba4307e711688e3d185e6d388820915324c6566e5d4ee0e577` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-observer-velocity-h-60s.json` | `.rows` | 160 | `7b8779f41e17530c1cba6013b156c57601933ba067c33f0b582ae7a6e6e35e9c` |
| `precision-2026-09-20/numerics/raw/sweep/report-a-tdb-off-tt-as-tdb-.json` | `.rows` | 160 | `73b3433b402051cfbb840b52d1e43381ae97e0ec063f84f6955cda579994aa45` |
| `precision-2026-09-20/numerics/raw/sweep/report-p0-prototype-as-shipped.json` | `.rows` | 160 | `e5d67c6fce6cdbf8f9cdbf240a65cd37cdcc6f1276609d99c4bc1bbd9bf1e2b6` |
| `precision-2026-09-20/numerics/raw/sweep/report-p1-iau2000b-nutation.json` | `.rows` | 160 | `e521ab8e36eecafed161c4df7fc635fabe7d02686f6bbe32117b935da2fad524` |
| `precision-2026-09-20/numerics/raw/sweep/report-p1a-iau2000a-nutation.json` | `.rows` | 160 | `49922a3bc0478bc89167c6983feb7c1b2a191d665e3f8762663be7067546ac65` |
| `precision-2026-09-20/numerics/raw/sweep/report-p2-frame-bias-only.json` | `.rows` | 160 | `f9be16dea165196593c7d7ea41f845fa2d1df64511eb32ae4aa863f482a947ac` |
| `precision-2026-09-20/numerics/raw/sweep/report-p3-2000b-frame-bias.json` | `.rows` | 160 | `26e8289d02995456bc544a07544f1955a46868df56a9a0022314c314de4901f3` |
| `precision-2026-09-20/numerics/raw/sweep/report-p4-2000b-bias-tdb.json` | `.rows` | 160 | `895a7b2d200b0d696e3e9f684f3fdfd789669c3da639a4a3642f7935eceafff4` |
| `precision-2026-09-20/numerics/raw/sweep/report-p5-2000b-bias-tdb-deflection.json` | `.rows` | 160 | `5a20f4e3d13a1a8fc751c1ee65b3e140d427623211ffeba9dd05ac44a140176f` |
| `precision-2026-09-20/numerics/raw/sweep/report-p6-full-aberration-too.json` | `.rows` | 160 | `2bb858657d0b416700520a7f23e75d68c208ddd33926838b0484b7e8454575a8` |
| `precision-2026-09-20/numerics/raw/sweep/report-p7-analytic-observer-velocity.json` | `.rows` | 160 | `328f098b1da14fb0b2dd1997dc04b8f2cc85ee3be92662c3a49ad57f29ca36d2` |
| `precision-2026-09-20/numerics/raw/sweep/report-p8-best-light-time-to-1e-11.json` | `.rows` | 160 | `328f098b1da14fb0b2dd1997dc04b8f2cc85ee3be92662c3a49ad57f29ca36d2` |
| `precision-2026-09-20/numerics/raw/sweep/report-p8a-best-with-iau2000a.json` | `.rows` | 160 | `eb8e0887ea55784fffbdad8b459542458802d24b49e5d6b53543ede78bba888d` |
| `precision-2026-09-20/numerics/verify/counterfactual/cellA-core-own-common.json` | `.cases[].deltaTReferenceSeconds` | 16 | `4e676e22efbdd8c6cf7407eae8184db24e5270a578725baa0d27249c187fe53e` |
| `precision-2026-09-20/numerics/verify/counterfactual/cellA-core-own-nut2000b-common.json` | `.cases[].deltaTReferenceSeconds` | 16 | `4e676e22efbdd8c6cf7407eae8184db24e5270a578725baa0d27249c187fe53e` |
| `precision-2026-09-20/numerics/verify/counterfactual/cellA-core-own-nut2000b.json` | `.cases[].deltaTReferenceSeconds` | 18 | `083f8ea37340cacc3314c749eee8c01793879283f74fea3486db8dcc897a8210` |
| `precision-2026-09-20/numerics/verify/counterfactual/cellB-core-pinned-common.json` | `.cases[].deltaTReferenceSeconds\|deltaTAppliedSeconds` | 16 | `cc438f5f95268cbdb65722b5ca943eab4437b135945d30a834c7595d584b3b4a` |
| `precision-2026-09-20/numerics/verify/counterfactual/cellB-core-pinned-nut2000b-common.json` | `.cases[].deltaTReferenceSeconds\|deltaTAppliedSeconds` | 16 | `cc438f5f95268cbdb65722b5ca943eab4437b135945d30a834c7595d584b3b4a` |
| `precision-2026-09-20/numerics/verify/counterfactual/cellB-core-pinned-nut2000b.json` | `.cases[].deltaTReferenceSeconds\|deltaTAppliedSeconds` | 18 | `5c219bf7bae828c46dfba66b5bfad27a1bb194f0071b2db5473570b0760174da` |
| `precision-2026-09-20/numerics/verify/holdout-p0-prototype-report.json` | `.rows` | 40 | `d948ab3ff90bd677c51c8c99f22fdbba64dc37817b8bf0f46b049c69dcf2dcb9` |
| `precision-2026-09-20/numerics/verify/holdout-p8-best-report.json` | `.rows` | 40 | `371fb191770f3cd4800a4c0478bf665c2a49550cda7c831e54fa18738a42b5b7` |
| `precision-2026-09-20/numerics/verify/holdout-p8a-best-2000a-report.json` | `.rows` | 40 | `fa017df187415dec10202f907194f6238cfecc75515df239a81b3ffdf3ef4a01` |
| `precision-2026-09-20/numerics/verify/p8-report.json` | `.rows` | 160 | `328f098b1da14fb0b2dd1997dc04b8f2cc85ee3be92662c3a49ad57f29ca36d2` |
| `precision-2026-09-20/numerics/verify/repro-cellD-report.json` | `.rows` | 160 | `87523a7685d858b36accdac443ed30221420ad28f60352177e499615e6243497` |
| `precision-2026-09-20/raw/cellA-core-own.json` | `.cases[].deltaTReferenceSeconds` | 18 | `083f8ea37340cacc3314c749eee8c01793879283f74fea3486db8dcc897a8210` |
| `precision-2026-09-20/raw/cellB-core-pinned.json` | `.cases[].deltaTReferenceSeconds\|deltaTAppliedSeconds` | 18 | `5c219bf7bae828c46dfba66b5bfad27a1bb194f0071b2db5473570b0760174da` |
| `precision-2026-09-20/raw/cmp-A-core-own.json` | `.rows` | 180 | `ecc428332255089fad05d51b82ddc7dbd8f0be9542f98f6be5d506f5168ab65b` |
| `precision-2026-09-20/raw/cmp-B-core-pinned.json` | `.rows` | 180 | `8705f6f423547ecdd849825591c5bf6db01f97b0ea21681e28ce4d60c42813fd` |
| `precision-2026-09-20/raw/cmp-C-proto-own.json` | `.rows` | 160 | `efe647595e65f4440718e89277c2efb5ac126b9d80479e74c603d8e3eed9976d` |
| `precision-2026-09-20/raw/cmp-D-proto-pinned.json` | `.rows` | 160 | `87523a7685d858b36accdac443ed30221420ad28f60352177e499615e6243497` |
| `precision-2026-09-20/raw/recovered-report-proto-engine-deltat.json` | `.rows` | 160 | `efe647595e65f4440718e89277c2efb5ac126b9d80479e74c603d8e3eed9976d` |
| `precision-2026-09-20/search/raw/decomposition.json` | `.sources.ephemerisModel.atTheTurningPointItself.swissLongitude` | 1 | `320287a39039ed35a542ef84eeed9ce3f7dbf9fa5db3e2c990116aba44b57e61` |
| `precision-2026-09-20/search/raw/reproduction.json` | `.independentReproduction.swiss.stationUtc` | 1 | `46f826408b8db2d49cbbb3dcb9dd5564f5e4d16bd8d0cbaed49c4702dc0e712c` |
|  | `.independentReproduction.swiss.stationLongitudeDegrees` | 1 | `86c94f95b75b798def64c6156953d1cea717d98e59c8d113b2722ec81541b162` |
|  | `.independentReproduction.swiss.stationSpeedDegPerDay` | 1 | `ecba08b9a5fd4533bcb287fef2046e9b670648d822cfdd338cfd4d6c2a3a950f` |
| `precision-2026-09-20/search/verify/raw-original/decomposition.json` | `.sources.ephemerisModel.atTheTurningPointItself.swissLongitude` | 1 | `320287a39039ed35a542ef84eeed9ce3f7dbf9fa5db3e2c990116aba44b57e61` |
| `precision-2026-09-20/search/verify/raw-original/reproduction.json` | `.independentReproduction.swiss.stationUtc` | 1 | `46f826408b8db2d49cbbb3dcb9dd5564f5e4d16bd8d0cbaed49c4702dc0e712c` |
|  | `.independentReproduction.swiss.stationLongitudeDegrees` | 1 | `86c94f95b75b798def64c6156953d1cea717d98e59c8d113b2722ec81541b162` |
|  | `.independentReproduction.swiss.stationSpeedDegPerDay` | 1 | `ecba08b9a5fd4533bcb287fef2046e9b670648d822cfdd338cfd4d6c2a3a950f` |
| `site-engine-rc10/node22-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |
| `site-engine-rc10/node24-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |
| `site-engine-rc5/independent-node-polar-node22.json` | `.nodes` | 3 | `70f1409edb00fcf4c924619e002ec73ba8cc0f97bfa90b4be6329d983d953a11` |
|  | `.polar` | 6 | `7c141ab7b7843a05fdb8ca6e76f25b3d42e5f2d82f1713d2fe9d8dfb48b0f79e` |
| `site-engine-rc5/independent-node-polar-node24.json` | `.nodes` | 3 | `70f1409edb00fcf4c924619e002ec73ba8cc0f97bfa90b4be6329d983d953a11` |
|  | `.polar` | 6 | `7c141ab7b7843a05fdb8ca6e76f25b3d42e5f2d82f1713d2fe9d8dfb48b0f79e` |
| `site-engine-rc7/node22-parity.json` | `.nodes` | 3 | `70f1409edb00fcf4c924619e002ec73ba8cc0f97bfa90b4be6329d983d953a11` |
|  | `.polar` | 6 | `66e5491e5c45b9cf089658daf90a61647941c634356a53aad2198765e08008e7` |
| `site-engine-rc7/node24-parity.json` | `.nodes` | 3 | `70f1409edb00fcf4c924619e002ec73ba8cc0f97bfa90b4be6329d983d953a11` |
|  | `.polar` | 6 | `66e5491e5c45b9cf089658daf90a61647941c634356a53aad2198765e08008e7` |
| `site-engine-rc8/node22-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |
| `site-engine-rc8/node24-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |
| `site-engine-rc9/node22-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |
| `site-engine-rc9/node24-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |
| `swiss-benchmark/report-holdout-core.json` | `.rows` | 60 | `0bb9af6efebf9f25ea9ffda8c7ae5a5b8d27aa5bc1fc28b2cb6c1b3892417a5f` |
| `swiss-benchmark/report-holdout-prototype.json` | `.rows` | 40 | `51c8e2cf705c4fc79f2b2f2263e4efabe9d6e022f3a04b496c81c9d541ab81c8` |
| `swiss-benchmark/report-measure-rc8.json` | `.rows` | 180 | `595d2a63e15c24833c1f178e23f38f1573794751ae6c9058be7fbb5f1647654c` |
| `swiss-benchmark/report-measure.json` | `.rows` | 180 | `ecc428332255089fad05d51b82ddc7dbd8f0be9542f98f6be5d506f5168ab65b` |
| `swiss-benchmark/report-prototype-matched.json` | `.rows` | 160 | `87523a7685d858b36accdac443ed30221420ad28f60352177e499615e6243497` |

Twelve of these files lost more on 2026-09-29 (next section): the seven
cell B files, both copies of `decomposition.json` and `reproduction.json`,
and `report-measure-rc8.json`.

## Removed on 2026-09-29

The review found four kinds of Swiss material the first removal had left.
This is what left for each, under
[DECISIONS-2026-09-29 §2](../platform/programme/DECISIONS-2026-09-29.md).

### Values that arithmetic on what remained gave back

- **The Horizons corpus's clock.** `horizons-24/corpus-tt.json` kept the TT
  instants the corpus was fetched at, UT + Swiss's ΔT, beside their UT
  instants: `(jdTt − jdUt) · 86400` gave all 24 removed ΔT values back, the
  worst to 1.9e-5 s. The time column of every Horizons response fetched at
  those instants did the same, and so did `horizons-frame/vectors/results.json`,
  which kept each instant's TT (`instants[].jdTdb`). The corpus was re-timed
  on the engine's own ΔT (below), and the TT left `vectors/results.json`.
- **The Uranus D analysis** (`precision-2026-09-20/search/raw/` and its copy
  in `search/verify/raw-original/`). `decomposition.json` kept the DE
  prototype's and the engine's difference from Swiss at the turning point
  beside their own longitudes, Swiss's TT − UTC and its residual, a 6-hourly
  grid that starts at Swiss's component start, and the ends of the recorded
  possible-exact region. `reproduction.json` kept Swiss's station minus the
  target beside the target, Swiss's TT − UTC, and the two components' ends
  and regions, which were Swiss's hourly scan. `uranus-d.json` kept the
  component ends it searched between, the crop-boundary orbs and Swiss's
  offset from the level at the 2020-01-01 boundary. The margins, the
  smallest distance of each program's longitude from the target, stay: the
  analysis rests on them.
- **Positions on Swiss's clock** (`precision-2026-09-20/`). To hold the clock
  fixed against Swiss, cell B of the controlled baseline ran the engine, and
  cell D, the modelling sweep, the reproduction of cell D and the three
  hold-out runs ran the DE prototype, at each case's UT + Swiss's ΔT. Beside
  the same program at its own clock (cells A and C), the Moon's difference
  over its speed gives that ΔT back: to within 0.012 s from cell B and
  0.0034 s from cell D. These 61 files keep their cases' ids, strata and UT
  and lost their per-case positions, and cell B its angles. Cells A and C
  keep theirs, and every statistic made from the pinned runs stays.
- **The far-future Moon.** The statistics block written into
  `report-measure-rc8.json` on 2026-09-28 listed the Moon's difference from
  Swiss at each of its two far-future epochs, which with the engine's own
  Moon gives Swiss's back. The count stays.

| File (under `docs/platform/evidence/`, but for the receipt) | Removed | Values | SHA-256 of the removed values |
| --- | --- | ---: | --- |
| `docs/engine-validation/swiss-node-polar/receipts/swisseph-master-commit.json` | `.files[].patch` | 1 | `0ff17b461a65c963adfd0ae7c318a3d8b352f1af1766f04c0b0d62c49fcb5176` |
| `engine-beyond-swiss/horizons-frame/vectors/results.json` | `.instants[].jdTdb` | 24 | `6c5910d731a5805eff1d86cb85caeba72f7f9ced5480c4cbe324980c15ef1420` |
| `precision-2026-09-20/numerics/{raw,verify}/counterfactual/cellB-core-pinned-common.json` | `.cases[].bodies\|angles` | 16 | `094cb633a4565d94973b1e37e5fcd3bde0dfdf49c3d885b81e2855f5a6fc041e` |
| `precision-2026-09-20/numerics/{raw,verify}/counterfactual/cellB-core-pinned-nut2000b-common.json` | `.cases[].bodies\|angles` | 16 | `08078783c5fdd8c45c95678af5558e4427f668882e0d6843616560bd6f286e24` |
| `precision-2026-09-20/numerics/{raw,verify}/counterfactual/cellB-core-pinned-nut2000b.json` | `.cases[].bodies\|angles` | 18 | `219737258661df377a51ebc517d69de5bbabddca33a60b9de922cb22785370c9` |
| `precision-2026-09-20/numerics/{raw,verify}/counterfactual/cellD-proto-pinned-common.json` | `.cases[].bodies` | 16 | `b96910dad8800e8aaa4edf8b5cd72de7adb5cf5190d2265783691ea7133fb306` |
| `precision-2026-09-20/numerics/{raw,verify}/counterfactual/cellD-proto-pinned-nut2000b-common.json` | `.cases[].bodies` | 16 | `1a999a8811547fc474c81f4db15c55de1de38832bcc187a4854950f4f11cf77d` |
| `precision-2026-09-20/numerics/{raw,verify}/counterfactual/cellD-proto-pinned-nut2000b.json` | `.cases[].bodies` | 18 | `293592fdf51e397129c06fad08fc929c260615e277580e9c789d527866881cf9` |
| `precision-2026-09-20/numerics/{raw,verify}/repro-cellD-dump.json` | `.cases[].bodies` | 18 | `643e6828ff6960d403fa1069d73ef22097a9abdcf3b6630b82665bc83b6db0e7` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-aberration-first-order.json` | `.cases[].bodies` | 18 | `016c06aae8f9985124a63a07faef830d3db24c7d6983d721754ae8698743d002` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-aberration-off.json` | `.cases[].bodies` | 18 | `0ede878d73dbf0c4a0d57d82e62156b0a2fc686c9a04f0f58fc074853c936526` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-bias-off.json` | `.cases[].bodies` | 18 | `ec23ec5ec423335daacd60e8f3bbe6442a71c1c368e21f1ef4702da738a06608` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-deflection-off.json` | `.cases[].bodies` | 18 | `5b6f9a380d75df460a652c7db939eb196f80d040e24359f7f7a64e6edb59ade6` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-light-time-1-iteration.json` | `.cases[].bodies` | 18 | `7c56c0415595bf4d01672328db068044d55f9ad8c26e2d14d1cd9c60e89f0753` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-light-time-2-iterations.json` | `.cases[].bodies` | 18 | `a4f9e00e61575b6e48e7ffb6e527dfa3ee798b8443f5345881b91a0c4930fd15` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-nutation-back-to-ae.json` | `.cases[].bodies` | 18 | `6b5c1a96951947aafac8ee4a4c99b27924d86f9d2bd49bc156b0448eb84d3200` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-observer-velocity-h-600s.json` | `.cases[].bodies` | 18 | `8445c022ab6c49dc7dc451839496ed1b41dbbc441a6df46e82bf0b62200092ab` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-observer-velocity-h-60s.json` | `.cases[].bodies` | 18 | `77a2113e03ccd854ff44cf25f5a02f3615b3f64583c9f36125e3a07b1d30cc79` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-a-tdb-off-tt-as-tdb-.json` | `.cases[].bodies` | 18 | `667d8ceef9be70258e6efe1d256cb7749ac354b99d1b549be7a9ab7ae54e5923` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p0-prototype-as-shipped.json` | `.cases[].bodies` | 18 | `afa3f0dcf1859c7c6fc3c219e3b262975c3ed1d9de8de10f05c8da333022df21` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p1-iau2000b-nutation.json` | `.cases[].bodies` | 18 | `1dd6d88cf642e56e12eb237d7972aaa313bb5bc17a737eff6ab63035d0034fea` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p1a-iau2000a-nutation.json` | `.cases[].bodies` | 18 | `7c7c875c1cd42ab481ec7959c86d9c2436ad8efb6150d0e8900be68c9f45e244` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p2-frame-bias-only.json` | `.cases[].bodies` | 18 | `204199a0d091d864949c0324dae011c8ba173699fb5e1fa320a0e3bfdbe4716d` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p3-2000b-frame-bias.json` | `.cases[].bodies` | 18 | `374d40fd330ebe3e8dc617a9dcd8366842a02c560c79881ef0c00fecc8ee4ef1` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p4-2000b-bias-tdb.json` | `.cases[].bodies` | 18 | `1ef5bd3b0beb11960d4f977424bbd7f00a281e93557b9707b7f63415c3abfb38` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p5-2000b-bias-tdb-deflection.json` | `.cases[].bodies` | 18 | `2c45d978e55c3de907a0d09b29bd5cdf03d3306c7d6644015bd9e66abc273fd8` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p6-full-aberration-too.json` | `.cases[].bodies` | 18 | `d59236f467ad5ca06acec77268b402d6c5789f986a3668be46ddb5ef0c890f93` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p7-analytic-observer-velocity.json` | `.cases[].bodies` | 18 | `03023f16e0481de1c1370a6a546d76748cf14623a196fd19acceb57707c1efe0` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p8-best-light-time-to-1e-11.json` | `.cases[].bodies` | 18 | `b2e07781a5712b12c7f39ea097494eee1516b80efe50a305e8b094cb6f7d0ab1` |
| `precision-2026-09-20/numerics/{raw,verify}/sweep/sweep-p8a-best-with-iau2000a.json` | `.cases[].bodies` | 18 | `b756cb15f992a636da5eb3d09a84a89e8f0403e9269d63005c9dac179cbe39d4` |
| `precision-2026-09-20/numerics/verify/holdout-p0-prototype.json` | `.cases[].bodies` | 6 | `641d6814eb95079f2dbd418405760e702be597a45102c8d433fbab20cafa13be` |
| `precision-2026-09-20/numerics/verify/holdout-p8-best.json` | `.cases[].bodies` | 6 | `a196b82f994ed51662edef5855ddf31df35bcc26d75f99c986893aae23088178` |
| `precision-2026-09-20/numerics/verify/holdout-p8a-best-2000a.json` | `.cases[].bodies` | 6 | `6cd06c2ae80e6efdb40e0001efd650473dd708edbe2032ecacd8f030e475712e` |
| `precision-2026-09-20/raw/cellB-core-pinned.json` | `.cases[].bodies\|angles` | 18 | `59e4fd386121ccb72a675e0cdc9cdedb37f901328aab55f0c2bc3071d1833866` |
| `precision-2026-09-20/raw/cellD-proto-pinned.json` | `.cases[].bodies` | 18 | `643e6828ff6960d403fa1069d73ef22097a9abdcf3b6630b82665bc83b6db0e7` |
| `precision-2026-09-20/search/{raw,verify/raw-original}/decomposition.json` | `.sources.ephemerisModel.overComponent.fromUtc\|toUtc` | 2 | `6d62d6ccce3fa659cc2e8302d0729d2029a420081613218c326371877b14da66` |
|  | `.sources.ephemerisModel.atTheTurningPointItself.deMinusSwissArcsec\|coreMinusSwissArcsec` | 2 | `8d53b840e23d0d7bc4e0ff731f258f8e1f6a722498c7af066cb4c1adc9a67ecc` |
|  | `.sources.timeModel.thisWindowIsHistorical.swissReturnedTtMinusUtcSeconds\|residualSeconds` | 2 | `3f319d4c4ff7c6104f551b21bab754d0025c594d21dad4664cf6c9b01d914a11` |
|  | `.stationaryGeometryAudit.theRightTreatment.recordedPossibleExactRegionUtc` | 2 | `88c5d716e271f50e18cc2bd04b17c8bcd7a72be356803d17af0f7a5401741e58` |
| `precision-2026-09-20/search/{raw,verify/raw-original}/reproduction.json` | `.recordedContract.components[].startUtc\|endUtc\|possibleExactRegionUtc\|possibleMinimumRegionUtc` | 2 | `d7b20e50afa588a426fbd77d0eaa0f8b17cfbe0d1082fae5a226216f84a1d73d` |
|  | `.independentReproduction.swiss.signedStationMinusTargetDegrees\|ttMinusUtcSeconds` | 2 | `6d4800489d3847402e365fc8ae8d6928243cd4522dab4c8b5af4f09b9f02c048` |
| `precision-2026-09-20/search/{raw,verify/raw-original}/uranus-d.json` | `.results.perComponentExactLevel[].fromUtc\|toUtc` | 2 | `5960af026c269213deb5eb0197e7b7c78d59a4255b88ceb2e77793cb75db1a78` |
|  | `.results.crops.halves[].recordedBoundaryOrbDegrees` | 2 | `76beadaaef60d2ec0ff2942ffe9578483cb041f3df2d77b78c85231455efe6e6` |
|  | `.results.crops.theBoundaryEvent.swissOffsetFromLevelDegrees\|swissOffsetFromLevelArcsec\|recordedCropBoundaryOrbDegrees\|deMinusSwissAtTheBoundaryArcsec\|rootOffsetFromBoundarySecondsSwiss` | 5 | `3f05ab82ab163825c515eceaa1d47b03f760e661e98d1fabf9121e0397340c9d` |
| `swiss-benchmark/report-measure-rc8.json` | `.statistics.farFuture.moonCases` | 2 | `36ad1218ee678fd678990c44c1d2856508fa0085a0ffff38e30b59fb8fa697e0` |

### The Horizons corpus, re-timed

21 files were replaced rather than stripped, because the Swiss value was
their clock. `corpora/tools/retime-corpus.mjs` wrote `corpus-tt.json` with
TT = UT + the engine's own ΔT (model `zodiacs-deltat/1`) at each
preregistered UT instant, rounded to the 1e-8 day a request carries, and
Horizons was asked again for the sixteen TT files in `horizons-24/` and the
three VECTORS files in `horizons-frame/vectors/`, whose query log was
replaced with them. `Moon_UT.txt`, at the UT instants on Horizons's own
clock, is unchanged. The instants moved by the difference between the two
programs' ΔT: fractions of a second up to 2026, more after it. The manifest
gives each file's SHA-256 before and after, and the guard fails on the old
bytes under any name. The horizons-frame study keeps its first-run figures,
with `results-2026-09-29.json` and `vectors/results-2026-09-29.json` beside
them; the two runs agree to within the rounding of Horizons's printed angles
([`../platform/evidence/engine-beyond-swiss/horizons-frame/README.md`](../platform/evidence/engine-beyond-swiss/horizons-frame/README.md)).

### Swiss Ephemeris source code

`swiss-node-polar/receipts/swisseph-master-commit.json` is GitHub's record
of the swisseph commit whose data files the node/polar acquisition used. Its
`files[].patch` held that commit's diff: 148 lines of `swetest.c`, 5,178
bytes, SHA-256
`135fbf87aed62a9275457268498f7b99cdcee14a2eb4e0082520674e2f9b229b`. The
patch left, and the manifest records each patch's file, SHA-256, size and
line count. The commit's identity, author, date and file statistics stay,
and `acquire.py` reads only its sha. A search of every tracked file for
Swiss Ephemeris's headers (`swephexp.h`, `sweph.h`, `swedate.h` and the
rest), its internal `swi_` functions, `swetest`'s usage text and its
copyright line found nothing else. "Astrodienst" appears only in prose and
receipts that name the provider.

### On the site's pages

`/methodology/` gave Swiss's ΔT at 2100 and, with `/developers/engine/`, the
Moon's difference from Swiss at 2100 and at 2190, and
`scripts/methodology-accuracy-claim.test.mjs` read the ΔT from the prose of
`swiss-benchmark/RESULTS.md`. The pages now give statistics over a stated
span. From 2100 to 2199 the two programs' ΔT differ by 14.3 to 36.7 s,
inside the engine's own 1-σ of 42.4 to 103.4 s, and that alone moves the
Moon by 7.0″ to 23.4″. Those figures are
[`swiss-benchmark/deltat-gap-2100-2199.json`](../platform/evidence/swiss-benchmark/deltat-gap-2100-2199.json):
the extremes of a daily run over 36,524 days, with no daily value and no
date for any extreme. `tools/deltat-gap-zodiacs.mjs` writes the engine's
side outside the repository, and `tools/deltat_gap_swiss.py` computes
Swiss's ΔT on demand with pyswisseph and writes only the statistics. The
test reads that file, checks it against the installed engine, and fails if
either page states Swiss's ΔT at a date. The claims ledger's `acc.deltat`,
`acc.deltat-formula` and `acc.swiss-benchmark` statements no longer quote
Swiss's value at a date.

### In READMEs and scripts

A README table or list that gives Swiss's values case by case is data. These
left:

- `swiss-lunar-return/README.md`: each case's first independent event,
  Modern B's second root and the wrap case's Swiss natal input;
- `swiss-eight-cases/README.md`: the Solar root's Swiss instant, and the
  product's residual from it, which together gave it back;
- `precision-2026-09-20/search/RESULTS.md`: Swiss's D station instant, its
  TT − UTC, the ends of its possible-exact region and its offset at the crop
  boundary;
- `engine-validation/README.md`: Swiss's ΔT at 2100 and the far-future
  Moon's difference from Swiss at each epoch, in section 1 and in the
  paragraph on what cannot be reproduced;
- the Uranus D verification scripts, which carried Swiss's component ends
  and possible-exact region as literals. They, `reproduce.mjs`,
  `decompose.mjs` and `uranus-d.mjs` read the fixture of commit `2ca93d41`
  from a path outside the repository, as an argument or from
  `SWISS_WINDOW_FIXTURE`, and refuse one inside it (`search/lib/backends.mjs`);
  `search/run-all.sh` writes its output outside the repository.

### Added by #600, removed on 2026-09-30

#600 vendored engine rc.14 on 2026-09-29, after this removal began, and
recorded two parity reports with the per-case differences from the Swiss node
and polar fixture that rc.5 to rc.10's reports carried until 2026-09-28.
rc.14 gives the same results as rc.10 on those cases, so the rows held the
same values, and the guard failed on them when this branch took in `main`.
They are stripped as the earlier reports were: `.nodes` and `.polar` leave,
and the maxima stay. `strip.py` reads them from `a9d3d9e8`, the commit that
added them.

| file | removed | rows | SHA-256 of what was removed |
| --- | --- | ---: | --- |
| `site-engine-rc14/node22-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |
| `site-engine-rc14/node24-parity.json` | `.nodes` | 3 | `3139f11a60d6b57adea9177c0eccd9bbafcdb4bbebb32aa05fd166bc27a7d793` |
|  | `.polar` | 6 | `fe016057b5d34eb39e23b0dcc944d905df847005a8a6e45ac74a26c8d6166053` |

## How to regenerate

Run a regeneration outside the repository, and commit statistics only. The
Swiss acquisitions need the pinned pyswisseph 2.10.3.2 build and the `.se1`
data files that `swiss-node-polar/README.md` and
`../platform/evidence/swiss-benchmark/CONFIGURATION.md` identify by SHA-256;
neither was ever in this repository. The engine-validation extractions also
need the retained raw bundles their READMEs name. The removed files' commands
are above; every file's is in the manifest. For the stripped and replaced
files, by group:

- `swiss-benchmark/report-*.json`, the precision work's `cmp-*.json` and
  `recovered-report-proto-engine-deltat.json` (10 files): in
  `docs/platform/evidence/swiss-benchmark/tools`,
  `node dump-zodiacs.mjs > zodiacs.json; python3 dump_swiss.py zodiacs.json <ephe> > swiss.json; node compare.mjs zodiacs.json swiss.json`
  (`RESULTS.md` there).
- The precision sweep, its reports and the hold-out and reproduction
  reports (69 files): in `docs/platform/evidence/precision-2026-09-20/numerics`,
  `node tools/t2-sweep.mjs <kernel> <swiss-measure.json> <outdir>`, with the
  Swiss side from `swiss-benchmark/tools/dump_swiss.py` (`numerics/RESULTS.md`).
- The counterfactual cells (18 files): in the same directory,
  `node tools/t2-core-counterfactual.mjs <outdir>`, with the four cells where
  it reads them and Swiss's run at `/tmp/claude-0/swisslab/swiss-measure.json`.
- The controlled cells A and B (2 files): in
  `docs/platform/evidence/precision-2026-09-20`,
  `node tools/dump-core-controlled.mjs <swiss.json> [--pinned]`
  (`CONTROLLED-BASELINE.md`); cell D and its two reproductions (3 files):
  `node docs/platform/evidence/swiss-benchmark/prototype/dump-prototype.mjs <de440s.bsp> <swiss.json>`.
- The three hold-out runs: in `numerics`, `node verify/v3-holdout.mjs`, with
  Swiss's hold-out run at `/tmp/claude-0/swisslab/swiss-hold.json`.
- The Uranus D analysis (6 files):
  `python3 docs/platform/evidence/precision-2026-09-20/search/verify/swiss-station.py`,
  and `search/lib/swiss-longitudes.py` through `search/reproduce.mjs`,
  `decompose.mjs` and `uranus-d.mjs`, each given the fixture of commit
  `2ca93d41` from outside the repository and writing outside it
  (`SWISS_WINDOW_FIXTURE=<fixture> sh search/run-all.sh <directory>`).
- `events-vs-swiss-2026-09-23/deltas.json` and `-25/deltas.json`:
  `python3 docs/platform/evidence/events-vs-swiss-2026-09-23/tools/compare.py <catalog dump> <ephe> <out.json>`,
  on the dump `tools/dump-catalog.ts` writes.
- `phase1-verdicts-2026-09-26/results/holdout-1.4-events.json`:
  `python3 docs/platform/evidence/phase1-verdicts-2026-09-26/tools/holdout_events.py <holdout-1.4.json>`,
  after both event comparisons above.
- `deltat-2026-09-25/outputs/swiss-deltat.json`:
  `DELTAT_SOURCES=<dir> python3 docs/platform/evidence/deltat-2026-09-25/tools/moon/swiss_deltat.py <ephe>`.
- `houses-2026-09-26/results/sidereal.json`: in
  `docs/platform/evidence/houses-2026-09-26/tools`,
  `node sidereal.mjs > sidereal.jsonl; python3 sidereal.py sidereal.jsonl` (`run-all.sh`).
- The twelve node/polar parity reports: `node scripts/platform-engine-report.mjs`
  at commit `2ca93d41`, with the engine version each file names installed.
  Their per-case differences left, and their maxima and digests stay; within
  each release the Node 22 and Node 24 digests are equal, which is the
  parity the reports were made to show.
- `engine-beyond-swiss/corpora/horizons-24/corpus-tt.json`: Swiss's ΔT at
  each corpus instant is, from the repository root,
  `python3 -c "import json, sys, swisseph as swe; swe.set_ephe_path(sys.argv[1]); [print(c['id'], swe.deltat_ex(c['jdUt'], swe.FLG_SWIEPH) * 86400) for c in json.load(open('docs/platform/evidence/engine-beyond-swiss/corpora/horizons-24/corpus-tt.json'))['cases']]" <ephe>`;
  on 2026-09-29 it gave back all 24 removed values exactly. The Horizons
  responses as first fetched, and `horizons-frame/vectors/results.json`'s
  TT, are `git show 2ca93d41:<path>`.
- `engine-beyond-swiss/corpora/canon-events.json`: no committed command
  regenerates Swiss's four canon residuals. The engine audit located the
  four events in Swiss Ephemeris 2.10.03 with a script it did not commit;
  `engine-audit-2026-09-22/LEDGER.md` (verification-honesty-3) gives the
  method. The values are only in commit `2ca93d41`.
- The swisseph commit receipt's patch: the commit as GitHub's API gives it,
  `https://api.github.com/repos/aloistr/swisseph/commits/3fd0f956d73898b91cc4f67cf18b21af656d1342`.
  It is Swiss Ephemeris source code and stays out of the tree.

Some recipes write into the tree by default: `numerics/verify/v4-swiss.py`
writes `verify/v4-dense-diff.json`, `numerics/RESULTS.md` redirects
`t1-nutation-swiss.py` into `raw/t1-swiss.json`, and the sweep, the
counterfactual cells, the reproduction of cell D and the hold-out runs write
their positions on Swiss's clock into `numerics/raw/` and `numerics/verify/`.
Point them outside the repository; the guard fails if their output is left
there. `transit-windows/project-fixtures.py` needs `--output`, so it no longer
writes into `src/lib/engine/fixtures/` by default.

## The tests

Every test that read a removed file now reads an independent reference, with
the same cases and the same gates. The references, their arbiters and the
command that rebuilds them are in
[`independent-references/`](independent-references/README.md).

| Test | Was held to | Now held to |
| --- | --- | --- |
| `engine.test.ts`: true node, three epochs | Swiss `TRUE_NODE` | the osculating node from NASA JPL Horizons DE441 state vectors, rotated with ERFA |
| `engine.test.ts`: polar angles, three places, both house systems | Swiss `houses_ex` whole-sign tuples, and Swiss's Placidus status −1 | ERFA ascendant, midheaven and whole-sign cusps, and Placidus undefined at or past 90° minus the ERFA true obliquity |
| `engine.test.ts`: five Placidus charts | Swiss `houses_ex`, inline in the test | ERFA angles and the conformance suite's L2 Placidus construction |
| `engine.test.ts`: three epochs | Swiss positions | Horizons DE441 apparent positions |
| `transit-scan.test.ts`: two stations | Swiss stations, contacts and bands | Horizons stations, contacts and bands |
| `solar-return.test.ts` | Swiss return, bands and two charts | Horizons return and bands; Horizons and ERFA charts |
| `returns.test.ts`: Saturn return | Swiss crossings and bands | Horizons crossings and bands |
| `progressions.test.ts` | ten JPL longitudes carried in the Swiss fixture | the same ten, from `horizons-reference.json` |
| `lunar-return.test.ts`: six cases and seven returned charts | Swiss roots, bands and charts | Horizons roots and bands; Horizons and ERFA charts |
| `transit-window-independent.test.ts`: nine cases, 30 branches | Swiss hourly scans | the Horizons longitude, with the same budgets and D's uncertain topology |
| `scripts/methodology-accuracy-claim.test.mjs`, `scripts/claims-bindings.test.mjs` | the benchmark's rows | the statistics recorded from them, cross-checked against the comparator's own aggregates; since 2026-09-29, for the clock, the statistics of `swiss-benchmark/deltat-gap-2100-2199.json` in place of Swiss's ΔT at 2100 |
| `swiss-benchmark/prototype/spk.test.mjs` | Swiss's ΔT at 2100 as a pin | a round 90 s pin: the test is of the mechanism |
| `src/lib/transit-window-ical.test.ts` | a window whose ends were Swiss's D period | the same period's ends from the independent references |

`scripts/platform-engine-report.mjs` reports the node and polar residuals
against the independent references. The engine passes every gate against the
new references; no case moved outside a tolerance the Swiss comparison used
to pass, and no gate was changed.

Two more tests and a CI job hold the arrangement in place.
`transit-window-independent.test.ts` checks that the original pack is still
`failed-incomplete`, reading the removed fixture's own status from the
manifest, which keeps the fixture's fields that hold no Swiss value under
the digest the test pinned while the fixture was here.
`src/lib/engine/independent-references-clock.test.ts` fails when the
installed engine's ΔT model or table differs from the one each reference
file was built on (`engineClock`), because every reference is taken at the
engine's own TT; the references' README says where that clock departs from
the policies' text. CI rebuilds the four reference files offline from the
kept Horizons responses and fails unless they come out byte for byte, with
Python 3.11 and the hashed `tools/requirements.txt`.

## What remains in the tree, and why

The guard's digests say exactly what remains. Of the 44,071 distinctive
tokens that left, these 3,474 still appear in a data or code file or under
`src/`:

- 2,562 are the instants of the nutation and dense grids, which were the
  inputs of the removed runs, not their output: `numerics/raw/t1-node.json`,
  `numerics/verify/t1-node.json` and `numerics/verify/v4-dense.json` hold
  the engine's and the prototype's own values at them, and a few scripts
  name a grid instant;
- 447 are statistics that equal a removed value because they are an extreme
  or a median of it: the reports' `overall`, `byBody` and `byStratum`
  blocks, the sweep summaries, `numerics/raw/SUMMARY.json`,
  `controlled-2x2.json`, `t2-core-counterfactual.json`, the node/polar
  maxima, the event comparisons' maxima, the claims ledger's bindings, and
  the D case's margin in `reproduction.json`;
- 432 are Horizons's own figures that the re-timed responses share with the
  first fetch: the constants in its headers (the astronomical unit, the
  speed of light, the Earth's radii), columns printed too coarsely for a
  shift of under a second to change, and one instant whose TT rounds the
  same on both clocks;
- 26 are case inputs and receipts: the birthplaces' coordinates, the JPL
  longitudes the eight-case fixture carried (now in `horizons-reference.json`)
  and the transit targets taken from them, the node/polar acquisition's
  timestamps, and the coverage of the ephemeris files it loaded;
- 7 are independent reference values that equal a removed value since engine
  rc.15's clock: five Terrestrial Time instants of UTC cases, and one Horizons
  lunar crossing (below).

An extreme keeps the case it came from, as the decisions allow: with the
engine's value for that case, it gives Swiss's value there back, one value
per body, stratum or report, not a table of the set. The pages quote such
extremes too, for example the largest difference up to 2026 with its body
and year.

`vendor/`, the engine archives and the Registry wing were not touched.

### The independent references on engine rc.15's clock, 2026-09-30

Engine 0.1.1-rc.15 reads an instant from 1972 to 2027-10-02 as UTC: TT =
UTC + (TAI − UTC) + 32.184 s, from the IERS leap seconds. That is the
definition Swiss's `swe_utc_to_jd` applies, and the removed node and polar
fixture recorded the TT of its UTC cases that way. The independent references,
rebuilt on rc.15's clock (`independent-references/README.md`, "Clock"), now
hold the same TT for five of those instants: 2001-12-21T09:00Z,
2001-12-21T09:30Z, 2005-03-15T00:00Z, 2020-01-01T00:00Z and
2026-07-01T00:00Z, as `input.jdTT` in `independent-node-polar.json` and, for
three of them, in the Horizons queries and responses they were taken from.
And the first return of the lunar pack's `L-modern-a`, the root of the Horizons
Moon carried to UTC on the same clock, falls on the millisecond Swiss's return
did: `expectedMilliseconds` and `independentChartUTC` in
`independent-lunar-returns.json`. None of these came from Swiss: the TT
instants follow from the UTC instant and the leap-second list, and the
crossing from Horizons DE441. The guard matched them by value, so their seven
digests moved from "gone" to "kept" in `value-digests.json`, whose SHA-256
and counts `manifest.json` records; `strip.py --check` confirms the two lists
still hold exactly the digests of what was removed.

## Dated records that keep quoted figures

The decision of 2026-09-29 keeps figures quoted in the prose of a dated
evidence README, audit record or report, as part of the finding it records.
These records quote Swiss's own values, or its difference from another
program at a named case, and stay as written:

- `docs/platform/evidence/engine-audit-2026-09-22/`: `LEDGER.md`,
  `AUDIT.md`, `CRITIC.md`, `BRIEF-v1.md`, and the reports in `results/` and
  `verify/` (JSON and text), whose fields are prose: Swiss's event instants,
  its ΔT at named dates, the angles and two cusps of one chart, and the four
  canon residuals;
- `docs/platform/evidence/deltat-2026-09-25/README.md`: Swiss's ΔT at
  2026-09-22, 2050 and 2100, and its differences from the S15
  reconstructions, the values that left `outputs/swiss-deltat.json`;
- `docs/platform/evidence/events-vs-swiss-2026-09-23/README.md`,
  `events-vs-swiss-2026-09-25/README.md` and
  `lunations-2026-09-23/README.md`: Swiss's ΔT in 2026;
- `docs/platform/evidence/houses-2026-09-26/README.md`: Swiss's sidereal time
  minus ERFA's at 1820;
- `docs/platform/evidence/swiss-benchmark/RESULTS.md`: Swiss's ΔT at
  2100-01-01;
- `docs/platform/evidence/precision-2026-09-20/`: `README.md`,
  `CONTROLLED-BASELINE.md`, `numerics/RESULTS.md` and `search/RESULTS.md`,
  and the finding and answer prose of `search/raw/uranus-d.json` and its
  `verify/raw-original/` copy, which give Swiss's offset from the level at
  the 2020-01-01 boundary;
- `docs/platform/evidence/engine-beyond-swiss/PREREGISTRATION.md`, and
  `phase1-verdicts-2026-09-25/README.md`, whose extremes name their cases;
- `docs/engine-validation/README.md`: section 1's account of rc.7 (the Moon
  64.8″ from Swiss at 2100 and 159.4″ at 2190) and of the prototype's 2100
  case pinned to Swiss's clock, and the dated corrections that quote earlier
  wording.
