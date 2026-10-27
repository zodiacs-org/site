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

On macOS arm64, Node 22.22.2:

- build, with schema validation (0 errors), engine isolation and bundle
  budgets: passes;
- `npm run check`: 0 errors, 0 warnings, 49 hints;
- `npm test`: 7,952 passed, 5 existing skips, 1 failed, across 620 files. The
  failure is `scripts/phase1-acceptance-evidence.test.mjs`, which requires
  captures of the current source (see Phase 1 captures). In an earlier full
  run two tests timed out at 5 s under load and passed alone;
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

## Phase 1 captures

The lockfile and `src/lib/**` are part of the Phase 1 capture digest, so the
18 captures are taken again by CI's Browser Evidence on this pull request,
reviewed, and committed with their provenance.

## Claims ledger

`docs/claims/ledger.json` follows the copy: the package, compute API,
registry, conformance, MCP and plugin claims say what is true of the
candidate; a new claim, `eng.receipt-convention-ids`, states the engine's rule;
the machine list adds the new key; and the bindings name the new archive,
`"releaseStatus": "vendored-candidate"` and 34.2 KB. Every sentence the
extractor selects is listed.

## Not established here

- Production. R44 stays partial until this revision is merged, deployed and
  checked in production: the registry with its new id, the compute API's and
  the hosted MCP server's receipts carrying their ids, and the conformance page
  on 0.2.0.
- A portal rescan. The hosted `tools/list` changes (Chart Studio's address and
  the compute receipts' schemas), so the AI portals' copies are stale until
  they scan again, which is the owner's call.
- Readers of new records. Records the site writes from now on are refused by
  npm's 1.0.0, MCP adapter archives up to rc.24, plugin ZIPs up to 0.3.13 and
  the rc.3 starter. A rollback to an earlier deployment cannot read them.
- Accuracy. Nothing here measures the candidate against an independent
  reference beyond the finite checks named above.
