# Fixed prospective paper study

`prospective-manifest.json` declares 180 execution days: October 2, 2026 through
March 30, 2027, ending March 31 UTC. This pilot is separate from the
retrospective classifier. It does not deploy forecasts or place orders.

Separate $10,000 accounts per asset compare SMA20 > SMA50 with the same TA
rule plus a fixed 12° new/full lunar phase gate at execution midnight. The
filter is an arbitrary hypothesis, not a validated signal or historically
optimized rule. Both arms buy at next day's open and sell at its close, with
10 basis points fee and 5 basis points adverse slippage on each side. These
are daily round trips, not a continuously held SMA crossover portfolio.

Decisions use the previous day's finalized close and are recorded at least
15 minutes before execution. Acquisition crossing the deadline fails. Missed
decisions cannot be backfilled. Settlement waits for finalized candles plus
a five-minute publication delay. No missing prices are filled.

## Run

Use a persistent private directory **outside the checkout**, never `public/`.
It holds protocol/source hashes and write-once raw decisions/settlements.

```sh
node scripts/market-lens-paper.mjs init --dir /private/persistent/lens-paper-v1
node scripts/market-lens-paper.mjs record --dir /private/persistent/lens-paper-v1
node scripts/market-lens-paper.mjs settle --dir /private/persistent/lens-paper-v1
node scripts/market-lens-paper.mjs report --dir /private/persistent/lens-paper-v1
```

Initialize before the first execution day. Run `record` daily, ideally at
00:10 UTC for the following day; `settle` after 00:05 UTC for completed days;
then `report`. First record is October 1, first execution October 2, first
settlement October 3. Duplicate records fail; settlements reuse receipts.
The source, lockfile and engine hashes freeze at init. Use the same pinned
implementation for all 180 days; unrelated website dependency updates must
not change its runtime. Protocol changes need a new version and future window.

## Interpretation and operations

Reports include net return, daily-close equity drawdown, fees/slippage,
trades, exposure and paired coverage separately for BTC and ETH. Compounding
stops across unresolved settlements. Missed days leave both arms in cash.
BTC and ETH are correlated; do not pool them as independent evidence. Interim
reports are descriptive, with no early efficacy decision or parameter tuning.
Daily-close drawdown excludes intraday losses; costs are simulated assumptions.

Local write-once hashes detect accidental edits; timestamps are not independent
attestation. This session's files/processes cannot be assumed to persist for
180 days. A durable private volume, daily scheduler, backup and independent
decision-hash witness are **not configured** by this patch. The runner works;
a local first decision is not a managed or independently witnessed study.

Arrange these before relying on the study as prospective evidence. Witness
each decision hash before execution without publishing raw prices. The draft
PR records the protocol before the future window, but does not attest every
daily decision. Applicable research/display rights are described in
`docs/market-lens/DATA-RIGHTS.md`.
