# Breaker review of the changelog evidence audit, site side (ZOD-152)

A second session tried to break the audit in this folder against the issue's
four tests. Done 13 November 2026 on branch
`audit/fable-job8-changelog-evidence` at `965ceecd6`. It adds this file only.
Nothing was pushed, published, tagged, merged or moved, and no pull request
was edited. The engine's half, with pull request 91's test release, is in the
engine repository, `docs/evidence/changelog-audit-20261112/BREAKER.md`.

## Verdict

**No blocker. The site's R1 to R4 results survive**, with the should-fix
items below.

| Test | Result | Why |
| --- | --- | --- |
| R1, inventory | holds | No tag, no GitHub release and no changelog of the site's own, confirmed again. One public surface was missed (S1). |
| R2, every line marked | holds | 43 rows recounted: 30 supported, 1 not supported, 12 unchecked. One unchecked row can be settled (S2). |
| R3, one list | holds | The one listed line is contradicted by git history, as the audit says. |
| R4, nothing published or moved | holds | See below. |

## What was checked again

**R4.** `git ls-remote origin 'refs/tags/*'` returns nothing, and GitHub
lists 0 releases and 0 tags for the site. Pull request 1014 is an open draft
at `965ceecd6`. The audit's commit changes only files under
`docs/platform/evidence/changelog-audit-20261112/`, is authored by Zodiacs
Admin, and neither it nor the pull request's text names a tool or a model.
Engine pull requests 91 and 92 are still at `ce4ba826` and `255b615b`.

**The ZIP rewrite finding (row S-pkg-03).** Rebuilt from git history on
`origin/main`: 63 ZIPs in `integrations/packages/` (65 with the two under
`history/`), and 13 of them have had more than one content, with the audit's
counts: Developer 0.3.13 (38), 0.3.12 (9), 0.3.14 (8), 0.3.3 (7), 0.3.10 (6),
0.3.6, 0.3.11 and 0.3.19 (5 each), 0.3.9 (4), 0.3.7 (2), and Zodiacs 0.5.0
(4), 0.5.1 (4) and 0.4.0 (2). The sentence came in with `de7372e6c`
(2026-11-02 01:55 +07), which is an ancestor of all five commits that changed
`zodiacs-developer-0.3.19.zip` on 2026-11-03, and each of those commits'
README already carried it. The finding holds.

One thing strengthens it. The refusal in
`scripts/package-ai-integrations.py` ("already exists with other bytes; use a
new version") came in with `5ff8cea53` on 2026-11-02, 22 minutes before
the sentence. So 0.3.19 was rewritten four times on 3 November while the
script already refused to do that, which means the file was removed first or
the script was not what wrote it. The sentence describes the script
correctly; "every earlier ZIP keeps its bytes" is the part git contradicts.

**Other rows opened again, all of which hold.** 17 archives in `vendor/`.
Zenodo's public API for record 23080134 on 13 November 2026: both DOIs, the
creation time to the microsecond, version `v0.1.1-rc.15`, published, one file
of 3,151,916 bytes, MD5 `f993fcd18500064ef8ad51155451fe9e` (rows S-ghrel-03
and 04). The engine's one tag and release (S-ghrel-01 and 02). npm's four
versions and their times (S-vendor-03 to 06, S-adopt-05).

## Findings

### Blockers

None.

### Should fix

**S1. The public correction log is not in the inventory (R1).**
`/corrections/` (`src/pages/corrections/index.astro`, data in
`src/data/corrections.json`) is a public, dated log of "material corrections
to astronomical facts, astrology explanations, and daily editions", each with
what was wrong, the correction and "the date the corrected version shipped".
It is the nearest thing the site has to public release notes, and neither
the inventory's "What the site has" nor its "Not checked" table names it.
It holds one entry. That entry was checked here: `people-b-f-skinner-sun-sign`,
corrected 2026-07-27, says the profile was withdrawn; the entry came in with
`c73d087a3` on 2026-07-27 (pull request 175, "withdraw one profile"), and
`src/data/people.json` has no `b-f-skinner` today. Supported. The page's
"launched 2026-07-19" and the entry's account of the cause were not traced.

**S2. Row S-adopt-06 can be settled.** The audit left five commit ids
unchecked as "probably sdk-repository commits". Four are: GitHub returns
`97f5e8d0` (2026-09-07, "Validate public birth flags and capture civil
settings"), `33336925` ("Freeze engine rc.5 reviewed package artifact"),
`785e3ea1` ("Record exact rc.5 consumer and browser acceptance") and
`51129a19` (2026-09-08, "Retain immutable engine rc.6 review archive") from
`zodiacs-org/sdk`, each matching what the record calls it. The fifth,
`03142a4d9a78733876137f611586d7482793bee6` in `site-engine-rc16/README.md`
line 55 ("MCP rc.16 local archive: carrier"), is not a commit in the sdk,
engine or site repository. It stays unchecked and should be named as not
found, since the record presents it as a carrier commit.

### Notes

- N1. `public/developers/engine/reference/release/README.txt` is a second
  published copy of an engine README (1.1.0-rc.2's, "not published"), beside
  the `public/sdk/engine/` reference the inventory does name. It is generated
  from the vendored archive, and its statement agrees with npm.
- N2. The inventory's reason for leaving out the developer pages and
  `llms.txt` ("checked by the site's own claims tests") was not tested here.
- N3. The observation that `vendor/README.md` is silent on npm for rc.14 and
  rc.15 (row S-vendor-07) is fair as an omission and is not a wrong line.

## Limits of this review

It sampled. The 12 unchecked rows, which stand for about 3,700 lines of
adoption records and package notes, are still unchecked apart from S2. No
build or test was run on the site. No submission portal was contacted.
