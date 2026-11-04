# Site adoption of engine 1.1.0-rc.2

The site's adoption of `@zodiacs/engine` 1.1.0-rc.2: the vendored archive and
its identity, the checks the candidate's preregistrations ask of the site,
and their records. Written as a skeleton on 2026-11-04; each section below
is filled by the commit that makes its runs.

- **Engine.** Source commit `806f76b43c0ee652016fe1b522c02d6f6e9c7ae5`,
  carrier `59c6ea9d9a4e7845a2880aa8303fcaadbd645170`, merged into engine
  main by `883371f5d592cd952873422f13766038fcfa7b68` (zodiacs-org/engine#82);
  archive SHA-256
  `c5aef0e3f20a19cf7ffabc99112cf592045199d6803814cf4ef6ea013615351c`. The
  units it carries, each with its preregistration and results in the
  engine's `docs/evidence/1.1.0-rc.2-20261102/`: F-89's nine corrections,
  F-53 (`@zodiacs/engine/time`), P1.M3c (the time bands), the four P2.E
  units (`@zodiacs/engine/lite`) and P2.B.vargas (`vargaSensitivity`).
- **Base.** Site main `0bf69bd56aaec8fbfd99bd4b45877064dc1234df` (#877, on
  2026-11-04), the commit every comparison here is made against. The
  adoption plan was written on `43b88e7d`; #877, between the two, changes
  none of the site files the preregistrations cite.

## What this folder holds

| Path | What | Commit |
| --- | --- | --- |
| [ARTIFACT-IDENTITY.md](ARTIFACT-IDENTITY.md), `npm-view.txt`, `npm-registry-1-0-0.json`, `public-consumer.log`, `node22-parity.json`, `node24-parity.json` | the archive's identity, npm's state and the consumer and parity checks | the carry |
| [PRODUCTION-CHECKS.md](PRODUCTION-CHECKS.md) | every production check, named before it runs | the preregistrations of the site's checks |
| [time-entry/](time-entry/) | F-53's S1 and S1b tools and their records (S1, T4, S1b and their controls); later S2's | the same, then the parity of F-53 |
| [lite/](lite/) | the lite preregistration's copy, the parity tool and its controls, B5's version 2, and control 1 shown failing on its constructed case ([lite/controls/](lite/controls/)); later the parity record and the bundle reports | the same, then the adoption |
| [PRIVATE-STATE.md](PRIVATE-STATE.md), [private-state-review/](private-state-review/) | the compute bundle's private-state review, with the AI runtimes' inventories | the adoption |
| [regenerated-outputs.json](regenerated-outputs.json), `tools/regenerate.py`, `tools/check-regenerated-outputs.py` | the engine-derived data regenerated on 1.1.0-rc.2, file by file against the base | the adoption |
| `tools/compare-mcp-versions.mjs` | the MCP adapter comparison's tool; its record is [../mcp-adapter/mcp-rc25-rc26.json](../mcp-adapter/mcp-rc25-rc26.json) | the adoption |
| [accuracy-refresh/](accuracy-refresh/), `tools/refresh-accuracy.sh` | the two Swiss statistics the accuracy claims bind to, on 1.1.0-rc.2 (aggregates only) | the adoption |
| [lite/parity.json](lite/parity.json), [lite/controls/](lite/controls/) | the lite parity record, and both attempts at its tool's controls | the parity record's commit, then the site checks |
| [lite/](lite/) `b1-bundles.txt` to `b6-check-16.txt`, `bundles-*.json` | lite B1 to B6 on the adoption head, with their controls and the four byte reports | the site checks |
| [time-entry/s2.txt](time-entry/s2.txt) and its outputs | F-53's S2: the search, the archives, the private-state test and the packaged functions | the site checks |
| [f89-checks.txt](f89-checks.txt) | F-89's S2 and S3 | the site checks |
| [entry-graphs.txt](entry-graphs.txt), `tools/compare-entry-graphs.mjs` | each public entry's code, 1.1.0-rc.1 against 1.1.0-rc.2 | the site checks |
| [mcp-pin.txt](mcp-pin.txt), [regenerated-outputs-check.txt](regenerated-outputs-check.txt) | the MCP adapter's pin to the adoption commit, and the regenerated outputs checked against the base | the site checks |
| `tools/verify-production.mjs` | every production check of [PRODUCTION-CHECKS.md](PRODUCTION-CHECKS.md), committed before any production run | the site checks |

Still to come, each by the commit that makes it: the local gate and the
private search, the Phase 1 captures, and production.

## The adoption

Phase I of the plan, on 2026-11-04, over the four adapters (`2617db5a`):
every output the engine feeds, regenerated on 1.1.0-rc.2 with the site's own
generators, one heavy step at a time, on Node 22.22.2 (the compute examples
on Node 24.21.0, as for 1.1.0-rc.1). Nothing here is recorded `accepted`.

- **Candidate and conformance.** `src/data/platform-engine-candidate.json`
  names 1.1.0-rc.2; `vendor/README.md` gains its section and keeps 1.1.0-rc.1
  as the previous candidate. The conformance results are the engine's
  `conformance/results/summary.json` at `883371f5`, copied unchanged
  (SHA-256 `fed41b36…`): the same 500 verdicts as 1.1.0-rc.1's, 267 pass,
  192 fail and 41 unsupported.
- **Conventions registry.** Version 2026-11-04 holds 157 ids in 59
  namespaces. The new namespace, `time-band`, holds `time-band:first-order`,
  which every calc receipt of a result with a band names. The registry test
  failed before the entry, naming that id, and passes after it.
- **Regenerated outputs** ([regenerated-outputs.json](regenerated-outputs.json)).
  Of the 74 files `tools/regenerate.py` rebuilds, 65 come back as the base's
  bytes. The daily publication manifest and the compute examples keep their
  regenerated bytes (the engine version, a generator digest, and receipt and
  cite digests). Seven keep the base's bytes under D-9: two whose generation
  date alone changed, and five transit months whose last bits differ only in
  this Mac's arm64 arithmetic (FINDINGS F-82). Also rebuilt: the
  playground's engine, the engine bundle record (34.4 KiB gzipped for natal
  charts, 34.2 before), the natal aspect examples, the developer demo's
  answers, the scene snapshot and the engine demo's version. The four
  independent-reference fixtures (pyerfa) change only their engine version
  and the digest of `tools/engine-clock.ts`, which now reads the engine's
  time basis; their five SHA-256 pins follow.
