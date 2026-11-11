# Connector directory dry run, 11 November 2026

Evidence for Linear ZOD-99 (parent ZOD-58): the Zodiacs connector checked against
the connector directories' live rules and the live server, as a submission dry run.
Nothing was submitted, and no product code was changed.

- `REPORT.md`: the pass or fail list for tests D1 to D8, with the rule, what the
  live server or page did, and the proposed fix for each failure. Start here.
- `DRAFT-PRS.md`: what draft pull requests 968, 970, 971 and 972 would fix and what
  still needs the owner.
- `rules/SOURCES.md`: the rules pages fetched, their digests, and the exact lines
  the report cites.
- `pages/`: text copies and digests of the live zodiacs.org pages read.
- `raw/mcp/`: the live `initialize` and `tools/list` answers, one file per sampled
  call in `calls/`, `scan.txt` (links and flagged words per call) and
  `descriptions-check.txt` (each description, sentence by sentence).
- `tools/`: the scripts that made those records. `cases.json` lists the 76 requests;
  all input is synthetic.

To repeat it: `python3 tools/run-calls.py` sends the cases to the live server again
(read-only tools; it overwrites `raw/mcp/calls/`), then
`python3 tools/scan-results.py > raw/mcp/scan.txt` and
`python3 tools/check-descriptions.py > raw/mcp/descriptions-check.txt` run offline.
Under-13 and under-18 cases depend on the day they are run: the dates were chosen
for 11 November 2026.
