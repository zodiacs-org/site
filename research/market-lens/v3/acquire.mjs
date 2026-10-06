var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};

// src/exchange/lens/catalog.ts
function item(id, name, assetClass, symbol, quote, venue, calendar, timeZone, kind, url, extra = {}) {
  return {
    id,
    name,
    symbol,
    base: symbol,
    quote,
    venue,
    calendar,
    timeZone,
    kind,
    sourceUrl: url,
    catalogVersion: CATALOG_VERSION,
    tickSize: 0.01,
    lotSize: 1,
    multiplier: 1,
    provider: { id: "twelve-data", symbol, exchange: venue, coverage: "mapping-pending" },
    eligibility: { asOf: "2026-10-06", source, benchmark: "Candidate universe; membership and liquidity must be verified", status: "candidate", liquidity: LIQUIDITY_RULE },
    lifecycle: "candidate",
    rights: "pending-written-grant",
    freshnessSeconds: 900,
    assetClass,
    ...extra
  };
}
var CATALOG_VERSION, LIQUIDITY_RULE, source, crypto, stocks, indexRows, indices, fx, commodities, futures, researchSeries, INSTRUMENTS;
var init_catalog = __esm({
  "src/exchange/lens/catalog.ts"() {
    "use strict";
    CATALOG_VERSION = "2026-10-06.1";
    LIQUIDITY_RULE = "Before activation: dated benchmark membership and 60 completed sessions; median daily traded value \u2265 USD 20m equivalent, \u226595% session coverage; FX/crypto venue-specific notional \u2265 USD 50m. No eligibility claim without the measured snapshot.";
    source = "https://www.msci.com/indexes/index-resources/index-methodology";
    crypto = ["BTC", "ETH", "SOL", "XRP"].map((symbol) => item(`${symbol}-USD`, { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP" }[symbol], "crypto", symbol, "USD", "Coinbase Exchange", "24x7", "UTC", "spot", `https://exchange.coinbase.com/trade/${symbol}-USD`, {
      base: symbol,
      lotSize: symbol === "BTC" ? 1e-8 : 1e-6,
      tickSize: symbol === "XRP" ? 1e-4 : 0.01,
      provider: { id: "coinbase", symbol: `${symbol}-USD`, coverage: "adapter" },
      lifecycle: "active"
    }));
    stocks = [
      ["XNAS:AAPL", "Apple", "AAPL", "USD", "NASDAQ", "US-equities", "America/New_York", "S&P 500"],
      ["XNAS:MSFT", "Microsoft", "MSFT", "USD", "NASDAQ", "US-equities", "America/New_York", "S&P 500"],
      ["XNAS:NVDA", "NVIDIA", "NVDA", "USD", "NASDAQ", "US-equities", "America/New_York", "S&P 500"],
      ["XNYS:JPM", "JPMorgan Chase", "JPM", "USD", "NYSE", "US-equities", "America/New_York", "S&P 500"],
      ["XETR:SAP", "SAP", "SAP", "EUR", "XETRA", "XETR", "Europe/Berlin", "DAX"],
      ["XLON:AZN", "AstraZeneca", "AZN", "GBX", "LSE", "XLON", "Europe/London", "FTSE 100"],
      ["XPAR:MC", "LVMH", "MC", "EUR", "Euronext Paris", "XPAR", "Europe/Paris", "CAC 40"],
      ["XTKS:7203", "Toyota Motor", "7203", "JPY", "JPX", "XTKS", "Asia/Tokyo", "Nikkei 225"],
      ["XHKG:0700", "Tencent", "0700", "HKD", "HKEX", "XHKG", "Asia/Hong_Kong", "Hang Seng"],
      ["XASX:BHP", "BHP Group", "BHP", "AUD", "ASX", "XASX", "Australia/Sydney", "ASX 200"]
    ].map(([id, name, symbol, quote, venue, calendar, zone, benchmark]) => item(id, name, "stocks", symbol, quote, venue, calendar, zone, "stock", source, {
      eligibility: { asOf: "2026-10-06", source, benchmark, status: "candidate", liquidity: LIQUIDITY_RULE },
      // Variable tick tables and overseas board lots require provider discovery.
      ...calendar !== "US-equities" ? { tickSize: void 0, lotSize: void 0 } : {}
    }));
    indexRows = [
      ["SPX", "S&P 500", "USD", "SPY", "NYSE", "US-equities", "America/New_York"],
      ["NDX", "Nasdaq-100", "USD", "QQQ", "NASDAQ", "US-equities", "America/New_York"],
      ["DJI", "Dow Jones Industrial Average", "USD", "DIA", "NYSE", "US-equities", "America/New_York"],
      ["DAX", "DAX", "EUR", "EXS1", "XETRA", "XETR", "Europe/Berlin"],
      ["UKX", "FTSE 100", "GBP", "ISF", "LSE", "XLON", "Europe/London"],
      ["N225", "Nikkei 225", "JPY", "1321", "JPX", "XTKS", "Asia/Tokyo"],
      ["HSI", "Hang Seng", "HKD", "2800", "HKEX", "XHKG", "Asia/Hong_Kong"],
      ["AS51", "ASX 200", "AUD", "STW", "ASX", "XASX", "Australia/Sydney"]
    ];
    indices = indexRows.flatMap(([symbol, name, quote, etf, venue, calendar, zone]) => [
      item(`INDEX:${symbol}`, `${name} reference`, "indices", symbol, quote, "Index administrator", calendar, zone, "reference", source, { provider: { id: "none", symbol, coverage: "unsupported" }, tickSize: void 0, lotSize: void 0 }),
      item(`ETF:${venue}:${etf}`, `${etf} \xB7 ${name} exposure`, "indices", etf, symbol === "UKX" ? "GBX" : quote, venue, calendar, zone, "etf", source, { proxyFor: `INDEX:${symbol}`, ...calendar !== "US-equities" ? { tickSize: void 0, lotSize: void 0 } : {} })
    ]);
    fx = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY"].map((pair) => item(`FX:${pair}`, pair, "fx", pair, pair.slice(4), "OTC composite", "FX-NY17", "America/New_York", "spot", "https://twelvedata.com/forex", {
      base: pair.slice(0, 3),
      tickSize: pair.endsWith("JPY") ? 1e-3 : 1e-5,
      lotSize: 1e3,
      provider: { id: "twelve-data", symbol: pair, coverage: "mapping-pending" }
    }));
    commodities = [
      ["GLD", "Gold", "https://www.spdrgoldshares.com/"],
      ["SLV", "Silver", "https://www.ishares.com/us/products/239855/ishares-silver-trust-fund"],
      ["USO", "WTI crude oil", "https://www.uscfinvestments.com/uso"],
      ["BNO", "Brent crude oil", "https://www.uscfinvestments.com/bno"],
      ["UNG", "Natural gas", "https://www.uscfinvestments.com/ung"],
      ["CPER", "Copper", "https://www.uscfinvestments.com/cper"]
    ].map(([symbol, name, url]) => item(`ETF:NYSE:${symbol}`, `${name} \xB7 ${symbol} proxy`, "commodities", symbol, "USD", "NYSE", "US-equities", "America/New_York", "etf", url, { proxyFor: name, roll: "Fund-managed exposure; fund price is not commodity spot or a futures settlement." }));
    futures = [["GC", "Gold", 100, 0.1], ["SI", "Silver", 5e3, 5e-3], ["CL", "WTI crude oil", 1e3, 0.01], ["NG", "Natural gas", 1e4, 1e-3], ["HG", "Copper", 25e3, 5e-4]];
    researchSeries = futures.map(([symbol, name, multiplier, tickSize]) => item(`CONT:${symbol}`, `${name} continuous research series`, "commodities", `${symbol}.c.0`, "USD", "CME", "CME-contract", "America/Chicago", "continuous", "https://databento.com/docs/standards-and-conventions/symbology", {
      multiplier,
      tickSize,
      provider: { id: "databento", symbol: `${symbol}.c.0`, coverage: "unsupported" },
      roll: "Calendar-ranked unadjusted series. Not tradable. Select and verify an individual expiry before sizing or research activation."
    }));
    INSTRUMENTS = Object.fromEntries([...crypto, ...stocks, ...indices, ...fx, ...commodities, ...researchSeries].map((row) => [row.id, row]));
  }
});

