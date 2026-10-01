# Handoff: the site's adoption of engine 0.1.1-rc.16 (work in progress)

Branch `rc16-adoption`, local only, not pushed, no pull request. Started from
site `origin/main` at `2197e696` (#603, the rc.15 adoption). Written
2026-09-30 when the work was stopped part way; this file is the status for
whoever continues it, and goes before the branch is proposed.

## Local continuation, 1 October 2026

The original 30 September plan below is retained as the baseline, not current
completion evidence. Local branch `programme/rc16-local-prep-20261001` integrates
main `ed55dacb`, reviewed compute prerequisite `458b6ab9`, and later owner
main `450f0fd9` (#614/#615); Guide/homepage owner changes are preserved. Current evidence and remaining checks are in
`docs/platform/evidence/site-engine-rc16/README.md`.

Four technique adapters are locally integrated. **Composite is deferred** and
its adapter restored exactly to main because the single techniques entry
violated the saved-chart ephemeris-free path and production route budget.
Steps 10 and 13 have dated technical decisions under `docs/platform/programme/`:
only measured final engine growth (+1,022 B) is allowed; the product station
catalogue now shares the monthly generator's longitude source while keeping
its exact derivative/refinement/physical definitions and <2 s gate. This
supersedes step 13's mixed-source transitional assumption only for stations.

P1.03 and original-clock Koch remain failed after fresh measurements. MCP rc.16
has local protocol, packed-consumer and named-host evidence. No archive bytes,
route budget, acceptance status or denominator changed. Native captures and
release/deployment gates remain pending; nothing here is remote publication.

## Goal

Adopt `@zodiacs/engine` 0.1.1-rc.16 into zodiacs.org the way rc.15 was
adopted in #603 (`docs/platform/evidence/site-engine-rc15/README.md`, commits
`2acb58f7..b70a0ddb`): vendor, parity in one process, a cause for every
difference, budgets, the MCP adapter, evidence, findings and claims, checks.

- Source: zodiacs-org/engine `main` at `6807f632` (PR #22). The archive
  `artifacts/zodiacs-engine-0.1.1-rc.16.tgz` is carried by `ef44477f` from
  source `ddbbaa0b`: SHA-256
  `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`,
  266,934 bytes, 69 files, 923,282 bytes unpacked. It is not on npm: npm
  serves rc.15 under `latest` and `next` (checked 2026-09-30).
- What rc.16 changes: the full IAU 2000B nutation (every longitude of date
  moves by the change in Δψ, up to 0.2701″; angles and cusps up to 0.8003″
  below 60.17° N, Koch up to 3.883″ at 65.75°), five opt-in entries (calc,
  window, techniques, houses, sky; the site uses only techniques), and a new
  receipt conventions set at index 0 (`nutation`, `moonPosition`).

## Ledger units it should move, and on what evidence

Do not mark any unit accepted: the checkpoint after production does that.
The evidence README must list the units this makes eligible and the evidence
for each gate ("package function released; the site imports it and its own
implementation is removed; parity recorded; deployed").

| Unit | State on this branch | Evidence |
| --- | --- | --- |
| P2.E.void-of-course | adopted (`21f802ec`) | parity V-W, V-P, V-S all agree |
| P2.E.returns | adopted (`820548d7`) | parity R-SI, R-SY, R-SM, R-SC, R-LI, R-LC all agree; R-E edges differ by design |
| P2.E.aspect-patterns | adopted (`e66be745`) | parity P-D, P-C all agree |
| P2.E.composite | adopted (`51077197`) | parity C-M, C-R all agree; C-X refused by design |
| P2.E.moon-sign-candidates | adopted (`409e1d22`) | parity M-A, M-Z agree but for designed cases; M-P differs only at Stockholm midnights |
| P2.E.dignities | **not adopted**, see Risks | parity D-X agrees (144/144); adoption blocked by bundling and budget |
| P2.E.declinations, P2.E.sect | unchanged | rc.16 has no ephemeris-free entry for them (F-54 stays open) |
| P1.03 (5″ gate at 63/65/66°) | not yet re-measured | see step 11 |
| P2.A.house.koch (3″ end to end on the ladder) | not yet re-measured | see step 11 |
| MCP adapter 0.1.0-rc.16 | not started | step 6 |

Parity record: `docs/platform/evidence/site-engine-rc16/techniques-parity.json`,
written by `tools/compare-techniques.mjs 2197e6966d026561fce19c4bfcd0b975803e0b7f`
(the base commit's site code from git objects and the installed package, in
one process on one engine). 10,277 cases, 309,361 values: 10,204 agree, 73
differ, every one with a cause, none unexplained.

## Done and verified

| Commit | What | Verified by |
| --- | --- | --- |
| `141a7954` | Vendor rc.16: archive and receipt from engine git objects at `6807f632` (blobs `92a0bf99…`, `81282022…`), anonymous download identical; lockfile changes only the engine entry (`sha512-QeYb1i…`); vendor/README; version stamps in engine-demo, the package integration test and the scene snapshot's `engineVersion` line | package-integration test passes |
| `7c386573` | The calendar function's server ephemeris in rc.16's frame of date: `scripts/build-time-basis.mjs` also bundles the package's compiled `src/nutation.ts` and `src/frame.ts` (cut from its ephemeris chunk, no astronomy-engine) into `src/lib/engine/time-basis.mjs`; `server-ephemeris.ts` turns its vectors with them | the generator checks 177,180 longitudes against natalChart bit for bit; `server-ephemeris.test.ts` passes at 12 decimals |
| `f45a14e7` | Techniques parity tool and record | as above |
| `21f802ec` | Void-of-course page takes `voidOfCourseWindows`/`voidOfCourseAt`; site module removed; tests retargeted; claim `acc.voc-times` evidence moved | `void-of-course.test.ts` 7/7 |
| `820548d7` | Returns take the package's instants; the site keeps its span refusal, lunar reference limits, validation and chart casting | 14 return test files pass |
| `e66be745` | Aspect patterns: adapter over `aspectPatterns`/`patternContainment` keeps `{ status, reason }` | 6 pattern test files pass unchanged |
| `51077197` | Composite: `compositeMidpoints`/`compositeAspects` | 14 composite and synastry test files pass unchanged |
| `409e1d22` | Moon signs: `untimedMoonSign` takes `moonSignCandidates(date).sign`; `moonCandidatesFromEndpoints` and `localDateEndpointsUtc` removed, tests retargeted | 6 test files pass |
| `155ca547` | WIP: the sixty transit months regenerated on rc.16 | not yet measured or gated |

The full suite has not been run since the adoptions. No site build has been
run on this branch, so no bundle, budget or route figure exists yet.

## Not done: the remaining steps, in order

0. **Merge `origin/main` first.** Main moved to `acbfad2e` (#604: checkpoint
   7 records, F-57 "the engine is on npm" copy, F-51 Lighthouse stall
   retakes). Expect conflicts in: `docs/platform/programme/acceptance-ledger.json`,
   `LEDGER.md`, `STATUS.md`, `FINDINGS.md`; `docs/claims/ledger.json`;
   `src/pages/developers/{engine,support,mcp,index}.astro`; `public/llms.txt`,
   `public/llms-full.txt`; `vendor/README.md` (both rewrite its header: keep
   rc.16 as vendored, and say npm serves rc.15); `src/data/platform-engine-candidate.json`
   and `scripts/platform-engine-candidate.mjs` (#604 requires
   `releaseStatus: 'published'`/`'On npm'`, true of rc.15 but not of rc.16:
   the assertion and the record need a state for "vendored candidate, npm
   serves an earlier version"); `docs/acceptance/phase1/screenshots/manifest.json`;
   `docs/platform/evidence/site-engine-rc15/README.md` (#604 appended to it).
   A daily edition added to main after 2026-09-30 must also be rebuilt on rc.16.
1. **Engine-derived data**, as rc.15's `48607990` and `5675c4fc`: the daily
   edition of 2026-09-30 (`node scripts/build-daily.mjs`,
   `npm run editorial:daily:build`, `npm run editorial:horoscopes:build`),
   the replay goldens (`--print-goldens`, reviewed), `events-publication.json`
   (`npm run data:events:build`), `sky.json`'s lunations, the pins in
   `src/data/almanac.test.ts`, `public/assets/registry-outlook.json` (rewritten
   by the build). Measure the catalogue with an rc.16 copy of
   `site-engine-rc15/tools/compare-event-catalog.mjs` (old side: base on the
   rc.15 archive, still in `vendor/`), and re-run the event times against
   Swiss Ephemeris as `events-vs-swiss-2026-09-30/` did.
2. **Tests that pin rc.15's digits.** The full run on rc.16 before any
   adaptation failed 99 tests in 18 files. Fixed since: server-ephemeris (3);
   probably build-transits (61), to be confirmed. Still to update, each with
   the reason in its comment: `src/lib/engine/transit-scan.test.ts` (the
   Mercury station of February 2026 moves 5.94 s), `src/lib/scene/scene.test.ts`
   snapshot (positions of the 1907 chart in the 7th decimal),
   `src/lib/compare/diff.test.ts` (on rc.16 two milliseconds, not six, show a
   real difference smaller than a rounding one: Moon 3.10e-7 against the node's
   5.09e-7; a pinned ΔT now moves only the Moon's speed across a sixth
   decimal, not the Sun's), `src/lib/share-positions.test.ts` (2),
   `src/lib/engine/returns.test.ts` (Saturn's station),
   `src/islands/MoonPhaseTool.reference.test.ts`, `scripts/angles-grid.test.mjs`
   (2; the ERFA arbiter's residuals shrink), `scripts/daily-snapshot-lib.test.mjs`
   (2), `scripts/daily-fact-audit.test.mjs`, `scripts/methodology-accuracy-claim.test.mjs`
   (3: the Swiss runs must be of rc.16, and the reduction check looks for
   `EclipticGeoMoon(`, which rc.16 replaced by `GeoMoon` turned by its own
   frame), `scripts/claims-ledger.test.mjs` (step 8), `scripts/mcp-artifact.test.mjs`
   (step 6), `scripts/platform-candidate-docs.test.mjs` and
   `scripts/engine-demo.test.mjs` (the candidate record),
   `scripts/phase1-acceptance-evidence.test.mjs` (step 16), and
   `scripts/people-font-preload.test.mjs` (needs a build in `dist/`).
3. **Independent references**: rebuild with
   `docs/engine-validation/independent-references/tools/build.py` (Python with
   pyerfa 2.0.1.5 is `scratchpad/refs-venv`); every file records the engine
   version, and the returned-chart references follow the product's return
   instants, which moved. Update the five SHA-256 pins in the tests, run
   `strip.py --check`, and rebuild the ERFA angle arbiter
   (`engine-beyond-swiss/corpora/tools/`) with `angles-grid.test.mjs`'s pins.
   The rebuild must be byte-identical when run twice.
4. **Swiss statistics refresh** (statistics only): `swiss-benchmark/tools/multiyear-zodiacs.mjs`
   with `multiyear_swiss.py`, and the ΔT gap tools. pyswisseph 2.10.03 is in
   `/tmp/claude-0/swisslab/venv`, the two `.se1` files in
   `/tmp/claude-0/swisslab/ephe` (their SHA-256 match `CONFIGURATION.md`).
   Update any figure the pages quote that moves.
5. **Conformance**: `src/data/conformance/` from the engine's committed
   results at `6807f632` (267 pass, 192 fail, 41 unsupported; one verdict
   moves, `L1-POS-0041`), and the `conf.results` claim.
6. **MCP adapter 0.1.0-rc.16**: rebuild `examples/mcp-server/server.mjs`
   (`scripts/build-mcp-server.mjs`), pack
   `public/examples/zodiacs-mcp-server-0.1.0-rc.16.tgz`, NOTICE (rc.16's
   NOTICE adds the IAU 2000B/NOVAS and precession notices), README,
   candidate.json, `src/mcp/bounds.ts` `ADAPTER_VERSION`, the protocol drive,
   benchmark and host drive; then the second commit that pins
   `artifactCommit` in `public/examples/mcp-server.json` to the carrier.
7. **Receipts**: calculator receipts pick up the new set at index 0 through
   `createNatalEnvelope`; the claims ledger's R7 check and the compare tests
   must name `nutation` and the new `moonPosition`.
8. **Claims ledger**, for every sentence that changes: code evidence for
   `acc.angles-houses`, `acc.engine-source`, `acc.frame` (rc.16's code is
   `eclipticOfDate`, `GeoMoon`, `tilt(time.tt).tobl`, `gastHours`),
   `time.host-icu`, `time.unknown-time`, `time.unknown-time-package` (their
   strings moved from `dist/geo.js` into a chunk that `./techniques` shares),
   the `package.json` binds of `product.engine-package` and
   `acc.engine-source`, and every statement that gives rc.15's figures.
9. **Pages and llms files**: `/developers/engine/`, `/developers/support/`,
   `/developers/mcp/`, `/developers/`, `/methodology/` (its sentence on the
   Moon's path, and the nutation), `llms.txt`, `llms-full.txt`: say rc.16 is
   what the site vendors, and that npm serves rc.15 until rc.16 is published.
   `src/data/engine-bundle.json` from `scripts/measure-engine-bundle.mjs`.
10. **Builds and budgets**: `npm run build` with the default flags and with
    CI's production-flags environment, each with `report-bundles --fail` and
    `check-dist`. The engine chunk's budget is 32,358 gzip bytes with 250 of
    headroom; the engine's stand-in expects the nutation to add about 1,080.
    Raise it only by the measured growth, with the reason in the commit. No
    route budget may move; `/birth-chart/` had 260 bytes left on rc.15.
    Confirm that `@zodiacs/engine/techniques` reaches no eager bundle.
11. **Re-measure P1.03 and P2.A.house.koch** with the committed tools
    (`phase1-verdicts-2026-09-25/tools/s13/`, `houses-2026-09-26/tools/`),
    gates unchanged. Both tools give Swiss the UTC instant as UT1, which the
    engine has not read that way from 1972 to 2027-10-02 since rc.15, so run
    them as they are and also with the two sides on one UT1 (the engine's
    own rerun set `timeScale: "ut1"`), and report both. The engine measured
    Koch at 0.035″ on the ladder after the nutation (pass); P1.03's 45 of 816
    over 5″ were 44 from Swiss's long-term sidereal time outside 1850–2050
    and 1 from the five-term nutation, so expect it to stay a fail.
12. **Evidence** in `docs/platform/evidence/site-engine-rc16/`: README like
    rc.15's; `site-outputs.json` from an rc.16 copy of rc.15's
    `compare-site-outputs.mjs` (rc.15 archive against rc.16; attribute every
    longitude to the change in Δψ at its TT, and the angles and cusps to the
    sidereal time and obliquity by recomputing both sides with
    `computeAngles`/`computeHouses` from `@zodiacs/engine/internal/math`);
    event-catalog, independent-references, swiss-refresh, node22/node24
    parity (`scripts/platform-engine-report.mjs`), the packed consumer log,
    `validation.json`.
13. **FINDINGS**: F-53 grows (rc.16 exports neither its frame nor its
    nutation either); F-54 stays open (no ephemeris-free entry for
    declinations and sect in rc.16); new: dignities not adoptable (below);
    the generators that call astronomy-engine directly (retrogrades in
    `sky.json`, eclipses, ingresses, the Aura Moon ingresses, birthdays)
    stay on its five-term nutation, as F-52 records for the clock: measure
    their margins as `model-clock-margins.mjs` did.
14. **Programme records**: no unit marked accepted; the evidence README
    lists the eligible units.
15. **Checks**: both builds, `npm run check`, `npm test`, `check-dist`,
    `report-bundles --fail` on both builds, the Swiss output guard, the
    claims and programme-ledger tests, `mcp:build:check` and
    `mcp:pack:check`, the browser drives, and the independent references
    rebuilt byte-identical.
16. **Pins and captures last**: pin `evidenceCommit` in
    `src/data/platform-engine-candidate.json` in its own commit, then retake
    the Phase 1 captures on the final build.

## Risks, failing checks and open questions

- **P2.E.dignities is not adoptable as rc.16 ships it.** The dignity
  functions are used in eager code (the chart wheel's scene model inside
  `ChartCalculator`'s initial bundle, the chart signature, the placement
  pages). `@zodiacs/engine/techniques` is one module: an isolated Vite 8
  build (scratchpad `rc16-work/chunk-exp`) with an eager `dignityFor` and a
  lazy `solarReturnInstant` from it put astronomy-engine into the eager
  bundle (71,318 bytes, 32,776 gzipped, its marker present). The dignities
  alone, eagerly, cost 549 gzip bytes more than the site's own (1,991 against
  1,442), where `/birth-chart/` has 260 left. Confirm both in the real build
  and record a finding: it needs the dignity tables in an entry that loads no
  ephemeris, as F-54 asks for declinations and sect.
- **The adopted techniques must stay lazy.** Every importer is lazy or
  build-time: the pattern panel and card, the relationship view, the two
  return computes and the chart lens, the untimed share card, the
  void-of-course page. Any future eager import of the entry drags the
  ephemeris into that bundle. Unverified until `report-bundles` runs.
- **Behaviour that changes by design** (recorded in the parity): six solar
  returns inside the 1800–2200 span that the old clipped scan refused are now
  found; returns from clipped windows can move by 1 to 2 ms; the untimed
  card's rules are the package's.
- **Failing now**: the prebuild gates will stop on the daily edition until
  step 1 is done; the tests listed in step 2.
- **Open**: the `platform-engine-candidate` release state after #604 (step 0);
  whether to name `src/lib/engine/time-basis.mjs` differently now that it
  also carries the frame of date (kept as is, CLAUDE.md names it).
- **Disk**: about 2.7 GB free; a site build writes about 450 MB of `dist/`.
