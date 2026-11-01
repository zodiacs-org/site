# The time atlas dataset and its diff viewer (B3.c): evidence

Ledger unit B3.c, "Published atlas dataset and a diff viewer", weight 2.
Gate: "dataset released under CC BY or ODbL with a diff viewer". What
"released" means here, the exact files, the licence text, the correction
route, what the viewer must show and every check with its control were fixed
in [PREREGISTRATION.md](PREREGISTRATION.md), the branch's first commit,
before any page, published file or test existed. This README records what
the feature branch built and checked. The production section is added by the
record pull request after the merge; until then nothing here has been served
by zodiacs.org, which answered 404 for `/developers/time-atlas/` on
1 November 2026.

The branch starts from site main `54deb7e80b46a16def4c31aae5c9c59d2acb79b0`
(the daily edition of 1 November on top of `0d3ee795`, at which the
preregistration was written). All commands ran with Node 22.22.2.

## What is published

`public/developers/time-atlas/0.1.0/`, served at
`/developers/time-atlas/0.1.0/`, holds the seventeen files of the
preregistration's table, 396,147 bytes, each a byte for byte copy of its
source in `atlas/` of zodiacs-org/engine at
`7307665bdbc432269fdac006104f661be16000bc` (atlas tree
`8e1bc174cafdb8c09ee7986cae4527cdbac18e9a`), with `atlas/LICENSE` served as
`LICENSE.txt`, and `files.json`, the site's index of them.

- `files.json`: 4,837 bytes, SHA-256
  `c5015f8eb2cd5cc635ef4f395453a97476270bae44eaad10bf81ea82389dc5d3`, git
  blob `67a1a9b62c7c7d44dd2eee4ce3fd1a25da8278b2`. It was written once by a
  script kept outside the repository, which refused to write unless every
  file had the size, SHA-256 and git blob of the preregistration's table. It
  lists each file's served path, source path, bytes, SHA-256 and git blob,
  and the repository, commit, tree and path they came from; it does not list
  itself.
- The ten data files are the same git blobs as `src/data/time-atlas/`, the
  copies the compute API reads, and a test holds the two copies equal. The
  early private search (below) found no matching line added, so the one-copy
  fallback was not needed.
- Licence: CC BY 4.0, with Zodiacs.org as licensor; `places.json` carries
  GeoNames data under CC BY 4.0, whose attribution and changes `atlas.json`
  records and the page renders unchanged. `LICENSE` and `README.md` of this
  repository name the atlas.