// src/exchange/lens/sessions.ts
function localInstant(date, hour, minute, zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw Error("Invalid session date.");
  const target2 = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  let candidate = target2;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(candidate).map((p2) => [p2.type, p2.value]));
    const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if (represented === target2) return candidate / 1e3;
    candidate += target2 - represented;
  }
  throw Error("Ambiguous or nonexistent local session time.");
}
function sessionBounds(calendar, date) {
  const day = new Date(date).getUTCDay();
  if (calendar === "24x7") return { open: Date.parse(date) / 1e3, close: Date.parse(addDate(date, 1)) / 1e3 };
  if (calendar === "US-equities") {
    if (date < "2026-01-01" || date > "2027-12-31") throw Error("Verified equity calendar covers 2026\u20132027 only.");
    if (day === 0 || day === 6 || holidays.has(date)) return null;
    return { open: localInstant(date, 9, 30, "America/New_York"), close: localInstant(date, halfDays.has(date) ? 13 : 16, 0, "America/New_York") };
  }
  if (calendar === "FX-NY17") {
    if (day === 0 || day === 6) return null;
    return { open: localInstant(addDate(date, -1), 17, 0, "America/New_York"), close: localInstant(date, 17, 0, "America/New_York") };
  }
  throw Error("This exchange calendar has not been verified.");
}
function sessionFor(calendar, date) {
  const current = sessionBounds(calendar, date);
  if (!current) return null;
  for (let offset = 1; offset < 12; offset++) {
    const next = sessionBounds(calendar, addDate(date, offset));
    if (next) return { date, ...current, nextOpen: next.open };
  }
  throw Error("Next session is unavailable.");
}
function sessionsBetween(calendar, start2, end2) {
  if (!Number.isFinite(start2) || !Number.isFinite(end2) || end2 <= start2 || end2 - start2 > 902 * 86400) throw Error("Session range is invalid.");
  const result = [];
  for (let date = new Date((start2 - 86400) * 1e3).toISOString().slice(0, 10); Date.parse(date) / 1e3 < end2 + 86400; date = addDate(date, 1)) {
    if (calendar === "US-equities" && (date < "2026-01-01" || date > "2027-12-31")) continue;
    const s = sessionFor(calendar, date);
    if (s && s.open >= start2 && s.open < end2) result.push(s);
  }
  if (calendar === "US-equities" && (start2 < Date.parse("2026-01-01") / 1e3 || end2 > Date.parse("2027-12-24") / 1e3)) throw Error("Requested range exceeds complete verified calendar coverage.");
  return result;
}
function markCorporateActions(candles, sessions, splits) {
  const dates = new Map(sessions.map((s) => [s.date, s.open]));
  const breaks = /* @__PURE__ */ new Set();
  for (const split of splits) {
    if (!Number.isFinite(split.ratio) || split.ratio <= 0 || !dates.has(split.effectiveDate)) throw Error("Corporate action is outside verified sessions.");
    breaks.add(dates.get(split.effectiveDate));
  }
  return candles.map((c) => ({ ...c, ...breaks.has(c.time) ? { adjustmentBreak: true } : {} }));
}
var holidays, halfDays, addDate;
var init_sessions = __esm({
  "src/exchange/lens/sessions.ts"() {
    "use strict";
    holidays = /* @__PURE__ */ new Set(["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25", "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"]);
    halfDays = /* @__PURE__ */ new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);
    addDate = (date, days) => new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10);
  }
});