- **Private state** ([PRIVATE-STATE.md](PRIVATE-STATE.md)). The compute
  bundle carries the time basis once where main's carried it twice: 45
  bindings and 9 write sites fewer, one renamed constant new. The guarded
  generator reproduced the audit-only bundle byte for byte (501,093 bytes),
  and the focused tests pass 14 of 14.
- **The engine reference.** Rebuilt from the 1.1.0-rc.2 archive: 15 public
  entry points, among them `./time` (20 names) and `./lite` (51), with
  `./calc` at 47; 587 paths written, 552 changed and 35 new. The drift check
  passes.
- **MCP adapter 0.1.0-rc.26.** It bundles 1.1.0-rc.2 and the engine's own
  time basis. Against rc.25 (the base's `server.mjs`), the same 278 calls,
  10 of them refusals, the tool list and the resource reads differ in nothing
  once versions and digests are written out
  ([../mcp-adapter/mcp-rc25-rc26.json](../mcp-adapter/mcp-rc25-rc26.json)).
  The protocol drive passes 114 of 114 checks, the host drive 7 of 7 against
  Claude Code 2.1.314, and the benchmark 18 of 18 scenarios (112
  assertions). The archive, `public/examples/zodiacs-mcp-server-0.1.0-rc.26.tgz`,
  rides this commit with an artifact commit of forty zeros; Phase J pins it
  to this commit (D-5).
- **Developer plugin 0.3.21** (0.3.20 went to #877). `npm run ai:check`
  passes. This commit moved Chart Studio's panel to `chart-studio-v7.html`,
  v6 staying a legacy address, because the panel embeds the engine; D-12
  takes the move back. Main's #881 then made its own 0.3.21, so after the
  merge (D-13) this branch's plugin is 0.3.22.
- **Accuracy refresh** ([accuracy-refresh/](accuracy-refresh/)). Both Swiss
  statistics runs, on 1.1.0-rc.2: every statistic equals 1.1.0-rc.1's, and
  only the engine version and the digest of the per-instant dump differ.
  Swiss output stayed outside the repository.
- **Claims.** The ledger goes from 257 claims to 260 and from 2,754 records
  to 2,792. Seven claims are new: the time and lite entries, the time bands,
  the varga sensitivity, the release itself, the ERFA figures for the Vertex
  and the East Point (F-89 item 1 under OQ9 (c)), and the site's use of the
  two new entries. Four leave: `eng.points-vertex-given` and, by D-3, F-89's
  items 2, 6 and 7. F-89's items 3, 4, 5, 8 and 9 are supported on rc.2's
  text, and the ratchet of open overstated claims goes from 11 to 2. Every
  new external anchor is at engine `806f76b` and was checked against the
  file there. `--unlisted` and `--orphans` give 0 and 0 (72 and 34 before),
  and the ledger's tests pass, R1 to R10. The comment of
  `src/lib/engine/returns.ts` now gives the |f″|h²/8 rule with rc.2's
  figures.
- **Sitemap dates and sizes.** Built as Sitemap Dates builds (the full
  `npm run build` with production's flags under the edition's frozen noon),
  the head changed 35 pages without a new date: the developer index, eight
  developer pages, the guides index and its 25 guides. They take
  2026-11-04, the edition's date (`src/pages/sitemap.xml.ts`), and built
  again with them, the comparison finds all 35 re-dated and none re-dated
  without a change. That build's routes are within budget: `/birth-chart/`
  70,731 bytes of 72,704 (70,152 on the base), and the engine chunk's
  closure 33,361 bytes of its 33,380.4 (33,267 on the base).

## Sentences lexicon 2 does not select (D-1)

Of the 731 sentences of the 1.1.0-rc.2 reference that 1.1.0-rc.1's does not
have, read with the extractor's own functions, the extractor selects 48 and
leaves 683 (102 distinct texts, most of them plain API descriptions). These
are the ones about the time bands, and F-89's three items whose sentences
carry no trigger word (D-3), with their backing at engine `806f76b`:

| Reference page | Text (shortened) | Backing |
| --- | --- | --- |
| `interfaces/calc.CalcPosition.html` | "The band from the time basis, which is not a bound on the error; null without speeds." | `src/calc.test.ts:513`; a limitation |
| `interfaces/calc.CalcTimeBand.html` | "Two kinds are not that movement: for the true nodes ... the band is that smoothed speed times the TT band; and for a topocentric position it is a conservative bound on the movement ..." | `src/calc.test.ts:663` (the topocentric bound against pinned evaluations); `docs/calc.md`, *Bands* |
| `interfaces/calc.HousesResult.html` | "Where TT moved 600 s one way would make Placidus or Koch fall back, a cusp's rate on TT is taken the other way alone, and where both ways would, it is 0 ..." | the one-sided case: `src/calc.test.ts:600`; the case of both ways: the code alone (`src/calc.ts:1081-1085`), no test |
| `interfaces/calc.TimeBands.html` | "They are not bounds (docs/time.md, "The time bands")." | a limitation |
| `release/README.txt`, `functions/crossings.findLongitudeCrossingsWith.html` | F-89 item 2: "A fixed step alone can lose both crossings when a station takes the body less than \|f″\|h²/8 past the target ... up to 0.0056° for Saturn and 0.011° for Jupiter ..." | `docs/evidence/1.1.0-rc.2-20261102/f89/blind-band.json`; `src/crossings.test.ts:188` |
| `functions/engine.placidusCusps.html` | F-89 item 6: "The iteration settles to 1e-9° within 64 steps except within about 1e-8° of the polar limit ..." | `src/houses-regression.test.ts:76` |
| `functions/houses.coAscendants.html` | F-89 item 7: "... (and, for Munkasey's co-ascendant, within ε of the equator) it can lie west of the meridian ..." | `src/houses-extra.test.ts:436` |

## Departures in the adoption commit

- **The MCP archive's manifest.** `node scripts/pack-mcp-server.mjs` as the
  plan writes it kept rc.25's artifact commit in the manifest, so the archive
  was packed with `--artifact-commit` of forty zeros, the two-commit pattern's
  placeholder; Phase J writes this commit there, and until then
  `npm run mcp:pack:check` fails by design.
- **The host drive's record** (`../mcp-adapter/host-drive.json`) wrote this
  Mac's checkout and temporary paths and the digest of a configuration file.
  They are written out as `<checkout>`, `<tmp>/zodiacs-mcp-host-<id>/` and
  "present; digest withheld".
- **The MCP comparison's tool** is rc.1's, copied unchanged: its version
  pattern already matches 1.1.0-rc.2, so the extension the plan names was not
  needed.
- **Outside the plan's lists, regenerated or edited because they name the
  engine:** the developer demo's answers (`src/data/developer-demo.json`); the
  registry's `writtenBy` for the current set, and the test's matching list,
  "1.1.0-rc.1 to rc.2"; an em dash in `public/llms.txt`, replaced; and nine
  claims whose evidence or binds the ledger's R3 and R4 found pointing at
  1.1.0-rc.1's text, chunk names, digests or test titles (each read again
  against 1.1.0-rc.2 before it moved; three statements restate their
  version).
- **Control 1's showing** on its constructed case ran at the adapters' commit
  and its records ride this commit
  ([lite/controls/](lite/controls/)), not the commit that preregistered it.
- **The bundle figures above** are those of the sitemap build, the full
  `npm run build` with production's flags. Phase J's B1 measures both builds
  as the lite preregistration specifies.
- **The bundle gate's own tests.** C4 and C5 gave `scripts/report-bundles.mjs`
  the importer lists of `./time` and `./lite`, a walk of `api/` and the lite
  views' closure check, but not the matching files in the synthetic checkout
  of `scripts/report-bundles.test.mjs`, so all 44 of its tests failed from C4
  on (the walk of a missing `api/` throws, and a checkout without those
  importers or views fails the new checks). The whole suite, run before this
  commit, found it. This commit adds the two time importers, the four lite
  adapters, an `api/` file and the three view chunks to that checkout; no
  rule of the gate changes, and the 44 pass.

## Open after the adoption commit

The whole unit suite (`npm test`, 8,158 tests) ran once before this commit.
Apart from the bundle gate's tests above, two tests fail:

- `scripts/phase1-acceptance-evidence.test.mjs` (the Phase 1 captures'
  template digest, `ef46941e…` expected, `a5f93e20…` found): an accepted
  failure until the captures are taken again on this branch (the plan's
  commit C8).
- `src/ai-tools/release-060.test.ts`, "lists the thirteen live definitions
  byte for byte": `open_chart_studio._meta` names
  `ui://zodiacs/chart-studio-v7.html` where the live tools/list of
  2026-11-01 names `chart-studio-v6.html`. The test holds 0.6.0's thirteen
  published tools to that list, and the move to v7 that the plan's I-8
  makes, because the panel embeds the engine, changes one of them. Neither
  the test nor the move is changed in this commit; the next one settles it
  (D-11), and D-12 later restores the test as it was.

## The site checks

Phase J of the plan, on 4 November, on the adoption head: J-1 on `83f168d8`,
J-2 to J-6 on `92702bb9` (which only adds J-1's record and the amendment
below), J-6's second claims attempt and J-7 to J-12 on `64096451` (which only
restates one claim). macOS arm64, Node 22.22.2, one heavy job at a time;
every control was put back and checked by its SHA-256. Nothing here is
recorded `accepted`.

