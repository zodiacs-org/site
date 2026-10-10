import { describe, expect, it } from 'vitest';
import { calculateIndicators, ema, rsi, sma } from './indicators';
import type { Candle } from './types';

const bars = (prices: number[]): Candle[] => prices.map((close, index) => ({ time: index * 3600, close, open: close, low: close, high: close, volume: 1, complete: true }));

describe('Market Lens indicators', () => {
  it('uses full warm-up periods and an SMA-seeded EMA', () => {
    const series = bars(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(sma(series, 20)).toEqual([{ time: 19 * 3600, value: 10.5 }, { time: 20 * 3600, value: 11.5 }]);
    expect(ema(series, 20)).toEqual([{ time: 19 * 3600, value: 10.5 }, { time: 20 * 3600, value: 11.5 }]);
    expect(calculateIndicators(series).sma50).toEqual([]);
  });

  it('matches the independent Wilder RSI worksheet example', () => {
    const series = bars([44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64, 46.21]);
    // Wilder worksheet mean gain=0.2385714, mean loss=0.1 at close 14.
    const values = rsi(series, 14);
    expect(values[0].value).toBeCloseTo(70.4641350211, 8);
    expect(values[1].value).toBeCloseTo(66.2496185536, 8);
    expect(values[2].value).toBeCloseTo(66.4809418347, 8);
  });

  it('defines flat, all-gain and all-loss RSI', () => {
    expect(rsi(bars(Array(20).fill(10)), 14)[0].value).toBe(50);
    expect(rsi(bars(Array.from({ length: 20 }, (_, index) => index + 1)), 14)[0].value).toBe(100);
    expect(rsi(bars(Array.from({ length: 20 }, (_, index) => 30 - index)), 14)[0].value).toBe(0);
  });

  it('excludes an unfinished candle and never changes previous outputs from later prices', () => {
    const series = bars(Array.from({ length: 60 }, (_, index) => 100 + index));
    const expected = calculateIndicators(series.slice(0, 59));
    series[59] = { ...series[59], close: 100_000, complete: false };
    expect(calculateIndicators(series)).toEqual(expected);
    series[59].complete = true;
    const extended = calculateIndicators(series);
    for (const name of ['sma20', 'sma50', 'ema20', 'rsi14'] as const) {
      expect(extended[name].slice(0, -1)).toEqual(expected[name]);
    }
  });

  it('restarts warm-up after gaps and provisional interior buckets', () => {
    const series = bars(Array.from({ length: 45 }, (_, index) => 100 + index));
    const gap = series.filter((_, index) => index !== 24);
    const values = calculateIndicators(gap, 3600);
    expect(values.sma20.map((point) => point.time)).toEqual([19, 20, 21, 22, 23, 44].map((index) => index * 3600));
    expect(values.sma50).toEqual([]);
    series[24].complete = false;
    expect(calculateIndicators(series, 3600)).toEqual(values);
  });
});
