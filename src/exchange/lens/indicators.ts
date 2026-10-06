import { consecutive } from './sessions';
import type { Candle, IndicatorPoint, Indicators } from './types';

/** Simple moving average: the first point follows `period` finalized closes. */
export function sma(closes: Candle[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  let sum = 0;
  for (let index = 0; index < closes.length; index += 1) {
    sum += closes[index].close;
    if (index >= period) sum -= closes[index - period].close;
    if (index >= period - 1) result.push({ time: closes[index].time, value: sum / period });
  }
  return result;
}

/** EMA seed is the first `period` closes' SMA; alpha = 2 / (period + 1). */
export function ema(closes: Candle[], period: number): IndicatorPoint[] {
  if (closes.length < period) return [];
  let value = closes.slice(0, period).reduce((sum, bar) => sum + bar.close, 0) / period;
  const result = [{ time: closes[period - 1].time, value }];
  const alpha = 2 / (period + 1);
  for (let index = period; index < closes.length; index += 1) {
    value += alpha * (closes[index].close - value);
    result.push({ time: closes[index].time, value });
  }
  return result;
}

function rsiValue(gain: number, loss: number): number {
  if (gain === 0 && loss === 0) return 50;
  if (loss === 0) return 100;
  if (gain === 0) return 0;
  return 100 - 100 / (1 + gain / loss);
}

/** Wilder RSI: initial mean of `period` changes, then 1/period smoothing. */
export function rsi(closes: Candle[], period: number): IndicatorPoint[] {
  if (closes.length <= period) return [];
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = closes[index].close - closes[index - 1].close;
    gain += Math.max(change, 0) / period;
    loss += Math.max(-change, 0) / period;
  }
  const result = [{ time: closes[period].time, value: rsiValue(gain, loss) }];
  for (let index = period + 1; index < closes.length; index += 1) {
    const change = closes[index].close - closes[index - 1].close;
    gain = (gain * (period - 1) + Math.max(change, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
    result.push({ time: closes[index].time, value: rsiValue(gain, loss) });
  }
  return result;
}

/**
 * Indicators never consume the current open candle. A missing or provisional
 * bucket restarts warm-up instead of treating irregular observations as bars.
 * Caller may supply intervalSeconds; otherwise infer the shortest spacing.
 */
export function calculateIndicators(candles: Candle[], intervalSeconds?: number): Indicators {
  const result: Indicators = { sma20: [], sma50: [], ema20: [], rsi14: [] };
  const ordered = [...candles].sort((left, right) => left.time - right.time);
  const spacing = intervalSeconds ?? ordered.reduce((minimum, bar, index) => index > 0 && bar.time > ordered[index - 1].time ? Math.min(minimum, bar.time - ordered[index - 1].time) : minimum, Infinity);
  let segment: Candle[] = [];
  const flush = () => {
    result.sma20.push(...sma(segment, 20));
    result.sma50.push(...sma(segment, 50));
    result.ema20.push(...ema(segment, 20));
    result.rsi14.push(...rsi(segment, 14));
    segment = [];
  };
  for (const candle of ordered) {
    if (!candle.complete || !Number.isFinite(candle.close) || candle.close <= 0) { flush(); continue; }
    if (segment.length && !consecutive(segment[segment.length - 1], candle, spacing)) flush();
    segment.push(candle);
  }
  flush();
  return result;
}
