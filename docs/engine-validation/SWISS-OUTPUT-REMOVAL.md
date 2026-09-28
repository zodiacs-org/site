# Swiss Ephemeris output removed from the tree

On 2026-09-28 Swiss Ephemeris's raw output left the current tree, under the
owner's decision
[DECISIONS-2026-09-28 §3](../platform/programme/DECISIONS-2026-09-28.md)
(audit finding F-22 in [`FINDINGS.md`](../platform/programme/FINDINGS.md)).
Brief §6 says "no Swiss code, data or output in `src/` or any pack". The raw
fixtures under `src/lib/engine/fixtures/` and the raw Swiss values in the
evidence folders are gone; statistics and SHA-256 digests stay. Git history
was not rewritten: commit `2ca93d4174822e2ba4b8fc3de0db6551d0c5ba83`, the
base of this change, is the last with every value, and
`git show 2ca93d41:<path>` gives any of them back.

Everything removed is listed below and, field by field with its SHA-256, in
[`swiss-output-removal/manifest.json`](swiss-output-removal/manifest.json).
[`swiss-output-removal/strip.py`](swiss-output-removal/strip.py) made the
change from the base commit's bytes, and `strip.py --check` confirms the tree
still matches it. `scripts/swiss-output-guard.test.mjs` fails if a removed
file or field comes back, or if a Swiss reference fixture appears under
`src/lib/engine/fixtures/`.

## What counts as Swiss output

A value Swiss Ephemeris returned: a position, a speed, a cusp, an angle, an
event time, a ΔT. Also a table that gives, for every case of a set, Swiss's
value or its difference from something reproducible (the engine, an arbiter,
a published instant), because either gives Swiss's value back.

What stays:

- statistics: counts, means, percentiles, and extremes with the case they
  came from;
- SHA-256 digests;
- the few figures an analysis or a report cites for one case it examines,
  and the figures READMEs and reports quote, which are left as written;
- the scripts that call Swiss (pyswisseph), which regenerate its values on
  demand, and their receipts;
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

The Swiss acquisitions themselves need the pinned pyswisseph 2.10.3.2 build and
the `.se1` data files that `swiss-node-polar/README.md` and
`../platform/evidence/swiss-benchmark/CONFIGURATION.md` identify by SHA-256;
neither was ever in this repository. The engine-validation extractions also
need the retained raw bundles their READMEs name.

`swiss-lunar-return-policy.json` held no position, but its `L-wrap` case was
born at the first 0° crossing of Swiss's Moon after 2000-01-01, an instant
Swiss gave. `independent-lunar-return-policy.json` carries its other cases,
its gates and its conditioning unchanged, names it by SHA-256, and takes that
crossing from the Horizons Moon instead.

## Stripped files

In 74 files Swiss's per-case values sat beside statistics. The values were
removed and every other field kept byte for byte: each file was written back
with the serializer that reproduces its original bytes, and
`canon-events.json`, which is laid out by hand, had its Swiss column cut from
the text. Each now carries a
`swissOutputRemoved` block naming the decision, the fields removed, the
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
| `engine-beyond-swiss/corpora/horizons-24/corpus-tt.json` | `.cases[].deltaTSeconds` | 24 | `ec648e52d9891ba911fc775b90976a30dff7776dabbcfbc2c532c1bb5dc85a7b` |
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

How to regenerate the removed values:

- `swiss-benchmark/report-*.json` and the precision work's `cmp-*`,
  `recovered-report-proto-engine-deltat.json` (10 files):
  in `docs/platform/evidence/swiss-benchmark/tools`,
  `node dump-zodiacs.mjs > zodiacs.json; python3 dump_swiss.py zodiacs.json <ephe> > swiss.json; node compare.mjs zodiacs.json swiss.json`
  (`RESULTS.md` there).
- The precision sweep and hold-out reports (27 files): in
  `docs/platform/evidence/precision-2026-09-20/numerics`,
  `node tools/t2-sweep.mjs <kernel> <swiss-measure.json> <outdir>`, with the
  Swiss side from `swiss-benchmark/tools/dump_swiss.py` (`numerics/RESULTS.md`).
- The controlled cells and counterfactuals (14 files): in
  `docs/platform/evidence/precision-2026-09-20`,
  `node tools/dump-core-controlled.mjs <swiss.json> [--pinned]`, with
  `swiss.json` from `swiss-benchmark/tools/dump_swiss.py`
  (`CONTROLLED-BASELINE.md`).
