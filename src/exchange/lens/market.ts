import type { Candle, Instrument, InstrumentId, Interval, MarketDataset } from './types';

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  'BTC-USD': { id: 'BTC-USD', name: 'Bitcoin', base: 'BTC', quote: 'USD', venue: 'Coinbase Exchange', sourceUrl: 'https://exchange.coinbase.com/trade/BTC-USD' },
  'ETH-USD': { id: 'ETH-USD', name: 'Ethereum', base: 'ETH', quote: 'USD', venue: 'Coinbase Exchange', sourceUrl: 'https://exchange.coinbase.com/trade/ETH-USD' },
};
export const INTERVAL_SECONDS: Record<Interval, number> = { '1h': 3600, '1d': 86400 };
export const MAX_MARKET_BARS = 900;
export const DEFAULT_MARKET_BARS = 240;

/** A half-open [start,end) range of UTC-aligned opening timestamps. */
export interface MarketRequest {
  instrument: InstrumentId;
  interval: Interval;
  start: number;
  end: number;
}

export class MarketDataError extends Error {
  constructor(public readonly code: 'request' | 'unavailable' | 'response' | 'rate-limit', message: string) {
    super(message);
    this.name = 'MarketDataError';
  }
}

function epochParameter(value: string | null, name: string): number | undefined {
  if (value === null) return undefined;
  if (!/^\d{1,11}$/.test(value)) throw new MarketDataError('request', `${name} must be Unix seconds.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new MarketDataError('request', `${name} is invalid.`);
  return parsed;
}

export function parseMarketQuery(params: URLSearchParams, now = Date.now() / 1000): MarketRequest {
  const allowed = new Set(['instrument', 'interval', 'start', 'end']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      throw new MarketDataError('request', 'Unsupported or repeated query parameter.');
    }
  }
  const instrument = params.get('instrument') ?? 'BTC-USD';
  const interval = params.get('interval') ?? '1d';
  if (!Object.hasOwn(INSTRUMENTS, instrument) || !Object.hasOwn(INTERVAL_SECONDS, interval)) {
    throw new MarketDataError('request', 'Choose BTC-USD or ETH-USD and 1h or 1d.');
  }
  const seconds = INTERVAL_SECONDS[interval as Interval];
  const currentEnd = Math.floor(now / seconds) * seconds + seconds;
  const end = epochParameter(params.get('end'), 'end') ?? currentEnd;
  const start = epochParameter(params.get('start'), 'start') ?? end - DEFAULT_MARKET_BARS * seconds;
  if (start < 0 || end <= start || start % seconds !== 0 || end % seconds !== 0 || end > currentEnd || (end - start) / seconds > MAX_MARKET_BARS) {
    throw new MarketDataError('request', `Use a UTC-aligned range of 1–${MAX_MARKET_BARS} bars ending no later than the current bucket.`);
  }
  return { instrument: instrument as InstrumentId, interval: interval as Interval, start, end };
}

export interface CandleNormalization {
  candles: Candle[];
  rejected: number;
  duplicates: number;
  conflicts: number;
  gaps: number[];
}

/** Coinbase volume is in units of the base currency, not USD. */
export function normalizeCoinbaseCandles(raw: unknown, request: Pick<MarketRequest, 'interval' | 'start' | 'end'> & { now: number }): CandleNormalization {
  if (!Array.isArray(raw)) throw new MarketDataError('response', 'The candle provider returned an invalid response.');
  const seconds = INTERVAL_SECONDS[request.interval];
  const byTime = new Map<number, Candle>();
  const conflicting = new Set<number>();
  let rejected = 0;
  let duplicates = 0;
  let conflicts = 0;
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== 6 || !row.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      rejected += 1;
      continue;
    }
    const [time, low, high, open, close, volume] = row as number[];
    if (!Number.isSafeInteger(time) || time < 0 || time % seconds !== 0 || low <= 0 || high < low || open < low || open > high || close < low || close > high || volume < 0) {
      rejected += 1;
      continue;
    }
    // Coinbase may include observations outside the requested window.
    if (time < request.start || time >= request.end || time > request.now) continue;
    const candle: Candle = { time, low, high, open, close, volume, complete: time + seconds <= request.now };
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
  // Conflicting provider records are a coverage gap, never an arbitrary choice.
  for (const time of conflicting) { byTime.delete(time); conflicts += 1; }
  const candles = [...byTime.values()].sort((left, right) => left.time - right.time);
  const gaps: number[] = [];
  for (let time = request.start; time < request.end && time <= request.now; time += seconds) {
    if (!byTime.has(time)) gaps.push(time);
  }
  return { candles, rejected, duplicates, conflicts, gaps };
}

function isDataset(value: unknown): value is MarketDataset {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<MarketDataset>;
  if (data.schema !== 1 || !data.instrument || !Object.hasOwn(INSTRUMENTS, data.instrument.id) || data.instrument.venue !== 'Coinbase Exchange' || !data.interval || !Object.hasOwn(INTERVAL_SECONDS, data.interval) || !Array.isArray(data.candles) || data.candles.length > MAX_MARKET_BARS || typeof data.fetchedAt !== 'string' || !Number.isFinite(Date.parse(data.fetchedAt)) || typeof data.stale !== 'boolean' || !data.coverage || !Array.isArray(data.coverage.gaps) || !Array.isArray(data.warnings) || data.warnings.some((warning) => typeof warning !== 'string')) return false;
  if (data.source !== `https://api.exchange.coinbase.com/products/${data.instrument.id}/candles` || data.instrument.sourceUrl !== INSTRUMENTS[data.instrument.id].sourceUrl) return false;
  try {
    parseMarketQuery(new URLSearchParams({ instrument: data.instrument.id, interval: data.interval, start: String(data.coverage.requestedStart), end: String(data.coverage.requestedEnd) }), Date.parse(data.fetchedAt) / 1000);
  } catch { return false; }
  return data.candles.every((bar) => !!bar && typeof bar === 'object' && typeof bar.complete === 'boolean');
}

/** Same-origin only: public candles never share a request with private notes. */
export async function loadMarketDataset(
  request: { instrument: InstrumentId; interval: Interval; start?: number; end?: number },
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<MarketDataset> {
  const query = new URLSearchParams({ instrument: request.instrument, interval: request.interval });
  if (request.start !== undefined) query.set('start', String(request.start));
  if (request.end !== undefined) query.set('end', String(request.end));
  const response = await (options.fetch ?? fetch)(`/api/registry/lens?${query}`, { signal: options.signal, headers: { Accept: 'application/json' }, credentials: 'omit' });
  if (!response.ok) {
    if (response.status === 503) {
      const body = await response.json().catch(() => null);
      if (body?.error === 'display-disabled') throw new MarketDataError('unavailable', 'Market prices are not enabled for this deployment. The calendar and journal remain available.');
    }
    throw new MarketDataError(response.status === 429 ? 'rate-limit' : 'unavailable', response.status === 429 ? 'Refresh limit reached. Try again shortly.' : 'Market data is unavailable. The calendar and journal remain available.');
  }
  const dataset: unknown = await response.json();
  if (!isDataset(dataset) || dataset.instrument.id !== request.instrument || dataset.interval !== request.interval) throw new MarketDataError('response', 'The market response is invalid.');
  // Protect consumers of the contract as well as the upstream API boundary.
  const normalized = normalizeCoinbaseCandles(dataset.candles.map((bar) => [bar.time, bar.low, bar.high, bar.open, bar.close, bar.volume]), { interval: dataset.interval, start: dataset.coverage.requestedStart, end: dataset.coverage.requestedEnd, now: new Date(dataset.fetchedAt).getTime() / 1000 });
  if (!dataset.candles.length || normalized.rejected || normalized.duplicates || normalized.conflicts || normalized.candles.length !== dataset.candles.length || dataset.candles.some((bar, index) => bar.time !== normalized.candles[index]?.time || bar.complete !== normalized.candles[index]?.complete) || dataset.coverage.start !== normalized.candles[0]?.time || dataset.coverage.end !== normalized.candles.at(-1)?.time || dataset.coverage.gaps.length !== normalized.gaps.length || dataset.coverage.gaps.some((time, index) => time !== normalized.gaps[index])) throw new MarketDataError('response', 'The market candle response is invalid.');
  return dataset;
}
