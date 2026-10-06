import { describe, expect, it, vi } from 'vitest';
import { loadMarketDataset, normalizeCoinbaseCandles, parseMarketQuery } from './market';
import { collectMarketDataset, handleLensMarket, type MarketCacheEntry, type MarketDependencies } from '../../../api/_registry/lens-handler';

const STEP = 3600;
const END = 1_800_003_600;
const NOW = END - 100;
const request = { instrument: 'BTC-USD' as const, interval: '1h' as const, start: END - 5 * STEP, end: END };
const row = (time: number, close = 10): number[] => [time, 8, 12, 9, close, 2];
const response = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
const deps = (fetcher: typeof fetch): MarketDependencies => ({ fetch: fetcher, now: () => NOW * 1000, sleep: async () => {}, cache: new Map() });
function sink() {
  return { statusCode: 0, headers: {} as Record<string, string>, body: '', setHeader(name: string, value: string) { this.headers[name] = value; }, end(body: string) { this.body = body; } };
}

describe('Market Lens candle contracts', () => {
  it('allowlists instruments, intervals, aligned bounded ranges and unique parameters', () => {
    expect(parseMarketQuery(new URLSearchParams('instrument=ETH-USD&interval=1h'), NOW)).toEqual({ instrument: 'ETH-USD', interval: '1h', start: END - 240 * STEP, end: END });
    for (const query of ['instrument=__proto__', 'instrument=UNLISTED-USD', 'interval=4h', 'url=https://evil.test', 'interval=1h&interval=1d', 'start=1&end=2', `interval=1h&start=${END - 901 * STEP}&end=${END}`, `interval=1h&end=${END + STEP}`]) {
      expect(() => parseMarketQuery(new URLSearchParams(query), NOW)).toThrow();
    }
  });

  it('validates OHLCV, sorts, deduplicates, bounds and marks unfinished bars', () => {
    const normalized = normalizeCoinbaseCandles([
      row(END - STEP), row(END - 3 * STEP), row(END - 3 * STEP), row(END),
      [END - 2 * STEP, 11, 12, 9, 10, 2], row(END - 4 * STEP),
      [END - 5 * STEP, 8, 12, 9, 10, -1], [END - 2 * STEP, 8, 12, 9, '10', 2],
    ], { ...request, now: NOW });
    expect(normalized.candles.map((bar) => bar.time)).toEqual([END - 4 * STEP, END - 3 * STEP, END - STEP]);
    expect(normalized.candles.map((bar) => bar.complete)).toEqual([true, true, false]);
    expect(normalized.rejected).toBe(3);
    expect(normalized.duplicates).toBe(1);
    expect(normalized.gaps).toEqual([END - 5 * STEP, END - 2 * STEP]);
  });

  it('excludes conflicting timestamp records instead of choosing one', () => {
    const result = normalizeCoinbaseCandles([row(END - STEP), row(END - STEP, 11)], { ...request, now: NOW });
    expect(result.conflicts).toBe(1);
    expect(result.candles).toEqual([]);
    expect(result.gaps).toContain(END - STEP);
  });

  it('rejects malformed root responses', () => {
    expect(() => normalizeCoinbaseCandles({ message: 'rate limited' }, { ...request, now: NOW })).toThrow();
  });
});

