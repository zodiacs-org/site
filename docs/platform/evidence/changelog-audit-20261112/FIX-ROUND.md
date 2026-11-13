# Fix round after the second session's review (ZOD-152)

13 November 2026. The second session's review is `BREAKER.md`: no blocker,
two should-fix items for the site. The owner approved one fix round at 10:48
ICT. This file records what it changed. The first pass's table in
`LINES-site-release-notes.md` is left as written; where a row's mark changes,
it changes here. Nothing was published, tagged, released or merged.

## 1. The public correction log, now in `INVENTORY.md`

| ID | Where | Claim | Status | Evidence opened | What it shows |
| --- | --- | --- | --- | --- | --- |
| F-corr-01 | `/corrections/` (`src/data/corrections.json`), its one entry | corrected 2026-07-27: the People profile of B. F. Skinner stated a settled Sun sign for a day on which the Sun changed sign, and was withdrawn | supported | `gh pr view 175 --repo zodiacs-org/site`: merged 2026-07-27T12:19:00Z, "People: measure the cusp on the birthplace's civil day, withdraw one profile" | The entry's date and subject match the merged pull request. The astronomy was not recomputed. |

The log holds content corrections. It has no entry about an engine release or
the AI tools packages, and this audit adds none: a public entry is a
publication, which is not part of this round.

## 2. Row S-adopt-06, settled

The first pass left five commit ids in the adoption records unchecked as
"probably sdk-repository commits".

| Id | Record | Found |
| --- | --- | --- |
| `97f5e8d01828f4b85ffa845825dee9acff4695e4` | `site-engine-rc5/README.md` | a commit in `zodiacs-org/sdk` |
| `333369256af683c560603dd1e6411dd7a07adb1f` | `site-engine-rc5/README.md` | a commit in `zodiacs-org/sdk` |
| `785e3ea154c28e890ecc97ce2284ee3e9f48a4a7` | `site-engine-rc5/README.md` | a commit in `zodiacs-org/sdk` |
| `51129a197cd3f2a2a8c966fb797ea4da1e147b3d` | `site-engine-rc6/README.md` | a commit in `zodiacs-org/sdk` |
| `03142a4d9a78733876137f611586d7482793bee6` | `site-engine-rc16/README.md`, line 55 | **not found** in sdk (GitHub's API), site or engine (`git cat-file`) |

Each was looked up again in this round with
`gh api repos/zodiacs-org/sdk/commits/<id>` and `git cat-file -t`. The row
splits: four ids supported (they exist where the records say; what each
commit holds was not read), one not supported, on the unsupported list as
row 2.

Counts after this round: 45 rows, 32 supported, 2 not supported, 11
unchecked (the first pass's 43 rows, with S-adopt-06 split in two and
F-corr-01 added).

## 3. The correction note (the owner's approved fix 1)

`integrations/packages/README.md`, after the sentence "`ai:package` never
rewrites an archive that already exists ... every earlier ZIP keeps its
bytes", now carries a dated note: the rule has held since Zodiacs 0.6.0 and
Developer 0.3.20, and 13 ZIPs were rewritten under the same version before
it, and Developer 0.3.19 four times after it (commits 3e7a645f6, 1a895a5c4,
c65d955b8 and 3034745d9 on 3 November). No ZIP and no manifest was touched. The file
is hand-written; no generator or test reads it. `npm run ai:check` could not
be run in this worktree (its dependencies are not installed), so CI is the
check.

## 4. Not done here

- The engine's correction notes and the draft 1.0.0 tag and release are in
  the engine repository (`docs/changelog-corrections.md`, `docs/releases/`).
- `public/sdk/engine/media/CHANGELOG.md`, the public "Engine changelog" that
  holds only the 0.1.1-rc.1 entry, is unchanged. No replacement was
  published; a public engine changelog is ZOD-96's subject.
- The unchecked rows are left as they are.
