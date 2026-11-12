# Changelog evidence audit, site side (ZOD-152)

An audit of what the site's release notes say against the evidence behind
them. Related: ZOD-96 (this audit does not build that page). Done 12 and 13
November 2026 on branch `audit/fable-job8-changelog-evidence`, at
`origin/main` `23b1884b6`. It adds this folder only.

| File | What it is | Test |
| --- | --- | --- |
| `INVENTORY.md` | What the site has in place of a changelog, how it was found, and what was left unchecked | R1 |
| `LINES-site-release-notes.md` | The line checks | R2 |
| `UNSUPPORTED.md` | The single list of lines marked not supported | R3 |
| `raw/` | The remote refs and inventory as captured | R1, R4 |

The engine's half, with the engine's `CHANGELOG.md` line by line and pull
request 91's test release 1.1.0-rc.6, is in the engine repository under
`docs/evidence/changelog-audit-20261112/`.

## Result

The site has no changelog, tag or GitHub release of its own. Six kinds of
release note were checked: 43 rows, supported 30, not supported 1,
unchecked 12.

- Every identity statement about a vendored engine archive (digest, size,
  file count, source and carrier commit, merge and pull request number)
  matches the files, the engine's manifest and its git history.
- The record of the engine's GitHub release and Zenodo DOI matches GitHub's
  and Zenodo's public answers to the byte and the second.
- One line is not supported: the packages notes say an existing ZIP is never
  rewritten, and git history shows 13 ZIPs that were, one of them the day
  after the sentence was written.
- Most of the adoption records' text is evidence about the site, not release
  notes, and is unchecked.

Nothing was published, tagged, released, merged or moved. Only read commands
were used against GitHub, npm and Zenodo.
