import {afterAll, afterEach, describe, expect, it} from 'vitest';
import {cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {findPackageJSON} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import manifest from './prospective-manifest.json';
import {DAY} from './core.mjs';
// The website may advance its engine; this frozen study must still run rc.15.
// Copy unchanged sources and unpack the committed archive into an isolated runtime.
const fixtureRoot = new URL('../../.cache/', import.meta.url);
await mkdir(fixtureRoot, {recursive: true});
const frozenRuntime = await mkdtemp(path.join(fileURLToPath(fixtureRoot), 'lens-frozen-test-'));
afterAll(async () => { await rm(frozenRuntime, {recursive: true, force: true}); });
for (const relative of ['research/market-lens/prospective-manifest.json', 'research/market-lens/prospective.mjs', 'research/market-lens/features.mjs', 'research/market-lens/core.mjs', 'research/market-lens/dataset.mjs', 'scripts/market-lens-paper.mjs', 'package.json', 'package-lock.json', 'vendor/zodiacs-engine-0.1.1-rc.15.tgz']) {
  const target = path.join(frozenRuntime, relative);
  await mkdir(path.dirname(target), {recursive: true});
  await cp(new URL('../../' + relative, import.meta.url), target);
}
const engineDirectory = path.join(frozenRuntime, 'node_modules/@zodiacs/engine');
await mkdir(engineDirectory, {recursive: true});
execFileSync('tar', ['-xzf', path.join(frozenRuntime, 'vendor/zodiacs-engine-0.1.1-rc.15.tgz'), '--strip-components=1', '-C', engineDirectory]);
const ephemerisPackage = findPackageJSON('astronomy-engine', import.meta.url);
expect(JSON.parse(await readFile(ephemerisPackage, 'utf8')).version).toBe(manifest.ephemerisVersion);
await symlink(path.dirname(ephemerisPackage), path.join(frozenRuntime, 'node_modules/astronomy-engine'));
// Resolve dependencies from the isolated frozen source directory.
const {createDecision, decisionWindow, openStudy, recordDecision, reportStudy, settleDecisions, settleTrade, writeOnce} = await import(/* @vite-ignore */ pathToFileURL(path.join(frozenRuntime, 'research/market-lens/prospective.mjs')).href);

const first = Date.parse(manifest.start) / 1000;
const recordTime = (first - DAY / 2) * 1000;
const rawBars = (start, end) => Array.from({length: (end - start) / DAY}, (_, i) => [start + i * DAY, 90, 200, 100, 101 + i, 2]);
const candles = rawBars(first - 51 * DAY, first - DAY).map(([time, low, high, open, close, volume]) => ({time, low, high, open, close, volume}));
const both = {'BTC-USD': candles, 'ETH-USD': candles};
const noLunation = () => ({nearNewMoon: 0, nearFullMoon: 0});
const directories = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, {recursive: true, force: true}); });
async function temporaryStudy() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lens-paper-'));
  directories.push(directory);
  return openStudy(directory, recordTime, true);
}

describe('prospective decisions and execution accounting', () => {
  it('freezes 180 days and refuses late, early or unpublished decisions', () => {
    expect((Date.parse(manifest.endExclusive) / 1000 - first) / DAY).toBe(180);
    expect(decisionWindow(manifest, recordTime).execution).toBe(first);
    expect(() => decisionWindow(manifest, (first - 899) * 1000)).toThrow('deadline');
    expect(() => decisionWindow(manifest, (first - DAY + 299) * 1000)).toThrow('publication');
    expect(() => decisionWindow(manifest, recordTime - DAY * 1000)).toThrow('outside');
    expect(() => decisionWindow(manifest, Date.parse(manifest.endExclusive))).toThrow('outside');
    expect(() => decisionWindow(manifest, NaN)).toThrow('Invalid');
  });
  it('uses finalized prices and changes only the paired lunar arm for the fixed gate', () => {
    const decision = createDecision(manifest, both, recordTime, noLunation);
    expect(decision.assets[0]).toMatchObject({sma20: 140.5, sma50: 125.5, taOnly: 'long', taLunar: 'cash'});
    expect(decision.executionAt).toBe(manifest.start);
    expect(decision.outcomeFinalizesAt).toBe('2026-10-03T00:00:00.000Z');
    expect(createDecision(manifest, both, recordTime, () => ({nearNewMoon: 1, nearFullMoon: 0})).assets[0].taLunar).toBe('long');
    const flat = candles.map((bar) => ({...bar, close: 100}));
    expect(createDecision(manifest, {'BTC-USD': flat, 'ETH-USD': flat}, recordTime).assets[0].taOnly).toBe('cash');
    expect(() => createDecision(manifest, {...both, 'BTC-USD': [...candles, {...candles.at(-1), time: first - DAY}]}, recordTime)).toThrow('future');
    expect(() => createDecision(manifest, {...both, 'BTC-USD': candles.filter((_, i) => i !== 25)}, recordTime)).toThrow('50 consecutive');
  });
  it('matches independent cash-flow fixtures for adverse fills and both fees', () => {
    const result = settleTrade('long', {open: 100, close: 110}, manifest, 10000);
    const units = 9990 / 100.05;
    const gross = units * 109.945;
    expect(result.equity).toBeCloseTo(gross * 0.999, 10);
    expect(result.feeUsd).toBeCloseTo(10 + gross * 0.001, 10);
    expect(result.slippageUsd).toBeCloseTo(units * 0.105, 10);
    expect(result.trades).toBe(1);
    expect(settleTrade('cash', {open: 100, close: 1}, manifest, 10000)).toEqual({equity: 10000, netReturn: 0, feeUsd: 0, slippageUsd: 0, trades: 0});
    expect(settleTrade('long', {open: 100, close: 100}, manifest, 10000).netReturn).toBeLessThan(-0.0029);
  });
});