- Not copied: `atlas/schema/atlas.schema.json` and `atlas/tools/` (MIT code,
  whose licence text is the engine repository's root `LICENSE`), and
  `atlas/tzdb/tzdb-2025c.json` (public domain), each linked at `7307665b`.
  The data files' `"$schema": "../schema/atlas.schema.json"` lines resolve in
  the engine repository, not on zodiacs.org, and the page says so.

## How the bytes were copied (C3)

The engine clone was read with `git show`, `git ls-tree`, `git cat-file` and
`git archive` of `atlas/`, and its HEAD
(`4b116cc72acfdce22a542e3d09c42bf2acd94a83`) did not move, with one
exception. After the local runs of the production check, one
`git -C <engine> status --porcelain` compared the clone's whole working tree
with its index, `docs/evidence/calc-sidereal-2026-10-05/` included, against
the owner's rule that the folder be left out of every recursive scan. It
printed nothing, and no file of that folder was opened or printed by hand
(see "Departures"). Every archive named `atlas` only and excluded
`docs/evidence/calc-sidereal-2026-10-05/` explicitly. Two extracts were made
outside every repository:

```sh
git -C <engine> archive 7307665bdbc432269fdac006104f661be16000bc -- atlas ':(exclude)docs/evidence/calc-sidereal-2026-10-05' | tar -x -C <extract>
git -C <engine> ls-tree 7307665bdbc432269fdac006104f661be16000bc atlas
# 040000 tree 8e1bc174cafdb8c09ee7986cae4527cdbac18e9a	atlas
git -C <engine> ls-tree -r 7307665bdbc432269fdac006104f661be16000bc atlas \
  | while read -r mode type blob file; do test "$(git hash-object --no-filters "<extract>/$file")" = "$blob" || echo "MISMATCH $file"; done
# prints nothing: all 30 blobs of the tree match the extract
```

The control, the same loop over engine
`c4e70330751b17f6ebd6322958c270f09f93d3a3` (atlas tree `2b2936eb`), printed
exactly `MISMATCH atlas/README.md`, `MISMATCH atlas/tools/resolve.mjs` and
`MISMATCH atlas/tools/selftest.mjs`. The seventeen files were copied from
the extract with `cp`.

[tools/engine-bytes.mjs](tools/engine-bytes.mjs) then compared each file of
the folder with the blob at its source path, read with `git cat-file`:

| report | commit | atlas tree | files |
| --- | --- | --- | --- |
| [engine-bytes-7307665b.json](engine-bytes-7307665b.json) | `7307665b` | `8e1bc174`, as indexed | 17 of 17 |
| [engine-bytes-c4e70330.json](engine-bytes-c4e70330.json) (control) | `c4e70330` | `2b2936eb`, not the index's | 16 of 17, README.md differing |

Both record the clone's HEAD, the same before and after. The control exits 1.

## The atlas's own checks (C4)

Run on the extract, with its outputs in [atlas-checks/](atlas-checks/) and
the commands and exit codes in [atlas-checks/runs.txt](atlas-checks/runs.txt):

- `node atlas/tools/check.mjs` exited 0: "atlas 0.1.0: 21 places, 14
  jurisdictions, 59 rules, 66 citations", flags documented 27, inferred 26,
  uncertain 6, 258 boundaries and 2735 round trips, "tzdb comparison
  current, every difference matched by exactly one explanation".
- `node atlas/tools/compare-tzdb.mjs --check` exited 0: "108 differences,
  each matched by exactly one explanation; files current".
- `node --test atlas/tools/selftest.mjs`: 26 tests, 26 passed.
- Control 1, one byte of `tzdb/differences.json` changed (the first
  `"differenceSeconds": -3600` made `-3601`): `check.mjs` and
  `compare-tzdb.mjs --check` both exited 1, the comparison stale.
- Control 2, `fr-paris` removed from the places `fr-summer-time-end-hour`
  matches: `check.mjs` exited 1 with four periods of Paris unexplained.

`compare-tzdb.mjs` was never run without `--check`.

## The viewer

`/developers/time-atlas/` is one Astro page,
`src/pages/developers/time-atlas/index.astro`, with page-scoped styles and no
script of its own, rendered from the published files by
`src/pages/developers/time-atlas/_atlas.ts`, which holds no prose. It reads
the comparison from `TZDB-DIFFERENCES.md` and joins its differing rows to
`tzdb/differences.json` row by row, throwing on any row it cannot place. It
shows:

- the base, tzdb 2025c with backzone (tarball SHA-256 `4aa79e4e...f957`,
  compiled tree of 598 files `98ba2bd3...bcc5`), the window and the
  definitions of a difference and of rounding;
- the 23 comparisons with their counts: 287 periods, 178 agreeing, 108
  differing and 1 rounding only; 22 comparisons have a difference, and the
  108 are 98 against the places' own zones and 10 against Europe/Berlin, for
  information;
- the 77 spans of agreement, and New York City's rounding-only period (380 ms);
- every one of the 287 periods side by side, each of the 108 differences with
  its own anchor and a link to its one explanation; the 108 name 31 rules,
  with versions 1, 2 and 3 on 46, 44 and 18 rows and flags documented,
  inferred and uncertain on 54, 32 and 22 rows (test 7 holds these figures,
  with a control that makes `fr-wet-1916`, on 10 rows, uncertain);
- the 11 explanations with their counts (42, 24, 18, 8, 5, 3, 2, 2, 2, 1 and
  1), their text, the two findings about tzdb 2025c under the label "Finding
  about tzdb 2025c, not sent to the tz project", and links to the 37 sources
  they cite, each shown once with its own anchor (13 with a gloss) and no
  excerpt;
- all 59 rules with their versions, flags and reasons, and the 45 change
  entries of 38 of them;
- the files with their digests, the licence and attribution text, the
  citation form, the correction route and the limits.

The page's HTML as built at `61875dc9`, after the review's fixes, is 392,125
bytes (392,022 at `96670534`). It holds no en or em dash; the nine em dashes
of the atlas are in eight citation excerpts, which stay in the published
files.

## The checks in this repository

`tests/time-atlas-dataset.test.ts` (C2, C5 and the unit tests of C6), run by
`npm test`, each with failing controls in the same test:

1. publishes exactly the seventeen atlas files and their index, none missing, none extra and no link
2. keeps the bytes the engine repository's atlas had at 7307665b, file by file
3. serves the same ten data files the compute API reads
4. lists each file in files.json with its size, SHA-256, git blob and source, and the commit and tree it came from
5. gives the atlas's own counts: 21 places, 14 jurisdictions, 59 rules (27 documented, 26 inferred, 6 uncertain) and 66 citations
6. reads the comparison as TZDB-DIFFERENCES.md states it: 23 place and zone pairs, 287 periods, 178 agreeing, 1 within a second and 108 differing
7. finds in the place tables exactly the 108 differences of tzdb/differences.json, in order, with their offsets
8. matches each difference to exactly one of the 11 explanations on its place, zone, rule and both offsets
9. builds the viewer with every period once, each difference under its explanation, and an anchor for every explanation, source, pair, row and rule
10. shows nothing with an en or em dash, and leaves out the excerpts, the only atlas strings that have them
11. names the version and commit the compute API's reading names
12. holds the page's checks over the built site to the files, and fails each planted fault
13. states in the hub card the counts the files give
14. states in both llms entries the counts and the commit the files give

Beside them:

- `scripts/check-time-atlas.mjs` holds the folder to its index
  (`timeAtlasFileProblems`) and the page to the published files
  (`timeAtlasPageProblems`, C6). The page check parses the files itself,
  apart from `_atlas.ts`, and names each problem's part: "viewer" (items 1
  to 10 of the preregistration's list, the excerpts, the dashes, the scripts,
  the in-page links and ids), "licence" (the licence and attribution text,
  the citation form and the Dataset markup) or "corrections". Since the
  review it also reads each comparison row's cells (the zone, marked for
  information where it is, and the five counts) and each period's result
  cell as a reader sees them, not only their attributes, and each change
  entry's version beside its date and summary; and its dash rule counts a
  numeric reference once decoded, so one with leading zeros counts, as does
  one without its semicolon. Test 12 plants each of these faults; on the
  built pages of `96670534` and `61875dc9`, each fault planted in memory, the
  check before the change found none of them and the check after it finds
  each one, as its only problem.
