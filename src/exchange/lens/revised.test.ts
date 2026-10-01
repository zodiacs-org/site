import { describe, expect, it } from 'vitest';
import { estimateRisk } from './risk';
import { computeOutlookDay, outlookLabel } from './outlook';
import { clearPersonalContext, createJournalEntry, emptyStore, exportStore, importStore, updateJournalEntry } from './storage';
import { economicState, type EconomicCatalog } from './economics';
import schedule from '../../../public/data/market-lens/economics.json';
import { eventDay } from './events';
import { analyzeOccurrences, matchedNonEventObservations, matchingEvents } from './history';
import { reliableTime } from './personal';
import type { Candle, SetupPlan, SkyEvent } from './types';
import { bodyLongitude } from '../../lib/engine/full';
import { createTransitWindowScanner } from '../../lib/engine/transit-window-core';
import references from '../../lib/engine/fixtures/horizons-reference.json';

const risk = { equity: 10000, riskMode: 'percent' as const, riskValue: 1, entry: 100, stop: 90, target: 120, feeBps: 10, slippageBps: 5 };
const setup: SetupPlan = { interval: '1h', technicalSetup: 'Finalized breakout', confirmation: 'Close above 100', invalidation: 'Below 90', risk, window: { kind: 'personal', id: 'personal:fixture', sourceId: 'chart-one', from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' } };
describe('spot risk and journal preparation', () => {
  it('accounts for two-side fee/slippage and calculates net reward', () => {
    const estimate = estimateRisk(risk);
    expect(estimate.budget).toBe(100);
    expect(estimate.stopLossUSD).toBeCloseTo(100, 10);
    expect(estimate.units).toBeCloseTo(100 / (100.05 * 1.001 - 89.955 * .999), 10);
    expect(estimate.rewardRisk).toBeLessThan(2);
    expect(estimate.costsAtStopUSD).toBeGreaterThan(0);
    expect(estimateRisk({ ...risk, riskMode: 'usd', riskValue: 100 })).toEqual(estimate);
  });
  it('caps a tight-stop position by cash and allows negative net target reward', () => {
    const estimate = estimateRisk({ ...risk, stop: 99.999, target: 100.001 });
    expect(estimate.equityCapped).toBe(true);
    expect(estimate.fundingUSD).toBeCloseTo(10000);
    expect(estimate.stopLossUSD).toBeLessThan(100);
    expect(estimate.rewardUSD).toBeLessThan(0);
  });
  it.each([{ stop: 101 }, { entry: 0 }, { equity: NaN }, { riskValue: 101 }, { feeBps: -1 }, { slippageBps: 1001 }, { target: 90 }])('rejects invalid risk input %j', patch => {
    expect(() => estimateRisk({ ...risk, ...patch })).toThrow();
  });
  it('preserves original setup, revised risk, outcomes and faithful backups', () => {
    const original = createJournalEntry({ instrument: 'BTC-USD', eventIds: ['personal:fixture'], horizonHours: 24, method: 'TA + astrology', hypothesis: 'Prepare before a release', plan: 'Wait for confirmation', outcome: '', setup }, { at: '2026-10-01T10:00:00Z', id: 'fixture-note' });
    const revised = updateJournalEntry(original, { setup: { ...setup, risk: { ...risk, stop: 95 } }, outcome: 'No entry; confirmation failed' }, { at: '2026-10-01T11:00:00Z' });
    expect(revised.revisions[0].setup!.risk.stop).toBe(90);
    expect(revised.setup!.risk.stop).toBe(95);
    const store = { ...emptyStore(), entries: [revised] };
    expect(importStore(exportStore(store)).store).toEqual(store);
    const scrubbed = clearPersonalContext(store, null);
    expect(scrubbed.entries[0].setup!.window).toBeUndefined();
    expect(scrubbed.entries[0].revisions[0].setup!.window).toBeUndefined();
    expect(scrubbed.entries[0].eventIds).toEqual([]);
    expect(scrubbed.entries[0].outcome).toBe(revised.outcome);
    expect(importStore(exportStore(scrubbed)).store).toEqual(JSON.parse(JSON.stringify(scrubbed)));
    const versioned = { ...store, entries: [{ ...revised, chartRef: { id: 'chart-one', updatedAt: '2026-09-01T00:00:00.000Z' }, setup: { ...revised.setup!, window: { ...setup.window!, sourceUpdatedAt: '2026-09-01T00:00:00.000Z' } }, revisions: revised.revisions.map(rev => ({ ...rev, setup: { ...rev.setup!, window: { ...setup.window!, sourceUpdatedAt: '2026-09-01T00:00:00.000Z' } } })) }] };
    expect(clearPersonalContext(versioned, 'chart-one', '2026-09-01T00:00:00.000Z').entries[0].setup!.window).toBeDefined();
    expect(clearPersonalContext(versioned, 'chart-one', '2026-09-02T00:00:00.000Z').entries[0].setup!.window).toBeUndefined();
  });
});
describe('official economics and uncertainty', () => {
  const catalog = schedule as EconomicCatalog;
  it('retains verified US Eastern DST changes and fractional display offsets', () => {
    expect(catalog.events.find(row => row.id === 'economic:employment:2026-10-02')!.at).toBe('2026-10-02T12:30:00.000Z');
    expect(catalog.events.find(row => row.id === 'economic:employment:2026-11-06')!.at).toBe('2026-11-06T13:30:00.000Z');
    expect(eventDay('2026-10-28T18:30:00.000Z', 'Asia/Bangkok')).toBe('2026-10-29');
    expect(catalog.events.find(row => row.kind === 'fomc-press-conference' && row.date === '2026-12-09')!.time).toBe('14:30');
  });
  it('separates verified, stale and uncovered/unavailable periods', () => {
    expect(economicState(catalog, '2026-10-02', Date.parse(catalog.verifiedAt))).toBe('covered');
    expect(economicState(catalog, '2026-10-02', Date.parse(catalog.verifiedAt) + 8 * 86400000)).toBe('stale');
    expect(economicState(catalog, '2027-01-01')).toBe('unavailable');
    expect(economicState(catalog, '2026-04-29')).toBe('unavailable');
  });
  it('does not grant reliable angles or natal Moon from unknown / ambiguous clocks', () => {
    expect(reliableTime(false, [])).toBe(false);
    expect(reliableTime(true, ['dst-fold'])).toBe(false);
    expect(reliableTime(true, ['dst-gap'])).toBe(false);
    expect(reliableTime(true, ['lmt'])).toBe(true);
  });
});
describe('fixed interpretive outlook', () => {
  const natal = { bodies: [{ body: 'Sun', lon: 0 }] };
  it('is stable across views and changes only with declared chart/date/settings', () => {
    const first = computeOutlookDay(natal, null, '2026-10-01', ['Jupiter'], 3, () => 120);
    expect(first.score).toBe(53);
    expect(computeOutlookDay(natal, null, '2026-10-01', ['Jupiter'], 3, () => 120)).toEqual(first);
    expect(computeOutlookDay(natal, null, '2026-10-01', ['Jupiter'], 1, () => 121.5).score).toBe(50);
    expect(outlookLabel(30)).toBe('challenging'); expect(outlookLabel(70)).toBe('supportive');
  });
  it('uses actual house cusps when supplied and exposes contributions', () => {
    const whole = Array.from({ length: 12 }, (_, i) => (330 + 30 * i) % 360);
    const result = computeOutlookDay(natal, whole, '2026-10-01', ['Jupiter'], 3, () => 120);
    expect(result.contributions[0].house).toBe(2);
    expect(result.score).toBe(53.8);
    expect(result.contributions[0].contribution).toBe(3.75);
  });
});
describe('fast transit windows against independent Horizons positions', () => {
  const epoch = new Date(references.epochs[0].utc);
  const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'] as const;
  for (const body of bodies) it(`retains the ${body} reference contact inside a bounded window`, () => {
    const target = references.epochs[0].longitudes[body]!;
    expect(Math.abs(bodyLongitude(body, epoch) - target)).toBeLessThan(.05);
    const scanner = createTransitWindowScanner({ bodyLongitude }, { bodies, stepMs: moving => moving === 'Moon' ? 3600000 : 21600000 });
    const windows = scanner.scanTransitWindows({ bodies: [{ body: 'Sun', lon: target }] }, new Date(epoch.getTime() - 3 * 86400000), new Date(epoch.getTime() + 3 * 86400000), { timeKnown: false, transitBodies: [body], aspects: ['conjunction'], orbDegrees: 1 });
    const contact = windows.find(window => Date.parse(window.startUtc) <= epoch.getTime() && Date.parse(window.endUtc) >= epoch.getTime());
    expect(contact).toBeDefined(); expect(contact!.exactPassesUtc).toHaveLength(1);
    expect(Math.abs(bodyLongitude(body, new Date(contact!.exactPassesUtc[0])) - target)).toBeLessThan(.00002);
    expect(contact!.startClipped).toBe(false); expect(contact!.endClipped).toBe(false);
  });
});
describe('descriptive non-event observations', () => {
  const start = Date.parse('2026-01-01T00:00:00Z') / 1000;
  const candles: Candle[] = Array.from({ length: 100 }, (_, i) => ({ time: start + i * 86400, open: 100 + i, close: 101 + i, high: 102 + i, low: 99 + i, volume: 10, complete: true }));
  const event: SkyEvent = { id: 'fixture-sky', family: 'lunation', subtype: 'new', title: 'Fixture new Moon', at: new Date((start + 40 * 86400) * 1000).toISOString(), bodies: ['Moon', 'Sun'], interpretation: '', provenance: { catalog: 'test', sha256: '0'.repeat(64), engineVersion: 'test', convention: 'test' } };
  it('matches weekday/bucket time without tuning on outcomes and retains incomplete events', () => {
    const missing = { ...event, id: 'missing-event', at: '2025-01-01T00:00:00Z' };
    const summary = analyzeOccurrences([event, missing], candles, { interval: '1d', now: start + 100 * 86400 });
    const matched = matchedNonEventObservations(summary, candles, { interval: '1d', now: start + 100 * 86400 });
    expect(summary.total).toBe(2); expect(summary.incomplete).toBe(1);
    expect(matched.matchedEvents).toBe(1); expect(matched.observations[0].anchor).toBe(start + 33 * 86400);
    expect(summary.occurrences[1].volatilityPct).toBeGreaterThan(0);
    expect(summary.occurrences[1].reversal).toBe(false);
  });
  it('compares only paired events and never establishes absence outside source coverage', () => {
    const second = { ...event, id: 'second', at: new Date((start + 80 * 86400) * 1000).toISOString() };
    const options = { interval: '1d' as const, now: start + 100 * 86400, controlCoverage: { start: start + 31 * 86400, end: start + 35 * 86400 } };
    const summary = analyzeOccurrences([event, second], candles, options);
    const matched = matchedNonEventObservations(summary, candles, options);
    expect(matched.matchedEvents).toBe(1); expect(matched.unmatchedEvents).toBe(1);
    expect(matched.pairedEvents[0].event.id).toBe(event.id);
    expect(matched.eventMeanReturnPct).toBe(matched.pairedEvents[0].returnPct);
    expect(matchedNonEventObservations(summary, candles, { ...options, controlCoverage: { start: start + 39 * 86400, end: start + 42 * 86400 } }).matchedEvents).toBe(0);
  });
  it('preserves moving/natal roles, chart revision and orb in personal event definitions', () => {
    const scanner = createTransitWindowScanner({ bodyLongitude: (_body, time) => (360 + (time.getTime() - start * 1000) / 86400000) % 360 }, { bodies: ['Sun'], stepMs: () => 3600000 });
    const window = scanner.scanTransitWindows({ bodies: [{ body: 'Mercury', lon: 0 }] }, new Date((start - 2 * 86400) * 1000), new Date((start + 2 * 86400) * 1000), { timeKnown: false, transitBodies: ['Sun'], aspects: ['conjunction'], orbDegrees: 1 })[0];
    const personal = { sourceId: 'own', sourceUpdatedAt: '2026-09-01T00:00:00Z', window, transitLongitude: 0, natalLongitude: 0, separation: 0, phase: 'exact' as const, natalHouse: null, transitHouse: null, orb: 1 };
    const subject: SkyEvent = { ...event, family: 'aspect', subtype: 'personal', aspectType: 'conjunction', bodies: ['Sun', 'Mercury'], personal };
    const same = { ...subject, id: 'same', at: '2026-10-01T00:00:00Z' };
    const reverse = { ...subject, id: 'reverse', personal: { ...personal, window: { ...window, transitBody: 'Mercury' as const, natalPoint: 'Sun' as const } } };
    const otherRevision = { ...subject, id: 'revision', personal: { ...personal, sourceUpdatedAt: '2026-09-02T00:00:00Z' } };
    const otherOrb = { ...subject, id: 'orb', personal: { ...personal, orb: 2 } };
    expect(matchingEvents(subject, [same, reverse, otherRevision, otherOrb]).map(row => row.id)).toEqual(['same']);
    expect(matchingEvents(event, [{ ...event, bodies: [...event.bodies].reverse() }])).toHaveLength(1);
  });
});
