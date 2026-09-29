# Decisions of 2026-09-29

On 2026-09-28 the owner delegated the programme's open decisions: "Choose the
best decision for me. It's beyond my expertise." The first decisions under
that delegation are in [DECISIONS-2026-09-28.md](DECISIONS-2026-09-28.md).
This record adds the ones taken on 2026-09-29, each with its reason and what
it changes.

## 1. The MCP adapter's archives 0.1.0-rc.8 to rc.10 (F-49): kept, with a notice beside them

The three archives bundle the engine's ΔT module, and so 32 values of Table
S15 of Stephenson, Morrison and Hohenkerk (2016), which are published under
CC BY 4.0. Each archive labels itself MIT and carries no notice. The licence
asks that anyone who shares the values say where they come from and under
what licence.

There were three choices:

- **Repack them with a notice.** Not possible: their SHA-256 digests are
  published and pinned, and a version names one byte sequence.
- **Stop serving them.** This would break every pinned link to them, and
  would not reach a copy already downloaded.
- **Keep them and publish a notice beside them.** The licence allows the
  attribution to be given in any reasonable manner, including by a link to a
  resource that holds it.

Decision: **keep the three archives as released, byte for byte, and publish
their notice beside them.**

- `public/examples/zodiacs-mcp-server-0.1.0-rc.8-to-rc.10-NOTICE.txt` names
  each archive by its digest, says that the MIT label covers the adapter's
  code, gives the work, its DOI and its licence, and asks that the notice be
  kept with any copy.
- `/developers/mcp/` links it.
- Archives from 0.1.0-rc.14 on declare `MIT AND CC-BY-4.0` and carry their
  own NOTICE.

## 2. What removing Swiss output covers (F-22)

The decision of 2026-09-28 §3 removes the raw Swiss fixtures and "raw Swiss
values in evidence folders", and keeps statistics and SHA-256 digests. The
independent review of the removal, on 2026-09-29, found Swiss material the
removal had left, of four kinds:

- Swiss Ephemeris source code: 148 lines of `swetest.c`, in the patch field
  of a commit receipt;
- per-case values that arithmetic on a stripped file still gives back;
- per-case Swiss figures on the site's own pages, and a test that reads one;
- figures quoted in the prose of dated evidence and audit records.

Decision: **code and data go everywhere; the product carries no Swiss value;
figures quoted in dated records stay as written.**

- **Code.** No Swiss Ephemeris source code anywhere in the tree. It is
  licensed under the AGPL or commercially, and this repository is all rights
  reserved. Scripts that call Swiss through pyswisseph stay, as the 2026-09-28
  decision allows.
- **Data.** No per-case Swiss value is kept as data anywhere. That covers a
  file, a field, a table, a list, or a script, and a value that arithmetic on
  what remains gives back, such as a difference kept beside the other term.
  A README table that lists Swiss's values case by case counts as data.
  Statistics and digests stay.
- **The product.** `src/` holds no Swiss value in any form, prose included,
  and neither does any package. The pages give statistics over a stated range
  instead of Swiss's value at one date, and tests read committed statistics.
- **Quoted figures in dated records.** Some figures are quoted in the prose
  of a dated evidence README, audit record or report, as part of the finding
  or analysis it records. They stay as written: they are cited facts in a
  historical record, not output kept for reuse, and removing them would
  change what the record says was found. The removal record names these
  files.
- **Enforcement.** The guard test fails on each of the first three:
  - a removed file's bytes under any name, archive members included;
  - a removed per-case value in any data file or anywhere in `src/`;
  - Swiss provenance markers in `src/`.
