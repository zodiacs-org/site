# The time atlas released as a dataset, with a diff viewer (B3.c): preregistration

Written on 1 November 2026 (Asia/Bangkok), before any page, published file
or test of this unit exists. The branch's first commit adds this file and
nothing else.

When it was written:

- Site main was `0d3ee7958e9d9fb18de5b2aa1571642f7f02a216` when this was
  written, and `54deb7e80b46a16def4c31aae5c9c59d2acb79b0` when it was
  committed; the second adds the daily edition of 1 November to the first
  and changes none of the files this unit adds or changes. Neither has
  `src/pages/developers/time-atlas/` or `public/developers/time-atlas/`, and
  that morning, at 03:39 and again at 04:27 (21:27 UTC on 31 October),
  zodiacs.org answered 404 for `/developers/time-atlas/` and for
  `/developers/time-atlas/0.1.0/data/atlas.json`.
- The atlas is `atlas/` in zodiacs-org/engine at commit
  `7307665bdbc432269fdac006104f661be16000bc`, the commit the site's atlas
  reading is pinned to (`ATLAS_COMMIT`). Its git tree,
  `8e1bc174cafdb8c09ee7986cae4527cdbac18e9a`, is the same at the B3.a merge
  `056bcd1a` and at engine main `a2539735`.
- The site carries the tree's ten data files in `src/data/time-atlas/`, as
  the same git blobs, and no byte-identical copy of its other 20 files:
  `src/lib/time-atlas/lib.mjs` is `atlas/tools/lib.mjs` with its header and
  loader changed for the site.
- Every count in this record was read from that tree before it was written,
  and the atlas's own checks had already been run on an extract of it. The
  counts describe the input, B3.a's accepted atlas, not a result of this
  unit, and none of them is a threshold this unit could tune. C3 to C5
  repeat them on the bytes this unit commits.

This record fixes what "released" means, the exact files, the licence and
attribution text, the correction process, what the viewer must show, how the
excerpts' dashes and the two tzdb findings are handled, every check with a
control that must fail, the production record, and the defaults the owner may
change. Anything the build cannot meet as written here is a departure: the
pull request and the evidence README state it, with its reason, before the
merge is asked for. The file set and the viewer's content are not narrowed
after the build.

## The unit and its gate

Ledger unit B3.c, "Published atlas dataset and a diff viewer", weight 2,
depends on B3.a. Gate: "dataset released under CC BY or ODbL with a diff
viewer". Its source is the brief's B3
([ENGINE-AND-PLATFORM-BRIEF.md](../../ENGINE-AND-PLATFORM-BRIEF.md) §4.1),
which takes "tzdb with backzone as the base", says the atlas "is published
under CC BY or ODbL, with a reviewed correction process", gives as its first
slice "the published dataset and a diff viewer", sets the rule "wherever the
atlas overlaps tzdb, every difference is explained", and asks to "accept
outside submissions only with citations".

The licence is decided: CC BY 4.0, and where GeoNames data is included, its
CC BY attribution is kept with a link to the licence and a note of changes
([DECISIONS-2026-09-28.md](../../programme/DECISIONS-2026-09-28.md) §6 and
§7; §7 answers brief §10.10). The atlas's schema makes the manifest's licence
the constant `CC-BY-4.0`. ODbL is not used.

B3.a's ledger notes record the atlas as not yet "published as a dataset with
a diff viewer (B3.c)". So the copies already public do not count as this
release: `atlas/` on engine main since 29 September 2026, and the engine's
Zenodo record 10.5281/zenodo.23080134 of the prerelease v0.1.1-rc.15, a
software record with MIT metadata whose archive holds the same atlas files.
The page gives no DOI for the atlas and does not present that record as one.

## What "released" means here

"Released" is the ledger's word for the gate; the brief's word is
"published".

- **Released** means published by zodiacs.org production under a versioned
  path whose files never change, `/developers/time-atlas/0.1.0/`, named for
  the manifest's `version`. The folder has no page of its own: a folder's
  address answers 404 on zodiacs.org, as `/developers/sky-benchmark/v0/`
  does. So the version is cited by its index,
  `https://zodiacs.org/developers/time-atlas/0.1.0/files.json`, and by the
  page that shows it, `https://zodiacs.org/developers/time-atlas/`. The
  ledger records release state `deployed`.
- **Files that never change.** After the first release no byte of a 0.1.0
  file is edited, no file is removed and none is added. A test fails on any
  change and says to publish a new version. A changed atlas is published
  only as a new version, at its own path beside 0.1.0, by its own site
  change. If the engine changes `atlas/` without changing the manifest's
  version, the site publishes nothing.
- **Not required:** a tag, a GitHub release, a DOI, or a deposit with
  Zenodo, Hugging Face or Kaggle. Each is the owner's to make. Datasets with
  DOIs are reach item X-7, outside the denominator.
- **If the owner asks for one of those,** B3.c is recorded `validated`,
  release `deployed`, with `blockedBy` `{ "owner": true, "action": ... }`
  naming that act, the form the ledger's other owner-blocked units use, until
  the act is done and recorded. The production evidence stands either way.
- **Where this reading is accepted.** The merge is the owner's decision,
  given as an explicit approval for this pull request, and the request for
  that approval carries the question at the end of this record. An approval
  given in reply, with no other answer, accepts this reading, as P4.2's
  stated departure was accepted with the approval of its merge; any other
  answer is recorded as given. The record pull request quotes the reply. The
  reading is put to the owner before any result exists, which is what
  DECISIONS-2026-10-05 §4 asks of a reading of the programme's own work.
- **The first release** of the atlas as a dataset is the production
  deployment that first serves the files under
  `/developers/time-atlas/0.1.0/`. CORRECTIONS.md says "The log starts with
  the first release", so its log starts there. The manifest's
  `"released": "2026-09-28"` is the atlas's own date for version 0.1.0, and
  the page never gives it as the date of publication.

## The files

The folder holds the sixteen files `atlas/LICENSING.md` puts under CC BY 4.0
and the licence's text, 17 files of 396,147 bytes, and `files.json`, the
site's index of them: 18 files in all. In the repository they are
`public/developers/time-atlas/0.1.0/<served path>`, and zodiacs.org serves
them at the same paths under `/developers/time-atlas/0.1.0/`. Each of the 17
is a byte-for-byte copy of its source in the atlas tree at `7307665b`. The
SHA-256 values were computed with `shasum -a 256` on an extract of that tree
(`git archive`) and on the blobs `git cat-file` gives for the same paths; the
two agree for these 17 files and for all 30 files of the tree. The git blob
id is a second identity for the same bytes.

