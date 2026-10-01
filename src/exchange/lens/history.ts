import type { Candle, Interval, SkyEvent } from './types';

export interface Occurrence {
  event: SkyEvent;
  status: 'complete' | 'pending' | 'incomplete';
  reason: string | null;
  /** UTC open of the candle containing the exact event instant. */
  anchor: number;
  windowStart: number;
  windowEnd: number;
  beforeReturnPct: number | null;
  returnPct: number | null;
  rangePct: number | null;
  missingTimes: number[];
  overlappingIds: string[];
  linkedIds: string[];
}

export interface OccurrenceSummary {
  occurrences: Occurrence[];
  total: number;
  complete: number;
  pending: number;
  incomplete: number;
  /** Complete rows with no overlapping comparison window or linked observation. */
  independent: number;
  meanReturnPct: number | null;
  medianReturnPct: number | null;
  meanRangePct: number | null;
  positiveFraction: number | null;
  returnDistribution: number[];
  convention: string;
}

export interface OccurrenceOptions {
  interval: Interval;
  horizonHours?: number;
  beforeHours?: number;
  now?: number;
  /** Additional events to flag; aggregate matching is never broadened by these. */
  contextEvents?: SkyEvent[];
}

/** Exact family/subtype/body pair/aspect stream; sign is also preserved for ingresses. */
export function eventMatchKey(event: SkyEvent): string {
  return JSON.stringify([event.family, event.subtype, [...event.bodies].sort(), event.aspectType ?? '', event.family === 'ingress' ? event.sign ?? '' : '']);
}

export function matchingEvents(subject: SkyEvent, events: SkyEvent[]): SkyEvent[] {
  const key = eventMatchKey(subject);
  return events.filter((event) => eventMatchKey(event) === key).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

const pct = (end: number, start: number): number => (end / start - 1) * 100;
const mean = (values: number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Observational bar-aligned windows, not a trading backtest. Baseline is the
 * last finalized close before the containing event bar. No forward filling,
 * shortened horizons, open candles, or future outcomes enter the summary.
 * Numbers in options.now and all boundaries are Unix seconds.
 */
export function analyzeOccurrences(events: SkyEvent[], candles: Candle[], options: OccurrenceOptions): OccurrenceSummary {
  const step = options.interval === '1h' ? 3600 : 86400;
  const horizon = (options.horizonHours ?? 24) * 3600;
  const before = (options.beforeHours ?? options.horizonHours ?? 24) * 3600;
  if (![horizon, before].every((value) => Number.isInteger(value) && value > 0 && value <= 180 * 86400 && value % step === 0)) throw new Error('History windows must be positive whole candle intervals, up to 180 days.');
  const now = options.now ?? Date.now() / 1000;
  if (!Number.isFinite(now)) throw new Error('History clock is invalid.');
  const byTime = new Map<number, Candle>();
  for (const candle of candles) {
    if (byTime.has(candle.time)) throw new Error('History candles contain duplicate timestamps.');
    if (!Number.isInteger(candle.time) || candle.time % step !== 0) throw new Error('History candles must use UTC interval starts.');
    if (![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)
      || Math.min(candle.open, candle.high, candle.low, candle.close) <= 0 || candle.volume < 0
      || candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close)) throw new Error('History candles contain invalid prices.');
    byTime.set(candle.time, candle);
  }
  const ids = new Set<string>();
  const occurrences = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).map((event): Occurrence => {
    const exact = Date.parse(event.at) / 1000;
    if (!Number.isFinite(exact)) throw new Error('History event instant is invalid.');
    if (ids.has(event.id)) throw new Error('History events contain duplicate IDs.');
    ids.add(event.id);
    const anchor = Math.floor(exact / step) * step;
    const windowStart = anchor - before;
    const windowEnd = anchor + horizon;
    // Include the close at the beginning of the before window, not just
    // the bars whose opens happen within it.
    const requiredTimes = [];
    for (let at = windowStart - step; at < windowEnd; at += step) requiredTimes.push(at);
    const missingTimes = requiredTimes.filter((time) => !byTime.has(time));
    const unfinished = requiredTimes.some((time) => byTime.has(time) && !byTime.get(time)!.complete);
    const pending = windowEnd > now || unfinished;
    const status = pending ? 'pending' : missingTimes.length ? 'incomplete' : 'complete';
    const observation: Occurrence = { event, status, reason: pending ? 'Outcome window has not finalized.' : missingTimes.length ? 'Required UTC candles are missing.' : null,
      anchor, windowStart, windowEnd, beforeReturnPct: null, returnPct: null, rangePct: null, missingTimes, overlappingIds: [], linkedIds: event.linkedIds ?? [] };
    if (status === 'complete') {
      const baseline = byTime.get(anchor - step)!.close;
      const past = byTime.get(windowStart - step)!.close;
      const outcome = byTime.get(windowEnd - step)!.close;
      const after = requiredTimes.filter((time) => time >= anchor).map((time) => byTime.get(time)!);
      observation.beforeReturnPct = pct(baseline, past);
      observation.returnPct = pct(outcome, baseline);
      observation.rangePct = (Math.max(...after.map((candle) => candle.high)) - Math.min(...after.map((candle) => candle.low))) / baseline * 100;
    }
    return observation;
  });
  const context = options.contextEvents ?? events;
  for (const row of occurrences) {
    row.overlappingIds = context.filter((other) => {
      if (other.id === row.event.id) return false;
      const anchor = Math.floor(Date.parse(other.at) / 1000 / step) * step;
      return anchor - before < row.windowEnd && anchor + horizon > row.windowStart;
    }).map((other) => other.id).sort();
  }
  const completed = occurrences.filter((row) => row.status === 'complete');
  const returns = completed.map((row) => row.returnPct!);
  return {
    occurrences, total: occurrences.length, complete: completed.length,
    pending: occurrences.filter((row) => row.status === 'pending').length,
    incomplete: occurrences.filter((row) => row.status === 'incomplete').length,
    independent: completed.filter((row) => row.overlappingIds.length === 0 && row.linkedIds.length === 0).length,
    meanReturnPct: mean(returns), medianReturnPct: median(returns), meanRangePct: mean(completed.map((row) => row.rangePct!)),
    positiveFraction: returns.length ? returns.filter((value) => value > 0).length / returns.length : null,
    returnDistribution: returns,
    convention: `UTC ${options.interval} bars; baseline is the finalized close before the bar containing the exact event. Before window: ${before / 3600} hours; after window: ${horizon / 3600} hours. Aggregates include complete windows only. Overlapping and linked observations are flagged; aggregate rows are not independent samples.`,
  };
}
