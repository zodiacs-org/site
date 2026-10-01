import {
  INSTRUMENTS, INTERVAL_SECONDS, MarketDataError, normalizeCoinbaseCandles, parseMarketQuery,
  type MarketRequest,
} from '../../src/exchange/lens/market.js';
import type { MarketDataset } from '../../src/exchange/lens/types.js';

export interface MarketCacheEntry { dataset: MarketDataset; cachedAt: number }
export interface MarketDependencies {
  fetch?: typeof fetch;
  /** Milliseconds since Unix epoch. */
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  cache?: Map<string, MarketCacheEntry>;
  timeoutMs?: number;
}

const sharedCache = new Map<string, MarketCacheEntry>();
const inFlight = new Map<string, Promise<MarketDataset>>();
const FRESH_MS = 60_000;
const CACHE_LIMIT = 100;
const PROVIDER_PAGE_BARS = 300;
const UPSTREAM = 'https://api.exchange.coinbase.com';
const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function fetchPage(url: URL, dependencies: MarketDependencies): Promise<unknown[]> {
  const fetcher = dependencies.fetch ?? fetch;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 6000);
    let waitMs = 250 * 2 ** attempt;
    try {
      const response = await fetcher(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'Zodiacs-Market-Lens/1.0' }, redirect: 'error' });
      if (response.ok) {
        // Bound both transfer size and parsed row count before accumulation.
        const length = Number(response.headers.get('content-length') ?? 0);
        if (length > 250_000) throw new MarketDataError('response', 'The provider response exceeded the size limit.');
        const body = await response.text();
        if (body.length > 250_000) throw new MarketDataError('response', 'The provider response exceeded the size limit.');
        const data: unknown = JSON.parse(body);
        if (!Array.isArray(data) || data.length > 1000) throw new MarketDataError('response', 'The provider candle response is invalid.');
        return data;
      }
      if (response.status !== 429 && response.status < 500) throw new MarketDataError('unavailable', 'The market provider rejected the request.');
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter)) {
        const requestedWait = Number(retryAfter) * 1000;
        // A long provider backoff exceeds this request's budget. Fail the page
        // instead of retrying earlier than the provider asked us to.
        if (requestedWait > 2000) throw new MarketDataError('response', 'The market provider requires a later retry.');
        waitMs = Math.max(waitMs, requestedWait);
      }
      lastError = new MarketDataError(response.status === 429 ? 'rate-limit' : 'unavailable', 'The market provider is temporarily unavailable.');
    } catch (error) {
      if (error instanceof MarketDataError && error.code !== 'rate-limit' && error.code !== 'unavailable') throw error;
      if (error instanceof MarketDataError && error.message === 'The market provider rejected the request.') throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await (dependencies.sleep ?? pause)(waitMs);
  }
  if (lastError instanceof MarketDataError) throw lastError;
  throw new MarketDataError('unavailable', 'The market provider could not be reached.');
}

async function fetchDataset(request: MarketRequest, dependencies: MarketDependencies): Promise<MarketDataset> {
  const nowMs = (dependencies.now ?? Date.now)();
  const seconds = INTERVAL_SECONDS[request.interval];
  const rows: unknown[] = [];
  const failedWindows: Array<{ start: number; end: number }> = [];
  for (let start = request.start; start < request.end; start += PROVIDER_PAGE_BARS * seconds) {
    const end = Math.min(request.end, start + PROVIDER_PAGE_BARS * seconds);
    const url = new URL(`/products/${request.instrument}/candles`, UPSTREAM);
    url.search = new URLSearchParams({ granularity: String(seconds), start: new Date(start * 1000).toISOString(), end: new Date(end * 1000).toISOString() }).toString();
    try {
      const page = await fetchPage(url, dependencies);
      // Treat each requested page as half-open even if the provider includes its end.
      // This prevents mutable current bars from conflicting at page boundaries.
      rows.push(...page.filter((row) => !Array.isArray(row) || typeof row[0] !== 'number' || (row[0] >= start && row[0] < end)));
    } catch {
      failedWindows.push({ start, end });
    }
    if (end < request.end) await (dependencies.sleep ?? pause)(100);
  }
  const normalized = normalizeCoinbaseCandles(rows, { ...request, now: nowMs / 1000 });
  if (!normalized.candles.length) throw new MarketDataError('unavailable', 'No validated candles were returned for the requested range.');
  const warnings = ['Volume is measured in the base asset. Current open candles are provisional and excluded from indicators.'];
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
    coverage: { requestedStart: request.start, requestedEnd: request.end, start: normalized.candles[0].time, end: normalized.candles.at(-1)!.time, gaps: normalized.gaps },
    warnings,
  };
}

function cacheKey(request: MarketRequest): string { return `${request.instrument}:${request.interval}:${request.start}:${request.end}`; }