describe('Market Lens provider adapter', () => {
  it('keeps hosted prices disabled without a display grant and enables the same validated adapter with a grant', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('MARKET_LENS_COINBASE_DISPLAY_ENABLED', '');
    const fetcher = vi.fn().mockResolvedValue(response([row(END - STEP)]));
    try {
      const disabled = sink();
      await handleLensMarket({ method: 'GET', url: '/api/registry/lens?interval=1h', headers: { 'x-forwarded-for': 'display-fixture' } }, disabled, deps(fetcher));
      expect(disabled.statusCode).toBe(503);
      expect(JSON.parse(disabled.body).error).toBe('display-disabled');
      expect(disabled.headers['Cache-Control']).toBe('private, no-store');
      expect(fetcher).not.toHaveBeenCalled();
      vi.stubEnv('MARKET_LENS_COINBASE_DISPLAY_ENABLED', '1');
      const enabled = sink();
      await handleLensMarket({ method: 'GET', url: '/api/registry/lens?interval=1h', headers: { 'x-forwarded-for': 'display-fixture' } }, enabled, deps(fetcher));
      expect(enabled.statusCode).toBe(200);
      expect(JSON.parse(enabled.body).instrument.id).toBe('BTC-USD');
      expect(fetcher).toHaveBeenCalledOnce();
    } finally { vi.unstubAllEnvs(); }
  });

  it('paginates no more than 300 bars per page and normalizes inclusive response edges', async () => {
    const seen: URL[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      seen.push(url);
      const start = Date.parse(url.searchParams.get('start')!) / 1000;
      const end = Date.parse(url.searchParams.get('end')!) / 1000;
      return response(Array.from({ length: (end - start) / STEP + 1 }, (_, index) => row(start + index * STEP)));
    }) as unknown as typeof fetch;
    const dataset = await collectMarketDataset({ ...request, start: END - 601 * STEP }, deps(fetcher));
    expect(seen).toHaveLength(3);
    for (const url of seen) {
      expect(url.origin).toBe('https://api.exchange.coinbase.com');
      expect(url.pathname).toBe('/products/BTC-USD/candles');
      expect(url.searchParams.get('granularity')).toBe('3600');
      expect((Date.parse(url.searchParams.get('end')!) - Date.parse(url.searchParams.get('start')!)) / (STEP * 1000)).toBeLessThanOrEqual(300);
    }
    expect(dataset.candles).toHaveLength(601);
    expect(dataset.coverage.gaps).toEqual([]);
    expect(dataset.instrument.venue).toBe('Coinbase Exchange');
  });

  it('retries 429 responses with bounded backoff', async () => {
    const sleeps: number[] = [];
    const fetcher = vi.fn().mockResolvedValueOnce(response([], 429, { 'retry-after': '1' })).mockResolvedValueOnce(response([row(END - STEP)]));
    const dataset = await collectMarketDataset(request, { ...deps(fetcher), sleep: async (ms) => { sleeps.push(ms); } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([1000]);
    expect(dataset.coverage.gaps).toHaveLength(4);
  });

  it('does not ignore a provider backoff that exceeds the request budget', async () => {
    const fetcher = vi.fn().mockResolvedValue(response([], 429, { 'retry-after': '60' }));
    await expect(collectMarketDataset(request, deps(fetcher))).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts a timed-out fetch and retries before reporting unavailable', async () => {
    const fetcher = vi.fn((_url, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
    await expect(collectMarketDataset(request, { ...deps(fetcher as typeof fetch), timeoutMs: 2 })).rejects.toThrow('No validated candles');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('returns partial coverage when one paginated window fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([], 404)).mockResolvedValueOnce(response([row(END - STEP)]));
    const dataset = await collectMarketDataset({ ...request, start: END - 301 * STEP }, deps(fetcher));
    expect(dataset.candles).toHaveLength(1);
    expect(dataset.coverage.gaps).toHaveLength(300);
    expect(dataset.warnings.some((warning) => warning.includes('coverage is partial'))).toBe(true);
  });

  it('uses fresh cache, shows bounded stale cache on failure, then expires it', async () => {
    let clock = NOW * 1000;
    const cache = new Map<string, MarketCacheEntry>();
    const fetcher = vi.fn().mockResolvedValueOnce(response(Array.from({ length: 5 }, (_, index) => row(request.start + index * STEP))));
    const dependencies = { ...deps(fetcher), now: () => clock, cache };
    const first = await collectMarketDataset(request, dependencies);
    clock += 30_000;
    expect(await collectMarketDataset(request, dependencies)).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    clock += 60_000;
    fetcher.mockRejectedValue(new Error('network'));
    const stale = await collectMarketDataset(request, dependencies);
    expect(stale.stale).toBe(true);
    expect(stale.fetchedAt).toBe(first.fetchedAt);
    clock += 15 * 60_000;
    await expect(collectMarketDataset(request, dependencies)).rejects.toThrow();
  });

  it('does not replace complete cached coverage with a partial refresh', async () => {
    let clock = NOW * 1000;
    const cache = new Map<string, MarketCacheEntry>();
    const fetcher = vi.fn().mockResolvedValueOnce(response(Array.from({ length: 5 }, (_, index) => row(request.start + index * STEP)))).mockResolvedValueOnce(response([row(END - STEP)]));
    const dependencies = { ...deps(fetcher), now: () => clock, cache };
    const first = await collectMarketDataset(request, dependencies);
    clock += 70_000;
    const refreshed = await collectMarketDataset(request, dependencies);
    expect(refreshed.stale).toBe(true);
    expect(refreshed.candles).toEqual(first.candles);
    expect(refreshed.coverage.gaps).toEqual([]);
  });

  it('bounds direct adapter callers before making upstream requests', async () => {
    const fetcher = vi.fn();
    await expect(collectMarketDataset({ ...request, start: END - 1000 * STEP }, deps(fetcher))).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('Market Lens same-origin API', () => {
  it('shows the fixed hosted-disabled explanation without reflecting server text', async () => {
    await expect(loadMarketDataset(request, { fetch: vi.fn().mockResolvedValue(response({error: 'display-disabled', message: '<untrusted>'}, 503)) })).rejects.toThrow('Market prices are not enabled for this deployment');
    await expect(loadMarketDataset(request, { fetch: vi.fn().mockResolvedValue(response({error: 'upstream', message: '<untrusted>'}, 503)) })).rejects.toThrow('Market data is unavailable');
  });

  it('rejects methods and unsupported parameters without requesting a provider', async () => {
    const fetcher = vi.fn();
    const res = sink();
    await handleLensMarket({ method: 'POST' }, res, deps(fetcher));
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    const invalid = sink();
    await handleLensMarket({ method: 'GET', url: '/api/registry/lens?url=https://evil.test', socket: { remoteAddress: 'invalid' } }, invalid, deps(fetcher));
    expect(invalid.statusCode).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('supports router dispatch, withholds CDN caching, and sanitizes errors', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([row(END - STEP)]));
    const res = sink();
    await handleLensMarket({ method: 'GET', url: `/api/compatibility?action=registry-lens&instrument=BTC-USD&interval=1h&start=${request.start}&end=${request.end}`, socket: { remoteAddress: 'success' } }, res, deps(fetcher));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toContain('no-store');
    expect(JSON.parse(res.body).instrument.venue).toBe('Coinbase Exchange');
    const failed = sink();
    await handleLensMarket({ method: 'GET', url: '/api/registry/lens', socket: { remoteAddress: 'failed' } }, failed, deps(vi.fn().mockRejectedValue(new Error('secret-in-upstream-error'))));
    expect(failed.statusCode).toBe(503);
    expect(failed.headers['Cache-Control']).toBe('private, no-store');
    expect(failed.body).not.toContain('secret-in-upstream-error');
  });

  it('never caches a stale response as healthy at the CDN', async () => {
    let clock = NOW * 1000;
    const fetcher = vi.fn().mockResolvedValueOnce(response([row(END - STEP)])).mockRejectedValue(new Error('network'));
    const dependencies = { ...deps(fetcher), now: () => clock };
    const req = { method: 'GET', url: `/api/registry/lens?instrument=BTC-USD&interval=1h&start=${request.start}&end=${request.end}`, socket: { remoteAddress: 'stale-header' } };
    await handleLensMarket(req, sink(), dependencies);
    clock += 70_000;
    const stale = sink();
    await handleLensMarket(req, stale, dependencies);
    expect(stale.statusCode).toBe(200);
    expect(JSON.parse(stale.body).stale).toBe(true);
    expect(stale.headers['Cache-Control']).toBe('private, no-store');
  });

  it('makes only a same-origin request without cookie credentials and validates the response', async () => {
    const serverFetch = vi.fn().mockResolvedValueOnce(response([row(END - STEP)]));
    const data = await collectMarketDataset(request, deps(serverFetch));
    const clientFetch = vi.fn().mockResolvedValueOnce(response(data));
    expect(await loadMarketDataset(request, { fetch: clientFetch })).toEqual(data);
    const [url, init] = clientFetch.mock.calls[0];
    expect(url).toMatch(/^\/api\/registry\/lens\?/);
    expect(init.credentials).toBe('omit');
    data.candles[0].complete = true;
    await expect(loadMarketDataset(request, { fetch: vi.fn().mockResolvedValueOnce(response(data)) })).rejects.toThrow('invalid');
  });

  it('rejects invalid response coverage and unsafe sources before normalization', async () => {
    const data = await collectMarketDataset(request, deps(vi.fn().mockResolvedValueOnce(response([row(END - STEP)]))));
    const changed = [
      { ...data, fetchedAt: 'bad-date' },
      { ...data, source: 'https://evil.test/candles' },
      { ...data, coverage: { ...data.coverage, requestedEnd: 999999999999 } },
      { ...data, coverage: { ...data.coverage, gaps: [] } },
      { ...data, candles: [null] },
    ];
    for (const body of changed) await expect(loadMarketDataset(request, { fetch: vi.fn().mockResolvedValueOnce(response(body)) })).rejects.toThrow('invalid');
  });

  it('rate limits repeated client refreshes without making upstream calls', async () => {
    const fetcher = vi.fn();
    for (let index = 0; index < 60; index += 1) {
      const invalid = sink();
      await handleLensMarket({ method: 'GET', url: '/api/registry/lens?invalid=1', socket: { remoteAddress: 'limit-fixture' } }, invalid, deps(fetcher));
      expect(invalid.statusCode).toBe(400);
    }
    const limited = sink();
    await handleLensMarket({ method: 'GET', url: '/api/registry/lens', socket: { remoteAddress: 'limit-fixture' } }, limited, deps(fetcher));
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['Retry-After']).toBe('60');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
