/** Dependency-free offline models. Neither this module nor raw data is shipped to browsers. */
export const DAY = 86400;
export const sigmoid = (x) => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
export const mean = (xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

export function fitScaler(rows, names) {
  if (!rows.length) throw new Error('Cannot fit a scaler without training rows');
  return names.map((name) => {
    const values = rows.map((row) => row.features[name]);
    if (values.some((x) => !Number.isFinite(x))) throw new Error(`Non-finite feature: ${name}`);
    const center = mean(values);
    const scale = Math.sqrt(mean(values.map((x) => (x - center) ** 2))) || 1;
    return {name, center, scale};
  });
}
export const transform = (row, scaler) => [1, ...scaler.map(({name, center, scale}) => (row.features[name] - center) / scale)];
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const softplus = (x) => Math.max(0, x) + Math.log1p(Math.exp(-Math.abs(x)));

function solve(matrix, vector) {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  const n = vector.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
    [a[pivot], a[i]] = [a[i], a[pivot]];
    if (Math.abs(a[i][i]) < 1e-14) throw new Error('Singular model Hessian');
    const divisor = a[i][i];
    for (let j = i; j <= n; j++) a[i][j] /= divisor;
    for (let k = 0; k < n; k++) if (k !== i) {
      const multiple = a[k][i];
      for (let j = i; j <= n; j++) a[k][j] -= multiple * a[i][j];
    }
  }
  return a.map((row) => row[n]);
}

export function fitLogistic(rows, names, lambda) {
  if (!(lambda > 0)) throw new Error('Positive L2 penalty required');
  const scaler = fitScaler(rows, names);
  const xs = rows.map((row) => transform(row, scaler));
  const ys = rows.map((row) => row.target);
  const balance = mean(ys);
  if (!(balance > 0 && balance < 1)) throw new Error('Training data must contain both classes');
  let weights = [Math.log(balance / (1 - balance)), ...names.map(() => 0)];
  const objective = (w) => mean(xs.map((x, i) => softplus(dot(x, w)) - ys[i] * dot(x, w))) + lambda / 2 * w.slice(1).reduce((sum, x) => sum + x * x, 0);
  let converged = false;
  let iterations = 0;
  for (; iterations < 60; iterations++) {
    const gradient = weights.map((w, i) => i === 0 ? 0 : lambda * w);
    const hessian = weights.map((_, i) => weights.map((__, j) => i === j && i > 0 ? lambda : 0));
    for (let r = 0; r < xs.length; r++) {
      const x = xs[r];
      const p = sigmoid(dot(x, weights));
      const residual = (p - ys[r]) / xs.length;
      const curvature = Math.max(p * (1 - p), 1e-12) / xs.length;
      for (let i = 0; i < weights.length; i++) {
        gradient[i] += residual * x[i];
        for (let j = 0; j <= i; j++) {
          hessian[i][j] += curvature * x[i] * x[j];
          if (i !== j) hessian[j][i] = hessian[i][j];
        }
      }
    }
    if (Math.max(...gradient.map(Math.abs)) < 1e-8) { converged = true; break; }
    const direction = solve(hessian, gradient);
    const before = objective(weights);
    let step = 1;
    let next;
    while (step > 1e-8) {
      next = weights.map((w, i) => w - step * direction[i]);
      // At the optimum, accumulation roundoff can exceed a vanishing Newton improvement.
      if (objective(next) <= before + 8 * Number.EPSILON * Math.max(1, Math.abs(before))) break;
      step /= 2;
    }
    if (step <= 1e-8) throw new Error('Newton line search failed');
    weights = next;
  }
  if (!converged) throw new Error('Logistic optimization did not converge');
  return {names, lambda, scaler, weights, iterations, converged};
}
export const predict = (model, row) => sigmoid(dot(transform(row, model.scaler), model.weights));
export function losses(target, probability) {
  const p = Math.min(1 - 1e-12, Math.max(1e-12, probability));
  return {brier: (probability - target) ** 2, logLoss: -(target * Math.log(p) + (1 - target) * Math.log1p(-p))};
}
export function metrics(rows, predictions) {
  if (!rows.length || rows.length !== predictions.length) throw new Error('Evaluation rows and predictions must align');
  const scores = predictions.map((p, i) => {
    if (!(p >= 0 && p <= 1)) throw new Error('Invalid probability');
    return losses(rows[i].target, p);
  });
  const calibration = Array.from({length: 5}, (_, bin) => {
    const indexes = predictions.map((p, i) => Math.min(4, Math.floor(p * 5)) === bin ? i : -1).filter((i) => i >= 0);
    return {lower: bin / 5, upper: (bin + 1) / 5, n: indexes.length, predicted: indexes.length ? mean(indexes.map((i) => predictions[i])) : null, observed: indexes.length ? mean(indexes.map((i) => rows[i].target)) : null};
  });
  return {n: rows.length, positiveRate: mean(rows.map((row) => row.target)), brier: mean(scores.map((s) => s.brier)), logLoss: mean(scores.map((s) => s.logLoss)), accuracy: mean(predictions.map((p, i) => Number((p >= 0.5 ? 1 : 0) === rows[i].target))), calibration};
}
export function trainingBaselines(training) {
  const unconditional = mean(training.map((row) => row.target));
  const persistence = [0, 1].map((direction) => {
    const rows = training.filter((row) => row.currentDirection === direction);
    return (rows.reduce((sum, row) => sum + row.target, 0) + 1) / (rows.length + 2);
  });
  return {unconditional, persistence};
}
export function purgedTraining(rows, evaluationStart) {
  const start = Date.parse(evaluationStart) / 1000;
  return rows.filter((row) => row.targetEnd < start);
}
export function evaluationRows(rows, start, endExclusive, labelEndExclusive = Infinity) {
  const first = Date.parse(start) / 1000;
  const last = Date.parse(endExclusive) / 1000;
  const labelLast = typeof labelEndExclusive === 'string' ? Date.parse(labelEndExclusive) / 1000 : labelEndExclusive;
  return rows.filter((row) => row.cutoff >= first && row.cutoff < last && row.targetEnd < labelLast);
}

/** Seeded paired daily moving blocks preserve adjacency; cut blocks at missing-row gaps. */
export function blockBootstrap(values, cutoffs, {blockDays = 30, replicates = 1000, seed = 61421} = {}) {
  if (values.length !== cutoffs.length || !values.length) throw new Error('Invalid bootstrap series');
  let state = seed >>> 0;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const samples = [];
  for (let replicate = 0; replicate < replicates; replicate++) {
    let total = 0;
    let count = 0;
    while (count < values.length) {
      const start = Math.floor(random() * values.length);
      for (let offset = 0; offset < blockDays && count < values.length; offset++) {
        const index = (start + offset) % values.length;
        if (offset > 0 && index !== 0 && cutoffs[index] !== cutoffs[index - 1] + DAY) break;
        total += values[index]; count++;
      }
    }
    samples.push(total / count);
  }
  samples.sort((a, b) => a - b);
  const quantile = (p) => samples[Math.min(samples.length - 1, Math.floor(p * samples.length))];
  return {mean: mean(values), interval95: [quantile(0.025), quantile(0.975)], interval975: [quantile(0.0125), quantile(0.9875)], blockDays, replicates, seed};
}