- `scripts/check-dist.mjs` runs both on every build ("time atlas: ..."), and
  its sitemap total is main's plus one (1452 to 1453). With the first
  difference row removed from the built page it failed 112 checks, all
  "time atlas: viewer: ..."; the page check as changed after the review, run
  in memory on the build of `61875dc9` with that row removed, gives the same
  112, all "viewer".
- `scripts/developer-structured-data-checks.mjs` holds the page's Dataset
  (C7): CC BY 4.0 exactly, version 0.1.0, span `1870-01-01/1919-12-31`, the
  seventeen files as DataDownloads with their media types, each served, and
  the breadcrumb "Historical time atlas"; its test plants a CC0 licence, no
  licence, version 0.1.1, a span with times, a missing file and a misnamed
  breadcrumb, each failing with the script's message.
- `scripts/check-developer-authorship.mjs` requires the page and the
  eighteen files in the built site.

## C1, the record first

```sh
first=$(git rev-list --reverse origin/main..HEAD | head -1)
git show --name-status --format= "$first"
# A	docs/platform/evidence/time-atlas-dataset-20261101/PREREGISTRATION.md
git log --format='%aI %cI' origin/main..HEAD | sort | head -1; git log -1 --format='%aI %cI' "$first"
# 2026-11-01T07:30:14+07:00 2026-11-01T07:30:14+07:00, both lines: the first commit's dates are the earliest
```

