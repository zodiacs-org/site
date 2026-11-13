# Site release notes, line by line (ZOD-152, R2)

Checked on the site repository at `origin/main` `23b1884b6374086491cbb69dd40a1dd9e50551f3`, 12 and 13 November 2026.

The site has no changelog of its own, no git tag and no GitHub release (see `INVENTORY.md`). What stands in for release notes is checked here: the vendored engine changelog, the two records of engine releases, the vendor list, the release-identity statements of the fifteen adoption records, and the notes for the AI tools packages.

43 rows: supported 30, not supported 1, unchecked 12.

Status has three values. **supported**: a source other than the note itself was opened in this audit and says what the line says. **not supported**: the evidence contradicts the line. **unchecked**: not verified here, with the reason. The engine's own changelog is checked in the engine repository, `docs/evidence/changelog-audit-20261112/`; rows here that cite "the engine audit" mean that folder.


## Vendored engine changelog: `public/sdk/engine/media/CHANGELOG.md` (24 lines, all checked)

6 rows: supported 4, not supported 0, unchecked 2.

| ID | Claim | Status | Evidence opened | What it shows, or why unchecked |
| --- | --- | --- | --- | --- |
| S-vend-01 | line 3: "## 0.1.1-rc.1 — unreleased candidate" | supported | npm lists no 0.1.1-rc.1 (versions: 0.1.1-rc.14, rc.15, rc.16, 1.0.0); `vendor/zodiacs-engine-0.1.1-rc.1.tgz` exists (21,374 bytes, SHA-256 `f95c887d...`) with `package.json` version 0.1.1-rc.1 | Unpublished, as it says. |
| S-vend-02 | the file as a whole is the engine's rc.1 changelog | supported | `diff` of lines 3 to 24 against the `CHANGELOG.md` packed inside `vendor/zodiacs-engine-0.1.1-rc.1.tgz`: no difference; against the 0.1.1-rc.1 entry of the engine's `CHANGELOG.md` on main (lines 2029 to 2052): two sentences differ in wording only ("No ownership SDK API changes." against "The API of the earlier package in github.com/zodiacs-org/sdk is unchanged."; "SDK PR #5" against "pull request #5 of that repository") | It is the entry as packed in rc.1. The engine reworded those two sentences later (its 0.1.1-rc.14 entry says earlier entries now name the repository). `git log`: the file came in with `40d3f9647` on 2026-09-08 and has not changed. |
| S-vend-03 | lines 7 to 8: "allow up to 64 iterations" | supported | the rc.1 archive's `dist/chunk-ATHPYVIF.js` has a loop bound `< 64` | A 64-step bound is in the packed code. The convergence test and the 66-degree limit were not traced. |
| S-vend-04 | lines 5 to 6, 9 to 16: the other six bullets (polar ascendant, input rejections, contract regressions, crossing bounds, coarse-sample crossing, years below 100) | unchecked | none | Behaviour of the rc.1 code, not run. Same text as the engine rows E-0.1.1-rc.1-28 to 34. |
| S-vend-05 | lines 18 to 21: migration note | unchecked | none | Advice. |
| S-vend-06 | lines 23 to 24: "Release holds remain in SDK PR #5. This entry records implementation, not publication" | supported | `gh api repos/zodiacs-org/sdk/pulls/5`: open, draft, not merged; npm lists no 0.1.1-rc.1 | Still true on 13 November 2026. |

## GitHub release and DOI record: `docs/platform/evidence/engine-github-release-2026-10-01/README.md` (48 lines, all checked)

10 rows: supported 7, not supported 0, unchecked 3.

