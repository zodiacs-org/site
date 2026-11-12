# Site inventory: releases, tags, changelogs and release-note files (ZOD-152, R1)

Built 12 and 13 November 2026 on branch `audit/fable-job8-changelog-evidence`,
at `origin/main` `23b1884b6374086491cbb69dd40a1dd9e50551f3`. Related: ZOD-96.
Nothing in this folder changes a release, a published file or another branch.

## How the inventory was built

| Source | Command | Result |
| --- | --- | --- |
| Git tags on the remote | `git ls-remote origin 'refs/tags/*'` | none |
| GitHub releases | `gh api repos/zodiacs-org/site/releases` | none (length 0) |
| GitHub tags | `gh api repos/zodiacs-org/site/tags` | none (length 0) |
| Files named like a changelog or release notes | `git ls-files \| grep -iE 'changelog\|release.?notes\|(^\|/)HISTORY\|NEWS\.md'` | one changelog, `public/sdk/engine/media/CHANGELOG.md`; the other matches are `history-check` logs, `docs/race-recaps/history.json`, a games page and two retained ZIPs under `integrations/packages/history/` |
| Files with "release" in their path | `git ls-files \| grep -i release` | evidence and planning folders, listed under "Not checked" below |
| The site's own version | `package.json` | `"name": "zodiacs-org"`, `"version": "1.0.0"`; never tagged or released under that number |
| The engine the site ships | `package.json`, `vendor/` | `@zodiacs/engine` from `file:vendor/zodiacs-engine-1.1.0-rc.2.tgz`; 17 engine archives in `vendor/` |
| The site's own versioned packages | `integrations/packages/manifest.json` and the folder | Zodiacs 0.6.6 and Zodiacs Developer 0.3.41 current; 63 ZIPs kept |

The raw answers are in `raw/site-refs-and-inventory-20261113.txt`.

## What the site has

**The site has no changelog of its own, no tag and no GitHub release.** It
deploys from `main`; a merge is its release. No site changelog was invented
for this audit. What exists and was checked:

| # | File | What it is | Checked in `LINES-site-release-notes.md` |
| ---: | --- | --- | --- |
| 1 | `public/sdk/engine/media/CHANGELOG.md` (24 lines) | A vendored copy of the engine changelog as packed in 0.1.1-rc.1, part of the historical `public/sdk/engine/` reference. Served publicly. | every line, rows S-vend-01 to 06 |
| 2 | `docs/platform/evidence/engine-github-release-2026-10-01/README.md` (48 lines) | The record of the engine's one GitHub release and its Zenodo DOI | every line, rows S-ghrel-01 to 10 |
| 3 | `docs/platform/evidence/engine-release/README.md` (103 lines) | The engine's release state on 16 and 17 September 2026 (rc.6, before any npm publication) | identity and status lines, rows S-engrel-01 to 05; 70 lines unchecked |
| 4 | `vendor/README.md` (303 lines) | One section per vendored engine archive: identity, publication status, what it added | every identity and status statement, rows S-vendor-01 to 08; about 230 lines of description unchecked |
| 5 | `docs/platform/evidence/site-engine-*/README.md` (15 files, 3,516 lines): rc5, rc6, rc7, rc8, rc9, rc10, rc14, rc15, rc16, rc17, 1-0-0-rc2, 1-0-0, 1-1-0-rc1, 1-1-0-rc2, geo-20261012 | Adoption records of each engine release. Evidence, not changelogs | release-identity statements only, rows S-adopt-01 to 07; about 3,400 lines unchecked |
| 6 | `integrations/packages/README.md` (102 lines) and `manifest.json` | Release notes of the AI tools packages, the site's only versioned releases of its own | versions, digests, the keep-its-bytes rule and one dated pull request, rows S-pkg-01 to 07; about 70 lines unchecked |

Vendored engine archives in `vendor/` (each with its `.sha256`): 0.1.0,
0.1.1-rc.0, rc.1, rc.5, rc.6, rc.7, rc.8, rc.9, rc.10, rc.14, rc.15, rc.16,
rc.17, 1.0.0-rc.2, 1.0.0, 1.1.0-rc.1 and 1.1.0-rc.2. Two of them, 0.1.0 and
0.1.1-rc.0, have no entry in the engine's changelog. The site never vendored
rc.2 to rc.4, rc.11 to rc.13, 1.0.0-rc.1 or 1.1.0-rc.3.

## Not checked, with the reason

| File or group | Lines | Why it is named | Why it was not line-checked |
| --- | ---: | --- | --- |
| `docs/platform/zodiacs-ai/HANDOFF-0.4.0.md`, `HANDOFF-0.5.0.md`, `RESUBMISSION-0.5.0.md`, `RESUBMISSION-0.6.0.md`, `AUDIT-0.4.0.md` | 1,547 | Hand-off and submission documents for AI tools versions | Not release notes of a published release; status in an outside review portal cannot be checked from the repository. Not reached. |
| The other files in `docs/platform/zodiacs-ai/` | about 3,400 | Launch, review and operations notes | Same. |
| `docs/platform/programme/` (decisions, ledger, status) | not counted | Records acceptance of work units, some named for engine releases | A programme ledger, not a changelog. |
| `docs/platform/*-pre-l2-release.md`, `STATUS-*.md`, `docs/natal-aspects/RELEASE.md`, `docs/owner-review/profile-release-2026-10-06.md`, `docs/growth/playbooks/release-trust-gate.md` | not counted | "release" in the name | Planning and gate documents for site features. |
| Developer pages and `llms.txt` that state the engine's version and npm status | not counted | Public statements about a release | Live copy, checked by the site's own claims tests; outside this audit. |
| `public/thesis/` editions | not counted | Numbered editions | Essays, not software releases. |
| The sdk repository (`zodiacs-org/sdk`): tags and releases `v1.0.0-rc.1`, `v1.0.0`, `v1.0.1`; npm `@zodiacs/sdk` 1.0.1 | | Named by the vendored changelog | A different repository; ZOD-152 covers the engine and the site. |

Engine releases, tags and the engine's own changelog are inventoried in the
engine repository, `docs/evidence/changelog-audit-20261112/INVENTORY.md`,
including pull request 91's unpublished test release 1.1.0-rc.6.