`572ea3d34063e4fafce6e24e322a364ec97a0f03` adds the preregistration alone.
The control, the same check with its base set to that commit, takes
`c6cec93a` as the first, which adds 33 files, and so fails.

## Claims records (C8)

The page joins `DENSE_FILES` (`LEXICON_VERSION` stays 2) and the "Not read"
comment names the served files. The new claim `product.time-atlas-dataset`
is `supported`, with the fourteen test titles, the SHA-256 of five published
files, the C3 and C4 outputs, an external item for the engine tree at
`7307665b` (read 1 November 2026) and the page check as evidence.

| | records |
| --- | ---: |
| sentences selected and recorded | 60 |
| on the new claim | 45 |
| on existing claims (`time.atlas-reading`) | 2 |
| exempt (not-a-claim 4, definitional 3, navigation 2, limitation 4) | 13 |

The 60 are the page's 47, the hub card's 1, llms.txt's 1 and
llms-full.txt's 11. `--unlisted` and `--orphans` print 0, and
`maxOpenOverstated` stays 11. Control: with the record of "Two explanations
end with a finding about tzdb 2025c, quoted as the atlas states it." removed
from the ledger, `--unlisted` reported exactly that one sentence.

Sentences the extractor misses. The review found six sentences about time
handling on the page that the extractor did not select, so they had no
record: the three of the paragraph under the comparisons table (the totals,
the 98 and the 10, and one explanation for each difference), the rules
paragraph, and the Limits items on the coverage and on railway clocks. The
first sentence of that paragraph, the rules sentence and the two Limits items
were reworded to name what they are about (tzdb 2025c, the historical time
atlas), which brings them under the extractor; the paragraph's other two
sentences come in with its first, as the page is dense. The four are on the
new claim, whose statement gained "22 of the 23 comparisons have a
difference" and "45 change entries on 38 rules", and the two Limits items are
exempt as limitations. The 61 sentences of the page that the extractor reads
and does not select were then read by hand: file descriptions, headings,
table cells, the licence and correction text and navigation, none of them a
statement about time handling but the h1. Of the hub card only its h2 is
not selected, and of the two llms blocks every sentence is. The h1 and the
hub card's h2 ("Check what the clocks said, 1870 to 1919") are headings and
have no record, unless the owner counts them as sentences about time
handling.
Control: with the rules sentence's record left out of the ledger in memory,
the selection reported exactly that sentence unlisted.

## Phase 1 (C9)

No Phase 1 captures: no digest path changed. The template source digest is
`1e81c55f05d4bb03924d102d0e835c55e93dcc48d2c6ae5506decc99541736a1`, the
committed manifest's; with `src/lib/time-atlas/index.ts` given one byte more
through `readSource`, the same function returns
`0ac787a4e49ba166ae8a9a4a6df30a3a2a9a2d111dc69142d18e405c343e8fad`, and
nothing was written.

## The private search

Counts only, with the owner-approved scanner and both pattern sets, over
`54deb7e8..c6cec93a` once the files were in: 0 lines added in the 2 commits
with either set, and 487 lines in the tree, main's figure.

Over the whole branch, after the review's fixes, `54deb7e8..61875dc9` (13
commits, no merges): both pattern sets reported 0 lines added and 487 lines
in the tree, equal to main's 487, read again with both sets over
`54deb7e8^..54deb7e8`. Each of the four reports has one "Birth data found"
line and no line starting with Error. Before the fixes, over
`54deb7e8..d0e413a8` (8 commits), the build and the review had each read
the same counts. The commit that adds this paragraph changes only this
README and the two local reports.

## Local runs of the production check

