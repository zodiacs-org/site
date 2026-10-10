import { describe, expect, it } from 'vitest';
import { analyzeOccurrences, matchingEvents } from './history';
import type { Candle, SkyEvent } from './types';
const hour = 3600;
const start = Date.parse('2026-01-01T00:00:00Z') / 1000;
const sky = (id: string, hours: number, extra: Partial<SkyEvent> = {}): SkyEvent => ({ id, family: 'aspect', subtype: 'trine', title: 'Sun trine Jupiter', at: new Date((start + hours * hour) * 1000).toISOString(), bodies: ['Sun', 'Jupiter'], aspectType: 'trine', interpretation: 'Traditional reading.', provenance: { catalog: 'test', sha256: 'a'.repeat(64), engineVersion: 'test', convention: 'UTC' }, ...extra });
const candles = Array.from({ length: 12 }, (_, i): Candle => ({ time: start + i * hour, open: 100 + i, high: 103 + i, low: 99 + i, close: 101 + i, volume: i + 1, complete: true }));
const options = { interval: '1h' as const, horizonHours: 2, beforeHours: 2, now: start + 12 * hour };

describe('event comparison stream', () => {
  it('requires exact family, subtype, unordered body pair, aspect, and ingress destination', () => {
    const subject = sky('original', 4);
    const reversed = sky('reversed', 5, { bodies: ['Jupiter', 'Sun'] });
    expect(matchingEvents(subject, [subject, reversed, sky('square', 6, { subtype: 'square', aspectType: 'square' }), sky('other-body', 7, { bodies: ['Sun', 'Saturn'] }), sky('station', 8, { family: 'station' })]).map((event) => event.id)).toEqual(['original', 'reversed']);
    const ingress = sky('ingress', 4, { family: 'ingress', subtype: 'ingress', aspectType: undefined, bodies: ['Jupiter'], sign: 'cancer' });
    expect(matchingEvents(ingress, [ingress, { ...ingress, id: 'leo', sign: 'leo' }])).toHaveLength(1);
  });
});

describe('complete event windows', () => {
  it('uses the finalized close before the containing bucket and fixed before/after windows', () => {
    const summary = analyzeOccurrences([sky('fractional-exact', 4.5)], candles, options);
    const row = summary.occurrences[0];
    expect(row.anchor).toBe(start + 4 * hour);
    expect(row.windowStart).toBe(start + 2 * hour);
    expect(row.windowEnd).toBe(start + 6 * hour);
    expect(row.status).toBe('complete');
    expect(row.beforeReturnPct).toBeCloseTo((104 / 102 - 1) * 100);
    expect(row.returnPct).toBeCloseTo((106 / 104 - 1) * 100);
    expect(row.rangePct).toBeCloseTo((108 - 103) / 104 * 100);
    expect(summary.complete).toBe(1);
    expect(summary.positiveFraction).toBe(1);
  });
  it('never forward-fills an internal gap or shortens a window', () => {
    const summary = analyzeOccurrences([sky('gap', 4)], candles.filter((bar) => bar.time !== start + 3 * hour), options);
    expect(summary.occurrences[0].status).toBe('incomplete');
    expect(summary.occurrences[0].missingTimes).toEqual([start + 3 * hour]);
    expect(summary.occurrences[0].returnPct).toBeNull();
    expect(summary.meanReturnPct).toBeNull();
    expect(summary.returnDistribution).toEqual([]);
  });
  it('keeps unfinished/future windows pending and excluded from aggregates', () => {
    const summary = analyzeOccurrences([sky('done', 4), sky('future', 11), sky('next-month', 30)], candles, options);
    expect(summary.complete).toBe(1);
    expect(summary.pending).toBe(2);
    expect(summary.occurrences[1].returnPct).toBeNull();
    const unfinished = analyzeOccurrences([sky('open-bar', 4)], candles.map((bar) => ({ ...bar, complete: bar.time !== start + 5 * hour })), options);
    expect(unfinished.pending).toBe(1);
    expect(unfinished.complete).toBe(0);
  });
  it('flags overlapping windows and eclipse/lunation links without deleting observations', () => {
    const events = [sky('first', 4), sky('second', 6), sky('eclipse', 10, { family: 'eclipse', linkedIds: ['lunation'] })];
    const summary = analyzeOccurrences(events, candles, options);
    expect(summary.occurrences[0].overlappingIds).toEqual(['second']);
    expect(summary.occurrences[1].overlappingIds).toEqual(['first']);
    expect(summary.occurrences[2].linkedIds).toEqual(['lunation']);
    expect(summary.total).toBe(3);
    expect(summary.independent).toBe(0);
  });
  it('rejects horizons shorter than a daily interval, misaligned bars, duplicates and impossible candles', () => {
    expect(() => analyzeOccurrences([], [], { interval: '1d', horizonHours: 6 })).toThrow('whole candle');
    expect(() => analyzeOccurrences([], [candles[0], candles[0]], options)).toThrow('duplicate');
    expect(() => analyzeOccurrences([], [{ ...candles[0], time: start + 1 }], options)).toThrow('UTC interval');
    expect(() => analyzeOccurrences([], [{ ...candles[0], low: 110 }], options)).toThrow('invalid prices');
  });
});
