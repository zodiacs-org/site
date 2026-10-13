// For each Lighthouse trace: when the fonts were requested and finished, when
// the page first painted, when inline scripts near the end of the body ran, and
// every LayoutShift event (ms from navigation start).
// node ci-trace-fonts.mjs <thesis-N.trace.json> [...]  (traces from a run's phase-1-browser-performance artifact)
import { readFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const events = Array.isArray(raw) ? raw : raw.traceEvents;
  const nav = events.find((e) => e.name === 'navigationStart' && e.args?.data?.documentLoaderURL?.includes('/thesis/'))
    ?? events.find((e) => e.name === 'navigationStart');
  const t0 = nav.ts;
  const ms = (ts) => Math.round((ts - t0) / 100) / 10;
  const requests = new Map();
  for (const e of events) {
    const d = e.args?.data;
    if (!d) continue;
    if (e.name === 'ResourceSendRequest' && /\/fonts\/|\.woff2/.test(d.url)) requests.set(d.requestId, { url: d.url.replace(/^.*\/fonts\//, ''), send: ms(e.ts), priority: d.priority });
    if ((e.name === 'ResourceFinish') && requests.has(d.requestId)) requests.get(d.requestId).finish = ms(e.ts);
  }
  const paints = events.filter((e) => ['firstPaint', 'firstContentfulPaint', 'largestContentfulPaint::Candidate'].includes(e.name) && e.ts >= t0)
    .map((e) => `${e.name}@${ms(e.ts)}`);
  const scripts = events.filter((e) => e.name === 'EvaluateScript' && e.args?.data?.url?.includes('/thesis/') && e.ts >= t0)
    .map((e) => `L${e.args.data.lineNumber}@${ms(e.ts)}+${Math.round(e.dur / 100) / 10}`);
  const parse = events.filter((e) => e.name === 'ParseHTML' && e.ts >= t0)
    .map((e) => `${e.args?.beginData?.startLine}-${e.args?.endData?.endLine}@${ms(e.ts)}`);
  const shifts = events.filter((e) => e.name === 'LayoutShift' && e.ts >= t0).map((e) => {
    const d = e.args.data;
    return `${ms(e.ts)}ms score=${d.score} weighted=${d.weighted_score_delta} recent=${d.had_recent_input} nodes=${JSON.stringify((d.impacted_nodes ?? []).map((n) => ({ id: n.node_id, old: n.old_rect, new: n.new_rect })))}`;
  });
  const viewport = events.find((e) => e.name === 'viewport');
  console.log(`# ${file.replace(/^.*\//, '')}`);
  console.log('fonts:', [...requests.values()].map((r) => `${r.url}[${r.priority}] ${r.send}→${r.finish}`).join(' | '));
  console.log('paints:', paints.slice(0, 4).join(' '));
  console.log('parse chunks:', parse.slice(0, 12).join(' '), parse.length > 12 ? `… (${parse.length})` : '');
  console.log('inline scripts:', scripts.join(' '));
  console.log('viewport event:', viewport ? ms(viewport.ts) : 'none');
  console.log('shifts:', shifts.length ? '\n  ' + shifts.join('\n  ') : 'none');
}