- **Lite parity (J-1)** ([lite/parity.json](lite/parity.json)). One formal
  run on `83f168d8` against the base, seed text `site-engine-1-1-0-rc2-lite`:
  it passes, with no unexplained difference, no failed comparison and no
  referee disagreement, and S2-P raises no owner question. Declinations:
  9,548 cases, 89 agree, 9,459 differ, each by a cause its section allows
  (73,126 values by `declination-formula` and 11,768 by `separation-exact`,
  each within 1e-12 degrees; `sun-bound-exemption` 6; `orb-boundary` 2;
  `declination-validation` 24, recorded). Sect: 24,072 cases, 23,868 agree,
  204 differ, all in recorded sections (`sect-convention` 188,
  `sect-validation` 16). Composite: 2,310 cases, 2,300 agree, 10 recorded
  refusals. Dignities: 312 cases, 295 agree, 17 differ
  (`site-prototype-lookup` 10, a site defect the adapter removes;
  `dignity-validation` 7, recorded).
- **The tool's controls (J-1), in two attempts** ([lite/controls/](lite/controls/)).
  The first, on `83f168d8`, passed 29 of its 30 tests: control 5's test
  counted no unexplained difference in D2-P because it counted the record's
  list of unexplained entries, which the tool stops at 5,000, and D2-R alone
  filled it. The dated amendment in [lite/PREREGISTRATION.md](lite/PREREGISTRATION.md)
  section 11 ("control 5 counted a capped list") changes that count, not the
  control. The second attempt, on `92702bb9`, citing the first, passed 30 of
  30: control 5 gave D2-R 32,094, D2-P 2,662 and D2-T 28 unexplained
  differences, with 5,000 entries listed and 29,784 left out of the list.
  Both logs are kept (`controls-attempt-1.log`, `controls-attempt-2.log`).
