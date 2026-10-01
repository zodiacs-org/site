import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fitLogistic, predict, metrics, losses, purgedTraining, evaluationRows, trainingBaselines, blockBootstrap, mean} from './core.mjs';
import {buildRows, TA_NAMES, ASTRO_NAMES, engineReceipt} from './features.mjs';
import {loadDataset, sha256, writeJson} from './dataset.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const variants = {taOnly: TA_NAMES, astroOnly: ASTRO_NAMES, combined: [...TA_NAMES, ...ASTRO_NAMES]};
const executeFile = promisify(execFile);

async function verifiedEngineReceipt(archive) {
  const dist = path.dirname(fileURLToPath(import.meta.resolve('@zodiacs/engine')));
  const runtimeFiles = {};
  for (const filename of (await readdir(dist)).filter((name) => name.endsWith('.js')).sort()) {
    const runtime = await readFile(path.join(dist, filename));
    const {stdout: packed} = await executeFile('tar', ['-xOf', archive, `package/dist/${filename}`], {encoding: 'buffer', maxBuffer: 8 * 1024 * 1024});
    if (sha256(runtime) !== sha256(packed)) throw new Error(`Installed engine differs from pinned archive: ${filename}`);
    runtimeFiles[filename] = sha256(runtime);
  }
  const requireEngine = createRequire(import.meta.resolve('@zodiacs/engine'));
  const ephemerisRoot = path.dirname(requireEngine.resolve('astronomy-engine'));
  const ephemerisPackage = JSON.parse(await readFile(path.join(ephemerisRoot, 'package.json'), 'utf8'));
  if (ephemerisPackage.version !== engineReceipt.ephemeris.version) throw new Error('Installed ephemeris version differs from pinned engine receipt');
  const ephemerisFiles = {};
  for (const filename of ['astronomy.js', 'esm/astronomy.js']) ephemerisFiles[filename] = sha256(await readFile(path.join(ephemerisRoot, filename)));
  return {...engineReceipt, packageArchiveSha256: sha256(await readFile(archive)), runtimeMatchesPinnedArchive: true, runtimeFilesSha256: runtimeFiles, ephemerisFilesSha256: ephemerisFiles};
}

export function tuneModel(rows, names, manifest) {
  const candidates = manifest.model.l2Candidates.map((lambda) => {
    const folds = manifest.split.validationFolds.map((fold) => {
      const training = purgedTraining(rows, fold.start);
      const validation = evaluationRows(rows, fold.start, fold.endExclusive, manifest.split.testStart);
      if (training.length < 500 || validation.length < 200) throw new Error('Insufficient chronological training/validation coverage');
      const model = fitLogistic(training, names, lambda);
      return {start: fold.start, endExclusive: fold.endExclusive, trainingN: training.length, validation: metrics(validation, validation.map((row) => predict(model, row))), iterations: model.iterations};
    });
    return {lambda, folds, weightedLogLoss: folds.reduce((sum, fold) => sum + fold.validation.n * fold.validation.logLoss, 0) / folds.reduce((sum, fold) => sum + fold.validation.n, 0)};
  });
  const selected = [...candidates].sort((a, b) => a.weightedLogLoss - b.weightedLogLoss || b.lambda - a.lambda)[0];
  return {lambda: selected.lambda, candidates};
}

export function comparePredictions(rows, combined, ta, seed) {
  const times = rows.map((row) => row.cutoff);
  const brier = rows.map((row, i) => losses(row.target, combined[i]).brier - losses(row.target, ta[i]).brier);
  const logLoss = rows.map((row, i) => losses(row.target, combined[i]).logLoss - losses(row.target, ta[i]).logLoss);
  const brierInterval = blockBootstrap(brier, times, {seed});
  const logLossInterval = blockBootstrap(logLoss, times, {seed: seed + 1});
  return {direction: 'Combined minus TA-only; lower scores are better.', brier: brierInterval, logLoss: logLossInterval, conclusion: brierInterval.interval975[1] < 0 ? 'Exploratory incremental improvement in this fixed holdout; independent review and prospective testing still required.' : brierInterval.interval975[0] > 0 ? 'Combined lunar model performed worse than TA-only on the primary holdout comparison.' : 'No incremental benefit demonstrated by the primary holdout comparison; uncertainty includes no difference.'};
}

function yearlyMetrics(rows, probabilities) {
  const years = [...new Set(rows.map((row) => new Date(row.cutoff * 1000).getUTCFullYear()))];
  return years.map((year) => {
    const indexes = rows.map((row, i) => new Date(row.cutoff * 1000).getUTCFullYear() === year ? i : -1).filter((i) => i >= 0);
    return {year, ...metrics(indexes.map((i) => rows[i]), indexes.map((i) => probabilities[i]))};
  });
}

