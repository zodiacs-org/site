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
  volatilityPct: number | null;
  reversal: boolean | null;
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
  meanVolatilityPct: number | null;
  reversalFraction: number | null;
  positiveFraction: number | null;
  returnDistribution: number[];
  convention: string;
}

export interface OccurrenceOptions {
  sessions?: import('./sessions').TradingSession[];
  interval: Interval;
  horizonHours?: number;
  beforeHours?: number;
  now?: number;
  /** Additional events to flag; aggregate matching is never broadened by these. */
  contextEvents?: SkyEvent[];
  /** Event-source coverage for establishing absence; Unix seconds. */
  controlCoverage?: { start: number; end: number };
}

/** Exact family/subtype/body pair/aspect stream; sign is also preserved for ingresses. */
export function eventMatchKey(event: SkyEvent): string {
  if (event.personal) return JSON.stringify([
    'personal', event.personal.sourceId, event.personal.sourceUpdatedAt ?? '',
    event.personal.window.transitBody, event.personal.window.natalPoint,
    event.aspectType ?? '', event.personal.orb,
  ]);
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
    if (!Number.isInteger(candle.time) || (!options.sessions && candle.time % step !== 0)) throw new Error('History candles must use UTC interval starts.');
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
    const schedule = options.sessions;
    const index = schedule?.findIndex(s => s.close > exact) ?? -1;
    const anchor = schedule ? schedule[index]?.open ?? exact : Math.floor(exact / step) * step;
    const beforeCount = before / step, afterCount = horizon / step;
    const windowStart = schedule ? schedule[index-beforeCount]?.open ?? anchor-before : anchor - before;
    const windowEnd = schedule ? schedule[index+afterCount-1]?.close ?? Infinity : anchor + horizon;
    const baselineTime = schedule ? schedule[index-1]?.open : anchor-step;
    const pastTime = schedule ? schedule[index-beforeCount-1]?.open : windowStart-step;
    const outcomeTime = schedule ? schedule[index+afterCount-1]?.open : windowEnd-step;
    // Include the close at the beginning of the before window, not just
    // the bars whose opens happen within it.
    const requiredTimes = [];
    if (schedule) { for (let n = index-beforeCount-1; n < index+afterCount; n++) requiredTimes.push(schedule[n]?.open ?? -1); }
    else for (let at = windowStart - step; at < windowEnd; at += step) requiredTimes.push(at);
    const missingTimes = requiredTimes.filter((time) => !byTime.has(time));
    const unfinished = requiredTimes.some(time => byTime.has(time) && (!byTime.get(time)!.complete || (byTime.get(time)!.closeTime ?? time+step) > now));
    const split = requiredTimes.some(time => byTime.get(time)?.adjustmentBreak);
    const pending = windowEnd > now || unfinished;
    const status = pending ? 'pending' : missingTimes.length || split ? 'incomplete' : 'complete';
    const observation: Occurrence = { event, status, reason: pending ? 'Outcome window has not finalized.' : missingTimes.length ? 'Required session candles are missing.' : split ? 'Window crosses an unadjusted corporate action.' : null,
      anchor, windowStart, windowEnd, beforeReturnPct: null, returnPct: null, rangePct: null, volatilityPct: null, reversal: null, missingTimes, overlappingIds: [], linkedIds: event.linkedIds ?? [] };
    if (status === 'complete') {
      const baseline = byTime.get(baselineTime!)!.close;
      const past = byTime.get(pastTime!)!.close;
      const outcome = byTime.get(outcomeTime!)!.close;
      const after = requiredTimes.filter((time) => time >= anchor).map((time) => byTime.get(time)!);
      observation.beforeReturnPct = pct(baseline, past);
      observation.returnPct = pct(outcome, baseline);
      observation.rangePct = (Math.max(...after.map((candle) => candle.high)) - Math.min(...after.map((candle) => candle.low))) / baseline * 100;
      observation.volatilityPct = Math.sqrt(after.reduce((sum, candle, index) => sum + Math.log(candle.close / (index ? after[index - 1].close : baseline)) ** 2, 0)) * 100;
      observation.reversal = observation.beforeReturnPct !== 0 && observation.returnPct !== 0 ? Math.sign(observation.beforeReturnPct) !== Math.sign(observation.returnPct) : null;
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
    meanVolatilityPct: mean(completed.map(row => row.volatilityPct!)), reversalFraction: mean(completed.flatMap(row => row.reversal === null ? [] : [row.reversal ? 1 : 0])),
    positiveFraction: returns.length ? returns.filter((value) => value > 0).length / returns.length : null,
    returnDistribution: returns,
    convention: `${options.sessions ? 'Verified trading sessions; off-session events anchor to the next session. Horizons count sessions (1/3/7), not elapsed days.' : 'UTC'} ${options.interval} bars; baseline is the finalized close before the bar containing the exact event. Before window: ${before / 3600} hours; after window: ${horizon / 3600} hours. Aggregates include complete windows only. Overlapping and linked observations are flagged; aggregate rows are not independent samples.`,
  };
}

