# Site adoption of engine 1.1.0-rc.1 and conformance suite 0.2.0 (R44)

Base: site main `68d12fceed2fb197e62d52479c5062f2c0dd0203` (the daily edition
of 2026-10-27). This revision vendors `@zodiacs/engine@1.1.0-rc.1`, a release
candidate that npm does not carry, and copies the results of conformance suite
0.2.0. With them the receipts and conformance vectors the site serves carry
the conventions registry's ids, which is what R44's gate asks of them. It also
carries MCP adapter 0.1.0-rc.25 and developer plugin 0.3.14, both built on the
candidate. The record ends with what is not established here.

## The archive

[ARTIFACT-IDENTITY.md](ARTIFACT-IDENTITY.md) binds `vendor/zodiacs-engine-1.1.0-rc.1.tgz`
to the engine carrier `6ec3464c`. The archive is 292,721 bytes, SHA-256
`52352d3f…a7b6`; source `c4170626`, merged by `d9fc39cd`
(zodiacs-org/engine#75). The lockfile changes in four lines: the dependency,
version, `resolved` and `integrity`. Every earlier archive keeps its bytes.

npm does not carry 1.1.0-rc.1: the read of 2026-10-27
([npm-view.txt](npm-view.txt)) lists 1.0.0 under `latest`, and the
registry tool's read of 1.0.0 the same day
([npm-registry-1-0-0.json](npm-registry-1-0-0.json)) finds npm's 1.0.0
tarball still the vendored 1.0.0 archive, with its attestation verified. The
candidate record (`src/data/platform-engine-candidate.json`) says
`vendored-candidate`, and the pages that name the engine say that npm's 1.0.0
computes the same values but refuses the candidate's records.

## What the engine changes

[entry-graphs.txt](entry-graphs.txt) follows each of the 15 public entry
points through its static imports in both archives
(`tools/compare-entry-graphs.mjs`, 1.0.0's tool, which now compares a
closure's files as a set and imports by the names they bind, because the
bundler reorders both by chunk hash). 13 load 1.0.0's code apart from the
version string, chunk names and chunk order. `./receipt` loads new code and
`./conventions` is new:

- a natal receipt carries a sixth conventions set, rc.16's with
  `conventionIds`, and lists, as `receipt.conventionIds`, every id of the
  registry that it and its result name, in code-unit order, each once;
- its envelope requires the feature `convention-ids`, so 1.0.0 and every
  earlier engine refuse it as `unsupported_feature`;
- `@zodiacs/engine/conventions` gives the rule (`natalConventionIds`) and the
  id syntax.

The engine's own record is its `docs/evidence/1.1.0-rc.1-20261026/`: the
candidate gives 1.0.0's values on its battery of charts, and every earlier
carried archive refuses its records.

## What the site adds for R44

- **Compute receipts.** `zodiacs.compute-receipt.v1` gains `conventionIds`,
  last: the ids its own fields name (the conventions and coverage, the
  ephemeris, the endpoint, each ΔT source's model, how local times were read,
  how a search ran). It leaves out its result's ids, such as an instant's ΔT
  segment or a flag, which depend on the request: the receipt, and the digest
  `cite.receipt` quotes, still hold nothing the request gave
  (`src/mcp/sky-tools.test.ts` still finds one receipt per request form). The
  OpenAPI document requires the field in both receipts and documents the
  calculation receipt's `timeScale`; the MCP adapter's strict output schemas
  carry it.
- **Registry.** Version 2026-10-27 holds 156 ids in 58 namespaces: the new
  namespace `conventionIds`, with its one id, and `flag:zone-history-disputed`,
  the compute API's own answer flag, which the `flag` namespace said it covered
  and did not. The 13 values rc.16's set and 1.1.0-rc.1's share are written by
  `1.1.0-rc.1; 0.1.1-rc.16 to 1.0.0`. The kind and arbiter entries cite the
  0.2.0 vector files at `7e64717b` (zodiacs-org/engine#76), whose vectors list
  those two ids. `tests/conventions-registry.test.ts` holds each natal
  receipt's ids to the site's own reading of its fields and to
  `natalConventionIds`, each compute receipt's to the site's reading, and each
  id to the engine's parser and address.
- **Conformance.** `src/data/conformance/summary.json` is 0.2.0's, copied
  unchanged (SHA-256 `76f21a32…e646`). The counts are rc.17's: 1.1.0-rc.1
  passes 267 of 500; Swiss Ephemeris, run on 0.1.0's files, which hold the same
  vectors without their ids, 403.
- **Compare tool.** A difference in `conventions.conventionIds` alone has its
  own cause, `convention-ids`, which says the records list their ids
  differently. It no longer reads as different conventions that can make
  values incomparable.
- **MCP conventions resource.** It lists the sixth set, written from
  1.1.0-rc.1, and its note says which versions may carry each set. Without
  that, the vocabulary threw for the oldest set's keys.

## What was regenerated, and what changed

| Output | Command | Change |
| --- | --- | --- |
| `src/lib/engine/time-basis.mjs` | `node scripts/build-time-basis.mjs` | five comment lines; its natalChart self-check passes at 14,765 instants |
| `api/_compute/compute.mjs` | `node scripts/build-compute-handler.mjs` | the banner, chunk comments, `ENGINE_VERSION`, the engine's new receipt code and the compute receipt's ids, after the private-state review ([PRIVATE-STATE.md](PRIVATE-STATE.md)) |
| `api/_compute/local-time.mjs` | `node scripts/build-compute-local-time.mjs` | one chunk-name comment |
| `public/developers/playground/engine.mjs` | `node scripts/build-playground-engine.mjs` | 154,581 to 155,491 bytes gzipped, inside its 145 to 165 KB band |
| MCP adapter `examples/mcp-server/` and `public/examples/zodiacs-mcp-server-0.1.0-rc.25.tgz` | `npm run mcp:build`, `node scripts/pack-mcp-server.mjs --artifact-commit 18273949…` | adapter 0.1.0-rc.25; see below |
| AI runtimes, developer plugin 0.3.14 and its ZIP | `npm run ai:build`, `npm run ai:package` | versions, the engine labelled an unpublished candidate, compute receipts' ids, and Chart Studio's address `chart-studio-v6.html` (its panel embeds the engine; v5 stays a legacy address); the Sky ZIP is unchanged |
| flag-off fixture | `CAPTURE_FLAG_OFF_FIXTURE=1 npx vitest run src/ai-tools/accounts/flag-off.test.ts` | the hosted `tools/list` names the new panel address and the compute receipts' `conventionIds` |
| TypeDoc reference, 561 files | `node scripts/build-engine-reference.mjs` | version, pinned source, release README, and eight new pages for `/conventions` |
| `src/data/engine-bundle.json` | `npm run engine:bundle` | version; natal 34.3 to 34.2 KB gzipped, local time 40.8 to 40.7, geo 79.7 to 79.5 |
| `src/data/natal-aspect-examples.json` | `node scripts/build-natal-aspect-examples.mjs` | `engineVersion`, seven times |
| four independent-reference fixtures | `docs/engine-validation/independent-references/tools/build.py` | `engineVersion` only, with their digest pins (see Platform) |
| engine-derived data, 73 files | `tools/regenerate.py` (1.0.0's, rebased) | see below |
| `src/lib/compute-api/examples.json` | `npx vite-node --script scripts/build-compute-examples.mjs` on Node 24.21.0 | versions, cite digests, and each receipt's `conventions.conventionIds` and `conventionIds` |
| scene snapshot, engine demo | `-u` on `src/lib/scene/scene.test.ts`; `src/lib/engine-demo.ts` | the engine version |

The data comparison is [regenerated-outputs.json](regenerated-outputs.json);
`tools/check-regenerated-outputs.py` checks it against base `68d12fce`. Of the
73 files:

- 64 regenerated byte for byte;
- `daily-publication-manifest.json` changes in two fields: the engine version,
  and the generator digest, which covers the lockfile;
- `examples.json` was regenerated separately (see the table);
- `ingresses.json` and `birthdays.json` changed only their generation dates, so
  their base bytes are kept;
- five monthly transit files differ in one value each (see Platform), and their
  base bytes are kept.

## Platform

This machine is arm64, and its V8 arithmetic differs from x86-64's in the last
bits (site FINDINGS F-82). The code that computes these values is unchanged, so
x86-64 reproduces the base bytes, and those are kept:

- five monthly transit files, by 3e-15 to 1.3e-14 of the value (one station
  degree each in two files, one aspect degree each in three);
- two of the four reference fixtures, by one unit in the tenth decimal; only
  the version change is applied, which CI's offline rebuild on x86-64 checks;
- both lunar nodes' speeds in the compute examples, by 5.7e-9°/day, the libm
  variance the examples test bounds.

The parity reports ([node22-parity.json](node22-parity.json),
[node24-parity.json](node24-parity.json)) give 1.0.0's arm64 residuals exactly.

## The MCP adapter

[mcp-rc24-rc25.json](../mcp-adapter/mcp-rc24-rc25.json) drives rc.24 and rc.25
with the same 278 calls, 10 of them refusals, plus both resources and the tool
list (`tools/compare-mcp-versions.mjs`, its version pattern extended to
1.1.0-rc.1). After versions and digests are normalised, 156 calls differ, in
three ways only:

- `get_capabilities`: the engine is `unpublished-candidate`, with no registry;
- the 66 records `calculate_natal_chart` writes: equal apart from their
  `conventions.conventionIds`, `conventionIds` and `requiredFeatures`; no
  summary differs;
- the 89 compute receipts of `get_positions`, `find_events` and
  `check_sky_fact`: they add `conventionIds` and the set's new key.

The tool list differs in those replies' output schemas, and the conventions
resource in its note, its sixth set and the new key. No comparison differs:
two records from one engine compare as before. The protocol drive passes 114
of 114, now expecting six sets, the benchmark 18 of 18 scenarios, and the
Claude Code host drive 7 of 7.

## Local results

On macOS arm64, Node 22.22.2, at the merge of main `3f50b316` (#823) into
this branch:

- build, with schema validation (0 errors), engine isolation and bundle
  budgets: passes;
- `npm run check`: 0 errors, 0 warnings, 49 hints;
- `npm test`: 7,958 passed, 5 existing skips, 1 failed, across 621 files. The
  failure is `scripts/phase1-acceptance-evidence.test.mjs`, which requires
  captures of the current source (see Phase 1 captures). Before the merge the
  same run gave 7,952 passed across 620 files, with the same failure; in an
  earlier full run two tests timed out at 5 s under load and passed alone;
- `node scripts/check-dist.mjs`, the engine reference check and its browser
  drive, the natal aspect publication drive and `report-bundles.mjs --fail`:
  pass;
- every generator's `--check`, `mcp:build:check`, `mcp:pack:check` and
  `ai:check`, and the wing builders with `git diff --exit-code -- public/`:
  no drift;
- `npm run ai:test`: 293 tests, the bundle drive and the npm recipes pass;
- the developer guide checks: 24 of 24 examples, installed from the carried
  archive, and every guide's HTML and Markdown twin;
- the claims ledger lists every selected sentence, and the programme ledger
  regenerates unchanged.

After the birth chart form's change (see below), main was merged twice more:
`bdf4ef88` (#836 and #835) without conflict, then `59a9383c` (#807). That
merge conflicted only in generated files: the packages manifest, which now
keeps main's sky 0.5.1 entry beside this branch's developer 0.3.14 one, and
the flag-off fixture, captured again. The AI runtimes are rebuilt and equal
the merged ones. After each merge the gate ran again: the scope guard, the
build, `npm run check`, check-dist, the MCP and AI checks and tests, the
engine reference and its drive, the natal aspect drive and both ledgers. All
pass, and the full suite passes 7,958 with only the Phase 1 capture check
failing.

The logs are in [validation/](validation/), normalised as
[log-normalization.json](log-normalization.json) records, which also cover the
host drive's record, whose digest of this machine's Claude Code configuration
is withheld.

## Private search

The owner's private birth-data search ran over this adoption's two commits and
its tree, with both pattern sets ([history-check.txt](history-check.txt),
counts only):

- the commits add 15 matching lines, under 5 anonymous labels, every one birth
  data already on main, re-emitted by the regenerated bundles and by the two
  new archives' copies of them;
- the tree's 484 lines are main's 473 and the 11 in those two archives.

Inputs and raw outputs stay outside every repository.

## Accuracy refresh

The two Swiss statistics runs the methodology page binds to were made again,
on 1.1.0-rc.1, with the owner's approval of 2026-10-27, by
`tools/refresh-accuracy.sh` (1.0.0's, writing to `accuracy-refresh/`). The
inputs were Node 22.22.2, pyswisseph 2.10.3.2 (Swiss 2.10.03) installed from
PyPI into a scratch environment, and `sepl_18.se1` and `semo_18.se1`, matched to
their pinned SHA-256. The data files and the per-instant dumps stay outside
every repository.

[deltat-gap-2100-2199.json](accuracy-refresh/deltat-gap-2100-2199.json) and
[multiyear-1800-2199.json](accuracy-refresh/multiyear-1800-2199.json) equal
1.0.0's in every statistic. They differ only in `engine` and in the digest of
the engine-side dump, whose header names the engine. The test, the claims
`acc.deltat` and `acc.swiss-multiyear`, and their binds now read these
reports; the bound values are unchanged.

## Birth chart form shift

Browser Evidence's Lighthouse gate failed twice on this pull request, on
Russian routes:

- run 40451982876 on `ef2ce850`: `/ru/`, CLS 0.020;
- run 40465183791 on `937199b8`: `/ru/birth-chart/`, 0.008 in one sample of
  three.

Other branches failed the same way before this one did:
`/ru/birth-chart/` measured 0.011 in runs 40350231305 (26 October) and
40453547217 (27 October). AGENTS.md allows one rerun for a small CLS failure
and asks that a second be fixed, so the second run's samples were read
([form-shift/ci-run-40465183791.json](form-shift/ci-run-40465183791.json), by
[tools/lighthouse-shift-summary.mjs](tools/lighthouse-shift-summary.mjs)).

- **What moved.** The failing sample has one layout shift, 0.0076, at
  131.8 ms. That is 32.5 ms after its first contentful paint and before the
  document had finished parsing. The element that moved is the form's options
  panel, `details.calc__options`.
- **Why.** Both birth chart pages draw the panel after the submit button and
  the privacy line: `.calc__fields` is `display: contents`, and the panel has
  `order: 10` in the form's grid. The markup, though, put the panel before
  those two rows. The browser can paint while it is still parsing. If it
  paints after it has read the panel but before the two rows, it draws the
  panel straight under the fields. When the rows arrive they go above the
  panel, which moves down out of view. The shift depends on where parsing has
  reached at the first paint, so it is intermittent. It is likeliest on the
  Russian page, which paints first; the English page has the same markup.
- **Reproduced.** [tools/form-shift-split.mjs](tools/form-shift-split.mjs)
  pauses each page's HTML for 2 s at four points in the form and records the
  layout shifts at 412 by 823 pixels.
  - Without the change ([form-shift/split-before.json](form-shift/split-before.json)),
    a pause just before the submit button shifts the panel: 0.0096 on the
    English page and 0.0112 on the Russian one (the 0.011 of the other
    branches).
  - With it ([form-shift/split-after.json](form-shift/split-after.json)), no
    pause shifts either page.
- **The change.** `src/islands/ChartCalculator.tsx` now writes the panel after
  the privacy line, where the CSS already draws it.
  [tools/form-layout.mjs](tools/form-layout.mjs) finds the loaded form
  unchanged at 412 and 1440 pixels on both pages: every row's box, and the
  SHA-256 of a screenshot of the form
  ([form-shift/layout-before.json](form-shift/layout-before.json),
  [form-shift/layout-after.json](form-shift/layout-after.json)). Keyboard
  focus now follows the drawn order, so the submit button comes before the
  options.
- **In CI.** With the change, Browser Evidence run 40482308898 on `828f9e33`
  passed every step. Lighthouse passed on every route, with CLS 0.000 on
  `/ru/` and `/ru/birth-chart/`.
- **Not explained.** The first run's `/ru/` failure was not reproduced, and
  its traces were not kept. The second run's three `/ru/` samples have no
  shift.

The six birth chart pages render their form's text in a new order, so their
sitemap dates move to 2026-10-27, the day of the daily edition they were built
with.

The local gate ran again with the change, every step as at the merge, and all
passed except the full suite. That run had two failures: the Phase 1 capture
check, and `scripts/sitemap-rendered-changes.test.mjs`, which timed out at 5 s
while another job on the machine held the load average near 158. Alone, that
file passes 25 of 25. After the sitemap dates, the build, `npm run check`,
check-dist and the full suite ran again. The suite passed 7,958, with only the
Phase 1 capture check failing
([validation/full-suite-form-shift.log](validation/full-suite-form-shift.log)).

## Phase 1 captures

The Phase 1 capture digest covers the lockfile, `src/lib/**`, `src/islands/**`
and the templates that main's merges change. So CI's Browser Evidence takes
the 18 captures again on this pull request's last head, and they are reviewed
and committed with their provenance.

- **Committed captures.** Browser Evidence run 40491088699 took them on
  `55544dc1`, after the birth chart form's change and the merge of main's
  `59a9383c`. It used Chromium 149.0.7827.55 at 2026-10-27T11:02:24Z, bound
  to template source digest `7124cefb…`, which the source at this head gives.
  Every step passed: the build, the captures and their receipt, the visual
  comparison, Lighthouse and the explorer drive
  ([browser-evidence-provenance.json](browser-evidence-provenance.json) is the
  run's own record). The committed files are the artifact's, byte for byte,
  and each matches the manifest and that record. All 18 images differ from
  the captures main's #807 committed, which carry a fixed `12:00:00Z` time.
  In the images compared, the content and layout are the same. Most of the
  differing pixels are 1 or 2 levels apart, spread over the whole page. The
  `today` page at 360 pixels is 35 pixels taller, and two others differ by
  1 pixel. With these captures the full suite passes 7,959 tests in 620
  files, with 5 existing skips
  ([validation/full-suite-captures.log](validation/full-suite-captures.log)).
- **Superseded runs.** Three runs took the captures for heads whose digest
  later changed:
  - 40451982876 on `ef2ce850`, digest `1a126188…`, before main's #823 was
    merged. Its artifact was not downloaded.
  - 40465183791 on `937199b8`, digest `75eaedf0…`, before the birth chart
    form's change. Its provenance is kept as
    [browser-evidence-provenance-937199b8.json](browser-evidence-provenance-937199b8.json).
  - 40482308898 on `828f9e33`, digest `3dff78e3…`, before main's #807 was
    merged. Every step passed.

## Claims ledger

`docs/claims/ledger.json` follows the copy: the package, compute API,
registry, conformance, MCP and plugin claims say what is true of the
candidate; a new claim, `eng.receipt-convention-ids`, states the engine's rule;
the machine list adds the new key; and the bindings name the new archive,
`"releaseStatus": "vendored-candidate"` and 34.2 KB. Every sentence the
extractor selects is listed.

## Production

#840 merged on 27 October 2026 at 21:38 ICT as
`d698bc084091b8c9a63d95e0572b270386e4b077`. Its parents are main `59a9383c`
and head `2cd66f37`, and its tree is the tested head's tree. Vercel
`dpl_9BVVN29Z2d8zWsiBUthJo1ytcePn` built it for production and was READY at
2026-10-27T14:45:58Z, when the zodiacs.org alias moved to it.

`tools/verify-production.mjs`, 1.0.0's check adapted, then checked canonical
production
([production/production-at-merge.json](production/production-at-merge.json)).
It now reads its expected values from the merge commit, and the alias read
from a file, as the registry's check does. Before and after the run, the
alias named that deployment, built from the merge, with an unchanged
`updatedAt` (read through the Vercel connector). All 11 checks pass:

- the engine, support and MCP pages and both llms files name 1.1.0-rc.1 as a
  release candidate npm does not carry, with npm's 1.0.0 beside it, and the
  pages give the archive's digest;
- the TypeDoc provenance names 1.1.0-rc.1, its source commit, its digest and
  its licence;
- the MCP manifest served is the merge's, and the rc.25 archive has its
  digest;
- the compute API's documented positions request is answered with `backend`
  and receipt engine 1.1.0-rc.1, and its receipt lists its convention ids.

The R44 checks, the registry's and the ids', and the state before the
deployment are recorded in
[convention-ids-20261027](../convention-ids-20261027/README.md).

## Not established here

- A portal rescan. The hosted `tools/list` changes (Chart Studio's address and
  the compute receipts' schemas), so the AI portals' copies are stale until
  they scan again, which is the owner's call.
- Readers of new records. Records the site writes from now on are refused by
  npm's 1.0.0, MCP adapter archives up to rc.24, plugin ZIPs up to 0.3.13 and
  the rc.3 starter. A rollback to an earlier deployment cannot read them.
- Accuracy. Nothing here measures the candidate against an independent
  reference beyond the finite checks named above.
