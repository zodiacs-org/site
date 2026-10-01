import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {DAY} from './core.mjs';

const executeFile = promisify(execFile);
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function exists(filename) { try { await stat(filename); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
export async function writeJson(filename, value) { await mkdir(path.dirname(filename), {recursive: true}); await writeFile(filename, JSON.stringify(value, null, 2) + '\n'); }

export function normalizeRecords(records, start, end) {
  if (!Array.isArray(records)) throw new Error('Coinbase candle response must be an array');
  return records.map((record) => {
    if (!Array.isArray(record) || record.length !== 6 || record.some((value) => typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Malformed candle record');
    const [time, low, high, open, close, volume] = record;
    if (!Number.isInteger(time) || time % DAY || low <= 0 || volume < 0 || low > Math.min(open, close) || high < Math.max(open, close) || high < low) throw new Error('Invalid candle OHLC/time/volume');
    return {time, low, high, open, close, volume};
  }).filter((bar) => bar.time >= start && bar.time < end).sort((a, b) => a.time - b.time);
}
export function deduplicate(candles) {
  const byTime = new Map();
  for (const bar of candles) {
    const prior = byTime.get(bar.time);
    if (prior && JSON.stringify(prior) !== JSON.stringify(bar)) throw new Error(`Conflicting duplicate candle at ${bar.time}`);
    byTime.set(bar.time, bar);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
export function describeCoverage(candles) {
  if (!candles.length) throw new Error('No historical candles returned');
  const gaps = [];
  for (let i = 1; i < candles.length; i++) if (candles[i].time !== candles[i - 1].time + DAY) {
    gaps.push({start: new Date((candles[i - 1].time + DAY) * 1000).toISOString(), endExclusive: new Date(candles[i].time * 1000).toISOString(), missingBars: (candles[i].time - candles[i - 1].time) / DAY - 1});
  }
  return {n: candles.length, firstBar: new Date(candles[0].time * 1000).toISOString(), lastBar: new Date(candles.at(-1).time * 1000).toISOString(), missingBars: gaps.reduce((sum, gap) => sum + gap.missingBars, 0), gaps};
}

/** curl uses the execution host's established HTTPS proxy/trust configuration. TLS stays verified. */
async function download(url, filename) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const {stdout} = await executeFile('curl', ['--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', '--proto', '=https', '--output', filename, '--write-out', '%{http_code}', '--user-agent', 'Zodiacs-Market-Lens-Private-Research/1', url], {maxBuffer: 1024 * 1024});
    const status = Number(stdout.trim());
    if (status === 200) return;
    if ((status === 429 || status >= 500) && attempt < 3) { await sleep(1000 * 2 ** attempt); continue; }
    throw new Error(`Coinbase historical request returned HTTP ${status}`);
  }
}

export async function acquireDataset(directory, manifest, manifestBytes, progress = console.log) {
  await mkdir(directory, {recursive: true});
  const manifestHash = sha256(manifestBytes);
  const predeclarationPath = path.join(directory, 'predeclaration.json');
  if (await exists(predeclarationPath)) {
    const prior = JSON.parse(await readFile(predeclarationPath, 'utf8'));
    if (prior.manifestHash !== manifestHash) throw new Error('Existing research directory belongs to a different preregistration. Use a new directory.');
  } else await writeJson(predeclarationPath, {experimentId: manifest.experimentId, manifestHash, savedBeforeAcquisitionAt: new Date().toISOString()});
  const start = Date.parse(manifest.data.requestedStart) / 1000;
  const end = Date.parse(manifest.data.requestedEndExclusive) / 1000;
  if (end * 1000 > Date.now()) throw new Error('Requested research end includes unfinished/future bars');
  for (const product of manifest.data.products) {
    if (await exists(path.join(directory, `${product}.receipt.json`))) {
      await loadDataset(directory, product, manifestHash);
      progress(`${product}: existing verified dataset reused`);
      continue;
    }
    const rawDir = path.join(directory, 'raw', product);
    await mkdir(rawDir, {recursive: true});
    const pages = [];
    let candles = [];
    let index = 0;
    for (let first = start; first < end; first += manifest.data.maxCandlesPerRequest * DAY) {
      const last = Math.min(end, first + manifest.data.maxCandlesPerRequest * DAY);
      const url = new URL(`https://api.exchange.coinbase.com/products/${product}/candles`);
      url.search = new URLSearchParams({granularity: String(DAY), start: new Date(first * 1000).toISOString(), end: new Date(last * 1000).toISOString()});
      const filename = path.join(rawDir, `${String(index).padStart(3, '0')}.json`);
      const metadataPath = filename + '.receipt.json';
      let metadata;
      if (await exists(filename) && await exists(metadataPath)) {
        metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
        if (metadata.url !== String(url)) throw new Error('Raw-page request receipt mismatch');
      } else {
        await download(String(url), filename);
        metadata = {url: String(url), fetchedAt: new Date().toISOString(), sha256: sha256(await readFile(filename))};
        await writeJson(metadataPath, metadata);
        await sleep(350);
      }
      const raw = await readFile(filename);
      if (sha256(raw) !== metadata.sha256) throw new Error('Raw-page integrity mismatch');
      const records = JSON.parse(raw.toString());
      const bars = normalizeRecords(records, first, last);
      pages.push({...metadata, rawFile: path.relative(directory, filename), requestedStart: first, requestedEndExclusive: last, returnedRecords: records.length, retainedRecords: bars.length});
      candles.push(...bars);
      progress(`${product}: historical page ${++index}, retained ${bars.length} UTC daily bars`);
    }
    candles = deduplicate(candles);
    const dataPath = path.join(directory, `${product}.candles.json`);
    await writeJson(dataPath, candles);
    await writeJson(path.join(directory, `${product}.receipt.json`), {schemaVersion: 1, provider: manifest.data.provider, product, granularitySeconds: DAY, manifestHash, datasetSha256: sha256(await readFile(dataPath)), timestampConvention: 'UTC opening time; record close belongs to finalized daily bar', volumeUnit: product.split('-')[0], requestedStart: manifest.data.requestedStart, requestedEndExclusive: manifest.data.requestedEndExclusive, coverage: describeCoverage(candles), pages, license: manifest.data.licensing});
  }
}

export async function loadDataset(directory, product, manifestHash) {
  const receipt = JSON.parse(await readFile(path.join(directory, `${product}.receipt.json`), 'utf8'));
  if (receipt.manifestHash !== manifestHash || receipt.product !== product) throw new Error('Dataset manifest/product binding mismatch');
  const bytes = await readFile(path.join(directory, `${product}.candles.json`));
  if (sha256(bytes) !== receipt.datasetSha256) throw new Error('Historical dataset hash mismatch');
  const parsed = JSON.parse(bytes.toString());
  const candles = normalizeRecords(parsed.map((bar) => [bar.time, bar.low, bar.high, bar.open, bar.close, bar.volume]), Date.parse(receipt.requestedStart) / 1000, Date.parse(receipt.requestedEndExclusive) / 1000);
  if (candles.length !== parsed.length || deduplicate(candles).length !== candles.length) throw new Error('Historical dataset coverage/duplicates invalid');
  if (JSON.stringify(describeCoverage(candles)) !== JSON.stringify(receipt.coverage)) throw new Error('Historical coverage receipt mismatch');
  const reconstructed = [];
  for (const page of receipt.pages) {
    const relative = path.normalize(page.rawFile);
    if (path.isAbsolute(relative) || relative.startsWith('..')) throw new Error('Invalid raw-page receipt path');
    const raw = await readFile(path.join(directory, relative));
    if (sha256(raw) !== page.sha256) throw new Error('Historical raw response integrity mismatch');
    reconstructed.push(...normalizeRecords(JSON.parse(raw.toString()), page.requestedStart, page.requestedEndExclusive));
  }
  if (JSON.stringify(deduplicate(reconstructed)) !== JSON.stringify(candles)) throw new Error('Normalized historical dataset does not match original source responses');
  return {candles, receipt};
}
