# Market Lens implementation checkpoints

The revised seven-checkpoint extension is documented in
[REVISED-CHECKPOINTS.md](REVISED-CHECKPOINTS.md). It adds canonical own-chart
reuse, private personal timing, actual-house context, spot-risk setups,
official economic schedules, matched historical observations and an optional
interpretive outlook. The sections below retain the initial implementation
record; current validation and deployment limits are in the revised record.

Implemented 2026-10-01 in the site checkout, starting from
`450f0fd948d86d82c416bcbd51b3dace5196097e`. The SDK, engine, and native app
checkouts were not modified. The site keeps its pinned rc.15 engine archive.

The workspace is `/terminal/lens/`; aggregate experiment results are at
`/terminal/lens/research/`. Both use the shared layout/footer, disable the
assistant and third-party analytics, and are initially noindex. Terminal and
its research ledger link to the workspace. Launch follow-up and deployed-preview
evidence are recorded in LAUNCH.md. No provider subscription was purchased.

## Checkpoint 1 — real public data and sourced astronomy

- Same-origin `/api/registry/lens`, explicitly rewritten into the existing
  compatibility function. Whitelisted BTC-USD/ETH-USD, Coinbase Exchange,
  USD spot, hourly/daily candles; maximum 900 requested bars and 300 per page.
- Validated OHLCV, sorting, duplicate/conflict handling, gap metadata,
  provisional/finalized status, venue/source and refresh time. Base-asset volume.
- Bounded retries/timeouts, server-side refresh limit, request coalescing,
  public caching, and visibly stale fallback for the identical requested range.
- Independently verified SMA20/50, SMA-seeded EMA20 and Wilder RSI14.
  Finalized candles only; gaps reset warm-up.
- 1,804 source-backed sky events, 60 UTC month shards for 2026–2030, stable
  IDs, source hashes, engine versions, conventions, linked eclipse/lunation
  records and explicit limits. Moon ingresses use the existing supported
  2026–2028 catalog; unsupported shared aspect pairs remain excluded.
- Live probes passed for both assets and intervals. The event drift check is
  included in the normal prebuild lifecycle.

## Checkpoint 2 — usable browser workspace

- Lazy chart with candles, volume, moving averages, RSI and exact-event
  references. Indicator runs do not connect across missing intervals.
  Viewport survives refreshes; axis and detail times use the selected IANA zone.
- Month/week/day/agenda calendar, shared sky filters and exact UTC ICS exports.
  Narrow screens open the agenda; month view has an accessible day-event list.
- Explicit user watch conditions, finalized-bar evaluation at candle close,
  creation cutoff and deduplicated reminders. Monitoring runs while the page
  is open. Pause/resume retains reminder identity.
- Dedicated IndexedDB journal/rules store, no account or wallet required.
  Revision history, fixed original method/horizon/event references, manual
  outcomes, JSON export/import, conflict-preserving merges and deletion.
- Atomic compare-and-save transactions prevent stale tabs from overwriting
  newer entries or restoring deletions. Conflicts reload saved state, preserve
  drafts, and allow a reviewed retry. Drafts survive workspace view changes.
- Imports are size/schema/text bounded and render as plain text. A failed
  import does not disable healthy storage; blocked storage leaves public
  chart/calendar functions usable. Private contents never enter API requests.

## Checkpoint 3 — historical inspection and forecasting experiment

- Event-history explorer matches family/subtype/body pair/aspect, with optional
  ingress sign, consistent before/after bar windows and coverage conventions.
  Complete, pending and incomplete rows stay visible. Gaps and unfinished
  windows are excluded from aggregates; overlaps and linked occurrences are
  flagged. This is descriptive research without entry/exit rules or costs.
- The separate versioned experiment used 4,091 BTC and 3,786 ETH real daily
  bars, fixed TA/lunar features, chronological validation, training-only
  scaling, purged boundaries and an untouched 2023-onward primary holdout.
- The runner validates source-response/dataset hashes and runtime-engine files
  against the pinned archive. Offline reruns reproduce scores and uncertainty.
- The tested lunar features showed no consistent incremental benefit. The
  post-hoc matched-penalty diagnostics are inconclusive for both assets;
  combined models underperform persistence baselines. Public model forecasts
  remain disabled. See ../../research/market-lens/REPORT.md for the full result.
- Raw pages, features, weights, and predictions remain outside the checkout at
  `/workspace/.onboarding/lens-research/v1`; no raw market dataset is published.

## Checkpoint 4 — verification and review

- Independent review covered time alignment, storage races, privacy,
  provider validation, chart gaps, accessibility and research leakage.
  Identified asset-switch, conflict/draft, timezone and reminder issues were fixed.
