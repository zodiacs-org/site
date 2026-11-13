# Site: every line marked not supported or contradicted (ZOD-152, R3)

This is the single list for the site repository: every row marked **not supported** in `LINES-site-release-notes.md`, 1 row. A script builds it from the same rows. The engine repository's list (12 rows, among them the three changelog headings that say "unreleased candidate" for versions on npm) is in the engine worktree, `docs/evidence/changelog-audit-20261112/UNSUPPORTED.md`.

Nothing was changed in any published file. This is a finding for the owner to decide on.

| # | ID | File | The line says | What the evidence shows |
| ---: | --- | --- | --- | --- |
| 1 | S-pkg-03 | `integrations/packages/README.md` | lines 18 to 20: "`ai:package` never rewrites an archive that already exists: a change needs a new version, so every earlier ZIP keeps its bytes." | Not true of every earlier ZIP: several were rewritten under the same version, and 0.3.19 was rewritten on the day after the sentence was written. It does hold for every ZIP from Developer 0.3.20 and Zodiacs 0.6.0 on, each of which has a single content in history (pkg-04). Evidence: `git log -- integrations/packages/<zip>` and the blob at each commit: 13 of the 63 ZIPs have had more than one content, among them `zodiacs-developer-0.3.13.zip` (38 different contents, 2026-10-14 to 2026-10-27), `zodiacs-developer-0.3.14.zip` (8, to 2026-11-02), `zodiacs-developer-0.3.19.zip` (5, all on 2026-11-03), `zodiacs-sky-0.5.0.zip` (4) and `zodiacs-sky-0.5.1.zip` (4, to 2026-10-27); the sentence was added on 2026-11-02 (`de7372e6c`) |

| 2 | S-adopt-06 | `docs/platform/evidence/site-engine-rc16/README.md` | line 55: "MCP rc.16 local archive: carrier `03142a4d9a78733876137f611586d7482793bee6`" | The commit it cites cannot be found: it is not an object in the site or engine repositories and GitHub returns none for it in the sdk repository. The other four ids of the first pass's unchecked row are sdk commits and match (see `FIX-ROUND.md`). The line calls the archive "local", so the carrier may be a commit that was never pushed; as cited, it cannot be checked by anyone else. Added in the fix round from the second session's review. Evidence: `git cat-file -t` in site and engine; `gh api repos/zodiacs-org/sdk/commits/03142a4d...`. |

## Fix round, 13 November 2026

Row 2 was added, so the site list is now 2 rows. Row 1 has its correction note in `integrations/packages/README.md` itself, beside the sentence, dated. The adoption record of row 2 is a dated evidence file and was not edited. See `FIX-ROUND.md`.

## Observations that are not line findings

1. `public/sdk/engine/media/CHANGELOG.md` is served publicly, is titled "Engine changelog" and holds only the 0.1.1-rc.1 entry. It is accurate for what it is (the changelog packed in rc.1, part of the historical reference that the house rules say is never edited), but a reader who lands on it sees a changelog that stops two months and 22 entries short of the engine's.
2. Two of its sentences differ in wording from the engine's current text of the same entry (row S-vend-02). The meaning is the same.
3. `vendor/README.md` says nothing about npm in its rc.15 and rc.14 sections, though both versions are on npm; its 1.0.0 and rc.16 sections do say so (row S-vendor-07).
4. `docs/platform/evidence/engine-release/README.md` and the rc.7 to rc.9 adoption records say `@zodiacs/engine` is not on npm. Each is dated before 30 September 2026, when the package first appeared there, so each was true on its date.
5. The engine's `CITATION.cff` says no DOI has been minted, while the site's record of 1 October 2026 and Zenodo show DOI 10.5281/zenodo.23080134. That finding is in the engine list (row O-cff-01).

## What this list does not cover

12 rows are **unchecked**, and several stand for long passages: about 3,400 lines of the adoption records, about 230 lines of `vendor/README.md`, 70 lines each of the engine-release record and the packages notes. The AI tools hand-off and submission documents (1,547 lines) were not checked at all. `INVENTORY.md` names each with the reason.
