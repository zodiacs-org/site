# First tagged engine release and DOI — 1 October 2026

G4's existing gate is met: tagged GitHub release, changelog, permanent Zenodo DOI.
This accepts one existing weighted unit, without changing its gate or denominator.

## Published outcome

- [GitHub release](https://github.com/zodiacs-org/engine/releases/tag/v0.1.1-rc.15), ID 400849502, published 2026-10-01T10:13:53Z, title `0.1.1-rc.15`.
- New lightweight tag `v0.1.1-rc.15` points exactly to commit `93ebae9fa54597aeaafbb346873f7f51e3cc6cb6`. It remains a prerelease, with draft=false; no manual assets were attached.
- [Version DOI 10.5281/zenodo.23080134](https://doi.org/10.5281/zenodo.23080134), [published record](https://zenodo.org/records/23080134), concept DOI 10.5281/zenodo.23080133. The API reports submitted=true, created 10:13:57.901413Z.
- Zenodo's source ZIP is 3,151,916 bytes, MD5 `f993fcd18500064ef8ad51155451fe9e`, SHA-256 `d1c050ed6fa103aa8fbafec60a37a08e0d7d5270c16bf7c14cf5636ae6c79e0c`. All 605 files match the tagged Git blobs byte for byte, with no missing/extra files. This ZIP is distinct from the already-published npm archive.

The owner explicitly approved this release and permanent DOI before publication.
The existing authenticated cloud-browser sessions published the release through
GitHub and verified the already-enabled Zenodo integration. No new grants, tokens,
payment, package publication or npm dist-tag change was performed. The independent
verification below used public read-only endpoints, not the publication session.

## Independent checks

`github-release.json` records the release and exact tag target. GitHub normalized
367 LF line endings to CRLF: raw body 25,192bytes/SHA-256
`7fb380910f3e24f0a3f62b77bfc89d1d1968321881fd2f523c1e9be33df33a8c`;
normalizing CRLF to LF yields the exact approved 24,825bytes/SHA-256
`4703e1b1435142cab100caa542aef94486f1e8cf04b2cfe8e29f77d1a6163700`.
There is no wording/content difference. The complete rc.15 changelog is included;
its historical heading is explicitly contextualized, not rewritten.

`zenodo-record.json` preserves public metadata and archive receipt.
`source-binding.json` is the independently downloaded ZIP comparison against the
full engine checkout. Reproduce with `python verify-source.py PATH_TO_ZIP PATH_TO_ENGINE_CHECKOUT`.
The ZIP can be downloaded from its exact public `files[0].links.self` URL in the record.
No downloaded source archive is added to this site's distribution.

## License and scope

The preexisting `.zenodo.json` primary license is MIT, while its description
explicitly preserves the package's MIT AND CC-BY-4.0 scopes, CC0 conformance
vectors and CC-BY-4.0 atlas data/MIT atlas tools. The record retains those
qualifications. A primary MIT badge must not be read as relicensing every file.
The source ZIP matches the approved public rc.15 history, not the rc.16 WIP or
new Agent Skill candidate. No Swiss data or held-back Chinese solar data is added.

The Software Heritage downstream archive was still waiting in the publication
view; this is not claimed complete and is not G4's DOI gate. Accuracy gates,
compute metrics, calendar deployment and rc.16 adoption remain separately open.
A4 remains unpublished pending the private history-check input required before
any engine push. No private pattern value or account credential is recorded here.
