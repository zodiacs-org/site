import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {createRequire, findPackageJSON} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DAY, mean} from './core.mjs';
import {lunarFeatures, engineReceipt} from './features.mjs';
import {deduplicate, normalizeRecords, sha256} from './dataset.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const iso = (seconds) => new Date(seconds * 1000).toISOString();
const stamp = (seconds) => iso(seconds).slice(0, 10);
const utcDay = (milliseconds) => Math.floor(milliseconds / (DAY * 1000)) * DAY;
const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const present = async (filename) => {
  try { await readFile(filename); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};
export async function writeOnce(filename, value) {
  await mkdir(path.dirname(filename), {recursive: true});
  await writeFile(filename, encode(value), {flag: 'wx', mode: 0o600});
}
function receipt(payload) { return {payload, sha256: sha256(encode(payload))}; }
function readReceipt(bytes) {
  const result = JSON.parse(bytes);
  if (!result.payload || result.sha256 !== sha256(encode(result.payload))) throw new Error('Paper receipt integrity mismatch');
  return result;
}

export function decisionWindow(manifest, nowMs) {
  if (!Number.isFinite(nowMs)) throw new Error('Invalid record time');
  const cutoff = utcDay(nowMs);
  const execution = cutoff + DAY;
  if (execution < Date.parse(manifest.start) / 1000 || execution >= Date.parse(manifest.endExclusive) / 1000) throw new Error('Next execution day is outside the frozen study window');
  if (nowMs / 1000 < cutoff + manifest.minimumPublicationDelaySeconds) throw new Error('Wait for the candle publication delay');
  if (nowMs / 1000 > execution - manifest.decisionLeadSeconds) throw new Error('Decision deadline has passed; backfilling is forbidden');
  return {cutoff, execution};
}

export function createDecision(manifest, candlesByProduct, nowMs, phaseAt = lunarFeatures) {
  const {cutoff, execution} = decisionWindow(manifest, nowMs);
  const lunar = phaseAt(execution); // Future astronomy is knowable; future market prices are never read.
  const lunarGate = lunar.nearNewMoon === 1 || lunar.nearFullMoon === 1;
  const assets = manifest.products.map((product) => {
    const bars = deduplicate(candlesByProduct[product]);
    if (bars.some((bar) => bar.time + DAY > cutoff)) throw new Error('Feature snapshot contains future or unfinished market candles');
    const latest = bars.slice(-50);
    if (latest.length !== 50 || latest.at(-1).time !== cutoff - DAY || latest.some((bar, i) => i && bar.time !== latest[i - 1].time + DAY)) throw new Error('Require 50 consecutive finalized feature candles through the latest UTC close');
    const sma20 = mean(latest.slice(-20).map((bar) => bar.close));
    const sma50 = mean(latest.map((bar) => bar.close));
    const taLong = sma20 > sma50;
    return {product, featureCutoff: iso(cutoff), sma20, sma50, lunar, taOnly: taLong ? 'long' : 'cash', taLunar: taLong && lunarGate ? 'long' : 'cash'};
  });
  return {recordedAt: new Date(nowMs).toISOString(), executionAt: iso(execution), outcomeFinalizesAt: iso(execution + DAY), assets};
}

export function settleTrade(arm, candle, manifest, equity) {
  if (!Number.isFinite(equity) || equity <= 0 || !['long', 'cash'].includes(arm)) throw new Error('Invalid paper position/equity');
  if (arm === 'cash') return {equity, netReturn: 0, feeUsd: 0, slippageUsd: 0, trades: 0};
  const fee = manifest.feeBpsPerSide / 10000;
  const slip = manifest.slippageBpsPerSide / 10000;
  const entryFee = equity * fee;
  const units = (equity - entryFee) / (candle.open * (1 + slip));
  const exitGross = units * candle.close * (1 - slip);
  const exitFee = exitGross * fee;
  const nextEquity = exitGross - exitFee;
  return {equity: nextEquity, netReturn: nextEquity / equity - 1, feeUsd: entryFee + exitFee, slippageUsd: units * (candle.open + candle.close) * slip, trades: 1};
}

async function loadFrozenSources() {
  const files = {};
  for (const relative of ['prospective-manifest.json', 'prospective.mjs', 'features.mjs', 'core.mjs', 'dataset.mjs', '../../scripts/market-lens-paper.mjs', '../../package-lock.json', '../../vendor/zodiacs-engine-0.1.1-rc.15.tgz']) {
    files[relative] = sha256(await readFile(path.resolve(root, relative)));
  }
  const enginePackagePath = findPackageJSON('@zodiacs/engine', import.meta.url);
  const enginePackageBytes = await readFile(enginePackagePath);
  const enginePackage = JSON.parse(enginePackageBytes);
  const engineEntry = path.resolve(path.dirname(enginePackagePath), enginePackage.exports['.'].import);
  files['engine/package.json'] = sha256(enginePackageBytes);
  const engineRoot = path.dirname(engineEntry);
  for (const filename of (await readdir(engineRoot)).filter((name) => name.endsWith('.js')).sort()) files[`engine/${filename}`] = sha256(await readFile(path.join(engineRoot, filename)));
  const requireEngine = createRequire(engineEntry);
  const ephemerisRoot = path.dirname(requireEngine.resolve('astronomy-engine'));
  for (const filename of ['package.json', 'astronomy.js', 'esm/astronomy.js']) files[`ephemeris/${filename}`] = sha256(await readFile(path.join(ephemerisRoot, filename)));
  return {files, hash: sha256(encode(files))};
}

export async function openStudy(directory, nowMs = Date.now(), initialize = false) {
  // Resolve symlinks at the CLI boundary as well as keeping raw files out of public/.
  const manifestBytes = await readFile(path.join(root, 'prospective-manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  if (engineReceipt.version !== manifest.engineVersion || engineReceipt.ephemeris.version !== manifest.ephemerisVersion) throw new Error('Paper study engine differs from the frozen protocol');
  const sources = await loadFrozenSources();
  const filename = path.join(directory, 'protocol.json');
  if (initialize) {
    if (nowMs >= Date.parse(manifest.start)) throw new Error('Protocol must be frozen before its first execution day; start a new version');
    await writeOnce(filename, receipt({experimentId: manifest.experimentId, frozenAt: new Date(nowMs).toISOString(), manifestHash: sha256(manifestBytes), sourceHash: sources.hash, sourceFiles: sources.files, engine: engineReceipt}));
  }
  const frozen = readReceipt(await readFile(filename, 'utf8'));
  if (frozen.payload.manifestHash !== sha256(manifestBytes) || frozen.payload.sourceHash !== sources.hash) throw new Error('Frozen protocol or implementation changed; use a new study version');
  return {directory, manifest, protocolHash: frozen.sha256, frozenAt: frozen.payload.frozenAt};
}

export async function recordDecision(study, fetchCandles, now = Date.now) {
  const {cutoff, execution} = decisionWindow(study.manifest, now());
  const filename = path.join(study.directory, 'decisions', `${stamp(execution)}.json`);
  if (await present(filename)) throw new Error('A decision already exists for this execution day; it cannot be overwritten');
  const snapshots = {};
  const candles = {};
  for (const product of study.manifest.products) {
    const raw = await fetchCandles(product, cutoff - 50 * DAY, cutoff);
    const snapshot = receipt({product, start: cutoff - 50 * DAY, endExclusive: cutoff, retrievedAt: new Date(now()).toISOString(), raw});
    snapshots[product] = snapshot;
    candles[product] = deduplicate(normalizeRecords(raw, cutoff - 50 * DAY, cutoff));
  }
  const recordedAt = now();
  if (utcDay(recordedAt) !== cutoff) throw new Error('Acquisition crossed the decision-day boundary; no decision recorded');
  const decision = createDecision(study.manifest, candles, recordedAt);
  const result = receipt({protocolHash: study.protocolHash, ...decision, snapshots});
  await writeOnce(filename, result);
  return result;
}

export async function readDecisions(study) {
  const directory = path.join(study.directory, 'decisions');
  let names;
  try { names = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const decisions = [];
  for (const filename of names.filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort()) {
    const decision = readReceipt(await readFile(path.join(directory, filename), 'utf8'));
    if (decision.payload.protocolHash !== study.protocolHash || filename !== decision.payload.executionAt.slice(0, 10) + '.json') throw new Error('Decision belongs to a different protocol/day');
    if (Date.parse(decision.payload.recordedAt) < Date.parse(study.frozenAt)) throw new Error('Decision was recorded before the protocol freeze');
    const candles = {};
    for (const product of study.manifest.products) {
      const snapshot = readReceipt(encode(decision.payload.snapshots[product]));
      if (Date.parse(snapshot.payload.retrievedAt) > Date.parse(decision.payload.recordedAt)) throw new Error('Decision precedes its source retrieval');
      candles[product] = deduplicate(normalizeRecords(snapshot.payload.raw, snapshot.payload.start, snapshot.payload.endExclusive));
    }
    const expected = createDecision(study.manifest, candles, Date.parse(decision.payload.recordedAt));
    for (const field of ['executionAt', 'outcomeFinalizesAt', 'assets']) if (JSON.stringify(expected[field]) !== JSON.stringify(decision.payload[field])) throw new Error('Decision does not reproduce from its frozen feature snapshot');
    decisions.push(decision);
  }
  return decisions;
}

export async function settleDecisions(study, fetchCandles, now = Date.now) {
  const completed = [];
  for (const decision of await readDecisions(study)) {
    const {executionAt, outcomeFinalizesAt} = decision.payload;
    if (now() < Date.parse(outcomeFinalizesAt) + study.manifest.minimumPublicationDelaySeconds * 1000) continue;
    const filename = path.join(study.directory, 'settlements', executionAt.slice(0, 10) + '.json');
    if (await present(filename)) continue;
    const execution = Date.parse(executionAt) / 1000;
    const snapshots = {};
    for (const product of study.manifest.products) {
      const raw = await fetchCandles(product, execution, execution + DAY);
      const bars = deduplicate(normalizeRecords(raw, execution, execution + DAY));
      if (bars.length !== 1 || bars[0].time !== execution) throw new Error('Missing complete execution candle; settlement stays pending');
      snapshots[product] = receipt({product, retrievedAt: new Date(now()).toISOString(), raw, candle: bars[0]});
    }
    const result = receipt({protocolHash: study.protocolHash, decisionHash: decision.sha256, executionAt, settledAt: new Date(now()).toISOString(), snapshots});
    await writeOnce(filename, result);
    completed.push({day: executionAt.slice(0, 10), sha256: result.sha256});
  }
  return completed;
}

export async function reportStudy(study, nowMs = Date.now()) {
  const decisions = await readDecisions(study);
  const byDay = new Map(decisions.map((decision) => [Date.parse(decision.payload.executionAt) / 1000, decision]));
  const initial = study.manifest.initialCapitalUsdPerArmPerAsset;
  const assets = study.manifest.products.map((product) => ({product, taOnly: {equity: initial, peak: initial, maxDrawdown: 0, feeUsd: 0, slippageUsd: 0, trades: 0}, taLunar: {equity: initial, peak: initial, maxDrawdown: 0, feeUsd: 0, slippageUsd: 0, trades: 0}}));
  let dueDays = 0, missedDays = 0, pendingDays = 0, matchedDays = 0;
  const first = Date.parse(study.manifest.start) / 1000;
  const last = Math.min(utcDay(nowMs) - DAY, Date.parse(study.manifest.endExclusive) / 1000 - DAY);
  let blocked = false;
  for (let day = first; day <= last; day += DAY) {
    // Do not score the latest day before its declared publication delay.
    if (nowMs < (day + DAY + study.manifest.minimumPublicationDelaySeconds) * 1000) continue;
    dueDays++;
    const decision = byDay.get(day);
    if (!decision) { missedDays++; continue; }
    const filename = path.join(study.directory, 'settlements', `${stamp(day)}.json`);
    if (!await present(filename)) { pendingDays++; blocked = true; continue; }
    const settlement = readReceipt(await readFile(filename, 'utf8'));
    if (settlement.payload.decisionHash !== decision.sha256 || settlement.payload.protocolHash !== study.protocolHash || settlement.payload.executionAt !== iso(day) || Date.parse(settlement.payload.settledAt) < (day + DAY + study.manifest.minimumPublicationDelaySeconds) * 1000) throw new Error('Settlement receipt does not match the prospective decision/cutoff');
    // A later day cannot be compounded over an unresolved earlier day.
    if (blocked) { pendingDays++; continue; }
    matchedDays++;
    for (const asset of assets) {
      const snapshot = readReceipt(encode(settlement.payload.snapshots[asset.product]));
      const bars = deduplicate(normalizeRecords(snapshot.payload.raw, day, day + DAY));
      if (bars.length !== 1 || JSON.stringify(bars[0]) !== JSON.stringify(snapshot.payload.candle) || Date.parse(snapshot.payload.retrievedAt) < (day + DAY + study.manifest.minimumPublicationDelaySeconds) * 1000 || Date.parse(snapshot.payload.retrievedAt) > Date.parse(settlement.payload.settledAt)) throw new Error('Settlement candle does not reproduce from its source/cutoff');
      const action = decision.payload.assets.find((value) => value.product === asset.product);
      for (const arm of ['taOnly', 'taLunar']) {
        const prior = asset[arm];
        const trade = settleTrade(action[arm], bars[0], study.manifest, prior.equity);
        prior.equity = trade.equity;
        prior.peak = Math.max(prior.peak, prior.equity);
        prior.maxDrawdown = Math.max(prior.maxDrawdown, 1 - prior.equity / prior.peak);
        for (const field of ['feeUsd', 'slippageUsd', 'trades']) prior[field] += trade[field];
      }
    }
  }
  for (const asset of assets) {
    for (const arm of ['taOnly', 'taLunar']) { asset[arm].netReturn = asset[arm].equity / initial - 1; asset[arm].exposure = matchedDays ? asset[arm].trades / matchedDays : null; delete asset[arm].peak; }
    asset.incrementalNetReturn = asset.taLunar.netReturn - asset.taOnly.netReturn;
  }
  return {experimentId: study.manifest.experimentId, protocolHash: study.protocolHash, generatedAt: new Date(nowMs).toISOString(), start: study.manifest.start, endExclusive: study.manifest.endExclusive, status: nowMs < Date.parse(study.manifest.start) ? 'awaiting-first-execution' : nowMs < Date.parse(study.manifest.endExclusive) + study.manifest.minimumPublicationDelaySeconds * 1000 ? 'descriptive-interim' : pendingDays ? 'pending-settlement' : 'window-complete', dueDays, recordedDecisions: decisions.length, futureDecisions: decisions.filter((decision) => Date.parse(decision.payload.outcomeFinalizesAt) > nowMs).length, matchedDays, missedDays, pendingDays, assets, limitations: [study.manifest.timestampLimit, study.manifest.inference, study.manifest.stoppingRule]};
}
