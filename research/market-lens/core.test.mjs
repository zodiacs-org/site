import {describe, it, expect} from 'vitest';
import {DAY, fitScaler, fitLogistic, predict, metrics, purgedTraining, evaluationRows, blockBootstrap, trainingBaselines} from './core.mjs';
import {buildRows, lunarFeatures} from './features.mjs';
import {normalizeRecords, deduplicate, describeCoverage, sha256} from './dataset.mjs';
import {tuneModel} from './experiment.mjs';

const first = Date.parse('2020-01-01T00:00:00Z') / 1000;
const bars = (n, flat = false) => Array.from({length: n}, (_, i) => ({time: first + i * DAY, open: flat ? 100 : 100 + i, close: flat ? 100 : 100 + i, low: flat ? 99 : 99 + i, high: flat ? 101 : 101 + i, volume: 10}));
const noPhase = () => ({lunarSin: 0, lunarCos: 1, nearNewMoon: 1, nearFullMoon: 0});

describe('private research dataset', () => {
  it('validates source OHLC, daily opening alignment and range without filling', () => {
    const source = [[first + DAY, 90, 110, 100, 105, 2], [first, 90, 110, 100, 105, 2], [first + 2 * DAY, 90, 110, 100, 105, 2]];
    expect(normalizeRecords(source, first, first + 2 * DAY).map((bar) => bar.time)).toEqual([first, first + DAY]);
    expect(() => normalizeRecords([[first, 106, 110, 100, 105, 2]], first, first + DAY)).toThrow('OHLC');
    expect(() => normalizeRecords([[first + 1, 90, 110, 100, 105, 2]], first, first + DAY)).toThrow('time');
    expect(() => normalizeRecords([[first, 90, 110, 100, NaN, 2]], first, first + DAY)).toThrow('Malformed');
    expect(() => normalizeRecords([[first, 90, 110, 100, 105, -2]], first, first + DAY)).toThrow('volume');
  });
  it('deduplicates identical source bars and rejects conflicts', () => {
    const bar = bars(1)[0];
    expect(deduplicate([bar, {...bar}])).toEqual([bar]);
    expect(() => deduplicate([bar, {...bar, volume: 11}])).toThrow('Conflicting');
    expect(describeCoverage([bar, bars(3)[2]]).missingBars).toBe(1);
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('cutoff and pinned astronomy features', () => {
  it('aligns known new/full Moon observations without claiming an exact event catalog', () => {
    const solarEclipse = lunarFeatures(Date.parse('2024-04-08T18:21:00Z') / 1000);
    expect(solarEclipse.nearNewMoon).toBe(1);
    expect(solarEclipse.nearFullMoon).toBe(0);
    expect(solarEclipse.lunarCos).toBeGreaterThan(0.999);
    const full = lunarFeatures(Date.parse('2024-03-25T07:00:00Z') / 1000);
    expect(full.nearFullMoon).toBe(1);
    expect(full.lunarCos).toBeLessThan(-0.999);
    expect(lunarFeatures(first)).toEqual(lunarFeatures(first));
  });
  it('uses finalized bar cutoff, standard indicator fixtures and one-day target', () => {
    const row = buildRows(bars(62), noPhase)[0];
    expect(row.cutoff).toBe(first + 61 * DAY);
    expect(row.targetEnd).toBe(first + 62 * DAY);
    expect(row.target).toBe(1);
    expect(row.features.logReturn7).toBeCloseTo(Math.log(160 / 153), 12);
    expect(row.features.sma20Gap).toBeCloseTo(160 / 150.5 - 1, 12);
    expect(row.features.sma50Gap).toBeCloseTo(160 / 135.5 - 1, 12);
    expect(row.features.rsi14Centered).toBe(1);
    expect(buildRows(bars(62, true), noPhase)[0].features.rsi14Centered).toBe(0);
    expect(row.features.logVolume20).toBe(0);
  });
  it('does not let next/future market prices affect current features', () => {
    const original = bars(100);
    const altered = structuredClone(original);
    altered[71].close = 1;
    altered[80].close = 10000;
    const baseline = buildRows(original, noPhase).find((row) => row.cutoff === first + 71 * DAY);
    const changed = buildRows(altered, noPhase).find((row) => row.cutoff === baseline.cutoff);
    expect(changed.features).toEqual(baseline.features);
    expect(changed.target).toBe(0);
    expect(baseline.target).toBe(1);
  });
  it('rejects incomplete targets and restarts warm-up after missing bars', () => {
    expect(buildRows(bars(61), noPhase)).toHaveLength(0);
    const withGap = bars(150).filter((_, index) => index !== 70);
    const rows = buildRows(withGap, noPhase);
    expect(rows.some((row) => row.cutoff > first + 70 * DAY && row.cutoff < first + 132 * DAY)).toBe(false);
    expect(rows.find((row) => row.cutoff === first + 132 * DAY)?.target).toBe(1);
  });
});

describe('training, scoring and dependence-aware uncertainty', () => {
  const training = [-2, -1, 1, 2].map((x) => ({features: {x}, target: Number(x > 0), currentDirection: Number(x > 0)}));
  it('fits scale only on supplied training data and regularized model symmetrically', () => {
    expect(fitScaler(training, ['x'])[0].center).toBe(0);
    const model = fitLogistic(training, ['x'], 0.01);
    expect(model.converged).toBe(true);
    expect(predict(model, {features: {x: 2}})).toBeGreaterThan(0.8);
    expect(predict(model, {features: {x: -2}})).toBeCloseTo(1 - predict(model, {features: {x: 2}}), 10);
    const conservative = fitLogistic(training, ['x'], 1);
    expect(predict(conservative, {features: {x: 2}})).toBeLessThan(predict(model, {features: {x: 2}}));
    expect(model.scaler[0].center).toBe(0);
  });
  it('purges any training label reaching an evaluation start and excludes holdout-crossing validation labels', () => {
    const boundary = Date.parse('2021-01-01T00:00:00Z') / 1000;
    const rows = [-2, -1, 0, 1].map((offset) => ({cutoff: boundary + offset * DAY, targetEnd: boundary + (offset + 1) * DAY}));
    expect(purgedTraining(rows, '2021-01-01T00:00:00Z').map((row) => row.cutoff)).toEqual([boundary - 2 * DAY]);
    expect(evaluationRows(rows, '2020-12-30T00:00:00Z', '2021-01-01T00:00:00Z', '2021-01-01T00:00:00Z')).toHaveLength(1);
  });
  it('matches independent binary score fixtures and training-only baselines', () => {
    const score = metrics([{target: 0}, {target: 1}], [0.25, 0.75]);
    expect(score.brier).toBe(0.0625);
    expect(score.logLoss).toBeCloseTo(-Math.log(0.75), 12);
    expect(score.accuracy).toBe(1);
    expect(score.calibration.reduce((sum, bin) => sum + bin.n, 0)).toBe(2);
    expect(trainingBaselines(training)).toEqual({unconditional: 0.5, persistence: [0.25, 0.75]});
  });
  it('uses deterministic paired blocks, preserves zero differences and distinguishes consistent changes', () => {
    const cutoffs = Array.from({length: 100}, (_, i) => first + i * DAY);
    const zeros = blockBootstrap(Array(100).fill(0), cutoffs);
    expect(zeros.interval95).toEqual([0, 0]);
    const values = Array.from({length: 100}, (_, i) => -0.02 + i / 10000);
    expect(blockBootstrap(values, cutoffs)).toEqual(blockBootstrap(values, cutoffs));
    expect(blockBootstrap(values, cutoffs).interval975[1]).toBeLessThan(0);
  });
  it('keeps holdout labels and features out of validation model selection', () => {
    const start = Date.parse('2018-01-01T00:00:00Z') / 1000;
    const rows = Array.from({length: 2200}, (_, i) => ({cutoff: start + i * DAY, targetEnd: start + (i + 1) * DAY, features: {x: Math.sin(i / 9)}, target: Number(Math.cos(i / 13) > 0)}));
    const manifest = {model: {l2Candidates: [0.01, 0.1, 1]}, split: {testStart: '2023-01-01T00:00:00.000Z', validationFolds: [{start: '2021-01-01T00:00:00.000Z', endExclusive: '2022-01-01T00:00:00.000Z'}, {start: '2022-01-01T00:00:00.000Z', endExclusive: '2023-01-01T00:00:00.000Z'}]}};
    const original = tuneModel(rows, ['x'], manifest);
    const changed = rows.map((row) => row.cutoff >= Date.parse(manifest.split.testStart) / 1000 ? {...row, target: 1 - row.target, features: {x: 1e8}} : row);
    expect(tuneModel(changed, ['x'], manifest)).toEqual(original);
  });
});