[tools/production-check.mjs](tools/production-check.mjs) was first run
against the branch's build of `96670534` (K7), after the pre-push list had
passed on it. After the review's fixes, `local/local.json` and
`local/local-controls.json` were replaced with the same two runs against the
branch's build of `61875dc954f60ec40a703631fc75d34507feffc2`, the last
commit that changes the page, its check or its tests, served by
`astro preview` as the drives serve it (`tests/visual/preview-server.mjs`),
before any pull request opened:

```sh
node tools/production-check.mjs - 61875dc954f60ec40a703631fc75d34507feffc2 local/local.json http://127.0.0.1:4431
TIME_ATLAS_CHECK_CONTROL=row-removed,tzdb-offset,explanation-removed,label-removed,excerpt-inserted,geonames-changes,form-link-removed \
  node tools/production-check.mjs - 61875dc954f60ec40a703631fc75d34507feffc2 local/local-controls.json http://127.0.0.1:4431
```

| report | run | passed | failing |
| --- | --- | ---: | --- |
| [local/local.json](local/local.json) | as built | 23 of 23 | none |
| [local/local-controls.json](local/local-controls.json) | `row-removed` | 22 of 23 | check 3 |
| | `tzdb-offset` | 22 of 23 | check 3 |
| | `explanation-removed` | 22 of 23 | check 3 |
| | `label-removed` | 22 of 23 | check 3 |
| | `excerpt-inserted` | 22 of 23 | check 3 |
| | `geonames-changes` | 22 of 23 | check 4 |
| | `form-link-removed` | 22 of 23 | check 5 |

The runs against `96670534` had given the same results. The page served this
time was the build's own, 392,125 bytes, SHA-256
`0859a811d323be738a98663da6baf5dd9b0ad251b0fa453210aca170dc7f661b`, held to
the page check as `61875dc9` holds it. A local run has no alias, so check 1
is not run. The preview server sends the published files without a charset
parameter, so the media type is compared without it here; on zodiacs.org
`charset=utf-8` is required as well. Checks 5 to 22 also read
raw.githubusercontent.com: the correction form's definition at engine main,
named "Atlas correction", and each file's bytes at engine `7307665b`, which
equal the served bytes and the commit's. The preview server sent no
`Access-Control-Allow-Origin` header for any of the seventeen files. The two
file controls, `one-byte` and `engine-c4e70330`, belong to the production
record; tried once against each of the two builds, each passed 22 of 23 and
failed exactly README.md's check.

The pre-push list ran on `96670534` before the first runs, one step at a time.
Every step exited 0 (the build's prebuild with the daily verification and
the freshness gate on the edition of 1 November, and its postbuild with
check-dist, schema:check and the Phase 1 receipt `1e81c55f...`) but two.
`npm test` run before the build, with no `dist/`, failed the nine cases of
`scripts/people-font-preload.test.mjs` that read `dist/` and do not skip
without it; run again after the build, as CI's Site Check runs it, it
passed: 625 files, 8,026 tests, 5 skipped. The hub drive passed, and the
first-use drive's Chromium half passed 44 of 44, the hub's ten cards in
order among them, but its Firefox half could not start, as no Firefox is
installed for Playwright on this machine: `npm run test:firstuse:browser`
exited 1, so that gate has not passed (see "Open for the owner"). The
optional local Sitemap Dates comparison, which needs a second build of main,
was not run.

After the review's fixes, on `61875dc9` and one step after another: the
build, with its prebuild on the edition of 1 November and its postbuild
(check-dist with the time atlas block, schema:check and the Phase 1 receipt
`1e81c55f...`), exited 0; `npm test` after it passed 625 files (1 skipped)
and 8,026 tests (5 skipped); `npm run check` gave 0 errors and 0 warnings;
`--unlisted` and `--orphans` printed 0; the Phase 1 scope guard passed (54
changed paths, protected scope untouched); the local runs above gave the
table's results; and the dash check on added lines printed nothing, with 7
lines in its control on `data/citations-fr.json` and 13 in the generated
guide's added lines. `npm run ai:check`, `mcp:build:check`, `mcp:pack:check`,
the compute handler's and the cities' `--check` and
`node scripts/programme-ledger.mjs --check` exited 0 too. The four
developer-guide checks and the two hub drives were not run again: the fixes
change neither the guides nor the hub.

