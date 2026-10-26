# Registry Research publication method

Registry Research is a deterministic publication system. It does not use model-authored prose and does not turn astrology into a financial signal.

## Evidence boundary

Every note renders three visibly separate sections:

1. **Sky fact** from the verified Daily Sky, committed transit catalog, ingress windows, and Registry Outlook edition.
2. **Traditional reading** copied from the disclosed symbolic scoring method. Price, liquidity, volume, market cap, and FDV are prohibited inputs.
3. **Market observation** from an exact-mint, UTC-dated Registry market archive snapshot. It is descriptive and never establishes causation.

The standard disclosure is mandatory: “Symbolic research—not investment advice. Market observations never alter the sky score.” Every item also states that astrology has no established predictive relationship with asset prices and that crypto assets can lose all value.

## Publication lifecycle

`node scripts/build-registry-research.mjs` verifies the exact Daily Sky fact-file hash against its verified manifest, loads the paired Registry Outlook and market archive, and writes deterministic drafts to `src/data/registry-research/drafts.json`.

During the 30-day pilot, a draft is public only when `approval-manifest.json` names its item ID, exact artifact SHA-256, reviewer, and review instant. Any content change changes the hash and invalidates the approval. Approved item data is append-only under `public/assets/data/registry-research/items/`; the builder refuses to rewrite an existing immutable item.

After the pilot, only explicitly allowlisted deterministic template IDs can publish automatically. Free-form model output remains disallowed. A published item is frozen: a later market observation the same day refreshes the archive, the outlook, and the ledger's `generatedAt`, but never regenerates an item that already has an immutable copy. Corrections and 24-hour/7-day observations are new append-only items referencing the original; they do not rewrite the original thesis.

## Public contracts

- Compact rolling feed: `/assets/registry-research-feed.json`
- Full approved archive index: `/assets/data/registry-research/index.json`
- Immutable items: `/assets/data/registry-research/items/{id}.json`
- RSS: `/feeds/market-research.xml`
- JSON Feed: `/feeds/market-research.json`
- Archive: `/terminal/research/`

Only the archive is offered for indexing. Each item page, `/terminal/research/{slug}/`, stays live and linked from the archive and the feeds but carries `noindex, follow` and is left out of `/sitemap.xml` and the section sitemaps (owner decision, 26 October 2026). `scripts/check-dist.mjs` fails a build in which an item page is indexable or listed.

The rolling window contains the previous 30 UTC calendar days plus approved event briefs through the end of the next seven UTC calendar days. `endsBefore` is the exclusive boundary at 00:00 UTC on the following day. Scheduled items carry `visibleAt`; standard RSS/JSON feeds exclude them until their publication build is eligible.
