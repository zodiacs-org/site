// Compact per-sample values from Lighthouse JSONs, for the evidence record.
// node lighthouse-samples.mjs <label>=<dir of thesis-N.json reports> [...] > lighthouse-samples.json
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/^thesis-(?:stalled-)?\d+\.json$/.test(name)) out.push(path);
  }
  return out;
}
const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const sets = {};
for (const arg of process.argv.slice(2)) {
  const [label, dir] = arg.split('=');
  sets[label] = files(dir).map((path) => {
    const lhr = JSON.parse(readFileSync(path, 'utf8'));
    const a = lhr.audits;
    const m = a.metrics?.details?.items?.[0] ?? {};
    const font = (name) => {
      const r = (a['network-requests']?.details?.items ?? []).find((item) => item.url.endsWith(`/fonts/${name}`));
      return r ? { start: round(r.networkRequestTime), end: round(r.networkEndTime), priority: r.priority, preload: Boolean(r.isLinkPreload) } : null;
    };
    return {
      sample: path.slice(dir.length + 1),
      setAside: /stalled/.test(path),
      performance: Math.round(lhr.categories.performance.score * 100),
      lcpMs: round(a['largest-contentful-paint'].numericValue),
      fcpMs: round(a['first-contentful-paint'].numericValue),
      cls: a['cumulative-layout-shift'].numericValue,
      tbtMs: round(a['total-blocking-time'].numericValue),
      observedFirstPaintMs: round(m.observedFirstPaint ?? NaN),
      shifted: (a['layout-shifts']?.details?.items ?? []).map((item) => item.node?.selector),
      fonts: { medium: font('eb-garamond-latin-500-normal.woff2'), italic: font('eb-garamond-latin-400-italic.woff2') },
    };
  });
}
const summary = Object.fromEntries(Object.entries(sets).map(([label, samples]) => {
  const valid = samples.filter((s) => !s.setAside);
  const lcps = valid.map((s) => s.lcpMs).sort((x, y) => x - y);
  return [label, {
    validSamples: valid.length,
    setAside: samples.length - valid.length,
    positiveCls: valid.filter((s) => s.cls > 0).length,
    maxCls: Math.max(...valid.map((s) => s.cls)),
    lcpMs: { min: lcps[0], median: lcps[Math.floor((lcps.length - 1) / 2)], max: lcps.at(-1) },
    fcpMsMedian: valid.map((s) => s.fcpMs).sort((x, y) => x - y)[Math.floor((valid.length - 1) / 2)],
    performanceMin: Math.min(...valid.map((s) => s.performance)),
  }];
}));
console.log(JSON.stringify({ summary, samples: sets }, null, 2));
