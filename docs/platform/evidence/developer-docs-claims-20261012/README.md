# The developer docs in the claims ledger, 2026-10-12 (F-23, P1.15)

## F-23

The claims ledger did not read the developer docs. It now reads all those the
site serves or ships, in five parts:

- **Shipped READMEs.** These are the READMEs inside the MCP adapter, the
  platform starter and the two plugin archives, and the developer guides'
  prose. They hold 84 sentences: four claims are new and three restated.
- **Shipped skills.** The plugin archives also ship four `SKILL.md` files,
  which a host loads as instructions. They hold 16 selected sentences: 11 are
  instructions, and five state facts, held to `acc.daily-gate`,
  `priv.chart-studio` and `product.ai-candidate`, restated to give the sky
  tools' 92-day event window. The developer plugin's skill said 31 days; it
  now says 92, and plugin 0.3.10 is packed with it.
- **Shipped notices, manifests, records, pages and scripts.** The adapter's
  NOTICE, `candidate.json` and `verify.mjs`, the plugins' NOTICEs, manifests
  and examples, the starter's pages, scripts, sources and checks, and the
  package manifests hold 142 selected sentences. The archives' generated
  bundles are built from sources the ledger reads, and the build checks
  require them to match; their licence texts, lock files and launch
  settings make no claims. The manifests are read whole, as
  the llms files are, once any sentence of a description is selected: an
  assistant directory shows those descriptions as written.
  - The adapter's NOTICE ends with the engine's NOTICE, unchanged. Its 19
    sentences from there keep the decisions made for the same sentences in
    the release's NOTICE.
  - The sky plugin's review test cases, the requests and expectations a
    directory reviewer runs, are not claims, nor are the developer plugin's
    starter prompts or the starter pages' form labels.
  - The rest are held to claims. Two claims are new: what the developer
    plugin's generated server bundles, and its three skills. Nine are
    restated to cover what these files add: `product.mcp-licence`,
    `product.mcp-candidate`, `product.ai-packages`, `product.platform-starter`
    (the starter's file round trip and redacted diagnostic),
    `priv.local-tools`, `priv.widgets`, `priv.compare-withheld-values` (the
    adapter's chart answer), `acc.studio-replay` (Time Explorer's birth-time
    window) and `time.visible-math` (Chart Studio without a birth time).
  - New checks hold these sentences:
    - `npm run ai:check` requires the developer plugin's ENGINE-NOTICE,
      ENGINE-LICENSE and ENGINE-LICENSING to be the installed engine's files,
      byte for byte, and ENGINE-NOTICE and ENGINE-LICENSING to be the served
      release's, which the ledger already reads.
    - The adapter's artifact test finds in `server.mjs` the leap-second
      list, the UT1 − UTC table and the IAU 2000B series its NOTICE names.
    - A starter test holds the widget page to its privacy note.
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

- `zodiacs-mcp-server-0.1.0-rc.22.tgz`, 123,598 bytes, SHA-256 `d7d1cc6b…`,
  pinned to `4d1b549b`. Its candidate record names rc.21 as the release it
  supersedes (a first cut named rc.19). The bundle is rc.21's code with the version
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