/** Injectable adapter for tests, local Astro middleware and the serverless route. */
export async function collectMarketDataset(request: MarketRequest, dependencies: MarketDependencies = {}): Promise<MarketDataset> {
  const nowMs = (dependencies.now ?? Date.now)();
  // Validate direct callers too; bounded requests are part of this adapter's contract.
  parseMarketQuery(new URLSearchParams({ instrument: request.instrument, interval: request.interval, start: String(request.start), end: String(request.end) }), nowMs / 1000);
  const key = cacheKey(request);
  const cache = dependencies.cache ?? sharedCache;
  const previous = cache.get(key);
  if (previous && nowMs - previous.cachedAt < FRESH_MS && nowMs >= previous.cachedAt) return previous.dataset;
  // Coalesce production requests only. Isolated test/custom adapters own their caches.
  const shared = !dependencies.fetch && !dependencies.cache && !dependencies.now;
  if (shared && inFlight.has(key)) return inFlight.get(key)!;
  const collection = (async () => {
    try {
      const dataset = await fetchDataset(request, dependencies);
      // Never replace a more complete cached series with a temporary partial refresh.
      if (previous && dataset.coverage.gaps.length > previous.dataset.coverage.gaps.length) {
        throw new MarketDataError('unavailable', 'The refreshed series has less complete coverage.');
      }
      if (cache.size >= CACHE_LIMIT && !cache.has(key)) cache.delete(cache.keys().next().value!);
      cache.set(key, { dataset, cachedAt: nowMs });
      return dataset;
    } catch (error) {
      const staleLimit = request.interval === '1h' ? 15 * 60_000 : 6 * 60 * 60_000;
      if (previous && nowMs >= previous.cachedAt && nowMs - previous.cachedAt <= staleLimit) {
        return { ...previous.dataset, stale: true, warnings: [...previous.dataset.warnings, 'Provider refresh failed. Showing cached data; check the fetched-at timestamp.'] };
      }
      throw error;
    }
  })();
  if (shared) inFlight.set(key, collection);
  try { return await collection; } finally { if (shared) inFlight.delete(key); }
}

export const getMarketDataset = collectMarketDataset;

const requestWindows = new Map<string, { count: number; reset: number }>();
function rateLimited(req: any, now: number): boolean {
  // Forwarded headers are trusted only behind the known Vercel edge, which
  // overwrites them. Local/direct servers use their socket peer address.
  const forwarded = process.env.VERCEL === '1' ? req.headers?.['x-forwarded-for'] : undefined;
  const address = String(forwarded ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim().slice(0, 64);
  const current = requestWindows.get(address);
  if (!current || current.reset <= now) {
    if (requestWindows.size >= 1000 && !requestWindows.has(address)) requestWindows.delete(requestWindows.keys().next().value!);
    requestWindows.set(address, { count: 1, reset: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 60;
}

function sendJson(res: any, status: number, body: MarketDataset | { error: string; message: string }): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex');
  // CDN caching is short and keyed by the full allowlisted query string.
  res.setHeader('Cache-Control', status === 200 && 'stale' in body && !body.stale ? 'public, max-age=15, s-maxage=30' : 'private, no-store');
  res.end(JSON.stringify(body));
}

export async function handleLensMarket(req: any, res: any, dependencies: MarketDependencies = {}): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'method', message: 'Use GET for public market data.' });
    return;
  }
  const nowMs = (dependencies.now ?? Date.now)();
  if (rateLimited(req, nowMs)) {
    res.setHeader('Retry-After', '60');
    sendJson(res, 429, { error: 'rate-limit', message: 'Too many market refreshes. Try again in a minute.' });
    return;
  }
  try {
    const url = new URL(req.url ?? '/api/registry/lens', 'http://localhost');
    // Remove only the router's known dispatch value; arbitrary keys stay invalid.
    if (url.searchParams.get('action') === 'registry-lens') url.searchParams.delete('action');
    const request = parseMarketQuery(url.searchParams, nowMs / 1000);
    // Public API availability is separate from permission to display its data.
    // Hosted previews and production remain closed until the owner has a grant.
    if (process.env.VERCEL === '1' && process.env.MARKET_LENS_COINBASE_DISPLAY_ENABLED !== '1') {
      sendJson(res, 503, { error: 'display-disabled', message: 'Market prices are not enabled for this deployment. The calendar and journal remain available.' });
      return;
    }
    sendJson(res, 200, await collectMarketDataset(request, dependencies));
  } catch (error) {
    const invalid = error instanceof MarketDataError && error.code === 'request';
    sendJson(res, invalid ? 400 : 503, { error: invalid ? 'request' : 'unavailable', message: invalid ? error.message : 'Market data is temporarily unavailable. The calendar and journal remain available.' });
  }
}

export default handleLensMarket;