| served path, under `/developers/time-atlas/0.1.0/` | source path at `7307665b` | bytes | SHA-256 | git blob |
| --- | --- | ---: | --- | --- |
| `data/atlas.json` | `atlas/data/atlas.json` | 1,720 | `4104e88dfc5b1eaaa1789e5c6c260a290c0d27c1878f39fd54df472355dcb7de` | `97d557d641efdae56ae337e2b03ba3f2bb618849` |
| `data/places.json` | `atlas/data/places.json` | 6,659 | `1c1366ae622ffed271ee2717454a5e723253ad28f5b1b444086e571664ef00db` | `7bf219585a7f9b70686872536510803426f51348` |
| `data/leads.json` | `atlas/data/leads.json` | 1,703 | `f247caf33ee57ff7708dc496cf1c5f2cece41f274f2969e4f2616840c462d54b` | `2985ffd094e4a9059079c805c50a21ab38785bb4` |
| `data/citations-fr.json` | `atlas/data/citations-fr.json` | 32,315 | `3b91f1e679cbb67e1bcb381979d0e21a51842671e339b901d21cfeb652b06b5a` | `aa8880404324cfd640eac51429dbd2a66c094c43` |
| `data/rules-fr.json` | `atlas/data/rules-fr.json` | 36,487 | `f6922563cf13ecb679cb152b04bddb73103c20f9ac1a445d80e106a9e11d53be` | `485a27d06feb474c68ad5cae2d2fc0467072d97c` |
| `data/citations-als.json` | `atlas/data/citations-als.json` | 16,769 | `5102d32cb2f1a588d569fc3aa57d8e9ebcdaa28843b90cab19c56b54a8f96f3b` | `c3f3a7e8a94fbfbdcd4507c90fa64945b9303f32` |
| `data/rules-als.json` | `atlas/data/rules-als.json` | 26,340 | `6cff3b85bfaf32555dec81399044a8f3e1cba2712d129637635330733807fa20` | `44c734f5d0d13f6757c00f7d8735a1114fa7ed69` |
| `data/citations-us.json` | `atlas/data/citations-us.json` | 20,505 | `0c06ad3a6255083814b3ddad19c6ef6a7dbdfd8e1b3d004c8bc182836df1dd3b` | `2328c3e490f5d1dd55a384ae16616747f09eb649` |
| `data/rules-us.json` | `atlas/data/rules-us.json` | 49,068 | `be300c2a1961f982500e6cbe57cd5c4165b8235da32655001886443f8d2648b4` | `d7de5df948e87582c8d87821b43080ec4d64d77e` |
| `data/tzdb-explanations.json` | `atlas/data/tzdb-explanations.json` | 15,913 | `3035f49a9c018b9164be6c64b8f85969bf4fcb7a1bd8d1d06395af541dc56fba` | `8215f08af3834c9d7ce567e6985fce7b8eae640e` |
| `tzdb/differences.json` | `atlas/tzdb/differences.json` | 42,949 | `46efb73ea6264200b54e86ad979bc5e50a0b932ee589aa1986e84eef1ff957dc` | `bb415cd19d1e9ac35b05f83f38a81f81f6e64b3c` |
| `TZDB-DIFFERENCES.md` | `atlas/TZDB-DIFFERENCES.md` | 84,517 | `1fbf2d47a168fc2626a630cbcf8384e284e3aa8d7dffd1a6d05267cba4486a53` | `1d649e371335ddb1e6b8b920bc358c76458bd707` |
| `README.md` | `atlas/README.md` | 11,078 | `ba480ca8860e163ef6ba7ebbcf773881e36085e94d99a1bdf00f029e35868cea` | `604ab3d59008517992e6efae72aeed72dbfa2382` |
| `COVERAGE.md` | `atlas/COVERAGE.md` | 22,736 | `375e2aa1cf6bc2428ff713628c4b53391db5957257b0e1130e8eff7e6e61de75` | `7a826c1a159b608e3ffd9c2029c1d05ce6e7886b` |
| `CORRECTIONS.md` | `atlas/CORRECTIONS.md` | 5,837 | `362be60dfcccec7e7c9c71594e313378b603d1b90e5499caf1e948da3e3d0013` | `464b21fc5f97f507583b67ce93572d9eeb6cbc61` |
| `LICENSING.md` | `atlas/LICENSING.md` | 2,894 | `7ba4edc0d9862a7e534057e0ecc3fc426b0cef41f38f2c5edb6b5e53ceb438fc` | `b9d2b546309d01c0eecbbf28b8359be70ae939c6` |
| `LICENSE.txt` | `atlas/LICENSE` | 18,657 | `9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411` | `da6ab6cc8f333d7e89a99812866df8f24374d47c` |

- **The index.** `files.json` is written once, by a script kept outside the
  repository, from the 17 files: its schema name, the atlas's name and
  version, the licence and its URL, the source (repository, commit, tree and
  path `atlas`) and, for each file in the table's order, its served path,
  source path, bytes, SHA-256 and git blob. It does not list itself, has no
  engine source and is not an atlas file. C2 holds every field of it to the
  files, and its own bytes and SHA-256 are recorded in the evidence README
  when it is written.
- **Layout.** The tree's layout is kept (`data/`, `tzdb/`, the documents at
  the top), so the documents' references to one another keep their meaning.
  The one rename: `LICENSE` is served as `LICENSE.txt`, so that it is served
  as text, as the engine reference serves its `LICENSE`
  (`scripts/engine-reference/build.mjs`). Its bytes do not change, and the
  page's file table shows the two names.
- **Media types.** Production serves `.json` as `application/json`, `.md` as
  `text/markdown` and `.txt` as `text/plain`, each with `charset=utf-8`, as
  it served `/developers/sky-benchmark/v0/items.json`,
  `/developers/conventions.md` and
  `/developers/engine/reference/release/LICENSE.txt` on 1 November. The local
  preview server sends the same types without the charset parameter, so the
  production check compares the type everywhere and requires the parameter
  only on zodiacs.org.
- **Two copies.** The ten `data/` files are the bytes of
  `src/data/time-atlas/`, and a test holds the two copies together. The page
  renders from the published copies, as the sky benchmark's page does, so
  what it shows is what is served.
