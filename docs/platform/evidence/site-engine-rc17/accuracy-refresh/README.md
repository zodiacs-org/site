# rc.17 Swiss statistics refresh

Measured on 6 October 2026 on Node 22.22.2, with pyswisseph 2.10.3.2
(library 2.10.03) and the official Swiss files that
[`CONFIGURATION.md`](../../swiss-benchmark/CONFIGURATION.md) pins;
[`tools/run.sh`](tools/run.sh) checks both before it runs. Engine archive
SHA-256 `9cd24c788863424ef614aaadec580db5a0dfc529303d385274db48a092a5299a`.

These are the two runs the Swiss-statistics claims, `acc.swiss-multiyear`
and `acc.deltat`, bind to, made by the unchanged tools in
`../../swiss-benchmark/tools/`:

- `multiyear-1800-2199.json`: 14,610 instants every ten days from 1800 to
  2199, 11 bodies, at the same UT1 and at the same TT;
- `deltat-gap-2100-2199.json`: 36,524 daily instants in 2100–2199.

Each differs from rc.16's record (`../../site-engine-rc16/accuracy-refresh/`)
in two fields only, the engine's version and the digest of the engine's
dump. The dumps differ only in their first line, which names the engine.
To check that, the dumps were made again on site main (`b4f82564`) with
rc.16 installed: their digests are the ones rc.16's records hold,
`059acb38…214a` and `55f21845…6fd4`, and each differs from rc.17's in that
line alone. Every statistic, and so every number the site publishes from
them, is rc.16's.

Only aggregates are committed. The dumps hold the engine's positions, and
the Swiss readings exist only inside the comparison tools' runs; neither is
in the repository. This is a comparison with another program's model, not
with observation, and it changes no acceptance status. The house and angle
measurements made on rc.16 (P1.03, Koch) were not repeated: the entries the
site computes charts and houses with load rc.16's files apart from chunk
names and the version string (`../entry-graphs.txt`).
