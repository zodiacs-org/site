# Market-data release decision

Reviewed 2026-10-01. The owner confirmed no display license is currently held.
Hosted prices are disabled by default. Do not enable
`MARKET_LENS_COINBASE_DISPLAY_ENABLED=1` until a written grant covers this use.
Local development retains the real adapter; the calendar and browser-local
journal do not require a market-data subscription.

## Sources and findings

- [Coinbase Exchange documentation](https://docs.cdp.coinbase.com/exchange/introduction/welcome)
  says market-data APIs are public and access binds users to its
  [Market Data Terms of Use](https://www.coinbase.com/legal/market_data).
  The legal page returned HTTP 403 here. Its present clauses were **not
  verified**; public access establishes neither a prohibition nor permission
  to display/redistribute candles. Do not substitute a guessed clause.
- [CoinAPI customer agreement](https://www.coinapi.io/legal#terms), effective
  2025-08-18, §1.2 grants use “for your internal business purposes only.” §2.3
  says external sources may require additional third-party license agreements.
  §1.3 permits overriding service-specific terms. An ordinary paid plan does
  not establish the needed display grant.
- [CoinAPI monthly pricing](https://www.coinapi.io/products/market-data-api/pricing)
  lists Startup $79/month (1,000 REST credits/day), Streamer $249/month
  (10,000/day), and Pro $599/month (100,000/day). These are access prices,
  **not display-license quotes**. Enterprise offers custom legal terms.
  No subscription was purchased.

## Recommendation

Ask Coinbase first for a display grant; that preserves the implemented venue
and research data. If unavailable, request CoinAPI custom terms explicitly
covering the underlying Coinbase Exchange source. Confirm permission before
buying access. An alternate feed needs its own adapter, source receipts and
a new prospective protocol if venue/candles change. No X API is needed here.

## Draft provider request — owner sends

Subject: BTC/ETH OHLCV display permission for zodiacs.org Market Lens

We are preparing a browser research workspace at zodiacs.org that lets users
compare technical indicators with astronomical event timestamps. We want to
display Coinbase Exchange BTC-USD and ETH-USD spot OHLCV at hourly and daily
intervals, with venue attribution and no order execution.

Our server retrieves bounded histories (at most 900 requested buckets per
interactive request), caches briefly, and sends candles to an interactive
chart and accessible browser table. Users can inspect past event windows, keep private setups and risk estimates,
and compare shared sky, browser-calculated personal transits and official
economic schedules. Personal chart inputs and calculations stay on device;
no personal data is sent to the market provider. We also run a private paper study; raw responses stay
outside the public repository. Published study results would be aggregate
strategy metrics, not a downloadable raw dataset.

Please confirm in writing the permission and complete price for:

1. Public browser display of hourly/daily OHLCV, derived SMA/EMA/RSI, event-window return/range/volatility statistics and matched non-event comparisons.
2. Server caching and candle delivery to browsers, including any restriction
   on JSON endpoints or automated extraction.
3. Private historical research storage, paper-study use and publication of
   aggregate derived performance metrics.
4. Required attribution, delay, retention, territory/audience limits,
   underlying exchange permissions, commercial use and termination duties.
5. A suitable plan and rate limits. The initial audience is not yet measured;
   please quote a low-volume pilot and growth tiers.

Please identify all applicable documents and separate source agreements. We
are seeking a display grant, not permission to execute transactions.

## Enablement after a grant

Keep the granted scope in private contract records. Set
`MARKET_LENS_COINBASE_DISPLAY_ENABLED=1` in the appropriate Vercel environment
only if the existing adapter fits that scope, then redeploy. Run the real
BTC/ETH hourly/daily browser drive and retain its receipt. A disabled-path
preview smoke does not validate the enabled upstream path. Production release
is outside this change.
