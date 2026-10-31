/**
 * Does the driver report what #860's UNMODIFIED harness reports?
 *
 * The unmodified harness rebuilds its cases from --epoch. On this pack the
 * targets it computes equal the recorded ones on all ten main cases of
 * both holdouts (checked before the run), so with --epoch set to each
 * holdout's accepted start it builds the same twenty cases the driver took
 * from the record. This compares the two outputs field by field, for every
 * field the unmodified harness writes, and the verdict.
 *
 *   node compare-unmodified.mjs --driver=holdout-1912-run.json --unmodified=unmodified-harness-1912.json --out=...
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = new Map();
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); args.set(k.replace(/^--/, ''), v ?? true); }
const D = JSON.parse(readFileSync(args.get('driver'), 'utf8'));
const U = JSON.parse(readFileSync(args.get('unmodified'), 'utf8'));
const SKIP = new Set(['ms', 'withinWallClock', 'partitionMs', 'warmMs', 'baselineMs', 'label']);
const diffs = [];
function walk(a, b, path) {
  const last = path[path.length - 1];
  if (SKIP.has(last)) return;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (!Object.is(a, b)) diffs.push({ path: path.join('.'), driver: a, unmodified: b });
    return;
  }
  // only the fields the unmodified harness writes
  for (const k of Object.keys(b)) walk(a[k], b[k], [...path, k]);
}
const caseIds = U.cases.map((c) => c.id);
const sameCaseIds = JSON.stringify(caseIds) === JSON.stringify(D.cases.map((c) => c.id));
for (let i = 0; i < U.cases.length; i += 1) {
  const u = U.cases[i];
  const d = D.cases.find((c) => c.id === u.id);
  walk(d, u, ['cases', u.id]);
}
for (let i = 0; i < U.repeated.length; i += 1) walk(D.repeated[i], U.repeated[i], ['repeated', U.repeated[i].id]);
walk(D.targets, U.targets, ['targets']);
walk(D.verdict, U.verdict, ['verdict']);
const result = {
  driver: args.get('driver'),
  unmodified: args.get('unmodified'),
  unmodifiedEpoch: U.epoch,
  driverEpoch: D.epoch,
  sameCaseIds,
  ignoredFields: [...SKIP],
  differences: diffs,
  identical: sameCaseIds && diffs.length === 0,
  unmodifiedVerdict: U.verdict.summary,
  driverVerdict: D.verdict.summary,
};
writeFileSync(args.get('out'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${args.get('unmodified')}: same case ids ${sameCaseIds}; ${diffs.length} differing fields (wall times and the label ignored); verdicts: driver "${D.verdict.summary}", unmodified "${U.verdict.summary}"\n`);
for (const x of diffs.slice(0, 20)) process.stdout.write(`  ${x.path}: driver ${JSON.stringify(x.driver)} vs unmodified ${JSON.stringify(x.unmodified)}\n`);