- **Not published.** `atlas/schema/atlas.schema.json` and `atlas/tools/` are
  not part of the CC BY dataset: they are MIT, and their licence text is the
  engine repository's root `LICENSE`, outside `atlas/`.
  `atlas/tzdb/tzdb-2025c.json`, the public-domain tzdb extract the
  comparison uses, is not copied either. That follows a reading of
  CLAUDE.md's rule against keeping a copy of the engine's tables as covering
  it; the rule is written about local-time conversion, so this is this
  record's default, put to the owner below, not a settled rule. The page
  links each at `7307665b`. If the owner wants the schema or the extract
  served, they go in before the merge: after the first release the 0.1.0 set
  is fixed.
- **The `$schema` lines.** Every data file opens with
  `"$schema": "../schema/atlas.schema.json"`, a path in the engine
  repository. The bytes cannot change, so the page says so beside the file
  table and links the schema at `7307665b`.
- **Reproduction** is the engine repository's: at `7307665b`,
  `node atlas/tools/check.mjs` rebuilds the comparison from the data and the
  extract, and fails if either published comparison file differs;
  `node atlas/tools/compare-tzdb.mjs --check` does the same for the
  comparison alone. Without `--check`, compare-tzdb.mjs rewrites the two
  files, so it is never run that way here.

### One copy instead, if the private search requires it

The private birth-data search (site gates, below) must report 0 matching
lines added. If the only matching lines the published copies add are copies
of lines already in `src/data/time-atlas/`, the ten data files are served
instead by one prerendered endpoint over `src/data/time-atlas/`
(`src/pages/developers/time-atlas/0.1.0/data/[file].ts`), byte for byte, and
`public/developers/time-atlas/0.1.0/` holds the other seven files and
`files.json`. The served paths, bytes and digests do not change, and C2 then
checks the built folder in `dist/`. Any other matching line stops the work,
and the owner gets the counts only.

## Licence and attribution, as the page states them

The page carries this text. Parts in braces are rendered from
`data/atlas.json` unchanged.

1. The Zodiacs.org historical time atlas, version 0.1.0, is licensed under
   the Creative Commons Attribution 4.0 International licence (CC BY 4.0),
   https://creativecommons.org/licenses/by/4.0/. The licensor is Zodiacs.org.
   The licence's text is LICENSE.txt in the version's folder.
2. Cite it as: Zodiacs.org historical time atlas, version 0.1.0,
   https://zodiacs.org/developers/time-atlas/ (its files are listed in
   https://zodiacs.org/developers/time-atlas/0.1.0/files.json), from
   https://github.com/zodiacs-org/engine/tree/7307665bdbc432269fdac006104f661be16000bc/atlas,
   licensed CC BY 4.0. Cite the rule ids and versions you relied on.
3. {longitudeSource.attribution} {longitudeSource.dataset},
   {longitudeSource.url}, retrieved {longitudeSource.retrieved}, SHA-256
   {longitudeSource.sha256}, licensed under {longitudeSource.license},
   {longitudeSource.licenseUrl}. Changes: {longitudeSource.changes}
4. The atlas's tools and its schema, in atlas/tools/ and atlas/schema/ of the
   engine repository, are under the MIT licence, whose text is that
   repository's LICENSE. They are not among the files published here.
5. As far as the atlas could establish, every text its citations quote is in
   the public domain, and LICENSING.md says why for each kind of source. The
   licence covers the atlas's own work, not the texts it quotes, and no scan
   or OCR text of a source is copied.
6. The tzdb 2025c extract the comparison uses, atlas/tzdb/tzdb-2025c.json in
   the engine repository, is in the public domain like tzdb itself. It is
   linked here, not published.

The citation names the commit. The published README's own form cites
`tree/main`, which moves; the README stays as published, so both forms will
circulate until a later version changes it. The Dataset markup gives the same
licence (C7).

The site repository is all rights reserved except the parts its LICENSE
lists, and the atlas is not among them yet. LICENSE gains this entry under
"Parts with their own terms", and README.md's licence paragraph names the
atlas to match:

> The Zodiacs.org historical time atlas, in src/data/time-atlas/ and
> public/developers/time-atlas/ (its files and their index), is licensed
> under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Its
> places.json carries place names and coordinates from GeoNames under
> CC BY 4.0, as its atlas.json records. src/lib/time-atlas/lib.mjs is the
> atlas's resolver, under the MIT licence, with its loader changed for the
> site. Their source is
> https://github.com/zodiacs-org/engine/tree/7307665bdbc432269fdac006104f661be16000bc/atlas.

The entry is the same under the one-copy fallback, when the ten data files
are served from `src/data/time-atlas/`.

## Corrections

The process is the atlas's own, as `atlas/CORRECTIONS.md` at `7307665b` and
the issue form `.github/ISSUE_TEMPLATE/atlas-correction.yml` (blob
`cb9817f5085ba305a290e8c0002a3fa061d199fe`, unchanged at engine main) set it
out:

- a correction is accepted only with a primary source, a stable URL, a page
  and column, and a verbatim excerpt in the original language;
- a reviewer fetches the source and reads the passage;
- the rule's version goes up with an entry in its `changes`, and a rule is
  never edited in place;
- `check.mjs` and the self-test must pass, `compare-tzdb.mjs` is rerun, and
  the correction is logged.

A correction reaches the atlas only through an engine merge the owner makes.
The site adds no correction route of its own, and its `wrong-chart` form is
not used for the atlas. The page states:

> To correct the atlas or add to it, open an Atlas correction issue in
> zodiacs-org/engine, or a pull request there, giving the rule id (or the
> place and period), what the clock showed and when it changed, with the
> clock the change is read on, and a citation to a primary source: its type,
> title, date and issuer, a stable link, the page and column, its language,
> and a verbatim excerpt of at most 40 words in the original language.
> Issues there are public. CORRECTIONS.md says how a correction is reviewed.
> The copy in this version's folder is frozen; the live one, with its log, is
> on the engine's main branch. An accepted correction gives the rule a new
> version, and the site publishes the changed atlas only as a new version, at
> its own path. The files of 0.1.0 never change.

Its links: "Atlas correction issue" to
`https://github.com/zodiacs-org/engine/issues/new?template=atlas-correction.yml`;
"CORRECTIONS.md" to `/developers/time-atlas/0.1.0/CORRECTIONS.md`;
"the live one" to
`https://github.com/zodiacs-org/engine/blob/main/atlas/CORRECTIONS.md`.

## What the viewer must show

The viewer is the page `/developers/time-atlas/`, one Astro page. It counts
as the gate's diff viewer only if its HTML, as the server sends it, with no
script run, holds all of this:

1. **The base.** tzdb 2025c with backzone, built by the L3 recipe: tarball
   SHA-256 `4aa79e4effee53fc4029ffe5f6ebe97937282ebcdf386d5d2da91ce84142f957`,
   compiled tree of 598 files
   `98ba2bd3eb549fced32814888318d478c96eb65d5fa5b482ee1d89ebb298bcc5`. The
   window is 1870-01-01T00:00:00 to 1920-01-01T00:00:00, local time. A
   difference is a period in which the offsets differ by one second or more.
   Civil time is compared; the railway clocks the atlas records are not.
   Times are UTC.
2. **The 23 comparisons**, from TZDB-DIFFERENCES.md's Summary: each place's
   name and id, the zone, whether the zone is the place's own (`tzdbZone`) or
   a second zone shown for information (Strasbourg and Metz against
   Europe/Berlin), and its periods compared, agreeing, differing and rounding
   only, and its days differing. In all: 287 periods, 178 agree, 108 differ,
   1 rounding only; 22 comparisons have a difference.
3. **All 108 differing periods**, from `tzdb/differences.json`, each exactly
   once and each with its own anchor, in its comparison's table (item 7),
   whose heading gives the place (name and id) and the zone, marked as for
   information on the 10 Europe/Berlin rows. The row gives from and to in
   UTC, as the file gives them, milliseconds kept; the atlas rule's id, its
   version and its uncertainty flag (documented, inferred or uncertain, from
   the rules files); the atlas offset; the tzdb offset with its abbreviation;
   the difference in seconds, atlas minus tzdb; and the id of its one
   explanation, linked to it.
4. **All 11 explanations**, from `data/tzdb-explanations.json`, each with its
   id as its anchor, its category, its text as the atlas gives it, the number
   of periods it explains (the counts in C5, adding to 108) and links to its
   citations. Each of the 37 citations they cite appears once, with its own
   anchor: id, title marked with its language, date, issuer and publication
   where given, locator, link, and the English gloss where the atlas has one
   (13 of the 37).
5. **The two findings about tzdb**, as fixed below.
6. **Agreement**, from TZDB-DIFFERENCES.md: for each comparison, the spans in
   which the atlas and tzdb agree to within a second, 77 spans in all; and
   New York's one rounding-only period, 1870-01-01T04:56:01.620Z to
   1883-11-18T17:00:00Z, rule `us-nyc-city-time-before-1883`, atlas
   -4:56:01.620, tzdb -4:56:02 LMT, 380 ms, with why it is not a difference
   (tzdb stores whole seconds).
7. **Every period**, side by side: the 287 rows of TZDB-DIFFERENCES.md's
   "Place by place" tables, in its order, 23 tables of one comparison each,
   every row with its from and to in UTC, its length, the atlas rule's id,
   version and flag, the atlas offset, the tzdb offset with its abbreviation,
   and its result: agrees, rounding with its milliseconds, or the difference
   in seconds with its explanation linked.
8. **Every rule's version history.** All 59 rules of the three rules files,
   each with its id as its anchor, its title, version, flag and reason, and
   every entry of its `changes` (version, date, summary): 45 entries on 38
   rules; the other 21 rules have none.
9. **The files**: the table of the 17 files and `files.json` (served path as
   a link, source path, bytes, SHA-256), the note on the `$schema` lines,
   and the reproduction route.
10. **No script needed.** All of 1 to 9 is in the HTML the server sends. The
    page adds no island, no script and nothing loaded from another site to
    what the base layout loads.

Agreement, the rounding-only period and every period can be derived from
committed data, so they are required. `differences.json` holds only the 108
differences, but TZDB-DIFFERENCES.md, one of the published files, lists every
period of every comparison (its Summary, "Where they agree" and "Place by
place" tables), and C5 holds that listing to `differences.json` row for row.
Computing them on the site instead would need resolver exports that
`src/lib/time-atlas/lib.d.mts` does not declare, and the tzdb extract, which
is not published.

"Diff viewer" is read as this comparison of the atlas with tzdb 2025c with
backzone, the base the brief names for the atlas. A comparison between atlas
versions has nothing to show while 0.1.0 is the only one; what the atlas holds
of its own history, each rule's version and its changes, is item 8, and every
period shows its rule's version.

## The excerpts and their dashes

Each of the 66 citations carries a verbatim excerpt in its source's
language. Eight excerpts hold nine em dashes, as their sources print them:
seven in `data/citations-fr.json`, one of which holds two, and one in
`data/citations-als.json`. No other field of the atlas, and none of its
documents, holds an em or en dash. The excerpts quote public-domain sources
and cannot change.

So the page does not render excerpts. For each citation it shows what item 4
lists, as the compute API's atlas citations already do (id, title, date,
link, locator, gloss), and the excerpts stay in the published files, byte
for byte. The page, the hub card, the two llms blocks and this record contain
no em or en dash. C6 fails on either character anywhere in the page's HTML,
raw or as a character reference, and one of its controls inserts the excerpt
of `fr-jo-1891-03-15-law`, which holds one.

## The two tzdb findings

Two explanations carry a `tzdbReport`. In `fr-summer-time-end-hour` it
begins "An apparent error in tzdb." In `de-reich-law-1893-instant` it begins
"A difference between the legal instant and tzdb's entry, not a shown
error." CORRECTIONS.md at `7307665b` says "Nothing has been sent; the owner
decides whether to send them."

On the page, each appears inside its explanation, after the explanation's
text, under the label "Finding about tzdb 2025c, not sent to the tz project",
and is quoted whole, as the atlas states it. The page's own words about them
are that label and these two sentences, before the explanations: "Two
explanations end with a finding about tzdb 2025c, quoted as the atlas states
it. At version 0.1.0 neither had been sent to the tz project." The page does
not shorten, reword or rank them, does not call the second an error, and says
nothing of what the tz project would do. Publishing the atlas does not send
them; sending them stays the owner's decision. If the owner sends either, the
page changes in the pull request that records it. C6 fails if a label or a
finding's text is missing, and one of its controls removes a label.

## Claims records

Every public sentence about time handling needs a claims record.

- **Scope.** The page and its helper are under `src/pages/developers/`, a
  trust path read with the full list. The hub card is in a trust file, and
  the two llms files are dense. The page joins `DENSE_FILES` in
  `scripts/claims-ledger-lib.mjs`, where the engine page already is, so a
  block with one selected sentence is recorded whole. That is a list entry,
  not a trigger, so `LEXICON_VERSION` stays 2 and no existing record changes.