- Focused tests: 80 Lens/event/research/routing assertions; 96 including the
  affected build and acceptance audits.
- Browser acceptance: 12 workflows, using real API responses for BTC/ETH and
  both intervals. Includes fractional timezone, indicator table, all calendar
  views/ICS, rules lifecycle, journal revision/export/import/delete/reload,
  invalid-import recovery, concurrent tabs/deletion/draft preservation,
  expanded history, provider outage, 390px views, unavailable private storage,
  and a controlled regression fixture for asset switching.
- No page exceptions, private note payload transmission, or third-party
  analytics requests in the acceptance run. Both the development server and
  built production UI passed all 12 workflows. See browser-acceptance.json and
  LAUNCH.md for evidence; price-bearing screenshots remain in private session
  artifacts pending display rights.
- Normal production build, static checks, generated-event drift check,
  artifact/link integrity and JavaScript budget enforcement pass.
  Lens initial JavaScript is about 27.6 KB gzip (32 KB route budget); the
  chart loads separately at about 50.1 KB, below the existing 60 KB global cap.
  Consumer engine-isolation checks pass; global budgets were not raised.
- Adding the pinned chart dependency changes the daily generator provenance
  hash and the existing Phase 1 acceptance source boundary. Regenerated the
  exact provenance receipt and all 18 required visual captures using the
  normal generators/drivers; their verification tests pass.
- Initial full suite: 6,429 passed, 4 skipped, and 2 baseline failures.
  Launch follow-up preserves the owner-approved “Your horoscope” label,
  corrects the stale CTA contract/reference, and regenerates October assistant
  context with its normal generator. Current validation is recorded in LAUNCH.md.

## Checkpoint 5 — launch preparation and prospective protocol

- DATA-RIGHTS.md records official-source findings and an owner-send provider
  request. The owner confirmed no display license. Hosted Coinbase prices
  return a noncached 503 until `MARKET_LENS_COINBASE_DISPLAY_ENABLED=1` is set
  after a suitable grant; the real adapter still works in local development.
- A separate frozen 180-day paper-study runner records decisions before future
  execution, settles complete candles, applies equal costs and reports paired
  returns, drawdown and coverage. See ../../research/market-lens/PROSPECTIVE.md.
  Persistent scheduling and independent decision witnessing remain unconfigured.

## Run and reproduce

```sh
cd /workspace/site
source /workspace/.onboarding/activate.sh
# This cloud runtime needs its HTTPS environment proxy for Node's public fetch.
# TLS validation stays enabled.
NODE_OPTIONS=--use-env-proxy npm run dev -- --host 127.0.0.1 --port 4321

npm run check
npm run build
npm test -- --maxWorkers=2 --minWorkers=1
npm run data:market-lens:check
OUT_DIR=/tmp/lens-browser npm run test:market-lens:browser
# Checks built production UI with the real local API behind a same-origin proxy.
OUT_DIR=/tmp/lens-production node tests/market-lens-preview-drive.mjs
# Personal calendar, risk, access and cross-tab acceptance against development.
OUT_DIR=/tmp/lens-revised node tests/market-lens-revised-drive.mjs
# Refresh official schedules manually; inspect changed sources before committing.
python3 scripts/update-market-lens-economics.py --year 2026
```

The dev adapter exercises the same public handler as production. Astro's static
preview alone does not execute Vercel functions. The production browser driver
checks the built assets using the local API; it does not certify Vercel edge
routing. Verify `/api/registry/lens` on an owner-authorized deployed preview
before release.

```sh
node scripts/market-lens-research.mjs run --dir /workspace/.onboarding/lens-research/v1
```

This rerun is offline and verifies reproducibility, not a new unseen evaluation.
Read the frozen manifest and the separate research README before reacquiring data.

## APIs, licensing and release limits

No API key, X API, paid model or GPU is needed for local development. Public
display rights are unconfirmed and hosted prices remain disabled pending a
grant. See DATA-RIGHTS.md for the source-backed provider recommendation and
prepared request. X/news context and background notifications remain later
scope. The app never silently splices prices from another venue.

Lightweight Charts 5.0.9 is pinned (Apache 2.0), with TradingView attribution/logo
and required NOTICE/LICENSE files in this directory and the public chart-license
path. Its fancy-canvas 2.1.0 dependency is MIT, with the upstream license
retained alongside these files. Notes are browser-local, not synced or
independently attested. Device loss can lose them; users can export their backups.

This version supports user hypotheses and watch conditions, not automated
execution or validated model predictions. A future forecasting release needs a
new evaluation protocol, independent review and a prospectively timestamped
paper-forecast period; a negative retrospective result is not a reason to tune
against the same holdout and describe it as new evidence.
