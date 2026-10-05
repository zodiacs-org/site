/**
 * The election search's evaluation, as PREREGISTRATION.md says, in three steps:
 *
 *   npx vite-node --script tools/run.ts endpoint <seed> <answered> <out.json>
 *       draws queries in order and asks the real handler, with its real
 *       allowance, until <answered> are answered; a query refused for its
 *       allowance is recorded and the next is drawn
 *   npx vite-node --script tools/run.ts brute <endpoint.json> <shard> <shards> <out.json>
 *       the brute force for the answered queries whose index is <shard> modulo <shards>
 *   npx vite-node --script tools/run.ts compare <endpoint.json> <brute.json>... <out.json>
 *       holds each answered query's windows to the brute force's
 *
 * The comparison closes gaps shorter than 20 seconds and then drops windows
 * shorter than 20 seconds, in both lists, since a scan every 10 seconds
 * cannot see them; it counts what it closed and dropped. The query passes
 * when both lists then hold as many windows, each end within 10 seconds.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createComputeApiHandler } from '../../../../../src/lib/compute-api/handler';
import { run } from '../../../../../scripts/lib/compute-api-harness';
import { createLocalTimeModule } from '../../../../../api/_compute/local-time.mjs';
import { bruteForce, type Span } from './brute-force';
import { drawQuery, mulberry32, type Query } from './draw';

export const TOLERANCE_MS = 10_000;
export const UNSEEN_MS = 20_000;

/** Closes gaps shorter than UNSEEN_MS, then drops windows shorter than it; returns how many of each. */
export function clean(spans: readonly Span[]): { spans: Span[]; closed: number; dropped: number } {
  const joined: Span[] = [];
  let closed = 0;
  for (const span of spans) {
    const last = joined[joined.length - 1];
    if (last && span.from - last.to < UNSEEN_MS) {
      last.to = span.to;
      closed += 1;
    } else joined.push({ ...span });
  }
  const kept = joined.filter((span) => span.to - span.from >= UNSEEN_MS);
  return { spans: kept, closed, dropped: joined.length - kept.length };
}

export function compare(endpoint: readonly Span[], brute: readonly Span[]) {
  const a = clean(endpoint);
  const b = clean(brute);
  let largest = 0;
  const sameCount = a.spans.length === b.spans.length;
  if (sameCount) {
    a.spans.forEach((span, index) => {
      largest = Math.max(largest, Math.abs(span.from - b.spans[index].from), Math.abs(span.to - b.spans[index].to));
    });
  }
  return {
    pass: sameCount && largest <= TOLERANCE_MS,
    endpointWindows: a.spans.length,
    bruteWindows: b.spans.length,
    largestDifferenceMs: sameCount ? largest : null,
    endpointClosed: a.closed,
    endpointDropped: a.dropped,
    bruteClosed: b.closed,
    bruteDropped: b.dropped,
  };
}

const spansOf = (windows: Array<{ from: string; to: string }>): Span[] => windows.map((window) => ({ from: Date.parse(window.from), to: Date.parse(window.to) }));

const [step, ...args] = process.argv.slice(2);
if (step === 'endpoint') {
  const [seed, answeredText, out] = args;
  const handler = createComputeApiHandler({ localTime: createLocalTimeModule(), env: {}, rateLimit: async () => 'allowed' });
  const random = mulberry32(Number(seed));
  const answered: Array<{ index: number; query: Query; windows: Array<{ from: string; to: string }>; samples: number }> = [];
  const refused: Array<{ index: number; query: Query; limit: string }> = [];
  for (let index = 0; answered.length < Number(answeredText); index += 1) {
    const query = drawQuery(random);
    const response = await run(handler, { endpoint: 'elections', body: query });
    if (response.status === 200) answered.push({ index, query, windows: response.json.result.windows, samples: response.json.receipt.electionSearch.samples });
    else if (response.status === 422 && response.json.error.code === 'budget-exhausted') refused.push({ index, query, limit: response.json.error.limit });
    else throw new Error(`query ${index} answered ${response.status}: ${response.text}`);
  }
  writeFileSync(out, `${JSON.stringify({ seed: Number(seed), answered, refused }, null, 1)}\n`);
  console.log(`endpoint: ${answered.length} answered, ${refused.length} refused for their allowance`);
} else if (step === 'brute') {
  const [endpointPath, shardText, shardsText, out] = args;
  const { answered } = JSON.parse(readFileSync(endpointPath, 'utf8'));
  const results = [];
  for (const [position, entry] of answered.entries()) {
    if (position % Number(shardsText) !== Number(shardText)) continue;
    const started = Date.now();
    const { windows, instants } = bruteForce(entry.query);
    results.push({ index: entry.index, windows: windows.map((span) => ({ from: new Date(span.from).toISOString(), to: new Date(span.to).toISOString() })), instants, seconds: (Date.now() - started) / 1000 });
    console.log(`brute ${entry.index}: ${windows.length} windows, ${instants} instants, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
  writeFileSync(out, `${JSON.stringify(results, null, 1)}\n`);
} else if (step === 'compare') {
  const out = args.pop()!;
  const [endpointPath, ...brutePaths] = args;
  const { seed, answered, refused } = JSON.parse(readFileSync(endpointPath, 'utf8'));
  const brute = new Map(brutePaths.flatMap((path) => JSON.parse(readFileSync(path, 'utf8'))).map((entry: any) => [entry.index, entry]));
  const rows = answered.map((entry: any) => {
    const other = brute.get(entry.index);
    if (!other) throw new Error(`no brute force for query ${entry.index}`);
    return { index: entry.index, conditions: entry.query.conditions.length, ...compare(spansOf(entry.windows), spansOf(other.windows)) };
  });
  const failed = rows.filter((row: any) => !row.pass);
  const summary = {
    seed,
    answered: rows.length,
    refused: refused.length,
    passed: rows.length - failed.length,
    failed: failed.map((row: any) => row.index),
    windowsCompared: rows.reduce((sum: number, row: any) => sum + row.endpointWindows, 0),
    largestDifferenceMs: Math.max(0, ...rows.map((row: any) => row.largestDifferenceMs ?? 0)),
    closedOrDropped: rows.reduce((sum: number, row: any) => sum + row.endpointClosed + row.endpointDropped + row.bruteClosed + row.bruteDropped, 0),
  };
  writeFileSync(out, `${JSON.stringify({ summary, rows }, null, 1)}\n`);
  console.log(JSON.stringify(summary));
} else {
  throw new Error('usage: run.ts endpoint|brute|compare …');
}