describe('paper receipt lifecycle', () => {
  it('records before execution, refuses replacement and waits for finalized outcomes', async () => {
    const study = await temporaryStudy();
    const decision = await recordDecision(study, async (_p, start, end) => rawBars(start, end), () => recordTime);
    expect(decision.payload.executionAt).toBe(manifest.start);
    await expect(recordDecision(study, async () => { throw new Error('must not fetch'); }, () => recordTime)).rejects.toThrow('already exists');
    await expect(writeOnce(path.join(study.directory, 'protocol.json'), {})).rejects.toThrow('EEXIST');
    expect(await reportStudy(study, recordTime)).toMatchObject({status: 'awaiting-first-execution', matchedDays: 0, futureDecisions: 1, recordedDecisions: 1});
    expect(await settleDecisions(study, async () => { throw new Error('must not fetch'); }, () => (first + DAY + 299) * 1000)).toEqual([]);
    const now = (first + DAY + 600) * 1000;
    expect(await settleDecisions(study, async (_p, start) => [[start, 89, 111, 100, 90, 2]], () => now)).toHaveLength(1);
    expect(await settleDecisions(study, async () => { throw new Error('must not replace'); }, () => now)).toEqual([]);
    const report = await reportStudy(study, now);
    expect(report).toMatchObject({matchedDays: 1, pendingDays: 0, missedDays: 0, status: 'descriptive-interim'});
    expect(report.assets[0].taOnly.maxDrawdown).toBeCloseTo(1 - report.assets[0].taOnly.equity / 10000, 12);
    expect(report.assets[0].taOnly.feeUsd).toBeGreaterThan(0);
    expect((await reportStudy(study, now + DAY * 1000)).missedDays).toBe(1);
  });
  it('rejects acquisition across a deadline instead of backdating', async () => {
    const study = await temporaryStudy();
    let reads = 0;
    const now = () => ++reads < 4 ? recordTime : (first - 600) * 1000;
    await expect(recordDecision(study, async (_p, start, end) => rawBars(start, end), now)).rejects.toThrow('deadline');
  });
  it('leaves missing settlement data pending without inventing fills', async () => {
    const study = await temporaryStudy();
    await recordDecision(study, async (_p, start, end) => rawBars(start, end), () => recordTime);
    const now = (first + DAY + 600) * 1000;
    await expect(settleDecisions(study, async () => [], () => now)).rejects.toThrow('pending');
    expect(await reportStudy(study, now)).toMatchObject({pendingDays: 1, matchedDays: 0});
  });
  it('detects edited decision and protocol receipts', async () => {
    const study = await temporaryStudy();
    await recordDecision(study, async (_p, start, end) => rawBars(start, end), () => recordTime);
    const filename = path.join(study.directory, 'decisions', '2026-10-02.json');
    const original = await readFile(filename, 'utf8');
    const changed = JSON.parse(original); changed.payload.assets[0].taOnly = 'cash';
    await writeFile(filename, JSON.stringify(changed));
    await expect(reportStudy(study, recordTime)).rejects.toThrow('integrity');
    await writeFile(filename, original);
    const protocol = JSON.parse(await readFile(path.join(study.directory, 'protocol.json'), 'utf8'));
    protocol.payload.sourceHash = 'edited';
    await writeFile(path.join(study.directory, 'protocol.json'), JSON.stringify(protocol));
    await expect(openStudy(study.directory, recordTime)).rejects.toThrow('integrity');
  });
  it('requires initialization before the first execution day', async () => {
    const study = await temporaryStudy();
    await expect(openStudy(path.join(study.directory, 'too-late'), first * 1000, true)).rejects.toThrow('before');
  });
});
