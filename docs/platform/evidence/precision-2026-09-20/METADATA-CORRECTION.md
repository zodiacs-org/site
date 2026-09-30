# Metadata correction, 2026-09-20 — compiler 1.1.0

A factual claim the compiler stamped into every pack header was wrong. It is
corrected forward under a new compiler identity. No artifact is rewritten and
no evidence is removed.

## What was wrong

`compile.mjs` wrote, for the kernel it reads:

> `licence: 'US Government work, public domain (JPL/Caltech-NASA)'`

[`RIGHTS.md`](RIGHTS.md) established on 2026-09-20, from NAIF's own rules
page, that this is not so: SPICE and its kernels are produced by **Caltech's
Jet Propulsion Laboratory under contract to NASA**, a contractor's output is
not automatically a government work, and NAIF's rules page never uses the
words "public domain". What it grants is a permission with conditions.

The correction landed in `RIGHTS.md` and did not reach the generator, so
every pack compiled after that document was written still carried the claim
the document had just refuted. `spkref.mjs` carried the same sentence in a
header comment.

## What changed

- `COMPILER_VERSION` 1.0.0 → **1.1.0**.
- `dependencies[0].licence` now states the permission and its conditions,
  cites the rules page and the date it was read, and adds
  `derivedCoefficientStatus: 'unsettled; no pack is distributed while it is'`.
- The `spkref.mjs` comment is corrected in place, with the old sentence
  quoted so the change is legible rather than silent.

## The payload did not move, and that is demonstrated

Recompiled candidate D from the same kernel, before and after:

| | compiler 1.0.0 | compiler 1.1.0 |
| --- | --- | --- |
| payload bytes | 1,721,408 | 1,721,408 |
| payload SHA-256 | `0a2187642704459a47983c79ed4ecb70deed5ab5ba75465e89319d39089e1afa` | **identical** |
| file bytes | 1,737,168 | 1,737,632 |

Every header field that moved, and no others: `compiler.version`,
`compiler.sourceSha256` for the two edited files, the four corrected licence
fields, and the eleven body offsets plus `payloadEndOffset`, which shift
because the header grew by 464 bytes. Not one coefficient changed.

## Old artifacts

Packs compiled before this date carry the old string and their recorded
digests still describe them. They are not reissued and nothing in the
evidence tree is edited to pretend otherwise. `RIGHTS.md` governs either
way; a header field is the compiler's note to itself, not a licence.

## The rights picture, by artifact

Read from the primary terms for each, not inferred from one to another:

| artifact | terms | may this project redistribute it? |
| --- | --- | --- |
| this runtime's code | MIT, ours | yes |
| the ERFA-derived nutation coefficients | BSD-3-Clause, derived with permission from IAU SOFA | yes, with the notice — `LICENSE-erfa` ships in the package |
| `astronomy-engine` 2.1.19 | MIT (Don Cross) | not bundled here; the preview does not need it |
| the DE440s kernel, unmodified | NAIF permission with conditions | permitted unmodified, with its own attribution |
| **a compiled coefficient pack** | **unsettled** | **no. Nothing derived from the kernel is committed or shipped** |
| Swiss Ephemeris code or data | AGPL-3.0 or paid commercial | no, and none is committed |
| numerical output measured from Swiss | see below | treated as a measurement, not redistributed in bulk |

Two things worth separating, because conflating them is how the first error
happened:

- **NASA involvement does not imply public domain.** A contractor's output
  is the contractor's, and the grant here is a permission, not a dedication.
- **A program's licence does not automatically reach its numerical output.**
  Whether the AGPL follows a Swiss longitude out of the program is a real
  question and this project does not need an answer to it, because Swiss
  output is used as a measuring instrument and bulk per-instant values are
  not committed.

## One inconsistency this work found and did not create

`RIGHTS.md` says Swiss output is "used only as measurements and never
redistributed or fitted against". Three files tracked in git are bulk Swiss
output, all predating this milestone:

- `numerics/raw/t1-swiss.json` (380 kB)
- `numerics/verify/t1-swiss.json`
- `numerics/verify/v1-swiss.json` (571 kB)

This milestone did not add to them: the four-configuration measurement
commits statistics only, and its per-instant Swiss values are ignored by
`raw/four-configurations/.gitignore`. Whether the three existing files
should stay is a decision about already-published history, and it is the
owner's, not one to make silently in either direction.

**The owner decision, precisely.** Either (a) accept that nutation and
longitude values measured from Swiss are facts about the sky rather than a
work of authorship, and amend `RIGHTS.md` to say "not redistributed in
bulk beyond the recorded measurement files, which are listed"; or (b) treat
them as covered, remove the three files from the working tree, and keep
them only in the local research directory. Nothing else in the project
depends on which is chosen, and no external enquiry has been sent.

*Correction, 2026-09-23.* The three files are not the only Swiss output in
the tree. The engine audit (`../engine-audit-2026-09-22/LEDGER.md`,
data-toolchain-packaging-6) and a search on 2026-09-23 find it in these
tracked files too, each a frozen measurement or test oracle and none a
fitting target:

- `src/lib/engine/fixtures/swiss-node-polar.fixture.json` and
  `swiss-eight-cases.fixture.json`: Swiss values for the node-and-polar and
  eight-case packs;
- `src/lib/engine/fixtures/swiss-lunar-returns.fixture.json`,
  `swiss-lunar-returned-charts.fixture.json` and
  `transit-window-independent.json`: return instants, charts and crossing
  roots from Swiss scans;
- differences from Swiss, from which Swiss's values can be recovered with
  the engine's: the per-row `../swiss-benchmark/report-*.json` and
  `../events-vs-swiss-2026-09-23/deltas.json` (290 event times, added on
  2026-09-23).

The owner decision above covers these as well.

*Decision, 2026-09-28.* The owner chose removal
([`../../programme/DECISIONS-2026-09-28.md`](../../programme/DECISIONS-2026-09-28.md)
§3). The three nutation files, `numerics/verify/v4-dense-diff.json` and the
engine fixtures above left the tree; the per-row Swiss values in the reports,
cells and deltas were stripped and their statistics kept; and the tests moved
to NASA JPL Horizons and ERFA.
[`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md)
lists each file and field with its SHA-256 and the command that regenerates
it. Commit `2ca93d41` still has them; history was not rewritten.

## What this does not block

The runtime, the synthetic fixtures, the local compiler and the developer
preview are all independently distributable and none of them contains
kernel-derived coefficients. The unsettled question is about packs, and
packs are exactly what is not shipped.