export async function runExperiment(directory, manifest, manifestBytes, reportDirectory = root, progress = console.log) {
  const manifestHash = sha256(manifestBytes);
  const sourceHashes = {};
  for (const filename of ['core.mjs', 'features.mjs', 'dataset.mjs', 'experiment.mjs']) sourceHashes[filename] = sha256(await readFile(path.join(root, filename)));
  const engineArchive = path.resolve(root, '../../vendor/zodiacs-engine-0.1.1-rc.15.tgz');
  if (engineReceipt.version !== '0.1.1-rc.15') throw new Error('Research engine version no longer matches the fixed preregistration');
  const engine = await verifiedEngineReceipt(engineArchive);
  const assets = [];
  const frozen = [];
  // All feature generation and validation tuning complete before any final holdout model evaluation.
  for (const product of manifest.data.products) {
    progress(`${product}: verify receipts and generate historical features`);
    const {candles, receipt} = await loadDataset(directory, product, manifestHash);
    const rows = buildRows(candles);
    const selections = {};
    for (const [name, names] of Object.entries(variants)) {
      progress(`${product}: bounded expanding-fold tuning ${name}`);
      selections[name] = tuneModel(rows, names, manifest);
    }
    frozen.push({product, datasetSha256: receipt.datasetSha256, selections});
    assets.push({product, receipt, rows, selections});
  }
  const freezeRecord = {experimentId: manifest.experimentId, manifestHash, engine, sourceHashes, selectedBeforeFinalEvaluation: true, assets: frozen};
  await writeJson(path.join(directory, 'model-selection.freeze.json'), freezeRecord);
  const freezeHash = sha256(await readFile(path.join(directory, 'model-selection.freeze.json')));
  const results = {schemaVersion: 1, experimentId: manifest.experimentId, manifestHash, modelSelectionFreezeSha256: freezeHash, generatedAt: new Date().toISOString(), status: 'Private exploratory research; public predictions disabled', engine, sourceHashes, target: manifest.target, split: manifest.split, scope: manifest.features.scope, licensing: manifest.data.licensing, assets: [], limitations: [
    'Only a fixed lunar feature set was tested; this does not establish or refute every astrological method.',
    'Same-venue daily OHLCV from public Coinbase Exchange responses; no futures, fees, spreads or execution simulation.',
    'Retrospective fixed holdout, not a prospectively timestamped paper forecast; repeated evaluation is reproducibility checking, not a new unseen test.',
    'Moving-block bootstrap is an uncertainty approximation, not a guarantee under regime changes. BTC/ETH observations are correlated.',
    'Two primary asset comparisons use conservative 97.5% intervals; other score/model/year/calibration comparisons are exploratory.',
    'Classification scores do not establish trading profitability. API availability does not establish public redistribution rights.',
    'UTC cutoff assumes finalized close availability. A public prospective system must define and record actual data-publication latency.'
  ]};
  for (let assetIndex = 0; assetIndex < assets.length; assetIndex++) {
    const {product, receipt, rows, selections} = assets[assetIndex];
    progress(`${product}: final frozen holdout evaluation`);
    const training = purgedTraining(rows, manifest.split.testStart);
    const test = evaluationRows(rows, manifest.split.testStart, manifest.data.requestedEndExclusive);
    if (test.length < 500) throw new Error('Insufficient final holdout coverage');
    const baseline = trainingBaselines(training);
    const probabilities = {unconditional: test.map(() => baseline.unconditional), persistence: test.map((row) => baseline.persistence[row.currentDirection])};
    const models = {};
    for (const [name, names] of Object.entries(variants)) {
      models[name] = fitLogistic(training, names, selections[name].lambda);
      probabilities[name] = test.map((row) => predict(models[name], row));
    }
    const scoreTable = Object.fromEntries(Object.entries(probabilities).map(([name, probs]) => [name, metrics(test, probs)]));
    const comparison = comparePredictions(test, probabilities.combined, probabilities.taOnly, 61421 + assetIndex * 100);
    // Added after the first holdout run: diagnostic only, explicitly not a new preregistered test.
    const matchedControl = fitLogistic(training, TA_NAMES, selections.combined.lambda);
    const matchedProbabilities = test.map((row) => predict(matchedControl, row));
    const matchedComparison = comparePredictions(test, probabilities.combined, matchedProbabilities, 62000 + assetIndex * 100);
    const postHocMatchedPenalty = {status: 'Post-hoc diagnostic added after first holdout inspection; no confirmatory inference.', reason: 'Selected penalties differ between model variants, so the primary pipeline comparison cannot isolate lunar features from regularization.', taOnlyLambda: matchedControl.lambda, taOnlyScore: metrics(test, matchedProbabilities), pairedComparison: matchedComparison};
    models.postHocTaMatchedPenalty = matchedControl;
    const baselineDifferences = {combinedMinusUnconditionalBrier: scoreTable.combined.brier - scoreTable.unconditional.brier, combinedMinusPersistenceBrier: scoreTable.combined.brier - scoreTable.persistence.brier};
    const assetResult = {product, datasetSha256: receipt.datasetSha256, retrievedFirstAt: receipt.pages[0].fetchedAt, retrievedLastAt: receipt.pages.at(-1).fetchedAt, coverage: receipt.coverage, usableRows: rows.length, developmentRows: purgedTraining(rows, manifest.split.developmentBefore).length, finalTrainingRows: training.length, testFirstCutoff: new Date(test[0].cutoff * 1000).toISOString(), testLastCutoff: new Date(test.at(-1).cutoff * 1000).toISOString(), approximateLunarCyclesInHoldout: (test.at(-1).cutoff - test[0].cutoff) / 86400 / 29.530588, selections, baseline, scores: scoreTable, comparison, baselineDifferences, postHocMatchedPenalty, yearly: Object.fromEntries(Object.entries(probabilities).map(([name, probs]) => [name, yearlyMetrics(test, probs)]))};
    results.assets.push(assetResult);
    await writeJson(path.join(directory, `${product}.models.json`), {manifestHash, freezeHash, engine, models, baseline});
    await writeJson(path.join(directory, `${product}.features.json`), {manifestHash, engine, rows});
    await writeJson(path.join(directory, `${product}.holdout-predictions.json`), {manifestHash, freezeHash, rows: test.map((row, i) => ({cutoff: row.cutoff, targetEnd: row.targetEnd, target: row.target, predictions: {...Object.fromEntries(Object.entries(probabilities).map(([name, probs]) => [name, probs[i]])), postHocTaMatchedPenalty: matchedProbabilities[i]}}))});
  }
  results.primaryConclusion = results.assets.every((asset) => asset.comparison.brier.interval975[1] < 0) ? 'Exploratory incremental improvement on both asset holdouts; evidence gate remains closed pending independent review and prospective evaluation.' : 'The experiment does not demonstrate a consistent incremental predictive benefit from the tested lunar features. Public model forecasts remain disabled.';
  await mkdir(reportDirectory, {recursive: true});
  await writeJson(path.join(reportDirectory, 'results.json'), results);
  await writeFile(path.join(reportDirectory, 'REPORT.md'), renderReport(results, manifest));
  progress(results.primaryConclusion);
  return results;
}