- **Records.** Every selected sentence gets a record: a claim, or an
  exemption from the closed list. A new claim, `product.time-atlas-dataset`,
  sorted between `product.sky-fact-aspects` and `time.ai-horoscope-window`,
  status `supported`, states only what C2 to C7 and the production record
  show. Its evidence: the titles of `tests/time-atlas-dataset.test.ts`, data
  items pinning the published files' SHA-256, an external item for the
  engine tree at `7307665b` with the date it was read, and code items for
  the page check. It binds the version, the licence line and the counts.
  Sentences that restate the compute API's reading point to
  `time.atlas-reading`.
- **Sentences the extractor misses.** Every sentence the site writes about
  time handling on these surfaces must be among those selected and recorded.
  One the extractor does not select cannot carry a record, so it is cut, or
  rewritten to name what it is about (tzdb 2025c, a time zone, a mean time),
  which brings it under the extractor, and then recorded. None goes out
  without a record.
- **The atlas's own words.** What the page renders from the published files
  (the explanations, the two findings, rule and citation titles, reasons,
  change summaries, glosses) and the 17 files themselves are the atlas's
  statements, cited to primary sources and checked by the atlas's checks
  (B3.a). C2, C5 and C6 hold them unchanged. The "Not read" comment in
  `scripts/claims-ledger-lib.mjs` gains the served atlas files with that
  reason, as `SCOPE_DROP` already gives it for `src/data/time-atlas/`.

## Where the change goes

New:

- `docs/platform/evidence/time-atlas-dataset-20261101/`: this record; a
  README that records C3 and C4's output, the test titles, the claims counts
  (selected, on existing claims, on the new claim, exempt), the local runs of
  the production check with their controls, and the review with its answers,
  and gains its production section after the merge; `tools/engine-bytes.mjs`
  (C3) with its two reports; the output of C4 and of its controls;
  `tools/production-check.mjs`; `local/`, the local runs, committed before the
  pull request opens; `production/`, added by the record pull request;
- `public/developers/time-atlas/0.1.0/`: the 17 files and `files.json`;
- `src/pages/developers/time-atlas/index.astro`: the page and its viewer, in
  one Astro file with page-scoped styles;
- `src/pages/developers/time-atlas/_atlas.ts`: pure functions over the
  published files that make the rows, joins and counts; it holds no prose;
- `scripts/check-time-atlas.mjs`: the folder check (C2) and the page check
  (C6), run by `scripts/check-dist.mjs` and by the production check;
- `tests/time-atlas-dataset.test.ts`: C2, C5 and the unit tests of C6's
  checks.

Changed:

- `src/pages/developers/index.astro`: one card, with no engine version,
  digest or source commit literal;
- `src/pages/sitemap.xml.ts`: an appended entry, and lastmods for
  `/developers/time-atlas/` and `/developers/` dated with the edition the
  branch last took from main (`src/data/daily.json`'s date), which is never
  later than the edition the merge's build reads;
- `scripts/check-dist.mjs`: the sitemap total, main's figure plus one (1452
  to 1453 at `54deb7e8`), and the time atlas block that runs C2 and C6;
- `scripts/check-developer-authorship.mjs`: the route, and the 18 files as
  required outputs;
- `scripts/developer-structured-data-checks.mjs`, its test and
  `scripts/validate-schema.mjs`: the contract (C7);
- `scripts/claims-ledger-lib.mjs` (the `DENSE_FILES` entry and the "Not
  read" comment) and `docs/claims/ledger.json`: as above;
- `api/_assistant/context.ts`, regenerated, and
  `scripts/build-assistant-context.test.mjs`: staticPages and consumerRoutes
  each main's figure plus one (74 to 75 and 713 to 714 at `54deb7e8`);
- `public/llms.txt` and `public/llms-full.txt`: one block each;
- `tests/platform-developers-drive.mjs` and
  `tests/developer-first-use-drive.mjs`: the new card;
- `LICENSE` and `README.md`: the atlas entry.

Not touched: any file or folder of the Phase 1 template digest, as
`tests/visual/phase1-evidence-contract.mjs` lists them. Among them are
`src/lib` (with `src/lib/time-atlas/` and
`src/lib/developer-structured-data.mjs`), `src/components`, `src/islands`,
`src/layouts`, `src/styles`, `package.json`, `package-lock.json`,
`astro.config.mjs` and `tsconfig.json`. The digest stays
`1e81c55f05d4bb03924d102d0e835c55e93dcc48d2c6ae5506decc99541736a1`, and none
of the 18 Phase 1 captures is retaken. What keeps the design outside it: the
tests live under `tests/`; the licence URL is the existing
`SKY_DATA_LICENSE`, imported unchanged; nothing calls a resolver export that
`lib.d.mts` does not declare, because agreement, rounding and every period
come from TZDB-DIFFERENCES.md; no component or stylesheet is added; no npm
script is added. If a touch proves unavoidable, it is a departure, and the
pull request names the path and its cost: the 18 captures retaken by the
pull request's Browser Evidence run and committed with their provenance.

Also not touched: `ATLAS_SOURCE`, `ATLAS_COMMIT` and the bundles that embed
them, `vercel.json`, `CLAUDE.md`, the programme ledger's files, and the
engine repository.

Out of scope: a Markdown twin (brief §3.4 asks one for every developer page;
that is Track 3's step, not this gate's), links from the compute and MCP
pages, a Lighthouse route, a header rule in `vercel.json`, an engine change
(the README's `tree/main` citation and the manifest's date stay as
published), and the playground bundle's header, which carries the atlas data
without naming the atlas; the evidence README records that gap for a later
change.

Copy rules, beyond the voice rules and no dashes: the page names the base as
tzdb 2025c with backzone; it says the 108 are 98 against each place's own
zone and 10 against Europe/Berlin for information; it names the compute API's
time endpoint in words and links `/developers/compute/`, never its path
(`tests/api/compute-api-privacy.test.ts`); it says nothing about analytics,
since the base layout loads them on indexable pages; and it keeps the site
dark only, with the site's own tokens and no theme of its own.

## Checks, each with a control that must fail

**C1. This record comes first.** Passes when
`git rev-list --reverse origin/main..HEAD` before the merge, or
`git rev-list --reverse <merge>^1..<merge>^2` after it, starts with a commit
that adds only this file, and that commit's author and commit dates are
earlier than those of every later commit in that list. The merge is a merge
commit, so the order stays in main's history. *Control:* the same check with
its base set to that first commit takes the next commit as the first. That
commit adds other files, so the check must fail.

**C2. The published bytes** (`tests/time-atlas-dataset.test.ts`, run by
`npm test`). Passes when `public/developers/time-atlas/0.1.0/` holds exactly
the 17 paths of the table and `files.json`, none missing, none extra and none
a symbolic link; each of the 17 has its bytes and SHA-256; `files.json`
states for each its source, size, SHA-256 and git blob, and the commit and
tree they came from; and each `data/` file equals `src/data/time-atlas/` byte
for byte. Under the one-copy fallback the same holds for the built folder in
`dist/`, checked by `scripts/check-dist.mjs`. *Controls,* in the same file,
on a temporary copy of the folder: README.md with its last byte changed;
`data/leads.json` removed; `schema/atlas.schema.json` added; README.md
replaced by a symbolic link; one data file differing from its `src/data`
copy; `files.json` with one file's size wrong. Each must fail.

**C3. The bytes are the engine's at `7307665b`.** Passes when each file's
SHA-256 equals that of the blob at its source path, read with `git cat-file`
from an engine clone whose HEAD does not move, and `7307665b:atlas` is tree
`8e1bc174`. It runs when the files are copied (`tools/engine-bytes.mjs` in
the evidence folder), and its report is kept there; production repeats it
against raw.githubusercontent.com. *Control:* the same comparison against
engine `c4e70330751b17f6ebd6322958c270f09f93d3a3` (authored 2026-09-28 UTC,
atlas tree `2b2936eb25159af831f59da7c04c0d952861d1ce`, whose `atlas/`
differs from `7307665b` in README.md and two tools files) must fail exactly
README.md: 16 of 17.

**C4. The atlas's own checks pass on this version.** On a `git archive`
extract of `7307665b`, with Node 22.22.2. Passes when
`node atlas/tools/check.mjs` exits 0 and reports 21 places, 14
jurisdictions, 59 rules and 66 citations, flags 27 documented, 26 inferred
and 6 uncertain, 258 boundaries and 2,735 round trips, and every tzdb
difference matched by exactly one explanation; when
`node atlas/tools/compare-tzdb.mjs --check` exits 0 with 108 differences,
each matched by exactly one explanation, and its files current; and when
`node --test atlas/tools/selftest.mjs` passes 26 of 26. The output is kept
in the evidence folder. *Controls,* on a second extract: one byte of
`tzdb/differences.json` changed, where `check.mjs` and
`compare-tzdb.mjs --check` must both exit non-zero; `fr-paris` removed from
the places
`fr-summer-time-end-hour` matches, where `check.mjs` must exit non-zero,
four periods being left unexplained.

**C5. The viewer's data** (`tests/time-atlas-dataset.test.ts`, on
`_atlas.ts`). Passes when, from the published files alone:

- the 108 rows each join to their rule and to exactly one explanation; 31
  rules appear, with versions 1, 2 and 3 on 46, 44 and 18 rows, and flags
  documented, inferred and uncertain on 54, 32 and 22 rows;
- the periods per explanation are: `fr-summer-time-end-hour` 42,
  `als-mos-german-rule` 24, `fr-own-mean-time-before-1891` 18,
  `als-mos-not-berlin` 8, `us-city-time-before-standard-time` 5,
  `us-standard-time-adopted-later` 3, `als-strasbourg-five-minutes` 2,
  `de-reich-law-1893-instant` 2, `us-city-time-whole-minutes` 2,
  `us-washington-until-1884` 1 and `us-louisville-city-clock` 1, adding to
  108;
- 98 rows are against the place's own zone and 10 against Europe/Berlin for
  information (Strasbourg 5, Metz 5);
- the explanations' 48 citation references resolve to 37 citations;
- the 59 rules carry versions 1, 2 and 3 on 21, 31 and 7 rules and flags
  documented, inferred and uncertain on 27, 26 and 6; 38 of them have
  `changes` entries, 45 in all;
- TZDB-DIFFERENCES.md's Summary gives 23 comparisons and 287 periods (178
  agree, 108 differ, 1 rounding only), 22 of them with a difference; its
  "Place by place" tables give 287 rows in 23 sections, naming 58 rules, with
  the same counts for each comparison, and their 108 differing rows equal
  `differences.json`'s row for row on place, zone, from, to, rule, both
  offsets, abbreviation and seconds; its "Where they agree" table gives 77
  spans;
- the one rounding-only period is New York's, as item 6 gives it.

*Controls,* in the same file, on altered copies of the inputs in memory: one
row removed from `differences.json`; one row's tzdb offset changed; one
explanation removed; one citation id misspelt in an explanation; New York's
rounding row turned into an agreeing one; one rule's flag changed. Each must
fail.

**C6. The page as built and as served.** One function,
`timeAtlasPageProblems` in `scripts/check-time-atlas.mjs`, run by
`scripts/check-dist.mjs` on `dist/developers/time-atlas/index.html` in every
build, and by the production check on the served page. It reads the HTML as
text, with no script run, decodes character references before it compares,
and takes every expected value from the published files, parsed apart from
`_atlas.ts`. It passes when:

- items 1 to 9 are all there: the base's version, digests, file count and
  window, and the definition of a difference and of rounding; the 23
  comparison rows, each with its five counts and its days differing as the
  Summary gives them; the 287 period rows in the report's order, 178
  agreeing, 1 rounding and 108 differing, each differing row with its own
  anchor, in the table of its place and zone, with its from and to, its
  rule's id, version and flag, both offsets, the tzdb abbreviation, its
  seconds and a link to its one explanation, in `differences.json`'s order;
  the 77 agreement spans; the 11
  explanation sections, each with its id, category, count and text as the
  atlas gives it, and links to its citations; the 37 citation entries, each
  once, with its own anchor, its title marked with its language, its date,
  locator and link, and its gloss where there is one; the 59 rule entries
  with their versions, flags and reasons and the 45 change entries; the
  files table, with every file's link, source path, bytes and SHA-256 and
  the link to `files.json`;
- no citation's excerpt is anywhere in the page;
- the licence and attribution text of items 1 to 6 above is there, with its
  `atlas.json` parts verbatim;
- the correction text is there, with its three links;
- both findings are there, each with its label and its text whole, and the
  two sentences before the explanations;