export interface MatchedComparison { pairedEvents: Occurrence[]; eventMeanReturnPct: number | null; eventMeanRangePct: number | null; eventMeanVolatilityPct: number | null; eventReversalFraction: number | null; observations: Occurrence[]; matchedEvents: number; unmatchedEvents: number; uniqueControls: number; meanReturnPct: number | null; meanRangePct: number | null; meanVolatilityPct: number | null; reversalFraction: number | null; returnDistribution: number[]; convention: string }
/** Deterministic descriptive matching, without optimization or future-filled candles. */
export function matchedNonEventObservations(summary: OccurrenceSummary, candles: Candle[], options: OccurrenceOptions): MatchedComparison {
  const horizon = (options.horizonHours ?? 24) * 3600, before = (options.beforeHours ?? options.horizonHours ?? 24) * 3600;
  const step = options.interval === '1h' ? 3600 : 86400;
  const qualifying = summary.occurrences;
  const exclusions = options.contextEvents ?? qualifying.map(row => row.event);
  const observations: Occurrence[] = []; const pairedEvents: Occurrence[] = []; let matchedEvents = 0;
  for (const row of qualifying.filter(row => row.status === 'complete')) {
    const candidates = Array.from({ length: 8 }, (_, i) => (i + 1) * 7 * 86400).flatMap(offset => [-offset, offset]);
    let chosen: Occurrence | undefined;
    for (const offset of candidates) {
      const anchor = row.anchor + offset;
      if (options.controlCoverage && (anchor - before - step < options.controlCoverage.start || anchor + horizon > options.controlCoverage.end)) continue;
      if (exclusions.some(event => { const other = Math.floor(Date.parse(event.at) / 1000 / step) * step; return other - before < anchor + horizon && other + horizon > anchor - before; })) continue;
      const event: SkyEvent = { ...row.event, id: `control:${row.event.id}:${anchor}`, at: new Date(anchor * 1000).toISOString(), end: undefined, personal: undefined, economic: undefined, linkedIds: [] };
      const observation = analyzeOccurrences([event], candles, { ...options, contextEvents: [] }).occurrences[0];
      if (observation.status === 'complete') { chosen = observation; break; }
    }
    if (chosen) { observations.push(chosen); pairedEvents.push(row); matchedEvents++; }
  }
  return { pairedEvents, eventMeanReturnPct: mean(pairedEvents.map(row => row.returnPct!)), eventMeanRangePct: mean(pairedEvents.map(row => row.rangePct!)), eventMeanVolatilityPct: mean(pairedEvents.map(row => row.volatilityPct!)), eventReversalFraction: mean(pairedEvents.flatMap(row => row.reversal === null ? [] : [row.reversal ? 1 : 0])), observations, matchedEvents, unmatchedEvents: summary.complete - matchedEvents, uniqueControls: new Set(observations.map(row => row.anchor)).size, meanReturnPct: mean(observations.map(row => row.returnPct!)), meanRangePct: mean(observations.map(row => row.rangePct!)), meanVolatilityPct: mean(observations.map(row => row.volatilityPct!)), reversalFraction: mean(observations.flatMap(row => row.reversal === null ? [] : [row.reversal ? 1 : 0])), returnDistribution: observations.map(row => row.returnPct!), convention: 'For each completed event, choose the nearest eligible same-weekday and UTC bucket-time window, within ±56 days in 7-day steps; earlier wins equal distance. Require declared event-source coverage for the whole comparison window and identical complete before/after candles and no overlap with any loaded comparison-context event window. No price, direction or volatility matching is tuned. Controls may be reused and are counted separately from unique controls; neither set is independent. Unmatched, pending and incomplete event rows remain visible. Realized window volatility is 100 × sqrt(sum of squared close-to-close log returns), unannualized. Reversal means opposite nonzero before/after return signs; it is distinct from return direction and volatility.' };
}