- The Uranus D analysis (4 files):
  `python3 docs/platform/evidence/precision-2026-09-20/search/verify/swiss-station.py`,
  and `search/lib/swiss-longitudes.py` through `search/reproduce.mjs`.
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
- `engine-beyond-swiss/corpora/horizons-24/corpus-tt.json`:
  `swe.deltat_ex(jdUt, swe.FLG_SWIEPH)` at each corpus instant, as the audit's
  `swiss_dump.py` read it (`corpora/README.md`).
- `engine-beyond-swiss/corpora/canon-events.json`: the four canon events
  located in Swiss Ephemeris 2.10.03, as the engine audit did
  (`engine-audit-2026-09-22/LEDGER.md`, verification-honesty-3).
- The twelve node/polar parity reports (`independent-node-polar-node22.json`
  and `-node24.json`, and those under `site-engine-rc5/`, `rc7/`, `rc8/`,
  `rc9/` and `rc10/`): `node scripts/platform-engine-report.mjs` at commit
  `2ca93d41`, with the engine version each file names installed. Their
  per-case differences left, and their maxima and digests stay; within each
  release the Node 22 and Node 24 digests are equal, which is the parity the
  reports were made to show.

Run a regeneration outside the repository, and commit statistics only. Some
of the recipes write into the tree by default (`numerics/verify/v4-swiss.py`
writes `verify/v4-dense-diff.json`, and `numerics/RESULTS.md` redirects
`t1-nutation-swiss.py` into `raw/t1-swiss.json`); the guard test fails if
their output is left there. `transit-windows/project-fixtures.py` now needs
`--output`, so it no longer writes into `src/lib/engine/fixtures/` by default.

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
| `scripts/methodology-accuracy-claim.test.mjs`, `scripts/claims-bindings.test.mjs` | the benchmark's rows | the statistics recorded from them, cross-checked against the comparator's own aggregates; Swiss's ΔT at 2100 as `swiss-benchmark/RESULTS.md` reports it |
| `swiss-benchmark/prototype/spk.test.mjs` | Swiss's ΔT at 2100 as a pin | a round 90 s pin: the test is of the mechanism |
| `src/lib/transit-window-ical.test.ts` | a window whose ends were Swiss's D period | the same period's ends from the independent references |

`scripts/platform-engine-report.mjs` reports the node and polar residuals
against the independent references. The engine passes every gate against the
new references; no case moved outside a tolerance the Swiss comparison used
to pass, and no gate was changed.

## What remains in the tree, and why

A search of the tree for every distinctive number (seven or more decimals)
and every millisecond timestamp that was removed finds these, and only these:

- the removed files' inputs, not their outputs: the instants of the dense
  and nutation grids (`numerics/verify/v4-dense.json`, `v7-probe.mjs`,
  `v13-break.mjs`), the transit-window cases' query ends and anchors, and
  the coverage of the loaded ephemeris files in two receipts
  (`transit-windows/wave24-d-qualified-policy.v6.json`,
  `phase1-verdicts-2026-09-25/results/provenance.json`);
- statistics that equal a removed value because they are an extreme or a
  median of it: `numerics/verify/v2-sweep-summary.json`,
  `raw/four-configurations/report.json`, the 64.8″ Moon at 2100 in the
  precision summaries;
- the Uranus D analysis in `precision-2026-09-20/search/`: its component
  ends, crop orbs and station instant are the figures the analysis examines
  for that one case, in `uranus-d.json`, `reproduction.json`,
  `decomposition.json`, `RESULTS.md` and a few verification scripts;
- two inputs a removed value can still be worked back from:
  `horizons-24/corpus-tt.json` keeps the TT instants the Horizons corpus was
  fetched at, which Swiss's ΔT set, so their difference from the UT instants
  gives it back to the precision of a Julian date; and cell B of the
  controlled baseline keeps the positions the engine computed on Swiss's ΔT.
  Both are kept because the measurements they record were made at them;
- figures READMEs and reports quote, left as written: for example the
  lunar-return pack's six first-return instants in
  `swiss-lunar-return/README.md`, Swiss's ΔT of 93.18 s at 2100 in
  `swiss-benchmark/RESULTS.md`, and the source manifests of earlier
  captures, which list the removed files with their digests.

`vendor/`, the engine archives and the Registry wing were not touched.
