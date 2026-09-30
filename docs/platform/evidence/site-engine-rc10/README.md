# Engine rc.10 site adoption evidence

This 2026-09-28 continuation prepares the site and its local MCP adapter for
review. It does not record a merge, deployment or npm publication.

The site installs the exact
[zodiacs-engine-0.1.1-rc.10.tgz](https://raw.githubusercontent.com/zodiacs-org/engine/d0c5cd0c8edaa849d2e2c0793ccc32c28826e7ee/artifacts/zodiacs-engine-0.1.1-rc.10.tgz),
SHA-256 `a377cdc8c12e25ff7de4fe95ddf77a4cdee8d2da97071b0f8454e340b374565c`.
Its source is `zodiacs-org/engine` commit
`9c4f3fd77b5d6235288d9cdfc2ac1d183a5c4d6b`; archive carrier
`d0c5cd0c8edaa849d2e2c0793ccc32c28826e7ee`, merged in engine PR #5.
The 61,318-byte archive contains 30 files. It was copied from the previously
downloaded frozen artifact and its digest checked again for this adoption.

The continuation starts from Opus's site branch at
`f8b233a27c7870e3e94b494bfe4b498a4f26ec22`, including the pending PR #588
budget fix, then incorporates site main
`cccb145bdf5eda533d72b182fedee60a81f0433e` for the September 28 daily edition.
The adoption changes no earlier immutable engine or MCP archive.

## What is adopted

- Engine rc.10 adds Equal-MC, with thirty-degree houses and cusp 10 at the
  midheaven, making thirteen house systems. Its `chartPoints` API supplies
  mean lunar nodes, mean Black Moon Lilith, Vertex/East Point and seven lots.
- The MCP adapter candidate is `0.1.0-rc.10`. Its natal tool adds `equal-mc`;
  its three-tool interface does not expose `chartPoints`.
- The consumer birth forms still offer whole sign and Placidus.
- The receipt conventions remain rc.8's. Imported receipts remain claims;
  changing the engine version does not authenticate or reproduce old records.

## Newly executed checks

`node22-parity.json` and `node24-parity.json` come from the unchanged
`scripts/platform-engine-report.mjs`, on Node 22.22.2 and Node 24.19.0.
Both pass its frozen three-node-epoch and three-polar-location corpus,
with both requested house systems. The finite residuals are identical across
these runtimes. This is not a broad error bound.

`public-candidate-consumer.log` records the unchanged
`scripts/verify-packed-consumer.mjs` from the exact rc.10 source commit,
run separately on both runtimes. All 16 checks pass on each, including public
examples and TypeScript 5.9.3 declarations, after fresh consumer installation.
These are automated checks run by the continuation team, not outside review.

`swiss-refresh.json` records a newly executed comparison using the existing
every-tenth-day corpus: 14,610 dates from 1800 through 2199, eleven bodies and
two clock conventions. All 321,420 Swiss calculations passed the unchanged
SWIEPH backend guard. The 1,914 emitted statistical values equal the prior
rc.9 summaries at their reported precision; this does not claim equality of
unreported per-instant residuals. Pinned recovered ephemeris files and the
cached Python binding were hash-verified; only summary statistics and the
receipt are committed.

Site, MCP, build and browser results are recorded in `validation.json`.
The recovered source and evidence are published in carrier commit
[`9216262432b295230cf536d96c319a26e1fcf5ed`](https://github.com/zodiacs-org/site/commit/9216262432b295230cf536d96c319a26e1fcf5ed).
Its complete tree, `a54ddfa6c71f06622517cdf8e4530099a0b8d11f`, matches the
validated recovery checkpoint exactly. A separate metadata commit pins the
engine evidence and MCP archive URLs to this actual remote carrier. The
original validation results and timestamps are preserved. This publication
does not record a production merge, deployment or npm release.

## Measurement limits

Engine PR #5 summarizes a prior Swiss comparison of the new points and
Equal-MC, and says its full record will accompany site adoption. That full
record was not available in the published site branch. This continuation
neither reconstructs it as a historical result nor claims to have rerun it.
The rc.9 twelve-system Swiss record remains unchanged and does not establish
Equal-MC residuals. The integration test checks Equal-MC's defining spacing
and tenth cusp; it is a definition check, not a fresh Swiss measurement.

*Appended 2026-09-28.* The full record is now published at
[`../points-2026-09-26/`](../points-2026-09-26/README.md). Its tools were
rerun against this archive and reproduced every result file byte for byte.
Equal-MC agrees with Swiss's house function to 0.0000000004″ given its
inputs, and to 0.24″ end to end from 1850 to 2049. The paragraph above is kept
as written.

The osculating (true) Lilith remains absent, as PR #5 explicitly deferred it
until a JPL-based Moon. No precision provider, astrological predictive
validity, general completeness or Swiss replacement claim follows from this
adoption.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the two parity reports here lost their per-case differences from
the Swiss node/polar fixture (`nodes` and `polar`). Their maxima, which the
figures above quote, stay, and each report records the SHA-256 of what it
lost under `swissOutputRemoved`; the Node 22 and Node 24 digests are equal,
as the values were. Commit `2ca93d41` still has the reports whole.
`scripts/platform-engine-report.mjs` now measures against the NASA JPL
Horizons and ERFA references
([`../../../engine-validation/independent-references/`](../../../engine-validation/independent-references/README.md));
run it at `2ca93d41` to measure against the Swiss fixture again. The record
of everything removed is [`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