## Overlaps

- Draft site#852 rewrites copy on the hub page this unit adds a card to;
  whichever merges second merges main, records the hub's changed sentences
  again, and dates `/developers/` no earlier than the other and no later
  than the edition its own build reads.
- site#860 changes the programme files, which this branch does not touch.

## Departures

- The preregistration was committed with its base commit, and the commit
  named beside two figures read at it, changed from `0d3ee795` to
  `54deb7e8`: main moved by the daily edition of 1 November, which changes
  none of this unit's files, and the figures (1452, 74 and 713) are the same
  at both.
- The extracts and the C4 outputs were made in a scratch folder outside
  every repository rather than under the programme's `notes/`; the committed
  outputs write the extract's path as `<extract>`.
- The blob check's loop variable is `file`, not `path`: in zsh, `path` is
  tied to `PATH`, and the loop as first written cleared it. Its hashes are
  `git hash-object --no-filters`, and the trees and HEAD are read with
  `git ls-tree` and `git show`, the verbs the engine clone was read with.
- The regenerated assistant guide also moves its twelve monthly horoscope
  lines from October to November, the edition the branch is built on, beside
  the page's one new line.
- Test 10 checks the hub card's source for dashes rather than the whole hub
  page, whose existing copy (its title and two paragraphs this unit does not
  touch) holds em dashes.
- The page check names its problems by part so that the production check
  can attribute them to its checks 3, 4 and 5, and check-dist runs it only
  once the folder check passes.
- The claim binds, besides the version, the licence and the 108 differences,
  the counts the atlas's own check printed (C4), so that the counts it
  restates are bound to the atlas's output.
- The owner's rule for the engine clone was broken once. After the local
  runs of the production check, one `git -C <engine> status --porcelain` was
  run to see that the clone was clean. It compares the clone's whole working
  tree with its index, `docs/evidence/calc-sidereal-2026-10-05/` included,
  and the owner's rule leaves that folder out of every recursive scan. It
  printed nothing, and no file of that folder was opened or printed by hand.
  Every other read of the clone in the build and its review was `git show`,
  `git ls-tree`, `git cat-file` or `git archive` of `atlas/`, and the fixes
  after the review did not read it. This goes in the pull request's body and
  to the owner.

## Open for the owner

- The first-use drive's Firefox half. The site gates require the handover's
  full list to pass before every push, and the list includes the two hub
  drives run locally. `npm run test:firstuse:browser` runs the first-use
  drive in Chromium and in Firefox: Chromium passed 44 of 44, but no Firefox
  is installed for Playwright on this machine, so the Firefox half never
  started and the command exited 1. No CI workflow runs the drives, so
  nothing else covers that half, and the gate has not passed. Installing
  Playwright's own Firefox build (`npx playwright install firefox` in the
  clone) is a download that needs the owner's permission, and nothing was
  downloaded. The owner decides: with that permission, Firefox is installed,
  `nice -n 10 npm run test:firstuse:browser` runs again on the build and both
  halves are recorded here; without it, the gap goes in the pull request's
  body as a departure from the site gates, and the owner accepts it before
  the push.

## Not done

- No tag, GitHub release, DOI or deposit: each is the owner's (reach item
  X-7). The engine's Zenodo record of v0.1.1-rc.15 is a software record and
  is not given as the atlas's DOI.
- The two tzdb findings are shown, labelled not sent; nothing was sent to
  the tz project.
- The excerpts are not on the page.
- No CORS header for the folder, which would be a hosting change.
- The schema, the tools and the tzdb extract are not copied.
- No Lighthouse route and no Markdown twin.
- The playground's engine bundle carries the atlas data without naming the
  atlas (`scripts/build-playground-engine.mjs`); a later change can add the
  credit.
- The draft pull request and the production record come after this branch.
  The independent review read the branch at `d0e413a8`; the commits after it
  answer six of its seven problems, and the seventh, the first-use drive's
  Firefox half, is the owner's to decide (see "Open for the owner").