// src/exchange/lens/provider-contract.ts
function validateSessions(rows, start2, end2) {
  if (!Array.isArray(rows) || rows.length > 900) throw Error("Session coverage is invalid.");
  const dates = /* @__PURE__ */ new Set();
  for (const [index, s] of rows.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || dates.has(s.date) || ![s.open, s.close, s.nextOpen].every(Number.isSafeInteger) || s.open < start2 || s.open >= end2 || s.close <= s.open || s.close - s.open > 86400 || s.nextOpen < s.close || s.nextOpen <= s.open || s.nextOpen - s.close > 12 * 86400 || index > 0 && rows[index - 1].nextOpen !== s.open) throw Error("Session schedule is inconsistent.");
    dates.add(s.date);
  }
}
function normalizeSessionCandles(rows, sessions, now2, splits = []) {
  if (!Array.isArray(rows) || rows.length > 900) throw Error("Invalid candle response.");
  const schedule = new Map(sessions.map((s) => [s.date, s]));
  const candles = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object" || typeof row.datetime !== "string") throw Error("Invalid provider bar.");
    const s = schedule.get(row.datetime);
    if (!s) throw Error("Provider returned an unexpected session date.");
    const nums = ["open", "high", "low", "close", "volume"].map((key) => key === "volume" && row[key] === void 0 ? 0 : typeof row[key] === "string" && /^\d+(\.\d+)?$/.test(row[key]) ? Number(row[key]) : NaN);
    const [open, high, low, close, volume] = nums;
    if (!nums.every(Number.isFinite) || Math.min(open, high, low, close) <= 0 || volume < 0 || low > Math.min(open, close) || high < Math.max(open, close) || candles.has(s.open)) throw Error("Malformed or duplicate session price.");
    candles.set(s.open, { time: s.open, open, high, low, close, volume, complete: s.close + 300 <= now2, closeTime: s.close, nextTime: s.nextOpen });
  }
  return markCorporateActions([...candles.values()].sort((a2, b) => a2.time - b.time), sessions, splits);
}
var init_provider_contract = __esm({
  "src/exchange/lens/provider-contract.ts"() {
    "use strict";
    init_sessions();
    init_catalog();
  }
});

