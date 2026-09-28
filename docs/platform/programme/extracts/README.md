# Extracts

These files were extracted on 2026-09-28 from the repository at `f2bd0dd4` by
an AI reviewer, for the acceptance ledger. Every quoted passage is an exact
substring of the line range it cites, and a final pass checked all 405
quotes. They are working references, not rules. If an extract and its source
disagree, the source wins.

- `v1-rules.json`: 117 version 1 rules that version 2 retains or cites. Each
  has its verbatim text, its location, the version 2 passages that refer to
  it, and how version 2 treats it. Where one source line holds several rules
  (M3, M5, M6), the split into sub-ids is the extractor's and is marked.
- `audit-dispositions.json`: the 128 findings of the 2026-09-22 audit (119 in
  `LEDGER.md` plus R1–R9). Each has any later disposition recorded in the
  repository, with its evidence path, or "no recorded disposition".
