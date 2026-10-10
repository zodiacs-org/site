# Owner decisions of 2026-10-11: engine 1.0.0, the private search and the release toolchain

The owner answered three explicit questions in the programme session of
2026-10-11 (Asia/Bangkok), each put as a choice with its consequences. The
answers below are the owner's selections, quoted. They grant what each
question named and nothing more.

## 1. Cut and publish `@zodiacs/engine` 1.0.0

**Question.** May the programme cut the stable release (version commit, new
archive) and publish it to npm's `latest` tag, as scoped in
[engine issue #32](https://github.com/zodiacs-org/engine/issues/32)
(1.0.0-rc.2's API and behaviour unchanged), once every gate, review and
private scan passes?

**Answer.** "Approve cut and publish (Recommended)".

**What it grants.** The version commit, the carried 1.0.0 archive and its
record under the engine's CONTRIBUTING.md *Releases*; a pull request merged
with a merge commit; one run of the Release workflow from main with version
`1.0.0` and tag `latest`; then the registry checks and the site's adoption.
A failed prerequisite stops publication. No gate, budget, tolerance or
licence changes, and no other package is published under this answer.

## 2. The private birth-data search

**Question.** May the programme use the scanner archive the handoff named
(`zodiacs-private-birth-data-check.tar.gz`, 82,576 bytes, SHA-256
`dbf9b51e13b53457f3f007520ff2f56f8a4bf43f774aed830ad442ac3f7df025`) for the
release's private searches, extracted outside every repository, reporting
counts only?

**Answer.** "Yes, use it".

**What it grants.** The release-range and staged searches, run outside the
repositories. Public records carry labels and counts; patterns, matched
lines and the archive stay private. The rule against opening
`docs/evidence/calc-sidereal-2026-10-05/tools/ayanamsa_rates.py` in the
engine stands: the search leaves it out and says so.

## 3. The release toolchain

**Question.** May the programme download the official Node.js builds the
release gates use (macOS arm64 20.19.0, 22.7.0, 22.22.2 and 24.21.0, and
linux-x64 22.22.2) from nodejs.org, each checked against its published
SHA-256, into a local folder outside the repositories, with no system
install?

**Answers.** "Yes, download them (Recommended)" for the four macOS builds,
and, asked separately, "Yes, download it (Recommended)" for linux-x64 22.22.2.

**Why linux-x64.** The engine's conformance results and its regression pins
are x86-64's. On arm64 three numbers of the calc round-trip fixture and one
recorded conformance residual move in their last bits, so those generated
files were rebuilt on Linux x86-64 (FINDINGS F-82).