- **B1, the route budgets on both builds (J-2)** ([lite/b1-bundles.txt](lite/b1-bundles.txt)).
  `report-bundles.mjs --fail` passes on the default build and with
  production's flags, `budgets.json` unchanged: `/birth-chart/` 67,546 bytes
  by default and 70,731 with production's flags, of 72,704; the engine
  chunk's closure 33,361 bytes of its 33,380.4 on both (33,267 on the base).
  The grown closures are named with the engine files they hold. rc.2's chunk
  split (rc.1's `chunk-YJ7WZ7NS`, `chunk-VDVUUMY2` and `chunk-W2TMLFJ3` give
  way to `chunk-F4JKI3XV`, `chunk-RMBWKZI2`, `chunk-NNOSOOWS` and
  `chunk-NIRYKLHT`) adds 94 bytes and one chunk to the engine chunk's
  closure. `/birth-chart/` grows by 584 bytes by default and 579 with
  production's flags, and by one chunk: 447 bytes of it in the dignity
  adapter's chunk, which now holds `lite-dignities.js`, the rest in the
  split and in three of the site's own chunks. Control: `/birth-chart/` set
  1 KB under its measured value made `--fail` exit 1 on each build.
- **B2 (J-3)** ([lite/b2-closures.txt](lite/b2-closures.txt)): the three lazy
  views' closures hold neither ephemeris marker on either build. Control: a
  build whose composite adapter takes `compositeMidpoints` from
  `@zodiacs/engine/techniques` (rc.16's regression; its `./lite` import kept,
  so that B3's list does not change) fails, with the marker in the
  RelationshipWheel closure; a clean rebuild then passes.
- **B3 (J-4)** ([lite/b3-importers.txt](lite/b3-importers.txt)): only the four
  adapters import `./lite`, and nothing imports `./calc` or `./vedic`.
  Control: a temporary fifth importer fails the report.
- **B4 (J-5)** ([lite/b4-suites.txt](lite/b4-suites.txt)): the suites pass
  against the adapters, 289 tests in 19 files. Each control failed its
  suites: sect with the altitude test written `> 0` (1 test); Mercury exalted
  in Gemini, in the dignity suite (1) and chart-context's (7); the latitude
  dropped from `declinationOf` (2); the composite midpoint on the longer arc,
  in the composite suite (2) and the synastry tests (11). The dignity adapter
  holds no table since the adapters' commit, so that control changes the
  rule where it lives, the installed package's `dist/lite-dignities.js` (the
  parity tool's control 8 makes the same edit on a scratch copy); the package
  was compared with the vendored archive file by file afterwards.
- **B5 version 2 (J-6)** ([lite/b5-reference-and-claims.txt](lite/b5-reference-and-claims.txt)),
  in two parts. The reference builds from the archive with its
  export-coverage assertion (15 public entry points), and fails it with
  `sectReading` left out of `./lite`'s documented names; the planted sentence
  is listed in both files with the plants and in neither without them. The
  claims rules: the first attempt, on `92702bb9`, failed R3 alone, because
  `product.ai-coverage-tools` cited a test by the title D-11 had renamed;
  `64096451` restates that claim (D-11 below), and the second attempt, citing
  the first, passed (the claims test and `release-060.test.ts`, 23 of 23).
  D-12 later puts the claim and the test back as they are on main.
- **B6 (J-7)** ([lite/b6-check-16.txt](lite/b6-check-16.txt)): check 16
  passes (the validator 12,109 of 12,109 checks); run on a scratch copy of
  the pilot table's text with Mercury's exaltation in Gemini it finds 2
  differences, the frozen file unchanged.
- **F-53's S2 (J-8)** ([time-entry/s2.txt](time-entry/s2.txt)). The search
  finds nothing on the head; on the base it finds 34 lines in 20 files, the
  same as in Phase C: the five importers in `src/` and `scripts/`, the
  private-state test's path, the copies in the five generated bundles and the
  import in `engine-clock.ts`, beside the generator, the module and the lines
  that name them. Member by member, plugin 0.3.21's ZIP and adapter rc.26's
  archive do not name the module, while the base's 0.3.20 ZIP and rc.25
  archive do. The private-state test passes. A functions-only `vercel build`
  (D-6; Vercel CLI 62.0.0, as rc.16's packaged-functions record), with a
  hand-written project link, an empty local environment file, a disposable
  HOME and the install and the site build switched off in a local copy of
  `vercel.json`, packaged 12 functions without a pull, a login or a link.
  The calendar and compute functions carry `@zodiacs/engine/time` and no file
  that names the module, the compute function carries the compute bundle
  byte for byte, and both entries and the compute handler load under
  `node --no-experimental-detect-module`. The lockfile and `node_modules`
  did not change, and `.vercel` was removed.
- **F-89's S2 and S3 (J-9)** ([f89-checks.txt](f89-checks.txt)): the
  reference's drift check passes; with the ratchet left at 11 the claims test
  fails R5 ("only 2 overstated claims remain open"); the programme ledger
  regenerates with P1.14's row unchanged, and from a scratch copy with P1.14
  `accepted` that row differs.
- **The entry graphs (J-10)** ([entry-graphs.txt](entry-graphs.txt), by
  `tools/compare-entry-graphs.mjs`, 1.1.0-rc.1's tool with its comment
  adapted). Of the 17 entries the package exports, 5 load 1.1.0-rc.1's code
  apart from the version string, chunk names and chunk order, `./lite` and
  `./time` are new, and the other 10 differ through the chunk split above,
  `./calc`, `./techniques` and `./vedic` also in their own files.
- **The MCP pin (J-11)** ([mcp-pin.txt](mcp-pin.txt)):
  `public/examples/mcp-server.json` names the adoption commit `620403bc` as
  the archive's artifact commit (D-5); the archive's bytes did not move, and
  `npm run mcp:pack:check` passes.
- **The regenerated outputs (J-12)** ([regenerated-outputs-check.txt](regenerated-outputs-check.txt)):
  the record now names its candidate commit, the adoption commit, as
  1.1.0-rc.1's names its own, so that it is checked there after merges of
  main; `tools/check-regenerated-outputs.py` passes: 74 outputs, 65
  identical, 7 base bytes kept and 2 regenerated.
- **The production check** (`tools/verify-production.mjs`): 1.1.0-rc.1's
  tool adapted to [PRODUCTION-CHECKS.md](PRODUCTION-CHECKS.md) and committed
  before any production run: R1 to R11, D1 to D3, C9, V1 and S3b, and a
  `--control` mode for the run on the deployment before the merge, in which
  every check with a control must fail. It finds production's own view and
  engine chunks by following chunk references from `/birth-chart/` and
  `/compatibility/`, and sends the compute API two POSTs: the documented
  positions request and S3b's control request. Before this commit it ran only
  against a local static copy of this head's build, never production; there
  every check passed except R11 and S3b, which need the API. Found while
  writing it: over a millisecond the time records' `deltaT.seconds` does not
  move at its stored precision, but `timeScale.ut1MinusUtc` and both sigmas
  do, so S3b's control request still differs from `timeBasis` at the original
  instants, as PRODUCTION-CHECKS.md requires; only that file's parenthetical
  reason is loose.
- **The programme ledger.** A dated note on P2.E.declinations (with the
  correction the lite preregistration's section 9 asks for: the site took
  the mean obliquity of date whenever it had an instant), P2.E.sect,
  P2.E.composite, P2.E.dignities, P2.B.vargas and P1.M3c. No status, release
  or `asOf` changes before production; `LEDGER.md` is regenerated.

## Decisions taken without asking, under the owner's delegation

From the adoption plan's section 11 (programme notes,
`notes/rc2-2026-11-01/adoption/PLAN.md`), under the owner's delegation of
2026-11-04. None of them accepts a reading: OQ5, the ratification of the
readings each unit chose after its scoping runs, stays with the owner, and
so does OQ10's Q5.

- **D-1.** Time-bands C8's version 2 is not run here. P1.M3c's version 1
  failed C1b in the engine's formal run, so C8 cannot change its verdict; C8's
  version 2 goes into P1.M3c's version 2, with C1b's fix, in a later
  candidate. No lexicon change: that is step 1.14h, with the owner. The band
  sentences the extractor does not select are to be listed here with their
  backing, as SR listed them.
- **D-2.** Lite B5's version 2 runs here ([lite/B5-VERSION-2.md](lite/B5-VERSION-2.md)).
- **D-3.** F-89's items 2, 6 and 7: their corrected sentences carry no
  trigger word, so their old records go and their claims leave the ledger;
  the ratchet of overstated claims goes from 11 to 2.
- **D-4.** P1.M3c is recorded `failed` (version 1), its release `deployed`
  once production serves rc.2; time-bands C9 is read in production for the
  record only.
- **D-5.** The MCP adapter's 0.1.0-rc.26 archive rides the adoption commit,
  after the switch to `@zodiacs/engine/time` that it bundles, and is pinned
  in the commit of the site checks; 1.1.0-rc.1's carry commit carried its
  adapter archive instead.
- **D-6.** S2's check of the packaged functions uses `npx vercel build` only
  with a hand-written project link and never `vercel pull`, which would write
  decrypted environment values; if the command asks for a pull, a login or a
  link, the check is made on esbuild bundles of the two functions instead,
  and recorded as a departure.
- **D-7.** S2's search leaves out the immutable archives
  (`integrations/packages/`, and `public/examples/*.tgz` up to rc.25), as it
  leaves out frozen evidence tools; the new archives are checked member by
  member.
- **D-8.** The live tool `docs/platform/evidence/swiss-benchmark/tools/multiyear-zodiacs.mjs`
  is switched with the importers: the accuracy refresh runs it on every
  engine version.
- **D-9.** Where only this Mac's arm64 arithmetic changes last bits of a
  regenerated file, the base's bytes stay and only version fields change, as
  for 1.1.0-rc.1; CI's x86-64 jobs check them.
- **D-10.** Both pull requests are merged with merge commits when every
  check is green; the units are recorded `validated`, with the owner's
  ratification as their blocker, and nothing is recorded `accepted`.
- **D-11** (4 November, after the adoption commit; withdrawn by D-12).
  Chart Studio moves to
  `chart-studio-v7.html`, as the plan's I-8 says, and
  `src/ai-tools/release-060.test.ts` names that one move. The thirteen
  published tools must still match the live `tools/list` of 1 November byte
  for byte, apart from the panel address in `open_chart_studio`'s `_meta`
  (`ui.resourceUri` and `openai/outputTemplate`); the old address must stay
  registered and serve the same panel as the new one; any other change, or a
  further move, fails the test. Its control: with `STUDIO_URI` set to
  `chart-studio-v8.html` in the working tree, two of its twelve tests failed,
  and the file was restored. The other way, keeping the panel's bytes so that
  the list stays as it was, would build Chart Studio on a second engine,
  1.1.0-rc.1, beside the adopted one. 1.1.0-rc.1's adoption moved the panel
  from v5 to v6 the same way (#840). OpenAI's copy of 0.5.1, in review,
  was scanned on 27 October and names v6, which the server keeps serving.
  `docs/platform/zodiacs-ai/RESUBMISSION-0.6.0.md` and
  `claude-directory/RESYNC-0.6.0.md`, with their drafted reviewer notes, now
  say that a rescan shows this one changed field. No portal step is taken:
  each stays with the owner. The claims ledger's `product.ai-coverage-tools`,
  which said the thirteen keep their published definitions byte for byte and
  cited the test by its old title, now names the one moved address and cites
  both tests; the claims test failed on the old title in Phase J (J-6, rule
  R3) and passed on the change.
- **D-12** (4 November, after the gate's first run on `e7068c9d`). D-11 is
  withdrawn. Main's #881, merged at 12:51Z that day, added a product rule to
  `AGENTS.md`: the 13 published MCP tool definitions stay byte-identical
  (`src/ai-tools/release-060.test.ts`). D-11's move changes one field of one
  of them, so the panel keeps the bytes `chart-studio-v6.html` was recorded
  with, the other way D-11 named, but without a second engine:
  `scripts/build-chart-studio.mjs` pins the published panel (`PUBLISHED`).
  The source still builds, on 1.1.0-rc.2, so a broken source fails, but
  `integrations/generated/chart-studio.mjs` keeps the bytes engine
  1.1.0-rc.1 built, which must match v6's recorded fingerprint, and
  `STUDIO_URI` must stay v6. `contracts.ts`, `panel-fingerprints.json`, the
  generated panel, `release-060.test.ts`, the two portal notes and the claim
  `product.ai-coverage-tools` are back to their bytes on main, as are the
  panel addresses in the MCP and staging drives; the flag-off fixture,
  captured again, differs from main's only in the engine's version. v7 was
  never pushed, so its fingerprint goes with it. Until a release may change the
  definitions, Chart Studio's panel therefore runs engine 1.1.0-rc.1, while
  the site, the MCP server's tools and the developer plugin run 1.1.0-rc.2;
  to end the pin, set `PUBLISHED` to null and give the panel a new address.
  Its controls are in [d12-chart-studio-pin.txt](d12-chart-studio-pin.txt).
  After the independent review (D-15) the pin also records `SOURCE_SHA256`,
  the panel this source builds while pinned, so a change to the studio's
  source, the engine or anything else the panel bundles fails instead of
  going unpublished unnoticed. One consequence stays while the pin holds: the
  panel's Chart Inspector runs 1.1.0-rc.1, so it does not reproduce records
  that 1.1.0-rc.2 writes (the site's, the compute API's, adapter rc.26's and
  the developer plugin's own tools'); the plugin's README and its 0.3.22
  release note say so.
- **D-13** (4 November, the merge of main `f45734dc`). #881 put the hosted
  server on 0.6.1 (the readings panel, the under-18 rule, the narrower
  links) and made a Developer 0.3.21 from it, while this branch had made its
  own 0.3.21 with engine 1.1.0-rc.2. Main's 0.3.21 keeps its bytes; the
  merged plugin is 0.3.22, 0.3.21's source with this branch's local chart
  tools, and its release note says so. The generated server, the sky watch,
  the plugin manifests and the flag-off fixture were rebuilt from the merged
  source; Sky 0.6.1's archive rebuilt to main's bytes, and the readings panel
  to `readings-v3.html`'s recorded bytes, so the adoption leaves both as #881
  published them. `npm run ai:check` passed, `npm run check` reported 0
  errors, and the AI, claims, fingerprint and sitemap tests passed 460 of 460.
- **D-14** (4 November, after the gate's first run). That run, on `e7068c9d`,
  failed two steps of section 6 apart from the Phase 1 capture test it
  accepts. The type check found two errors in D-11's test helper; `52ed7473`
  typed it, and D-12 then put the test back as it is on main. The developer
  first-use drive passed its 44 Chromium checks and failed its one Firefox
  check, "firefox: launches": Playwright's Firefox 151 (build 1532) does not
  start headless on this Mac's macOS 27.0.1 within 180 seconds, as the B3.c
  record found the same day, and CI does not run the drive. The Firefox
  launch joins section 6's accepted failures for this branch's gate runs, as
  a departure for the owner to ratify; the drive's Chromium half stays a
  check that stops the push. The gate runs again on the merged head as a
  second attempt citing the first (`rc2a-e7068c9d-prepush-times.txt`).
- **D-15** (4 November, the independent review of `02d550fc`, which
  AGENTS.md asks for before a merge). Its verdict named one blocker: the
  Phase 1 captures are stale, so CI's suite fails on this branch while main
  passes; the plan takes them again from this pull request's Browser
  Evidence run (C8). Its notes, acted on: the Chart Studio pin's
  `SOURCE_SHA256` and the Chart Inspector note (D-12); the plugin's README
  still named 0.3.21, so it names 0.3.22, and the 0.3.22 archive, never
  pushed, was packed again; and `src/islands/chart3d/EclipticView.tsx`
  called the engine's declination function, which also finds every pair's
  aspects, on each frame of a turning sphere, so the declinations are now
  computed once per chart. Left as they are: the engine chunk's 19 bytes of
  headroom, within its budget, and the ledger notes' "not yet merged", which
  the record pull request updates. The gate's second attempt was stopped
  during its 37th step to make these changes, every step before it passing
  but the two accepted failures; the third attempt runs on the head that
  carries them.