const fixed = (value, places = 5) => value.toFixed(places);
const percentage = (value) => `${(value * 100).toFixed(2)}%`;
const interval = (value) => `[${fixed(value[0])}, ${fixed(value[1])}]`;
export function renderReport(results, manifest) {
  const lines = ['# Market Lens lunar-direction experiment', '', results.primaryConclusion, '', `Generated ${results.generatedAt}. **Private retrospective research; no public model forecasts or trading policy.**`, '', '## Frozen question and protocol', '', 'Does a fixed set of lunar-phase features improve next UTC daily close direction predictions relative to a fixed technical-analysis feature set?', '', `Manifest: \`${results.experimentId}\`, SHA-256 \`${results.manifestHash}\`. Model-selection freeze SHA-256: \`${results.modelSelectionFreezeSha256}\`.`, '', 'The target is the direction from finalized close t to finalized close t+1. The forecast cutoff is UTC midnight after bar t; all market features use bar t and earlier. Zero returns are class 0. No missing bars are filled. Feature rows require 61 consecutive daily bars; RSI uses Wilder smoothing initialized after 14 changes within each contiguous segment.', '', 'TA features are 1/7/30-day log returns, SMA20/50 price gaps, 20-day close-return population standard deviation, centered RSI14, and log1p(volume) minus log1p(20-day mean volume). Lunar features are sine/cosine of Moon–Sun elongation and fixed ≤12° proximity flags for new/full phase, evaluated with the pinned engine at the forecast cutoff. These flags are not exact event timestamps.', '', `Development precedes 2021. Two expanding validation folds cover 2021 and 2022. The final holdout starts ${manifest.split.testStart} and ends with targets finalized by ${manifest.data.requestedEndExclusive}. Training labels ending at or after an evaluation start are purged. Validation labels reaching the holdout are also purged. All scaling fits training data only.`, '', 'Each of TA-only, lunar-only, and combined logistic models tries only L2 penalties 0.01, 0.1, and 1, selected by sample-weighted validation log loss. All candidates are retained in results.json. After selection, models refit on pre-holdout data once; holdout performance does not influence model selection.', '', '## Verified source and coverage', '', `Venue: Coinbase Exchange, BTC-USD and ETH-USD spot; UTC daily opening timestamps, volume in the asset's base currency. Requested history starts ${manifest.data.requestedStart}. Raw responses, response hashes, retrieval receipts, features, fitted weights and holdout predictions are stored outside the public site. **Public display/redistribution rights have not been established.**`, '', `Astronomy: ${results.engine.engine} ${results.engine.version}, ${results.engine.ephemeris.name} ${results.engine.ephemeris.version}. Vendored archive SHA-256: \`${results.engine.packageArchiveSha256}\`.`, ''];
  for (const asset of results.assets) {
    lines.push(`## ${asset.product}`, '', `Observed bars: ${asset.coverage.n}, ${asset.coverage.firstBar} through ${asset.coverage.lastBar}; ${asset.coverage.missingBars} missing daily bars within observed coverage. Usable rows: ${asset.usableRows}; development: ${asset.developmentRows}; final training: ${asset.finalTrainingRows}; final test: ${asset.scores.combined.n}.`, '', `Holdout cutoffs: ${asset.testFirstCutoff} through ${asset.testLastCutoff}; positive target rate ${percentage(asset.scores.combined.positiveRate)}; approximately ${asset.approximateLunarCyclesInHoldout.toFixed(1)} lunar cycles, not thousands of independent lunar events. Dataset SHA-256: \`${asset.datasetSha256}\`.`, '', '| Model | Selected L2 | Brier ↓ | Log loss ↓ | Direction accuracy |', '|---|---:|---:|---:|---:|');
    for (const [name, score] of Object.entries(asset.scores)) lines.push(`| ${name} | ${asset.selections[name]?.lambda ?? '—'} | ${fixed(score.brier)} | ${fixed(score.logLoss)} | ${percentage(score.accuracy)} |`);
    lines.push('', `**Primary paired comparison, combined minus TA-only Brier:** ${fixed(asset.comparison.brier.mean)}; 95% interval ${interval(asset.comparison.brier.interval95)}; conservative 97.5% interval ${interval(asset.comparison.brier.interval975)}.`, '', `Secondary log-loss difference: ${fixed(asset.comparison.logLoss.mean)}; 95% interval ${interval(asset.comparison.logLoss.interval95)}.`, '', asset.comparison.conclusion, '', '### Combined model reliability', '', '| Predicted range | Days | Mean prediction | Observed positive rate |', '|---|---:|---:|---:|');
    for (const bin of asset.scores.combined.calibration) lines.push(`| ${percentage(bin.lower)}–${percentage(bin.upper)} | ${bin.n} | ${bin.predicted === null ? '—' : percentage(bin.predicted)} | ${bin.observed === null ? '—' : percentage(bin.observed)} |`);
    const diagnostic = asset.postHocMatchedPenalty;
    lines.push('', '### Attribution limits and post-hoc diagnostic', '', `The primary comparison uses separately selected penalties (TA ${asset.selections.taOnly.lambda}; combined ${asset.selections.combined.lambda}). It compares complete modeling pipelines and cannot isolate an effect from adding lunar features. Combined minus persistence Brier is ${fixed(asset.baselineDifferences.combinedMinusPersistenceBrier)}; a positive value means the combined model is worse than that simpler benchmark.`, '', `After inspecting the first holdout, we added a **post-hoc, exploratory** TA-only control using the combined model's selected L2 (${diagnostic.taOnlyLambda}). Its Brier score is ${fixed(diagnostic.taOnlyScore.brier)}. Combined minus matched-penalty TA Brier is ${fixed(diagnostic.pairedComparison.brier.mean)} with a 95% block interval ${interval(diagnostic.pairedComparison.brier.interval95)}. This diagnostic is not a new confirmatory or unseen test.`);
    lines.push('');
  }
  lines.push('## Uncertainty and interpretation', '', 'Paired circular moving-block bootstrap uses 30-day blocks, 1,000 deterministic replicates, and the same daily rows for both models. Blocks stop at missing-day gaps. Central 97.5% intervals conservatively address the two primary asset comparisons; other model scores, accuracy, year slices and calibration bins are exploratory. Daily dependence, correlated assets, model selection and market regime change limit inference.', '', ...results.limitations.map((limitation) => `- ${limitation}`), '', '## Reproduce and evidence gate', '', 'From the site checkout: `node scripts/market-lens-research.mjs acquire --dir /workspace/.onboarding/lens-research/v1`, then `node scripts/market-lens-research.mjs run --dir /workspace/.onboarding/lens-research/v1`. Run verifies every source-response/dataset hash and can operate offline. `./node_modules/.bin/vitest run research/market-lens/core.test.mjs --maxWorkers=1 --minWorkers=1` tests leakage boundaries, deterministic lunar features, gaps, fixtures, metrics and model behavior.', '', 'A rerun of this holdout verifies reproducibility; it is not a new unseen evaluation. Any protocol change needs a new manifest/version and fresh evaluation plan. No public model forecast is enabled. Independent review and a prospectively timestamped paper-forecast period are prerequisites.', '');
  return lines.join('\n');
}