// scripts/market-lens-v3-acquire.ts
import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// api/_registry/lens-providers.ts
init_catalog();
init_sessions();
init_provider_contract();

// src/exchange/lens/market.ts
init_catalog();
init_catalog();
var INTERVAL_SECONDS = { "1h": 3600, "1d": 86400 };
var MAX_MARKET_BARS = 900;
var DEFAULT_MARKET_BARS = 240;
var MarketDataError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "MarketDataError";
  }
  code;
};
function epochParameter(value, name) {
  if (value === null) return void 0;
  if (!/^\d{1,11}$/.test(value)) throw new MarketDataError("request", `${name} must be Unix seconds.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new MarketDataError("request", `${name} is invalid.`);
  return parsed;
}
function parseMarketQuery(params, now2 = Date.now() / 1e3) {
  const allowed = /* @__PURE__ */ new Set(["instrument", "interval", "start", "end"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      throw new MarketDataError("request", "Unsupported or repeated query parameter.");
    }
  }
  const instrument = params.get("instrument") ?? "BTC-USD";
  const interval = params.get("interval") ?? "1d";
  if (!Object.hasOwn(INSTRUMENTS, instrument) || !Object.hasOwn(INTERVAL_SECONDS, interval)) {
    throw new MarketDataError("request", "Choose BTC-USD or ETH-USD and 1h or 1d.");
  }
  const seconds = INTERVAL_SECONDS[interval];
  const currentEnd = Math.floor(now2 / seconds) * seconds + seconds;
  const end2 = epochParameter(params.get("end"), "end") ?? currentEnd;
  const start2 = epochParameter(params.get("start"), "start") ?? end2 - DEFAULT_MARKET_BARS * seconds;
  if (start2 < 0 || end2 <= start2 || start2 % seconds !== 0 || end2 % seconds !== 0 || end2 > currentEnd || (end2 - start2) / seconds > MAX_MARKET_BARS) {
    throw new MarketDataError("request", `Use a UTC-aligned range of 1\u2013${MAX_MARKET_BARS} bars ending no later than the current bucket.`);
  }
  return { instrument, interval, start: start2, end: end2 };
}
function normalizeCoinbaseCandles(raw, request) {
  if (!Array.isArray(raw)) throw new MarketDataError("response", "The candle provider returned an invalid response.");
  const seconds = INTERVAL_SECONDS[request.interval];
  const byTime = /* @__PURE__ */ new Map();
  const conflicting = /* @__PURE__ */ new Set();
  let rejected = 0;
  let duplicates = 0;
  let conflicts = 0;
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== 6 || !row.every((value) => typeof value === "number" && Number.isFinite(value))) {
      rejected += 1;
      continue;
    }
    const [time, low, high, open, close, volume] = row;
    if (!Number.isSafeInteger(time) || time < 0 || time % seconds !== 0 || low <= 0 || high < low || open < low || open > high || close < low || close > high || volume < 0) {
      rejected += 1;
      continue;
    }
    if (time < request.start || time >= request.end || time > request.now) continue;
    const candle = { time, low, high, open, close, volume, complete: time + seconds <= request.now };
    const existing = byTime.get(time);
    if (existing) {
      duplicates += 1;
      if (existing.low !== low || existing.high !== high || existing.open !== open || existing.close !== close || existing.volume !== volume) {
        conflicting.add(time);
      }
    } else {
      byTime.set(time, candle);
    }
  }
  for (const time of conflicting) {
    byTime.delete(time);
    conflicts += 1;
  }
  const candles = [...byTime.values()].sort((left, right) => left.time - right.time);
  const gaps = [];
  for (let time = request.start; time < request.end && time <= request.now; time += seconds) {
    if (!byTime.has(time)) gaps.push(time);
  }
  return { candles, rejected, duplicates, conflicts, gaps };
}

// api/_registry/lens-providers.ts
var caches = /* @__PURE__ */ new Map();
async function json(url, key, fetcher) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6e3);
  try {
    const r = await fetcher(url, { headers: { Authorization: `apikey ${key}`, Accept: "application/json" }, redirect: "error", signal: controller.signal });
    if (!r.ok) throw Error("Provider request failed.");
    const reader = r.body?.getReader();
    if (!reader) throw Error("Empty response.");
    let size = 0;
    const chunks = [];
    try {
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4e5) throw Error("Response exceeds limit.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    clearTimeout(timer);
  }
}
function configuredGrant(request, env, now2) {
  if (env.MARKET_LENS_TWELVE_DATA_DISPLAY_ENABLED !== "1" || !env.TWELVE_DATA_API_KEY) throw new MarketDataError("unavailable", "Twelve Data display rights and secure credentials are not configured.");
  let grant;
  try {
    grant = JSON.parse(env.MARKET_LENS_TWELVE_DATA_CONFIG ?? "");
  } catch {
    throw new MarketDataError("unavailable", "A verified provider entitlement is required.");
  }
  const i = INSTRUMENTS[request.instrument], mapping = grant.instruments?.[request.instrument];
  if (!grant.grantId?.trim() || !Number.isFinite(Date.parse(grant.validUntil)) || Date.parse(grant.validUntil) <= now2 || !mapping || mapping.symbol !== i.provider?.symbol || mapping.currency !== i.quote || mapping.timeZone !== i.timeZone || typeof mapping.exchange !== "string" || !mapping.exchange || !Array.isArray(mapping.splits) || request.interval !== "1d") throw new MarketDataError("unavailable", "This instrument, interval or entitlement is unavailable.");
  if (Date.parse(mapping.actionsFrom) / 1e3 > request.start || Date.parse(mapping.actionsThrough) / 1e3 < request.end || !Number.isFinite(Date.parse(mapping.actionsFrom)) || !Number.isFinite(Date.parse(mapping.actionsThrough))) throw new MarketDataError("unavailable", "Verified corporate-action coverage is unavailable for this range.");
  return { grant, mapping };
}
async function collectTwelveData(request, options = {}) {
  const env = options.env ?? process.env, now2 = (options.now ?? Date.now)(), i = INSTRUMENTS[request.instrument];
  const { grant, mapping } = configuredGrant(request, env, now2);
  let sessions = mapping.sessions?.filter((s) => s.open >= request.start && s.open < request.end) ?? sessionsBetween(i.calendar, request.start, request.end);
  validateSessions(sessions, request.start, request.end);
  if (i.calendar === "US-equities" && JSON.stringify(sessions) !== JSON.stringify(sessionsBetween(i.calendar, request.start, request.end))) throw Error("Approved schedule differs from core sessions.");
  if (!sessions.length) throw new MarketDataError("unavailable", "No verified sessions in this range.");
  const cacheKey2 = JSON.stringify([request, grant]);
  const cached = caches.get(cacheKey2);
  if (!options.fetch && cached && now2 >= cached.at && now2 - cached.at < 6e4) return cached.dataset;
  const url = new URL("https://api.twelvedata.com/time_series");
  url.search = new URLSearchParams({ symbol: mapping.symbol, exchange: mapping.exchange, interval: "1day", start_date: sessions[0].date, end_date: sessions.at(-1).date, outputsize: "900", order: "asc", adjust: "none", prepost: "false", timezone: "Exchange" }).toString();
  try {
    const raw = await json(url, env.TWELVE_DATA_API_KEY, options.fetch ?? fetch);
    if (raw.status !== "ok" || raw.meta?.symbol !== mapping.symbol || raw.meta?.currency !== mapping.currency || raw.meta?.exchange !== mapping.exchange || raw.meta?.exchange_timezone !== mapping.timeZone) throw Error("Provider identity differs from approved discovery.");
    const candles = normalizeSessionCandles(raw.values, sessions, now2 / 1e3, mapping.splits.filter((s) => sessions.some((session) => session.date === s.effectiveDate)));
    if (!candles.length) throw Error("No validated candles.");
    const times = new Set(candles.map((c) => c.time)), gaps = sessions.filter((s) => !times.has(s.open)).map((s) => s.open);
    const dataset2 = { schema: 2, instrument: i, interval: "1d", sessions, adjustment: "unadjusted-reset-at-split", attribution: "Twelve Data", source: "https://api.twelvedata.com/time_series", fetchedAt: new Date(now2).toISOString(), stale: now2 / 1e3 - sessions.filter((s) => s.close + 300 <= now2 / 1e3).at(-1).close > 4 * 86400, candles, coverage: { requestedStart: request.start, requestedEnd: request.end, start: candles[0].time, end: candles.at(-1).time, gaps }, warnings: ["Twelve Data \xB7 unadjusted regular-session prices; features restart at declared splits. Volume is reported by the feed (FX volume may be unavailable).", ...gaps.length ? [`${gaps.length} expected sessions missing; no prices were filled in.`] : []] };
    if (!options.fetch) {
      if (caches.size >= 100) caches.delete(caches.keys().next().value);
      caches.set(cacheKey2, { at: now2, dataset: dataset2 });
    }
    return dataset2;
  } catch {
    throw new MarketDataError("unavailable", "This provider could not return verified session prices. No substitute feed was used.");
  }
}

// api/_registry/lens-handler.ts
var sharedCache = /* @__PURE__ */ new Map();
var inFlight = /* @__PURE__ */ new Map();
var FRESH_MS = 6e4;
var CACHE_LIMIT = 100;
var PROVIDER_PAGE_BARS = 300;
var UPSTREAM = "https://api.exchange.coinbase.com";
var pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function fetchPage(url, dependencies) {
  const fetcher = dependencies.fetch ?? fetch;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 6e3);
    let waitMs = 250 * 2 ** attempt;
    try {
      const response = await fetcher(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "Zodiacs-Market-Lens/1.0" }, redirect: "error" });
      if (response.ok) {
        const length = Number(response.headers.get("content-length") ?? 0);
        if (length > 25e4) throw new MarketDataError("response", "The provider response exceeded the size limit.");
        const body = await response.text();
        if (body.length > 25e4) throw new MarketDataError("response", "The provider response exceeded the size limit.");
        const data = JSON.parse(body);
        if (!Array.isArray(data) || data.length > 1e3) throw new MarketDataError("response", "The provider candle response is invalid.");
        return data;
      }
      if (response.status !== 429 && response.status < 500) throw new MarketDataError("unavailable", "The market provider rejected the request.");
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter)) {
        const requestedWait = Number(retryAfter) * 1e3;
        if (requestedWait > 2e3) throw new MarketDataError("response", "The market provider requires a later retry.");
        waitMs = Math.max(waitMs, requestedWait);
      }
      lastError = new MarketDataError(response.status === 429 ? "rate-limit" : "unavailable", "The market provider is temporarily unavailable.");
    } catch (error) {
      if (error instanceof MarketDataError && error.code !== "rate-limit" && error.code !== "unavailable") throw error;
      if (error instanceof MarketDataError && error.message === "The market provider rejected the request.") throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await (dependencies.sleep ?? pause)(waitMs);
  }
  if (lastError instanceof MarketDataError) throw lastError;
  throw new MarketDataError("unavailable", "The market provider could not be reached.");
}
async function fetchDataset(request, dependencies) {
  const nowMs = (dependencies.now ?? Date.now)();
  const seconds = INTERVAL_SECONDS[request.interval];
  const rows = [];
  const failedWindows = [];
  for (let start2 = request.start; start2 < request.end; start2 += PROVIDER_PAGE_BARS * seconds) {
    const end2 = Math.min(request.end, start2 + PROVIDER_PAGE_BARS * seconds);
    const url = new URL(`/products/${request.instrument}/candles`, UPSTREAM);
    url.search = new URLSearchParams({ granularity: String(seconds), start: new Date(start2 * 1e3).toISOString(), end: new Date(end2 * 1e3).toISOString() }).toString();
    try {
      const page = await fetchPage(url, dependencies);
      rows.push(...page.filter((row) => !Array.isArray(row) || typeof row[0] !== "number" || row[0] >= start2 && row[0] < end2));
    } catch {
      failedWindows.push({ start: start2, end: end2 });
    }
    if (end2 < request.end) await (dependencies.sleep ?? pause)(100);
  }
  const normalized = normalizeCoinbaseCandles(rows, { ...request, now: nowMs / 1e3 });
  if (!normalized.candles.length) throw new MarketDataError("unavailable", "No validated candles were returned for the requested range.");
  const warnings = ["Volume is measured in the base asset. Current open candles are provisional and excluded from indicators."];
  if (failedWindows.length) warnings.push(`${failedWindows.length} provider page(s) could not be retrieved; coverage is partial.`);
  if (normalized.rejected) warnings.push(`${normalized.rejected} malformed provider record(s) were excluded.`);
  if (normalized.conflicts) warnings.push(`${normalized.conflicts} conflicting candle timestamp(s) were excluded.`);
  if (normalized.gaps.length) warnings.push(`${normalized.gaps.length} requested candle bucket(s) are missing. No prices were filled in.`);
  return {
    schema: 1,
    instrument: INSTRUMENTS[request.instrument],
    interval: request.interval,
    candles: normalized.candles,
    fetchedAt: new Date(nowMs).toISOString(),
    source: `${UPSTREAM}/products/${request.instrument}/candles`,
    stale: false,
    coverage: { requestedStart: request.start, requestedEnd: request.end, start: normalized.candles[0].time, end: normalized.candles.at(-1).time, gaps: normalized.gaps },
    warnings
  };
}
function cacheKey(request) {
  return `${request.instrument}:${request.interval}:${request.start}:${request.end}`;
}
async function collectMarketDataset(request, dependencies = {}) {
  const nowMs = (dependencies.now ?? Date.now)();
  parseMarketQuery(new URLSearchParams({ instrument: request.instrument, interval: request.interval, start: String(request.start), end: String(request.end) }), nowMs / 1e3);
  const provider = INSTRUMENTS[request.instrument].provider;
  if (provider?.id === "twelve-data") return collectTwelveData(request, dependencies);
  if (provider?.id !== "coinbase") throw new MarketDataError("unavailable", "Price coverage is unavailable for this instrument.");
  const key = cacheKey(request);
  const cache = dependencies.cache ?? sharedCache;
  const previous = cache.get(key);
  if (previous && nowMs - previous.cachedAt < FRESH_MS && nowMs >= previous.cachedAt) return previous.dataset;
  const shared = !dependencies.fetch && !dependencies.cache && !dependencies.now;
  if (shared && inFlight.has(key)) return inFlight.get(key);
  const collection = (async () => {
    try {
      const dataset2 = await fetchDataset(request, dependencies);
      if (previous && dataset2.coverage.gaps.length > previous.dataset.coverage.gaps.length) {
        throw new MarketDataError("unavailable", "The refreshed series has less complete coverage.");
      }
      if (cache.size >= CACHE_LIMIT && !cache.has(key)) cache.delete(cache.keys().next().value);
      cache.set(key, { dataset: dataset2, cachedAt: nowMs });
      return dataset2;
    } catch (error) {
      const staleLimit = request.interval === "1h" ? 15 * 6e4 : 6 * 60 * 6e4;
      if (previous && nowMs >= previous.cachedAt && nowMs - previous.cachedAt <= staleLimit) {
        return { ...previous.dataset, stale: true, warnings: [...previous.dataset.warnings, "Provider refresh failed. Showing cached data; check the fetched-at timestamp."] };
      }
      throw error;
    }
  })();
  if (shared) inFlight.set(key, collection);
  try {
    return await collection;
  } finally {
    if (shared) inFlight.delete(key);
  }
}

// research/market-lens/v3/runtime.mjs
import { createHash } from "node:crypto";
import { moonPhase, ENGINE_VERSION } from "@zodiacs/engine";
var hash = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
var epoch = (value) => Date.parse(value) / 1e3;
var finite = (n) => typeof n === "number" && Number.isFinite(n);
function validateProtocol(p2, now2 = Date.now() / 1e3, freezing = false) {
  if (p2.version !== 3 || p2.experimentId !== "market-lens-cross-asset-v3" || p2.status !== "ready" || p2.engineVersion !== ENGINE_VERSION) throw Error("v3 activation is blocked: complete the draft prerequisites.");
  if (!finite(epoch(p2.start)) || epoch(p2.endExclusive) - epoch(p2.start) !== 180 * 86400 || freezing && epoch(p2.start) < now2 + 2 * 86400) throw Error("Freeze requires a fresh 180-day window at least two days ahead.");
  if (p2.leadSeconds !== 900 || p2.publicationDelaySeconds !== 300 || p2.featureSessions !== 50 || p2.initialCapitalPerArm !== 1e4 || p2.publicForecastsEnabled !== false) throw Error("Unexpected v3 method constants.");
  if (!Array.isArray(p2.assets) || !p2.assets.length || p2.assets.length > 50 || new Set(p2.assets.map((a2) => a2.id)).size !== p2.assets.length) throw Error("Fix a unique eligible asset set.");
  for (const a2 of p2.assets) {
    if (!p2.candidateAssets.includes(a2.id) || !["spot", "stock", "etf"].includes(a2.kind) || !["coinbase", "twelve-data"].includes(a2.provider) || !a2.currency || !a2.symbol || !a2.calendarSource || !a2.grantReference || !a2.eligibilityReceiptSha256?.match(/^[a-f0-9]{64}$/) || !a2.acquisitionAcceptanceSha256?.match(/^[a-f0-9]{64}$/) || ![a2.tickSize, a2.lotSize, a2.multiplier].every((n) => finite(n) && n > 0) || a2.multiplier !== 1) throw Error("Asset eligibility, rights, acceptance and instrument metadata are required.");
    if (!finite(a2.feeBps) || !finite(a2.slippageBps) || a2.feeBps < 0 || a2.slippageBps < 0 || a2.feeBps > 1e3 || a2.slippageBps > 1e3) throw Error("Invalid fixed costs.");
    if (!Array.isArray(a2.sessions) || a2.sessions.length < 51 || a2.sessions.length > 500 || new Set(a2.sessions.map((s) => s.id)).size !== a2.sessions.length) throw Error("Freeze the complete session schedule including warmup.");
    for (const [n, s] of a2.sessions.entries()) if (!/^[a-zA-Z0-9_-]{1,40}$/.test(s.id) || ![s.open, s.close].every(Number.isSafeInteger) || s.close <= s.open || s.close - s.open > 86400 || n > 0 && s.open < a2.sessions[n - 1].close || s.adjustmentBreak !== void 0 && typeof s.adjustmentBreak !== "boolean") throw Error("Invalid session schedule.");
    if (a2.sessions.filter((s) => s.close + 300 < epoch(p2.start)).length < 50 || !a2.sessions.some((s) => s.open >= epoch(p2.start) && s.open < epoch(p2.endExclusive))) throw Error("Insufficient warmup or study session coverage.");
  }
  return p2;
}

// scripts/market-lens-v3-acquire.ts
var [manifestFile, instrumentId, output] = process.argv.slice(2);
if (!manifestFile || !instrumentId || !output) throw Error("Use: node acquire.mjs manifest.json catalog-id new-private-output.json");
var p = validateProtocol(JSON.parse(await readFile(manifestFile, "utf8")));
var a = p.assets.find((a2) => a2.id === instrumentId);
if (!a) throw Error("Instrument is not in frozen study.");
if (process.env.MARKET_LENS_V3_PRIVATE_ACQUISITION_ENABLED !== "1") throw Error("Private v3 acquisition is not enabled. Verify the frozen rights and acceptance evidence first.");
var here = path.dirname(fileURLToPath(import.meta.url));
var root = path.resolve(here, here.endsWith(`${path.sep}scripts`) ? ".." : "../../..");
await mkdir(path.dirname(path.resolve(output)), { recursive: true, mode: 448 });
var parent = await realpath(path.dirname(path.resolve(output)));
if (parent === root || parent.startsWith(root + path.sep)) throw Error("Raw acquisition must stay outside the public checkout.");
var now = Date.now() / 1e3;
var eligible = a.sessions.filter((s) => s.close + 300 <= now);
var last = eligible.at(-1);
if (!last) throw Error("No finalized sessions.");
var start = Math.floor(eligible.slice(-60)[0].open / 86400) * 86400;
var end = Math.min(Math.ceil((last.close + 1) / 86400) * 86400, Math.floor(now / 86400) * 86400 + 86400);
var rawResponses = [];
var captureFetch = async (input, init) => {
  const url = new URL(String(input));
  if (!["api.exchange.coinbase.com", "api.twelvedata.com"].includes(url.hostname) || url.protocol !== "https:") throw Error("Unexpected provider origin.");
  const response = await fetch(input, init), reader = response.body?.getReader();
  if (!reader) throw Error("Empty provider response.");
  const chunks = [];
  let length = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4e5) throw Error("Provider response exceeds limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const body = Buffer.concat(chunks);
  if (response.ok) rawResponses.push({ url: url.toString(), receivedAt: Date.now() / 1e3, sha256: hash(body), bodyBase64: body.toString("base64") });
  return new Response(body, { status: response.status, headers: { "content-type": "application/json", ...response.headers.has("retry-after") ? { "retry-after": response.headers.get("retry-after") } : {} } });
};
var dataset = await collectMarketDataset({ instrument: instrumentId, interval: "1d", start, end }, { fetch: captureFetch, cache: /* @__PURE__ */ new Map() });
if (dataset.stale || !rawResponses.length) throw Error("Stale or unreceipted data cannot enter prospective acquisition.");
if (dataset.instrument.quote !== a.currency || dataset.instrument.provider?.id !== a.provider || dataset.instrument.provider?.symbol !== a.symbol) throw Error("Provider identity differs from frozen protocol.");
var acceptedSessions = new Map(a.sessions.map((s) => [s.open, s]));
var snapshot = { instrument: instrumentId, provider: a.provider, symbol: a.symbol, currency: a.currency, receivedAt: Date.now() / 1e3, source: dataset.source, sourceDatasetHash: hash(dataset), rawResponsesHash: hash(rawResponses), candles: dataset.candles.filter((c) => c.complete && acceptedSessions.has(c.time) && acceptedSessions.get(c.time).close + 300 <= Date.now() / 1e3).map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume })) };
for (const c of dataset.candles.filter((c2) => acceptedSessions.has(c2.time))) {
  const s = acceptedSessions.get(c.time);
  if ((c.closeTime ?? c.time + 86400) !== s.close || Boolean(c.adjustmentBreak) !== Boolean(s.adjustmentBreak)) throw Error("Acquired session or corporate action differs from the frozen schedule.");
}
var target = path.join(parent, path.basename(output));
await writeFile(target + ".dataset.json", JSON.stringify({ dataset, rawResponses }) + "\n", { flag: "wx", mode: 384 });
await writeFile(target, JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx", mode: 384 });
console.log(JSON.stringify({ status: "acquired", instrument: instrumentId, sha256: hash(snapshot), bars: snapshot.candles.length }));
