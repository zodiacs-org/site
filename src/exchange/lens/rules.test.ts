import { describe, expect, it } from 'vitest';
import { describeCondition, evaluateRules } from './rules';
import type { Candle, SkyEvent, WatchRule } from './types';

const START = Date.parse('2026-10-01T00:00:00Z') / 1_000;
const candle = (index: number, close: number, complete = true): Candle => ({
  time: START + index * 3_600, open: close, high: close + 1,
  low: close - 1, close, volume: 10, complete,
});
const rule = (override: Partial<WatchRule> = {}): WatchRule => ({
  id: 'rule-1', version: 1, instrument: 'BTC-USD', interval: '1h',
  condition: 'price-cross-up', threshold: 100, family: 'lunation',
  windowHours: 6, enabled: true, createdAt: '2026-10-01T00:00:00.000Z', ...override,
});
const event = (id: string, hour: number, family: SkyEvent['family'] = 'lunation'): SkyEvent => ({
  id, family, subtype: 'full', title: id, at: new Date((START + hour * 3_600) * 1_000).toISOString(),
  bodies: ['Moon'], interpretation: 'Traditional interpretation',
  provenance: { catalog: 'test', sha256: 'test', engineVersion: 'test', convention: 'UTC' },
});
const evaluate = (rules: WatchRule[], bars: Candle[], events: SkyEvent[]) => evaluateRules(rules, bars, events, 'BTC-USD', '1h');

describe('finalized-bar watch rules', () => {
  it('evaluates at the closing instant and includes both research-window edges', () => {
    const matches = evaluate([rule()], [candle(0, 99), candle(1, 101)], [event('left', -4), event('right', 8), event('outside', 8.001)]);
    expect(matches.map(match => match.eventId)).toEqual(['left', 'right']);
    expect(matches.every(match => match.at === '2026-10-01T02:00:00.000Z')).toBe(true);
    expect(matches.every(match => match.candleTime === START + 3_600)).toBe(true);
  });

  it('keeps overlapping events distinct and deduplicates repeated catalog entries', () => {
    const sky = [event('one', 2), event('two', 2), event('one', 2)];
    const matches = evaluate([rule(), rule()], [candle(0, 99), candle(1, 101)], sky);
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map(match => match.key)).size).toBe(2);
    expect(evaluate([rule({ version: 2 })], [candle(0, 99), candle(1, 101)], sky)[0].key).not.toBe(matches[0].key);
  });

  it('does not match provisional bars, mismatched assets/intervals, disabled rules, or the wrong event family', () => {
    const bars = [candle(0, 99), candle(1, 101)];
    const sky = [event('one', 2)];
    expect(evaluate([rule()], [bars[0], candle(1, 101, false)], sky)).toEqual([]);
    expect(evaluate([rule()], [candle(0, 99, false), bars[1]], sky)).toEqual([]);
    expect(evaluate([rule({ enabled: false }), rule({ instrument: 'ETH-USD' }), rule({ interval: '1d' })], bars, sky)).toEqual([]);
    expect(evaluate([rule({ family: 'station' })], bars, sky)).toEqual([]);
    expect(evaluate([rule({ family: 'any' })], bars, [event('one', 2, 'station')])).toHaveLength(1);
  });

  it('requires a crossing and does not repeatedly fire while the price stays beyond a level', () => {
    const bars = [candle(0, 99), candle(1, 100), candle(2, 101), candle(3, 102), candle(4, 99)];
    const matches = evaluate([rule(), rule({ id: 'down', condition: 'price-cross-down' })], bars, [event('one', 3)]);
    expect(matches.map(match => match.candleTime)).toEqual([START + 2 * 3_600, START + 4 * 3_600]);
  });

  it('does not bridge missing bars, invalid values, or duplicate bar timestamps', () => {
    const sky = [event('one', 3)];
    expect(evaluate([rule()], [candle(0, 99), candle(2, 101)], sky)).toEqual([]);
    expect(evaluate([rule()], [candle(0, 99), { ...candle(1, 101), close: NaN }], sky)).toEqual([]);
    expect(evaluate([rule()], [candle(0, 99), candle(0, 101)], sky)).toEqual([]);
  });

  it('does not emit historical reminders before a rule was created', () => {
    const bars = [candle(0, 99), candle(1, 101)];
    expect(evaluate([rule({ createdAt: '2026-10-01T02:00:00.001Z' })], bars, [event('one', 2)])).toEqual([]);
    expect(evaluate([rule({ createdAt: '2026-10-01T02:00:00.000Z' })], bars, [event('one', 2)])).toHaveLength(1);
  });

  it('preserves earlier matches when later market values are changed', () => {
    const bars = [candle(0, 99), candle(1, 101), candle(2, 102)];
    const sky = [event('one', 2)];
    const prior = evaluate([rule()], bars, sky).filter(match => match.candleTime <= START + 3_600);
    const extended = evaluate([rule()], [...bars.slice(0, 2), candle(2, 80), candle(3, 120)], sky).filter(match => match.candleTime <= START + 3_600);
    expect(extended).toEqual(prior);
  });

  it('detects SMA20/50 crosses only after both means have warmed up', () => {
    const bars = [...Array(50)].map((_, i) => candle(i, 100));
    bars.push(candle(50, 50), candle(51, 150), candle(52, 150));
    const rules = [rule({ id: 'down', condition: 'sma-cross-down', threshold: undefined }), rule({ id: 'up', condition: 'sma-cross-up', threshold: undefined })];
    const matches = evaluate(rules, bars, [event('one', 51)]);
    expect(matches.map(match => [match.ruleId, match.candleTime])).toEqual([['down', START + 50 * 3_600], ['up', START + 52 * 3_600]]);
    expect(evaluate(rules, bars.slice(0, 49), [event('one', 49)])).toEqual([]);
  });

  it('resets indicator warmup after missing market buckets', () => {
    const bars = [...Array(50)].map((_, i) => candle(i, 100));
    bars.push(candle(51, 50), candle(52, 150), candle(53, 150));
    expect(evaluate([rule({ condition: 'sma-cross-up', threshold: undefined })], bars, [event('one', 54)])).toEqual([]);
  });

  it('detects a Wilder RSI threshold crossing and rejects missing or invalid thresholds', () => {
    const bars = [...Array(15)].map((_, i) => candle(i, 100 + i));
    bars.push(candle(15, 74));
    const sky = [event('one', 16)];
    expect(evaluate([rule({ condition: 'rsi-cross-down', threshold: 50 })], bars, sky)).toHaveLength(1);
    expect(evaluate([rule({ threshold: undefined }), rule({ condition: 'rsi-cross-down', threshold: 101 }), rule({ windowHours: -1 })], bars, sky)).toEqual([]);
  });

  it('describes the matched predicate without a trading recommendation', () => {
    expect(describeCondition(rule())).toBe('Closing price crossed above 100 USD on the finalized bar');
  });
});
