import { calculateIndicators } from './indicators';
import type { Candle, EventFamily, InstrumentId, Interval, RuleMatch, SkyEvent, WatchRule } from './types';

const STEP: Record<Interval, number> = { '1h': 3_600, '1d': 86_400 };
const FAMILIES: EventFamily[] = ['lunation', 'eclipse', 'station', 'retrograde', 'ingress', 'aspect'];

/** The rule's TA timestamp is the finalized bar's close, never its opening instant. */
export function evaluateRules(
  rules: readonly WatchRule[],
  candles: readonly Candle[],
  events: readonly SkyEvent[],
  instrument: InstrumentId,
  interval: Interval,
): RuleMatch[] {
  const step = STEP[interval];
  if (!step) return [];
  const bars = [...candles].sort((a, b) => a.time - b.time);
  // Ambiguous or invalid candles cannot establish a crossing. Do not repair or
  // forward-fill a dataset inside the rule engine.
  if (bars.some((bar, i) => !validBar(bar) || (i > 0 && bar.time === bars[i - 1].time))) return [];
  const indicators = calculateIndicators(bars, step);
  const sma20 = new Map(indicators.sma20.map(point => [point.time, point.value]));
  const sma50 = new Map(indicators.sma50.map(point => [point.time, point.value]));
  const rsi = new Map(indicators.rsi14.map(point => [point.time, point.value]));
  const matches = new Map<string, RuleMatch>();

  for (const rule of rules) {
    if (!eligibleRule(rule, instrument, interval)) continue;
    const created = Date.parse(rule.createdAt) / 1_000;
    for (let i = 1; i < bars.length; i += 1) {
      const previous = bars[i - 1];
      const current = bars[i];
      if (!previous.complete || !current.complete || current.time - previous.time !== step) continue;
      const closeTime = current.time + step;
      if (closeTime < created) continue;
      let before: number | undefined;
      let after: number | undefined;
      if (rule.condition.startsWith('sma-')) {
        before = difference(sma20.get(previous.time), sma50.get(previous.time));
        after = difference(sma20.get(current.time), sma50.get(current.time));
      } else if (rule.condition.startsWith('price-')) {
        before = previous.close - rule.threshold!;
        after = current.close - rule.threshold!;
      } else if (rule.condition.startsWith('rsi-')) {
        before = difference(rsi.get(previous.time), rule.threshold);
        after = difference(rsi.get(current.time), rule.threshold);
      }
      if (before === undefined || after === undefined) continue;
      const crossed = rule.condition.endsWith('-up') ? before <= 0 && after > 0 : before >= 0 && after < 0;
      if (!crossed) continue;
      const at = new Date(closeTime * 1_000).toISOString();
      for (const event of events) {
        if (rule.family !== 'any' && rule.family !== event.family) continue;
        const eventTime = Date.parse(event.at) / 1_000;
        // These are chosen, symmetric research windows around exact instants.
        // A retrograde interval matches its cataloged starting instant.
        if (!Number.isFinite(eventTime) || Math.abs(eventTime - closeTime) > rule.windowHours * 3_600) continue;
        const key = JSON.stringify([rule.id, rule.version, instrument, interval, current.time, event.id]);
        matches.set(key, {
          key, ruleId: rule.id, at, candleTime: current.time,
          eventId: event.id, condition: describeCondition(rule),
        });
      }
    }
  }
  return [...matches.values()].sort((a, b) => a.candleTime - b.candleTime || a.key.localeCompare(b.key));
}

function difference(a: number | undefined, b: number | undefined): number | undefined {
  return a !== undefined && b !== undefined && Number.isFinite(a) && Number.isFinite(b) ? a - b : undefined;
}

function validBar(bar: Candle): boolean {
  return Number.isSafeInteger(bar.time) && typeof bar.complete === 'boolean'
    && [bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite)
    && bar.low > 0 && bar.high >= Math.max(bar.open, bar.close)
    && bar.low <= Math.min(bar.open, bar.close) && bar.volume >= 0;
}

function eligibleRule(rule: WatchRule, instrument: InstrumentId, interval: Interval): boolean {
  if (!rule.enabled || rule.instrument !== instrument || rule.interval !== interval
    || !rule.id || !Number.isSafeInteger(rule.version) || rule.version < 1
    || !Number.isFinite(Date.parse(rule.createdAt))
    || !Number.isFinite(rule.windowHours) || rule.windowHours < 0 || rule.windowHours > 720
    || (rule.family !== 'any' && !FAMILIES.includes(rule.family))) return false;
  switch (rule.condition) {
    case 'sma-cross-up': case 'sma-cross-down': return true;
    case 'price-cross-up': case 'price-cross-down': return Number.isFinite(rule.threshold) && rule.threshold! > 0;
    case 'rsi-cross-up': case 'rsi-cross-down': return Number.isFinite(rule.threshold) && rule.threshold! >= 0 && rule.threshold! <= 100;
    default: return false;
  }
}

export function describeCondition(rule: WatchRule): string {
  const direction = rule.condition.endsWith('-up') ? 'above' : 'below';
  if (rule.condition.startsWith('sma-')) return `SMA20 crossed ${direction} SMA50 on the finalized bar`;
  if (rule.condition.startsWith('rsi-')) return `RSI14 crossed ${direction} ${rule.threshold} on the finalized bar`;
  return `Closing price crossed ${direction} ${rule.threshold} USD on the finalized bar`;
}