| ID | Claim | Status | Evidence opened | What it shows, or why unchecked |
| --- | --- | --- | --- | --- |
| S-ghrel-01 | line 8: GitHub release "ID 400849502, published 2026-10-01T10:13:53Z, title `0.1.1-rc.15`" | supported | GitHub API (`gh api repos/zodiacs-org/engine/releases`, saved in the engine audit's `raw/github-releases.json`): id 400849502, `published_at` 2026-10-01T10:13:53Z, name `0.1.1-rc.15` | Exact match. |
| S-ghrel-02 | line 9: tag `v0.1.1-rc.15` "points exactly to commit `93ebae9f...`. It remains a prerelease, with draft=false; no manual assets were attached"; "lightweight" | supported | `git ls-remote` of the engine: `93ebae9fa54597aeaafbb346873f7f51e3cc6cb6 refs/tags/v0.1.1-rc.15` with no peeled `^{}` line (so not an annotated tag); API: `prerelease` true, `draft` false, `assets` empty | Match. |
| S-ghrel-03 | line 10: "Version DOI 10.5281/zenodo.23080134 ... concept DOI 10.5281/zenodo.23080133. The API reports submitted=true, created 10:13:57.901413Z" | supported | Zenodo public API, `https://zenodo.org/api/records/23080134`, read 13 November 2026: `doi` 10.5281/zenodo.23080134, `conceptdoi` 10.5281/zenodo.23080133, `submitted` true, `created` 2026-10-01T10:13:57.901413+00:00, status published, version `v0.1.1-rc.15` | Exact match. It is the only version under the concept record. |
| S-ghrel-04 | line 11: "Zenodo's source ZIP is 3,151,916 bytes, MD5 `f993fcd18500064ef8ad51155451fe9e`"; "All 605 files match" (the count) | supported | Zenodo API `files[0]`: size 3151916, checksum `md5:f993fcd18500064ef8ad51155451fe9e`; `git ls-tree -r 93ebae9` in the engine lists 605 files; `source-binding.json`: `zipFiles` 605, `gitFiles` 605, no missing, extra or mismatched | Size, MD5 and file count match. |
| S-ghrel-05 | line 11: the ZIP's SHA-256 `d1c050ed...`; "match the tagged Git blobs byte for byte" | unchecked | `source-binding.json` records it | The ZIP was not downloaded again, so its SHA-256 and the byte comparison rest on the recorded file. |
| S-ghrel-06 | lines 13 to 17: the owner approved; how it was published; "No new grants, tokens, payment, package publication or npm dist-tag change was performed" | unchecked | none | Not checkable from the repositories. |
| S-ghrel-07 | lines 21 to 25: "GitHub normalized 367 LF line endings to CRLF: raw body 25,192bytes/SHA-256 `7fb38091...`; normalizing CRLF to LF yields the exact approved 24,825bytes/SHA-256 `4703e1b1...`" | supported | recomputed from the API's `body`: 25,192 bytes, SHA-256 `7fb380910f3e24f0a3f62b77bfc89d1d1968321881fd2f523c1e9be33df33a8c`, 367 CRLF pairs; after normalising 24,825 bytes, SHA-256 `4703e1b1435142cab100caa542aef94486f1e8cf04b2cfe8e29f77d1a6163700` | Exact match. The release body has not been edited since. |
| S-ghrel-08 | lines 26 to 27: "The complete rc.15 changelog is included; its historical heading is explicitly contextualized, not rewritten" | supported | the body's entry equals the engine's 0.1.1-rc.15 entry at `93ebae9` and on main (23,574 characters each, compared by script); the body's preface says the heading "describes when those notes were written" | Match. |
| S-ghrel-09 | lines 37 to 38: "The preexisting `.zenodo.json` primary license is MIT" | supported | the engine has `.zenodo.json` (added 2026-09-28, before the release); Zenodo API `metadata.license.id` `mit-license` | Match. The description's other licence scopes (lines 38 to 40) were not compared. |
| S-ghrel-10 | lines 3 to 4 (G4's gate is met), 29 to 33 (the JSON files and the script), 41 to 48 (scope, Software Heritage, what stays open) | unchecked | the three JSON files and `verify-source.py` exist | Programme statements and items the record itself says are not complete. |

## Engine release state of 16 September 2026: `docs/platform/evidence/engine-release/README.md` (103 lines)

5 rows: supported 4, not supported 0, unchecked 1.

| ID | Claim | Status | Evidence opened | What it shows, or why unchecked |
| --- | --- | --- | --- | --- |
| S-engrel-01 | lines 12, 17 to 18, 22 to 23: `@zodiacs/engine@0.1.1-rc.6`; "`vendor/zodiacs-engine-0.1.1-rc.6.tgz`, 23 files, 36,591 packed bytes"; SHA-256 `09c3e634...`; equals the recorded `.sha256` | supported | `sha256sum`, `stat` and `tar -tzf` of the vendored file: `09c3e63432f8ba2e9df05af137c42f65ab039740a207a89418d9e6470ea3db3e`, 36,591 bytes, 23 members; `vendor/zodiacs-engine-0.1.1-rc.6.sha256` holds the same digest | Exact match. |
| S-engrel-02 | line 16: source commit `fb57af7a2cd7c30983cc8fb655183d5a11f9cf30` in the sdk repository | supported | `gh api repos/zodiacs-org/sdk/commits/fb57af7a...`: exists, dated 2026-09-08, "Correct historical local-time gap and fold precision in engi..." | The commit exists. The branch name was not checked. |
| S-engrel-03 | lines 37 to 42, 60: "`@zodiacs/engine` is **not on the public registry**" on 16 and 17 September 2026 | supported | npm `time.created` for the package is 2026-09-30T11:45:35Z (engine audit `raw/npm-view-engine.json`) | True on its date: the package first appeared on npm two weeks later. The record is dated, so it is not marked out of date; a reader today should know that rc.14, rc.15, rc.16 and 1.0.0 are now on npm and that rc.6 never was. |
| S-engrel-04 | lines 14, 61: "`@zodiacs/sdk@1.0.1` is already published" | supported | `npm view @zodiacs/sdk version`: 1.0.1 | Match. |
| S-engrel-05 | lines 24 to 33 (the clean install and its chart figures), 44 to 92 (the authentication blockers and the options), 94 to 103 (what is not claimed) | unchecked | none | A session's observations and plans; not re-run. 70 lines. |

## Vendor list: `vendor/README.md` (303 lines)

8 rows: supported 6, not supported 0, unchecked 2.

| ID | Claim | Status | Evidence opened | What it shows, or why unchecked |
| --- | --- | --- | --- | --- |
| S-vendor-01 | lines 9 to 13, 42 to 46, 72 to 76, 94 to 97, 131 to 134: for 1.1.0-rc.2, 1.1.0-rc.1, 1.0.0, 1.0.0-rc.2 and 0.1.1-rc.17, the artifact SHA-256, packed bytes, file count, unpacked bytes, source commit, carrier commit and the merge commit with its pull request number (#82, #75, #39, #26) | supported | checked by script: each digest and size equals the file in `vendor/`; file counts and unpacked sums recomputed from each archive (90 / 1,096,783; 77 / 1,006,494; 74 / 991,915; 74 / 989,528); each source commit equals the engine's `artifacts/archives.json`; each carrier commit is a commit that changed that archive's path in the engine; each merge commit's subject names the stated pull request and is an ancestor of engine `main`; each `.sha256` receipt holds the file's digest | Every identity statement matches. |
| S-vendor-02 | the SHA-256 given for each older archive (rc.16, rc.15, rc.14, rc.10, rc.9, rc.8, rc.7, rc.6, rc.5, rc.1, 0.1.0, rc.0; lines 173 to 300) | supported | each of the twelve digests equals the SHA-256 of the corresponding file in `vendor/` (script) | Match. |
| S-vendor-03 | lines 3 to 7: 1.1.0-rc.2 "is a **vendored candidate, not on npm**" | supported | `npm view @zodiacs/engine versions`: no 1.1.0-rc.2; `latest` 1.0.0, `next` 0.1.1-rc.16 | Match on 13 November 2026. |
| S-vendor-04 | lines 67 to 70: 1.0.0 "published ... to npm under `latest` on 2026-10-11 (run 38144970198, with SLSA provenance), and npm's tarball is these bytes" | supported | npm `time["1.0.0"]` 2026-10-11T13:54:56Z, `latest` 1.0.0; `sha1sum vendor/zodiacs-engine-1.0.0.tgz` equals npm `dist.shasum` `72b7a026...`; the engine's `docs/evidence/1.0.0-20261011/publication/release-run-38144970198-publish.log` exists | Date, tag, bytes and run number match. The provenance attestation was not verified again. |
| S-vendor-05 | rc.16 section: "npm has carried it under `next` since 2026-10-01, and its tarball is these bytes" | supported | npm `time["0.1.1-rc.16"]` 2026-10-01T12:02:05Z, `next` 0.1.1-rc.16; SHA-1 of the vendored file equals `dist.shasum` `f57e312b...` | Match. |
| S-vendor-06 | 0.1.1-rc.17 section: "(vendored candidate, not on npm)"; "Archive: 70 files, 273,123 packed bytes, 946,349 unpacked bytes"; last section: "Neither candidate was published to npm" (0.1.1-rc.0 and rc.1) | supported | npm lists none of rc.17, rc.0, rc.1; the rc.17 file is 273,123 bytes with 70 members and 946,349 unpacked bytes | Match. |
| S-vendor-07 | the rc.15 and rc.14 sections' silence on npm | unchecked | npm has carried both since 2026-09-30 | Not a wrong statement: these two sections say nothing about npm, while the sections for 1.0.0 and rc.16 do. Recorded as an omission. |
| S-vendor-08 | the rest of the file: what each release added, blob ids, licence notes, rollback notes, the `(merged by ...)` short ids of the rc.14 and rc.15 sections | unchecked | `93ebae9f` is the engine's rc.15 merge; `8deda244` appears in the rc.14 adoption record | About 230 lines of description not checked line by line; they restate the engine changelog, which is checked in the engine audit. |

## Site adoption records: `docs/platform/evidence/site-engine-*/README.md` (15 files, 3,416 lines). These are evidence records, not changelogs; only their release-identity statements were checked.

7 rows: supported 5, not supported 0, unchecked 2.

| ID | Claim | Status | Evidence opened | What it shows, or why unchecked |
| --- | --- | --- | --- | --- |
| S-adopt-01 | in each of the twelve records that give one (rc.5, rc.6, rc.7, rc.8, rc.9, rc.10, rc.14, rc.15, rc.16, rc.17, 1.0.0-rc.2, 1.1.0-rc.2): the engine archive's SHA-256 | supported | by script, the first SHA-256 in each README equals the SHA-256 of that version's file in `vendor/` | Match in all twelve. |
| S-adopt-02 | the packed sizes they give (36,065; 36,591; 39,252; 51,748; 55,576; 87,415; 190,974; 266,934; 273,123; 287,011; 288,063; 292,721 bytes) | supported | each equals `stat` of that version's vendored file | Match. |
| S-adopt-03 | engine source and carrier commits named in the records for rc.7 to 1.1.0-rc.2 | supported | each 40-character id named near the top of those records is a commit object in the engine repository (`git cat-file -t`) | They exist. Whether each is the right commit was confirmed for the versions that `vendor/README.md` also lists (vendor-01). |
| S-adopt-04 | `site-engine-rc15/README.md` line 404: npm shasum `e4a49148b2cedc1c21fdba324e83b76f6d6b4862` | supported | equals `sha1sum` of the vendored and carried rc.15 archive and npm's `dist.shasum` | Match. |
| S-adopt-05 | publication status as each record states it: rc.5, rc.6, rc.7, rc.8, rc.9 "unpublished candidate"; rc.10, rc.14, rc.15 "does not record ... npm publication"; rc.17 "not on npm"; 1.0.0-rc.2 "rc.17, rc.1 and rc.2 are not published"; 1.0.0 "on npm under `latest`, and `next` still names rc.16" | supported | npm registry on 13 November 2026 | Each agrees with the registry for the version it speaks of. The rc.7 to rc.9 records' "`npm view @zodiacs/engine` returns 404" was true on their dates (the package first appeared on npm on 2026-09-30) and is not true now. |
| S-adopt-06 | commit ids in `site-engine-rc5` (lines 8, 9, 13), `site-engine-rc6` (line 5, `51129a19...`) and `site-engine-rc16` (line 55, `03142a4d...`) | unchecked | not objects in the engine or site repositories | Probably sdk-repository commits or other digests; not looked up. |
| S-adopt-07 | everything else in the fifteen records | unchecked | none | About 3,400 lines of adoption evidence (test totals, deployments, page checks). Outside a changelog audit; not reached. |

## AI tools packages: `integrations/packages/README.md` (102 lines) and `manifest.json`. These are the site's only versioned releases of its own.

7 rows: supported 4, not supported 1, unchecked 2.

| ID | Claim | Status | Evidence opened | What it shows, or why unchecked |
| --- | --- | --- | --- | --- |
| S-pkg-01 | lines 86 to 87: "Current candidates are **Zodiacs 0.6.6** and **Zodiacs Developer 0.3.41**; `manifest.json` identifies their archive ... hashes" | supported | `manifest.json`: zodiacs-sky 0.6.6 and zodiacs-developer 0.3.41; each ZIP's byte size and SHA-256 recomputed and equal to the manifest; `src/ai-tools/contracts.ts:21` `AI_VERSION = '0.6.6'`; plugin manifests say 0.6.6 and 0.3.41 | Match. |
| S-pkg-02 | every version the README names has its ZIP | supported | 10 Zodiacs versions (0.4.0, 0.5.0, 0.5.1, 0.6.0 to 0.6.6) and 29 Developer versions (0.3.3, 0.3.6, 0.3.7, 0.3.13 to 0.3.16, 0.3.20 to 0.3.41) named; all 39 ZIPs exist in `integrations/packages/` | Match. |
| S-pkg-03 | lines 18 to 20: "`ai:package` never rewrites an archive that already exists: a change needs a new version, so every earlier ZIP keeps its bytes." | not supported | `git log -- integrations/packages/<zip>` and the blob at each commit: 13 of the 63 ZIPs have had more than one content, among them `zodiacs-developer-0.3.13.zip` (38 different contents, 2026-10-14 to 2026-10-27), `zodiacs-developer-0.3.14.zip` (8, to 2026-11-02), `zodiacs-developer-0.3.19.zip` (5, all on 2026-11-03), `zodiacs-sky-0.5.0.zip` (4) and `zodiacs-sky-0.5.1.zip` (4, to 2026-10-27); the sentence was added on 2026-11-02 (`de7372e6c`) | Not true of every earlier ZIP: several were rewritten under the same version, and 0.3.19 was rewritten on the day after the sentence was written. It does hold for every ZIP from Developer 0.3.20 and Zodiacs 0.6.0 on, each of which has a single content in history (pkg-04). |
| S-pkg-04 | the individual "keeps its bytes" statements for 0.3.15, 0.3.20 to 0.3.40 and Zodiacs 0.6.0 to 0.6.5 | supported | each of those ZIPs is touched by exactly one commit in `git log` | Match. |
| S-pkg-05 | lines 72 to 73: "With PR #915 (8 November 2026) the hosted server ... refuses a birth date less than 13 years ago" (the pull request and date) | supported | `gh pr view 915 --repo zodiacs-org/site`: merged 2026-11-08T05:14:47Z, "Refuse birth dates under 13 in the hosted tools" | Match. The behaviour was not run. |
| S-pkg-06 | `manifest.json` `status`: "Unpublished review candidates ..."; lines 16 to 17 "not evidence of upload, acceptance or listing"; "0.5.1 was in OpenAI review on 28 October" | unchecked | none | Directory and review status live outside the repository; no submission portal was contacted. |
| S-pkg-07 | what each version changed (tool counts such as "19 tool definitions", switches, wording, pictures) | unchecked | `src/ai-tools/release-060.test.ts` exists and pins 0.6.6 | About 70 lines; tool definitions were not diffed version by version. |
