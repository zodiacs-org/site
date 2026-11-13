/**
 * Summarise the layout shifts of a Browser Evidence run's Lighthouse samples:
 * for each sample of the given routes, its cumulative layout shift, the
 * shifted elements Lighthouse names, and from the trace the first contentful
 * paint and each shift's time after navigation and score.
 *
 *   node lighthouse-shift-summary.mjs <the artifact's tests/visual/artifacts/lighthouse> <route name>...
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [directory, ...routes] = process.argv.slice(2);
const samples = [];
for (const route of routes) {
  for (let take = 1; take <= 3; take += 1) {
    const name = `${route}-${take}`;
    const report = JSON.parse(await readFile(join(directory, `${name}.json`), 'utf8'));
    const trace = JSON.parse(await readFile(join(directory, `${name}.trace.json`), 'utf8'));
    const events = trace.traceEvents ?? trace;
    const path = new URL(report.finalDisplayedUrl ?? report.requestedUrl).pathname;
    const navigation = events.filter((event) => event.name === 'navigationStart')
      .find((event) => { try { return new URL(String(event.args?.data?.documentLoaderURL)).pathname === path; } catch { return false; } });
    const after = (event) => Number(((event.ts - navigation.ts) / 1000).toFixed(1));
    const paint = events.find((event) => event.name === 'firstContentfulPaint' && event.ts >= navigation.ts);
    samples.push({
      sample: name,
      path,
      cumulativeLayoutShift: report.audits['cumulative-layout-shift'].numericValue,
      shiftedElements: (report.audits['layout-shifts']?.details?.items ?? []).map((item) => ({ selector: item.node?.selector ?? null, score: item.score })),
      firstContentfulPaintMs: paint ? after(paint) : null,
      shifts: events.filter((event) => event.name === 'LayoutShift' && event.ts >= navigation.ts)
        .map((event) => ({ ms: after(event), score: event.args.data.score })),
    });
  }
}
console.log(JSON.stringify({ schema: 'zodiacs.lighthouse-shift-summary.v1', samples }, null, 2));
