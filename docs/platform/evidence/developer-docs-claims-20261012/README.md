# The developer docs in the claims ledger, 2026-10-12 (F-23, P1.15)

## F-23

The claims ledger did not read the developer docs. It now reads all those the
site serves or ships, in three parts:

- **Shipped READMEs.** These are the READMEs inside the MCP adapter, the
  platform starter and the two plugin archives, and the developer guides'
  prose. They hold 84 sentences: four claims are new and three restated.
- **The precision alpha's README.** It holds 16 sentences: three claims are
  new, and `acc.precision-preview` is restated.
- **The engine references the site serves.** These are the 1.0.0 API
  reference with its release's README, LICENSING and NOTICE, and the
  archived rc.1 reference and SDK pages. A new HTML extractor reads each
  TypeDoc page's doc comments.
  - 465 sentences: 114 claims are new.
  - Eleven claims are overstated, each with its resolution
    ([`../claims-engine-references-20261012/`](../claims-engine-references-20261012/README.md)).

The engine's 1.0.0 CHANGELOG is not served by the site. F-23 is closed.
P1.14 stays partial, because claims that use no trigger word still escape the
extractor.

## P1.15

`llms-full.txt` no longer describes the retired calendar feed and preview
links as live. It now says that a share code gives the UTC birth time to the
whole minute, the window the decoder tests hold it to. A test fails if either
llms file describes the retired paths as live again.

## MCP adapter 0.1.0-rc.22 and developer plugin 0.3.10

The adapter's README described the comparison benchmark as ten record pairs;
it has been eighteen scenarios since an earlier change, and now says so. The
README travels inside the archive, so the archive is cut again:

- `zodiacs-mcp-server-0.1.0-rc.22.tgz`, 123,600 bytes, SHA-256 `aa03a11e…`,
  pinned to `b57dbdf1`. The bundle is rc.21's code with the version
  (`e945f67c…`, against rc.21's `a1731969…`).
- Developer plugin 0.3.10 bundles it.
- rc.21 and plugin 0.3.9, released with the geo adoption, stay served beside
  them.

Driven with the same 278 calls (10 refusals), the tool list and both
resources, rc.21 and rc.22 answer identically once versions and digests are
written out ([`../mcp-adapter/mcp-rc21-rc22.json`](../mcp-adapter/mcp-rc21-rc22.json)).
On rc.22:

| Drive | Result |
| --- | --- |
| Protocol | 106 of 106 |
| Host (Claude Code 2.1.296) | 7 of 7 |
| Benchmark | 18 of 18 scenarios, 112 assertions |
