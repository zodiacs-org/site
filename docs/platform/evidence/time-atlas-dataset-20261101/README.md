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

The engine clone's HEAD (`4b116cc72acfdce22a542e3d09c42bf2acd94a83`) did
not move, and the atlas was read from it with `git show`, `git ls-tree`,
`git cat-file` and `git archive` of `atlas/`. The clone was also read by
name in two other ways: `git show -s HEAD`, to confirm its HEAD, and, in the
review, the root `LICENSE` and `.github/ISSUE_TEMPLATE/atlas-correction.yml`,
listed by name without recursion, the first lines of the `LICENSE` blob
included. In the build, one read broke the owner's rule for the clone: after the local
runs of the production check, one `git -C <engine> status --porcelain`
compared the clone's whole working tree with its index,
`docs/evidence/calc-sidereal-2026-10-05/` included, against the owner's rule
that the folder be left out of every recursive scan. It printed nothing, and
no file of that folder was opened or printed by hand (see "Departures",
which also gives the reads made when the unit was scoped).
Every archive named `atlas` only and excluded
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
  each one, as its only problem. Since the second review it also reads each
  period row's first six cells in order, the explanation each difference's
  result cell names, and the version and flag each rule entry shows beside
  its title and reason (`823ed051`). Test 12 plants the four faults these
  catch; on the built page of `823ed051`, each planted in memory, the check
  of `be6728d5` finds none of them and the check of `823ed051` each one, as
  its only problem.
- `scripts/check-dist.mjs` runs both on every build ("time atlas: ..."), and
  its sitemap total is main's plus one (1452 to 1453). With the first
  difference row removed from the built page it failed 112 checks, all
  "time atlas: viewer: ..."; the page check as changed after the review, run
  in memory on the build of `61875dc9` with that row removed, gives the same
  112, all "viewer", and so does the check of `823ed051` on its own build.
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

Over the whole branch, after the second review's fixes,
`54deb7e8..823ed051` (15 commits, no merges): both pattern sets reported 0
lines added and 487 lines in the tree, equal to main's 487, read again with
both sets over `54deb7e8^..54deb7e8`. Each of the four reports has one
"Birth data found" line and no line starting with Error. Before, the build
and the review over `54deb7e8..d0e413a8` (8 commits), and the fixes after
the review over `54deb7e8..61875dc9` (13 commits) and `54deb7e8..be6728d5`
(14 commits), had each read the same counts. The commit that adds this
paragraph changes only this README and the two local reports.

## Local runs of the production check

[tools/production-check.mjs](tools/production-check.mjs) was first run
against the branch's build of `96670534` (K7), after the pre-push list had
passed on it, and again after the review's fixes against the build of
`61875dc9`. After the second review's fixes, `local/local.json` and
`local/local-controls.json` were replaced with the same two runs against the
branch's build of `823ed051bdd12442a809e28b96591af2de12af92`, the last
commit that changes the page, its check or its tests, served by
`astro preview` as the drives serve it (`tests/visual/preview-server.mjs`),
before any pull request opened. That build, with its prebuild on the edition
of 1 November and its postbuild (check-dist with the time atlas block,
schema:check and the Phase 1 receipt `1e81c55f...`), exited 0. The runs:

```sh
node tools/production-check.mjs - 823ed051bdd12442a809e28b96591af2de12af92 local/local.json http://127.0.0.1:4431
TIME_ATLAS_CHECK_CONTROL=row-removed,tzdb-offset,explanation-removed,label-removed,excerpt-inserted,geonames-changes,form-link-removed \
  node tools/production-check.mjs - 823ed051bdd12442a809e28b96591af2de12af92 local/local-controls.json http://127.0.0.1:4431
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

The runs against `96670534` and `61875dc9` had given the same results. The
page served this time was the build's own, 392,125 bytes, SHA-256
`0859a811d323be738a98663da6baf5dd9b0ad251b0fa453210aca170dc7f661b`, the
same bytes as the build of `61875dc9`, held to the page check as `823ed051`
holds it. A local run has no alias, so check 1
is not run. The preview server sends the published files without a charset
parameter, so the media type is compared without it here; on zodiacs.org
`charset=utf-8` is required as well. Checks 5 to 22 also read
raw.githubusercontent.com: the correction form's definition at engine main,
named "Atlas correction", and each file's bytes at engine `7307665b`, which
equal the served bytes and the commit's. The preview server sent no
`Access-Control-Allow-Origin` header for any of the seventeen files. The two
file controls, `one-byte` and `engine-c4e70330`, belong to the production
record; tried once against each of the builds of `96670534` and `61875dc9`,
each passed 22 of 23 and failed exactly README.md's check.

The pre-push list ran on `96670534` before the first runs, one step at a time.
Every step exited 0 (the build's prebuild with the daily verification and
the freshness gate on the edition of 1 November, and its postbuild with
check-dist, schema:check and the Phase 1 receipt `1e81c55f...`) but two.
`npm test` run before the build, with no `dist/`, failed the nine cases of
`scripts/people-font-preload.test.mjs` that read `dist/` and do not skip
without it; run again after the build, as CI's Site Check runs it, it
passed: 625 files, 8,026 tests, 5 skipped. The hub drive passed, and the
first-use drive's Chromium half passed 44 of 44, the hub's ten cards in
order among them, but its Firefox half could not start, as no Firefox was
installed for Playwright on this machine then (later installed, it does not
start on this Mac): `npm run test:firstuse:browser` exited 1, so that gate
has not passed (see "Open for the owner"). The
optional local Sitemap Dates comparison, which needs a second build of main,
was not run.

After the review's fixes, on `61875dc9` and one step after another: the
build, with its prebuild on the edition of 1 November and its postbuild
(check-dist with the time atlas block, schema:check and the Phase 1 receipt
`1e81c55f...`), exited 0; `npm test` after it passed 625 files (1 skipped)
and 8,026 tests (5 skipped); `npm run check` gave 0 errors and 0 warnings;
`--unlisted` and `--orphans` printed 0; the Phase 1 scope guard passed (54
changed paths, protected scope untouched); the two local runs gave the
table's results; and the dash check on added lines printed nothing, with 7
lines in its control on `data/citations-fr.json` and 13 in the generated
guide's added lines. `npm run ai:check`, `mcp:build:check`, `mcp:pack:check`,
the compute handler's and the cities' `--check` and
`node scripts/programme-ledger.mjs --check` exited 0 too. The four
developer-guide checks and the two hub drives were not run again: the fixes
change neither the guides nor the hub.

## Production

#862 was merged on the owner's approval on 4 November 2026 at 10:53:59 ICT
(03:53:59Z) as `2f2a56699c10a8d1de1b2b5a731d0122a0a11ff2`, a merge commit
whose parents are main `e632fe4c` (the daily edition of 4 November) and the
head `25e5216a`. Times in this section are UTC.

### The owner's reply

The request for the merge carried the preregistration's question. The
owner's reply, given in chat on 4 November 2026, in full:

> i have no idea what those things are that are still with me and you can go ahead and merge and continue. Resolve it yourself.

Before the merge, #862's body gained this first paragraph:

> **Resolved on 2026-11-04.** The owner approved the merge and asked that the two questions below be settled without them. As this body says, approving the merge with no tag, release or DOI named accepts the reading of "released" (release state `deployed`). The other question, accepting the first-use drive's unrun Firefox half as a departure, would be the programme passing its own unit, which zodiacs.org's `DECISIONS-2026-10-05.md` §4 keeps from it under a delegation. So the departure stays recorded and not accepted, and the record PR after this merge records B3.c as `validated` with release state `deployed`, not `accepted`. A later owner ruling on the Firefox half, or a run of it where Playwright's Firefox starts, can move it to `accepted`.

The preregistration accepts its reading of "released" with an approval
"given in reply, with no other answer", and records "any other answer" as
given. This reply approves the merge and also hands the open questions to
the programme to settle.
[DECISIONS-2026-10-05.md](../../programme/DECISIONS-2026-10-05.md) §4 keeps
the programme from accepting its own unit's reading or departure under a
delegation, so this record goes further than that paragraph on the first
question: neither the reading of "released" nor the first-use drive's
unrun Firefox half is accepted. B3.c is recorded `validated`, release
`deployed`, with `blockedBy` naming the owner's acceptance of both, or, for
the Firefox half, a run of it where Playwright's Firefox starts. So a run of
that half alone would not move B3.c to `accepted`, as the paragraph said it
could. The production evidence below stands either way.

The owner accepted both on 6 November, and on 7 November main's next passing
Site Check in place of one on the merge ("The owner's acceptance (6 and 7
November)", below).

### The merge and its deployment

- Vercel built `dpl_5L1BPzRrw9QY9DmaJUnf7KzzoiVz` from the merge for
  production from 03:54:04Z. It was READY at 04:02:16Z, the zodiacs.org
  alias moved to it then, and the merge's Vercel status turned to success
  at 04:02:17Z.
- The alias was read three times through the Vercel connector (team
  `team_Ue0ac8HT1b3TAzaDDZBTFhQt`, project
  `prj_nRTO3q3aNYLfaM3dotAowOc028fO`), each time with the deployment it
  named. Each record keeps only `deploymentId`, `aliasUpdatedAt`,
  `readyState`, `target` and `githubCommitSha`, and `recordedAt` is when it
  was written down:
  - [alias-before.json](production/alias-before.json), 03:57:46Z:
    `dpl_7oWVdoEKjmaUWqGw9AVJPYH45dFT`, built from `e632fe4c`, while the
    merge's deployment was building;
  - [alias-at-merge.json](production/alias-at-merge.json), 04:04:38Z: the
    merge's deployment, before the checks;
  - [alias-after.json](production/alias-after.json), 04:05:33Z: the same
    deployment, with the same `updatedAt`, after them. The alias did not
    move during the checks.
- The site serves no commit of its own: the service worker's cache version
  is a digest of the files it caches. The build identity is the commit
  Vercel records for the deployment the alias names, which check 1 reads,
  and it is `2f2a5669` itself.

### The production check

[tools/production-check.mjs](tools/production-check.mjs) ran from the
programme's clone of the site on a Mac16,10 (Apple M4, arm64) under macOS
27.0.1 with Node 22.22.2, with the merge as `<commit>` in every run. The
tool and `scripts/check-time-atlas.mjs` it imports are the merge's (blobs
`e11df9ae` and `4c375b09`, the same at the head `25e5216a`, which was
checked out for the first run):

```sh
M=2f2a56699c10a8d1de1b2b5a731d0122a0a11ff2
node tools/production-check.mjs production/alias-before.json $M production/control-before.json
node tools/production-check.mjs production/alias-at-merge.json $M production/production-at-merge.json
TIME_ATLAS_CHECK_CONTROL=one-byte node tools/production-check.mjs production/alias-at-merge.json $M production/control-one-byte.json
TIME_ATLAS_CHECK_CONTROL=engine-c4e70330 node tools/production-check.mjs production/alias-at-merge.json $M production/control-engine-c4e70330.json
TIME_ATLAS_CHECK_CONTROL=row-removed node tools/production-check.mjs production/alias-at-merge.json $M production/control-row-removed.json
```

| report | against | read at | passed | failing | preregistered |
| --- | --- | --- | ---: | --- | --- |
| [control-before.json](production/control-before.json) | zodiacs.org at `dpl_7oWVdoEKjmaUWqGw9AVJPYH45dFT` (`e632fe4c`), after the merge and before its deployment | 03:58:12Z | 0 of 24 | all | 0 of 24 |
| [production-at-merge.json](production/production-at-merge.json) | zodiacs.org at `dpl_5L1BPzRrw9QY9DmaJUnf7KzzoiVz`, built from the merge | 04:04:55Z | 24 of 24 | none | 24 of 24 |
| [control-one-byte.json](production/control-one-byte.json) | the same, expecting README.md with its last byte changed | 04:05:03Z | 23 of 24 | 18, README.md | 23 of 24, README.md failing |
| [control-engine-c4e70330.json](production/control-engine-c4e70330.json) | the same, comparing with raw GitHub at engine `c4e70330` | 04:05:12Z | 23 of 24 | 18, README.md | 23 of 24, README.md failing |
| [control-row-removed.json](production/control-row-removed.json) | the same, with the first difference row removed from the served page before check 3 | 04:05:14Z | 23 of 24 | 3 | 23 of 24, check 3 failing |

- The window between the merge and its deployment was caught, so the
  control before the deployment ran after the merge, with the merge as
  `<commit>`: the same command that then passed. The preregistration's
  other form of that control, before the merge with the head as
  `<commit>`, was not needed.
- At the merge's deployment, `/developers/time-atlas/` answered 200 as
  `text/html; charset=utf-8`, 411,624 bytes, SHA-256
  `ec72b4d0e40cbe6b630a7872cf5d55f2a4a6301301bf2056fc4f5cc06325f818`, and
  the page check as the merge holds it found no problem in its viewer,
  licence or corrections parts. The correction form's definition at engine
  main is named "Atlas correction".
- Each of the 17 files answered 200 with its media type and
  `charset=utf-8`, and its body had the index's SHA-256 and the bytes that
  the merge holds and that raw.githubusercontent.com serves for engine
  `7307665b`. `files.json` answered 200 as `application/json;
  charset=utf-8` with the merge's bytes.
- `/developers/` links the page, `sitemap.xml` lists it with the lastmod
  2026-11-01, and `llms.txt` and `llms-full.txt` give its address.
- With the first difference row removed, the page check reported 112
  problems, all in its viewer part, as check-dist did for the same fault on
  the local builds.
- Production sent `Access-Control-Allow-Origin: *` with each of the 17
  files, where the local preview server sent none and the preregistration's
  default was no CORS header for the folder. `vercel.json`, which this unit
  did not change, has no rule for these paths (its
  `Access-Control-Allow-Origin` rules name `/api/v1/` and two registry
  files), and the same header came with the 404 answers in the control
  before the deployment, so it does not come from a rule of this
  repository.

### Main's Site Check on the merge

[Run 41769911262](https://github.com/zodiacs-org/site/actions/runs/41769911262),
the Site Check of the merge's push to main, failed on its first attempt: 20
of its 21 jobs passed, and Build & Check failed at its step "Verify AI
integration candidates" on one test outside this unit,
`src/ai-tools/features/horoscope-period.test.ts`, "gives the week's
reading, and for love that week's love readings and the sky that bears on
love". The test fixes its clock at 2 November 2026 and expects that week's
love readings to include one dated 2 November. It reads the committed
horoscope window, which the daily edition of 4 November (`e632fe4c`, the
merge's first parent) rewrote, and the readings it finds now start on 3
November. #862 changed none of the files the test reads. On this machine
the same test fails in the same way at `e632fe4c`, before the merge, and at
the merge itself. The result comes from committed data, not from timing,
so it is no flake, and a rerun of the same commit would fail again; none
was made. The production record's fourth condition, main's Site Check
passing on the merge, is therefore not met, for a reason outside this
unit. B3.c is recorded `validated` either way (above). On 7 November the
owner accepted main's next passing Site Check, run 41806876561 on
`0bf69bd5`, in its place (below).

### C1 after the merge

`git rev-list --reverse 2f2a5669^1..2f2a5669^2` lists 20 commits. The
first, `572ea3d3`, adds only PREREGISTRATION.md, with author and commit
dates of 2026-11-01T07:30:14+07:00; the earliest date of the other 19,
author or commit, is 07:39:06+07:00 the same day. The merge kept the record
first in main's history.

### The owner's acceptance (6 and 7 November)

DECISIONS-2026-10-05 §4 keeps the programme from accepting its own unit's
reading or departure under a delegation, so B3.c waited for the owner
(above). On 6 November at about 16:25 ICT the owner was asked, in the
session, in one question:

> One more item that only you can settle: B3.c, the time atlas dataset. It has
> been live on zodiacs.org since 4 November, with its comparison viewer, under
> CC BY 4.0. To count it as accepted (the ledger would go from 48.2% to 49.3%
> once #900 merges), it needs two approvals. First, that 'released' means
> published permanently on zodiacs.org at /developers/time-atlas/0.1.0/ in
> files that never change, without a separate GitHub release, tag or DOI.
> Second, the same Firefox gap you approved for rc.2: its first-use check could
> not run Firefox on this Mac, though the Chromium half passed. Do you approve
> both?

The options offered were "Approve both" (B3.c recorded accepted in the next
record pull request, after site#900), "Add a GitHub release" ("released"
should also mean a GitHub release and tag; B3.c stays validated until it
exists) and "Not now". The owner answered **"Approve both"**.

Preparing this record showed a third open item that the question had not
named: the production record's fourth condition, main's Site Check passing
on the merge, which run 41769911262 did not meet (above). Main's next
passing Site Check was
[run 41806876561](https://github.com/zodiacs-org/site/actions/runs/41806876561)
on `0bf69bd5` (#877, which changed the failing test), created at 09:21:58Z
on 4 November, 21 of 21 jobs on its first attempt. The same test had failed
main's run 41744586321 on `e632fe4c`, before the merge. Of the 54 files #862
changed, only `docs/claims/ledger.json` and `src/pages/sitemap.xml.ts`,
which other pull requests change too, changed between `2f2a5669` and
`0bf69bd5`; no atlas file, page or test of this unit did. On 7 November at
about 15:22 ICT the owner was asked, in one question:

> A correction on B3.c (the time atlas): besides the two things you
> approved, its record has one more unmet condition. The site's automatic
> check failed on the B3.c merge itself, on a horoscope test that has
> nothing to do with the atlas. That test was already failing before the
> merge and was fixed on main about 5.5 hours later. The check passed on
> that fix, with every atlas file unchanged. Do you accept that later pass
> in place of a pass on the merge?

The options offered were "Yes, accept it" (B3.c recorded accepted, with
this departure stated) and "No, keep validated" (B3.c stays validated, the
record stating the unmet condition). The owner answered **"Yes, accept
it"**.

- **What it accepts.** The preregistration's reading of "released": atlas
  0.1.0 served by zodiacs.org production under
  `/developers/time-atlas/0.1.0/`, cited by its index `files.json`, in files
  that never change, with no tag, GitHub release or DOI. The first-use
  drive's unrun Firefox half as a departure from the site gates ("Open for
  the owner"). Run 41806876561 on `0bf69bd5` in place of a passing Site
  Check on the merge.
- **What it changes.** B3.c is recorded `accepted`, release `deployed`,
  with no `blockedBy` (`docs/platform/programme/acceptance-ledger.json`):
  89.95 of 182.45 weighted units, 49.301 per cent, from 87.95, and Frontier
  bets (first slices) from 32 of 41 to 34 of 41. The weight blocked on the
  owner or outside action goes from 5 (2.740%) to 3 (1.644%).
- **What it leaves open.** Nothing of B3.c. No tag, GitHub release, DOI or
  deposit was made ("Not done").

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
- The owner's rule for the engine clone was broken four times: three times
  when the unit was scoped, before the preregistration, and once in the
  build. When the site was mapped, two `git status --short` runs in the
  clone, and when the build plan was drafted, one
  `git -C <engine> status --porcelain`, checked that the clone was clean;
  each compared the whole working tree with its index, the folder included,
  printed nothing and opened no file of the folder. In the build, after the
  local
  runs of the production check, one `git -C <engine> status --porcelain` was
  run to see that the clone was clean. It compares the clone's whole working
  tree with its index, `docs/evidence/calc-sidereal-2026-10-05/` included,
  and the owner's rule leaves that folder out of every recursive scan. It
  printed nothing, and no file of that folder was opened or printed by hand.
  Every other read of the clone in the build and its review was `git show`,
  `git ls-tree`, `git cat-file` or `git archive` of `atlas/`,
  `git show -s HEAD` to confirm its HEAD, or, in the review, the root
  `LICENSE` and `.github/ISSUE_TEMPLATE/atlas-correction.yml`, listed by name
  without recursion, the first lines of the `LICENSE` blob included. The
  fixes after each review, and the second review, did not read the clone.
  This goes in the pull request's body and to the owner.

## Open for the owner

- The first-use drive's Firefox half. The site gates require the handover's
  full list to pass before every push, and the list includes the two hub
  drives run locally. `npm run test:firstuse:browser` runs the first-use
  drive in Chromium and in Firefox. Chromium passed 44 of 44. No CI workflow
  runs the drives, so nothing else covers the Firefox half, and that gate
  has not passed. With the owner's permission (1 November 2026), the
  clone's own Playwright (`playwright-core` 1.61.1) installed the Firefox
  build it expects, Firefox 151.0, build 1532 (98.8 MiB downloaded). On this
  Mac, macOS 27.0.1, that build does not start headless: run on the build of
  `7a7702a5`, the drive stopped at Firefox's launch after 180 s, Firefox
  having printed `sandbox_extension_issue_file_to_process failed ...
  Operation not permitted` and `RenderCompositorSWGL failed mapping default
  framebuffer`. A one-page launch outside the command sandbox, with
  Firefox's own sandboxes switched off (`MOZ_DISABLE_*_SANDBOX=1`), stopped
  the same way at the compositor error. So the Firefox half could not be
  run here. It goes in the pull request's body as a departure from the site
  gates, for the owner to accept.

The owner accepted this departure on 6 November ("The owner's acceptance (6
and 7 November)", in "Production").

## The independent review

The review read the branch at `d0e413a8` and reported seven problems. Six
are answered by the commits named below; the fourth is the owner's:

1. Six sentences about time handling on the page had no claims record: four
   were reworded and all six recorded, as "Sentences the extractor misses"
   says (`eeee0b60`).
2. No test held the 108 differing rows to their 31 rules, versions and
   flags: test 7 does, with a control (`1263020a`).
3. This README said the engine clone was read only with `git show`,
   `git ls-tree`, `git cat-file` and `git archive`, and that nothing in the
   excluded folder was read or searched: the C3 section and "Departures"
   record the build's `git status` (`4f7af81f`), and the scoping's (this
   commit).
4. The first-use drive's Firefox half has not passed: Firefox, installed
   with the owner's permission, does not start on this Mac, so it is a
   departure for the owner to accept (see "Open for the owner").
5. A failure of the published bytes named only the path: each now also says
   that the files of 0.1.0 never change and that a changed atlas is
   published as a new version, at its own path (`a7178ce4`).
6. The page check missed zero-padded dash references, a change entry's
   version, the comparison rows' cells and the periods' result cells: it
   reads each now, references without their semicolon too, and test 12
   plants each (`61875dc9`).
7. The final private search was not recorded: it is, under "The private
   search" (`be6728d5`).

A second review read the branch at `be6728d5`. It found the first, second,
fifth, sixth and seventh problems fixed as stated, the third fixed with one
overstatement left, and the fourth rightly left open for the owner. Its
smaller items were answered after it:

- The page check still accepted four faults of the sixth problem's kind: a
  rule entry showing another version, or another flag, than its attributes
  give, a difference naming another explanation than the one it links, and
  a difference with its two offsets swapped. Since `823ed051` the check
  reads each period row's first six cells in order, the explanation each
  difference's result cell names, and the version and flag each rule entry
  shows beside its title and reason, and test 12 plants each of the four
  faults.
- A change to files.json, itself a file of 0.1.0, did not fail with the
  fifth problem's message: since `823ed051` test 4 holds its 4,837 bytes and
  its SHA-256, and says that the files of 0.1.0 never change.
- This README overstated how the engine clone was read, did not record the
  review with its answers, and called the Firefox half the seventh problem.
  The commit that adds this section corrects the C3 section, "Departures"
  and "Not done", replaces the local runs with runs against the build of
  `823ed051`, and records the private search over the branch to `823ed051`.

The second review's other items need nothing in the branch: the pull
request's body and the notice to the owner (the Firefox half and the
`git status` departure), a count in a hand-off note, and scratch files
outside the repository.

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
  answer six of its seven problems, and the fourth, the first-use drive's
  Firefox half, could not be run here and is the owner's to accept (see
  "Open for the owner").