- the JSON-LD holds exactly one Dataset, with `isAccessibleForFree` true
  (the rest of the markup is C7's);
- `<main>` holds no `<script>`, no inline event handler and no image, frame,
  object or media element; the page's `<script>` tags, read in order, are the
  same as those of the sky benchmark's page, on the same layout and from the
  same build or deployment; and nothing outside `<main>` loads from another
  site that the sky benchmark's page does not also load from;
- every in-page link has its target, and no id appears twice;
- no U+2013 or U+2014 is anywhere in the page, raw or as a character
  reference. The sky benchmark's page, as zodiacs.org served it on
  1 November, has none in its 88,048 bytes, and the build minifies the
  layout's inline scripts, whose comments hold dashes, before
  `scripts/check-dist.mjs` reads the page.

*Controls,* run by the production check against the branch's build served
locally, before the pull request opens, each a change made to the fetched
page before it is checked: the first difference row removed; one row's tzdb
offset changed; one explanation's section removed; one finding's label
removed; the excerpt of `fr-jo-1891-03-15-law`, which holds an em dash,
inserted into its citation entry; the GeoNames changes text altered; the
correction form's link removed. Each must fail exactly the check that reads
what it changed: check 3 for the first five, check 4 for the sixth and check
5 for the last. The first runs again in production. The unit tests of
`timeAtlasPageProblems`, in C5's file, plant the same faults in a page they
render from the data.

**C7. Structured data** (`npm run schema:check`, with the page in
`scripts/developer-structured-data-checks.mjs`). Passes when the page carries
its contract as that script checks it: a Dataset with a name and a
description, version `0.1.0`, a url the build serves, the Organization node
as creator, licence exactly `["https://creativecommons.org/licenses/by/4.0/"]`,
temporalCoverage `1870-01-01/1919-12-31`, and a DataDownload with an
encodingFormat for each of the 17 atlas files, exactly those 17 contentUrls,
each a file the build serves; the breadcrumb Zodiacs.org, Developers,
Historical time atlas; one canonical; and the Organization node exactly once.
`files.json` is linked from the page but is not a DataDownload: it is the
site's index, not part of the atlas. *Controls,* in
`scripts/developer-structured-data-checks.test.mjs`: the page's Dataset with
CC0's URL as its licence; with no licence; with version `0.1.1`; with one
contentUrl missing; with a temporalCoverage that carries times; with the
breadcrumb misnamed. Each must fail with the script's own message.

**C8. Claims records.** Passes when
`node scripts/claims-ledger.mjs --unlisted` and `--orphans` both print 0,
`scripts/claims-ledger.test.mjs` (R1 to R10) and
`scripts/claims-bindings.test.mjs` pass, `maxOpenOverstated` stays 11, and
the new claim is `supported`. *Control:* in the work clone, with one of the
new sentence records removed from `docs/claims/ledger.json` and restored
afterwards, `--unlisted` must report exactly 1.

**C9. The Phase 1 receipt still holds.** Passes when the branch's template
source digest, `phase1TemplateSourceSha256` of
`tests/visual/phase1-evidence-contract.mjs`, equals the committed
manifest's,
`1e81c55f05d4bb03924d102d0e835c55e93dcc48d2c6ae5506decc99541736a1`, so
`npm run test:phase1:evidence` passes with no new captures. *Control:* the
same function, with its `readSource` option giving
`src/lib/time-atlas/index.ts` one byte more, must return a different digest.
Nothing is written.

**Site gates.** These keep their own tests and get no new controls here. The
handover's full list must pass before every push, run one after another
under the pinned Node toolchain, after checking free disk space:

- `npm test`; the build, with the frozen clock while the day's edition is
  not yet on main, and its postbuild; `npm run check`;
- `npm run ai:check`, `npm run mcp:build:check`, `npm run mcp:pack:check`;
- `node scripts/build-compute-handler.mjs --check` and
  `npm run data:cities:also -- --check`;
- `node scripts/phase1-scope-guard.mjs --base origin/main`, 0 protected
  paths;
- the four developer-guide checks (twins, browser, examples, Python);
- the two claims-ledger commands, and
  `node scripts/programme-ledger.mjs --check`;
- the two hub drives, updated for the new card, run locally.

The private birth-data search runs counts only, with both pattern sets, over
`<main>..HEAD`, and over each merge's parents when the branch has merged
main. It must report 0 lines added with either set and a tree count equal to
main's. If a published file adds a matching line, the work stops and the
owner gets the counts only; the one-copy fallback above applies only when
every such line copies one already in `src/data/time-atlas/`. CI on the draft
pull request must be green in every job, Sitemap Dates and Developer guides
included.

## The production record

Vercel builds only main, so production is the first place these files are
served, after the merge. The record meets the acceptance standard the
programme has kept for site units since the handover of 2026-10-14, beside
the ledger's own rules ([README.md](../../programme/README.md), "Status and
release"):

1. The pull request is merged, with a merge commit, on the owner's explicit
   approval.
2. The zodiacs.org alias names a READY production deployment built from the
   merge commit. It is read with the Vercel connector's get_alias and
   get_deployment (team `team_Ue0ac8HT1b3TAzaDDZBTFhQt`, project
   `prj_nRTO3q3aNYLfaM3dotAowOc028fO`), and only the deployment id, the
   alias's updatedAt, readyState, target and githubCommitSha are recorded,
   with the time of the read; never the alias's protection bypass key.
   Records: `production/alias-before.json`, `production/alias-at-merge.json`
   and `production/alias-after.json`, read once the checks have run.
3. A production check passes N of N, with controls that show it can fail.
4. Main's Site Check passes on the merge; a documented flake gets its one
   rerun, as AGENTS.md allows.
5. The gate's text is met by evidence the repository reproduces.

The check is `tools/production-check.mjs` in the evidence folder, run as
`node <it> <alias.json|-> <commit> <out.json> [base URL]`, with `-` for a
local run, which has no alias, and `TIME_ATLAS_CHECK_CONTROL=<name>` for a
control. It runs from a clone at `<commit>`, takes every expected byte from
`git show <commit>:<path>` and every expectation about the page from
`scripts/check-time-atlas.mjs` at that commit. It fetches without following
redirects and without cache, hashes decoded bodies, and writes
`{ schema, base, control, commit, deployment, readAt, passed, of, checks }`,
each check `{ name, ok, detail }`. Its 24 checks:

| check | passes when |
| --- | --- |
| 1 | the alias names a READY production deployment whose commit is `<commit>`, or contains it (`git merge-base --is-ancestor`); not run locally |
| 2 | `/developers/time-atlas/` answers 200 as `text/html` |
| 3 | the page holds the viewer's content, no excerpt, no em or en dash and nothing it should not load, and every in-page link has its target (C6: items 1 to 10, the dash rule, the script rule, links and ids) |
| 4 | the page holds the licence and attribution text, and its Dataset markup (C6 and C7) |
| 5 | the page holds the correction text with its three links, and the form's definition at engine main on raw.githubusercontent.com is named "Atlas correction" (the form's own address sends a visitor who is not signed in to GitHub's sign-in page, so it is not fetched) |
| 6 to 22 | one per atlas file: it answers 200 with its media type (the type everywhere, and `charset=utf-8` too on zodiacs.org), and its decoded body has the table's SHA-256 and the same bytes as the file `<commit>` holds for it (`public/developers/time-atlas/0.1.0/<served path>`, or `src/data/time-atlas/<name>` under the one-copy fallback) and as `https://raw.githubusercontent.com/zodiacs-org/engine/7307665bdbc432269fdac006104f661be16000bc/<source path>` |
| 23 | `files.json` answers 200 as `application/json`, with the bytes `<commit>` holds for it |
| 24 | `/developers/` links the page, `sitemap.xml` lists it with a lastmod, and `llms.txt` and `llms-full.txt` give its address |

| report | against | must pass |
| --- | --- | --- |
| `local/local.json` | the branch's build served locally, before the pull request opens | 23 of 23 (no alias) |
| `local/local-controls.json` | the same, under each of C6's seven controls | 22 of 23 each, failing exactly its check |
| `production/control-before.json` | zodiacs.org before the merge's deployment: after the merge if that window is caught, otherwise before the merge, with the pull request's head as `<commit>` | 0 of 24 |
| `production/production-at-merge.json` | zodiacs.org at the deployment built from the merge | 24 of 24 |
| `production/control-one-byte.json` | the same, expecting README.md with its last byte changed | 23 of 24, README.md failing |
| `production/control-engine-c4e70330.json` | the same, comparing with raw GitHub at engine `c4e70330` | 23 of 24, README.md failing |
| `production/control-row-removed.json` | the same, with the first difference row removed from the served page before check 3 | 23 of 24, check 3 failing |

If the alias has moved past the merge's deployment before the check runs,
the check runs on the deployment the alias names, which must contain the
merge, and the report says so (`production/production.json`). The local
reports are committed in the feature pull request before it opens; the
production reports go in the record pull request. After the deploy, the
site's IndexNow workflow submits the new and re-dated addresses on its own;
nothing here triggers it, so the lastmods must be right before the merge.

**The record.** A separate record pull request after the merge, as for
B3.b, sets B3.c `accepted`, release `deployed`, with evidence in B3.b's
form: the pull request, main's Site Check run on the merge,
`production-at-merge.json` with its controls, the test file with its titles,
this record and the evidence README. Its notes begin "Accepted <date>:" and
quote the owner's reply on "released". The id and the weight do not change.
The figures are the ones `node scripts/programme-ledger.mjs --summary` prints
on the record branch, whatever has merged by then. On today's main they would
be 85.95 of 182.45 weighted units, 47.109%; with P4.5 (site#860, weight 6)
accepted first, 91.95, 50.397%; if #860 is settled with P4.5 short of
accepted, 85.95 again. Frontier bets (first slices) goes from 32 of 41 to 34
of 41. The feature pull request does not touch `acceptance-ledger.json`,
`LEDGER.md` or `STATUS.md`. If the owner has asked for a tag, a release or a
DOI, the record is `validated`, release `deployed`, with `blockedBy`
`{ "owner": true, "action": ... }` naming that act: the accepted figure does
not move, and the blocked weight grows by 2 (from 3, 1.644%, to 5, 2.740%,
on today's main).

## How the work runs

- An isolated clone of zodiacs-org/site, branched from origin/main, with its
  own `node_modules`; no git worktree.
- Commits as `admin@zodiacs.org` ("Zodiacs Admin"). No model or personal name
  in any commit, pull request or file.
- One programme pull request per repository at a time: this unit's draft
  pull request opens only after site#860 is settled. Draft site#852 rewrites
  the hub page this unit adds a card to; whichever merges second merges main,
  records the hub's changed sentences again, and dates `/developers/` no
  earlier than the other's date and no later than the edition its own build
  reads, last in `EVERGREEN_LASTMOD`. Sitemap Dates passes a changed page
  whose date is new, or is the edition's own day, so the same day serves
  when both land on one edition.
- Draft pull requests only. The merge is made only on the owner's explicit
  approval for this pull request, with a merge commit: no squash, no rebase,
  no force-push, no empty commits. The pull request's body, and the request
  for the approval, ask the question at the end of this record.
- Heavy builds, full suites, private scans and browser drives run one after
  another, after checking free disk space.
- Before the owner is asked to approve the merge, at least one independent
  review (brief §5): the reviewer gets the pull request, this record and the
  gate, not the author's reasoning, and every finding is answered in the
  pull request.

## Defaults the owner may change

Each default lets the build go ahead; the pull request names them, and an
answer before the merge changes the build. After the first release the
0.1.0 set is fixed, so a change to the files after that is a new version.

- **File set.** The 17 files and the index; the schema (MIT, with the
  engine's root LICENSE) and the tzdb extract (public domain) linked at
  `7307665b`, not copied. Serving them would make the `$schema` lines
  resolve, and changes the index, the Dataset's licence list and
  contentUrls, C2, C7 and the claims records.
- **Excerpts.** Left out of the page, as the compute API's citations leave
  them out; the alternative renders them as quotations marked with their
  language, dashes kept, with C6's dash rule changed for them.
- **The two tzdb findings.** Shown now, labelled not sent; they are already
  public in the engine repository.
- **Cross-origin reads.** No CORS header for the folder; a header rule is a
  hosting change, which needs the owner's specific authorization.
- **Lighthouse.** No route for the page; adding one changes the gate on
  every push.
- **Markdown twin.** None in this unit.
- **Order.** The reordering of 28 October (notes, 02-PLAN-63.md, row 26)
  puts B3.c in its second wave, after the January checkpoint; this unit runs
  now, a departure from that proposed order, not from any rule.

## The question for the owner

Does B3.c's "released" mean what this record reads it as, atlas 0.1.0
served by zodiacs.org production under `/developers/time-atlas/0.1.0/`,
cited by its index `files.json`, under CC BY 4.0, in files that never change
(release state `deployed`), or do you also want a tag, a GitHub release or a
dataset DOI? If you name one, B3.c is recorded `validated`, with `blockedBy`
naming it, until it is done. If you approve the merge and name none, that
approval accepts this reading.
