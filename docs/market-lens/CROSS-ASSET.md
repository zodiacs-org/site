# Cross-asset catalog and provider checkpoint

Reviewed 7 October 2026, Asia/Bangkok. Catalog `2026-10-06.1` contains 52 explicitly identified instruments: 4 crypto pairs, 10 stock candidates, 8 benchmark references plus 8 ETF exposures, 11 FX pairs and 11 commodity ETF/research series. This is an extensible planning universe, not a claim of licensed live coverage or validated blue-chip eligibility.

The picker supports asset-class navigation, search and browser-local favorites. Selected IDs survive preferences, journal edits and exports. Schema 1 BTC/ETH workspaces migrate to schema 2 at read and the next atomic compare-and-save; the original text/revisions are preserved and failed validation never resets storage. Canonical profile access remains guarded; market requests contain only instrument, interval and bounded dates, never chart data or notes.

## Coverage

| Class | Catalog | Implemented price path | Activation limits |
| --- | --- | --- | --- |
| Crypto | BTC/ETH/SOL/XRP USD at Coinbase | Bounded hourly/daily Coinbase adapter | Written display grant remains absent; never enable based on public API access alone |
| Stocks | AAPL/MSFT/NVDA/JPM plus SAP/AZN/LVMH/Toyota/Tencent/BHP | Twelve Data daily adapter and server-side discovery | Exact mapping, corporate actions, permissions and overseas calendars/tick tables require reviewed evidence |
| Index exposure | S&P500/Nasdaq100/Dow/DAX/FTSE100/Nikkei225/HangSeng/ASX200 | Named cash ETF candidates; reference index prices unavailable | Index values are not orders or tradable units; no ETF/index substitution |
| FX | Seven majors; EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY | Provider interface and explicit daily session schedules | Feed-specific daily-close/holiday convention must be verified; NY17 planning calendar is not assumed to match Twelve Data |
| Commodities | GLD/SLV/USO/BNO/UNG/CPER fund prices; GC/SI/CL/NG/HG continuous research identifiers | ETF path through licensed daily adapter | Funds carry basis/roll costs; continuous series have no executable expiry and cannot be sized; Databento acquisition is not enabled |

All stock/index entries are **candidates** dated 6 October. The catalog does not falsely certify index membership or measured liquidity. Before promoting eligibility, archive the relevant administrator/issuer constituent list as of the inclusion date and 60 completed sessions proving median daily traded value ≥ USD20m equivalent with ≥95% session coverage (crypto/FX: venue-specific USD50m). No source data has been acquired under a new subscription. Variable overseas tick/lot metadata is unavailable and the risk calculator refuses it.

## Calculation and data contract

US-equity core sessions use the [NYSE 2026–2027 calendar](https://www.nyse.com/trade/hours-calendars), including holidays, half days and New York DST. Requests outside complete verified coverage fail. Overseas markets require an approved explicit schedule. FX NY17 sessions use Monday close-date labels with Sunday opens; provider activation requires its own confirmed daily definition. Daily session bars finalize after 300 seconds. Indicators and watch crossings follow expected next sessions, restart after missing bars and unadjusted splits, and use actual session closes. Chart gaps represent expected missing sessions, not closed weekends. History horizons count 1/3/7 sessions for session datasets; UTC weekday matched controls remain unavailable for them.

Twelve Data requests explicitly use `adjust=none`, regular sessions, max 900 daily rows, six-second timeout, bounded response bytes and an in-memory 60-second cache (100 keys). No cross-provider fallback. Credentials travel in server-side authorization headers. The adapter verifies returned symbol, currency, exchange and timezone against an operator-reviewed mapping; it requires declared corporate-action coverage even when the list is empty. Browser datasets revalidate prices, session boundaries, finalized flags and coverage. HTTP responses use `private, no-store` so rights revocation cannot leave CDN-held prices visible. Coinbase retains its bounded stale fallback; other provider failures explicitly withhold prices.

Sizing uses quote currency, outward adverse tick rounding, lot rounding down, multiplier, two-sided fees/slippage and a cash cap. GBX means pence, not GBP. No implicit FX conversion. Futures calculations require an explicitly verified unexpired individual contract, no-roll policy and margin per contract; catalog continuous series are refused. The current UI saves cash plans only. Legacy USD spot plans remain interpretable with their original assumptions.

## Official provider review

Sources inspected 6 October UTC / 7 October Bangkok; no new inquiry was sent and no subscription was purchased.

| Provider | Suitability | Rights and operational decision |
| --- | --- | --- |
| Coinbase Exchange | Preserves existing crypto venue and v2 method | Current [Market Data Terms](https://www.coinbase.com/legal/market_data) require prior written consent for external redistribution/display and derived works. Existing gate remains off. v2 frozen receipts are unchanged. |
| Twelve Data | Practical candidate for stocks, ETFs, FX and international daily coverage; [timezone documentation](https://support.twelvedata.com/en/articles/5745849-timezones) distinguishes exchange-local daily data | [Terms §§2–3](https://twelvedata.com/terms) require explicit external-display/redistribution scope and applicable source agreements; caching and retention restrictions remain contract-specific. Recommend requesting a scoped pilot quote, not purchasing a standard plan as presumed permission. |
| Databento | Candidate for explicit futures contracts, instrument definitions and historical symbology; [official historical API](https://databento.com/docs/api-reference-historical) | [Pricing/licensing](https://databento.com/pricing/) depends on dataset/use. Confirm exchange redistribution and retained research rights. Defer live integration until futures protocol and entitlements are agreed. Continuous identifiers are research-only placeholders. |
| CoinAPI | Existing crypto inquiry, acknowledged 1 October | No written grant received in this session. Existing [customer agreement](https://www.coinapi.io/legal#terms) review and contact receipt are retained in DATA-RIGHTS.md. Do not resend blindly. |

Candidate membership sources: [S&P500 methodology](https://www.spglobal.com/spdji/en/indices/equity/sp-500/), [MSCI methods](https://www.msci.com/indexes/index-resources/index-methodology), [SPY issuer holdings](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy). Dated membership/ADTV receipts are still required before study eligibility; catalog search availability does not certify membership.

## Secure configuration after approval

- `MARKET_LENS_COINBASE_DISPLAY_ENABLED`: leave disabled until the written grant covers all enabled crypto pairs and derived uses.
- `TWELVE_DATA_API_KEY`: server-only secret, never a public/Vite-prefixed variable.
- `MARKET_LENS_TWELVE_DATA_DISPLAY_ENABLED`: defaults off.
- `MARKET_LENS_TWELVE_DATA_CONFIG`: server-only JSON containing `grantId`, `validUntil`, and an `instruments` map keyed by stable catalog ID. Each mapping has verified `symbol`, `exchange`, `currency`, `timeZone`, `actionsFrom`, `actionsThrough`, `splits:[{effectiveDate,ratio}]`, and an explicit `sessions:[{date,open,close,nextOpen}]` where the built-in US calendar does not apply. Do not fill unknown data with guessed defaults.

Request a written quote covering public browser display, JSON candle delivery, derived indicators/history, bounded caching, private retained research, backup retention and aggregate publication; enumerate every venue and instrument family. Ask for attribution, delays, quotas, termination/deletion obligations and source exchange fees. Reply address remains admin@zodiacs.org. This is a prepared request scope, not a sent message or budget authorization.
