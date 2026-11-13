/**
 * Plain-text tables from a ladder run: one line per (case, rung) and tree,
 * then the events with brackets, then the scores.
 *
 *   node table.mjs --run=DIR > DIR/tables.txt
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const DIR = args.get('run');
const run = JSON.parse(readFileSync(join(DIR, 'run.json'), 'utf8'));
const { ladder } = JSON.parse(readFileSync(join(DIR, 'ladder.json'), 'utf8'));
const DAY = 86400;
const out = [];
const p = (s = '') => out.push(s);
const n = (x) => (typeof x === 'number' ? x.toLocaleString('en-US') : String(x));
const t = (e) => (e.ttDays !== undefined ? e.ttDays * DAY : e.tdbSec);
const br = (e) => (e.ttDays !== undefined ? [e.bracketTtDays[0] * DAY, e.bracketTtDays[1] * DAY] : e.bracketTdbSec);
const iso = (sec) => new Date(Date.UTC(2000, 0, 1, 12) + (sec - 69.184) * 1000).toISOString();

p(`ladder run: ${run.startedAt} to ${run.finishedAt}, node ${run.node} ${run.platform}`);
p(`pack: container ${run.pack.containerDigest.v2}, payload ${run.pack.payloadSha256}, compiler ${run.pack.compiler}`);
p('scored: no (post hoc; the F windows were opened by earlier versions)');
p();
p('case  rung        tree   status            complete  evaluations       cells  events  unresolved  excluded  ms');
for (const row of ladder) {
  for (const [rung, x] of Object.entries(row.rungs)) {
    for (const [v, s] of [['v1', x.v1], ['#860', x.v2]]) {
      if (s.threw) { p(`${row.id.padEnd(5)} ${rung.padEnd(11)} ${v.padEnd(6)} threw ${s.threw.code}: ${s.threw.message}`); continue; }
      p(`${row.id.padEnd(5)} ${rung.padEnd(11)} ${v.padEnd(6)} ${s.status.padEnd(17)} ${String(s.established).padEnd(9)} ${n(s.evaluations).padStart(11)} ${n(s.cells).padStart(11)} ${String(s.events.length).padStart(7)} ${String(s.unresolvedRuns).padStart(11)} ${String(s.excludedRuns).padStart(9)} ${Math.round(s.ms)}`);
    }
    const c = x.comparison;
    p(`      ${''.padEnd(11)} same-event pairs ${c.sameEventPairs ?? '-'} of ${c.v1 ?? '-'} v1 events; lost ${c.lost}; task-definition lost ${x.simpleLost?.lost ?? '-'}; bit-identical pairs ${c.bitIdenticalPairs ?? '-'}; same counts ${x.sameCounts}; both established ${x.bothEstablished}; counts equal where both established ${x.countsEqualWhereBothEstablished}; whole result identical ${x.identity?.wholeResultIdentical}`);
  }
}
p();
p('events with brackets (TDB seconds past J2000; the geometric rung\'s TT days times 86,400)');
for (const row of ladder) {
  for (const [rung, x] of Object.entries(row.rungs)) {
    for (const [v, s] of [['v1', x.v1], ['#860', x.v2]]) {
      if (s.threw) continue;
      for (const [i, e] of s.events.entries()) {
        const [lo, hi] = br(e);
        p(`${row.id.padEnd(5)} ${rung.padEnd(11)} ${v.padEnd(6)} #${String(i).padEnd(3)} ${t(e)}  [${lo}, ${hi}]  width ${(hi - lo).toExponential(3)} s  ${e.direction}  ${e.kind}  ${iso(t(e))}`);
      }
    }
    if (x.comparison.pairDetail) {
      for (const q of x.comparison.pairDetail) {
        if (!q.bitIdentical) p(`${row.id.padEnd(5)} ${rung.padEnd(11)} pair v1 #${q.v1} / #860 #${q.v2}: |dt| ${q.d.toExponential(3)} s, brackets overlap (1e-3 s widened) ${q.overlaps}, reference roots checked ${q.rootsChecked} inside ${q.rootsInside}, same event ${q.sameEvent}`);
      }
    }
  }
}
p();
const s = run.scores;
p(`E-1 (ten-case part): ${s.E1.pass ? 'PASS' : 'FAIL'}; ${s.E1.eventsLost} v1 events lost by section 5; ${s.E1.taskDefinitionLost} by the task's 1e-3 s, same-direction test; threw ${s.E1.threw.length}`);
p(`E-2 (ten-case part): ${s.E2.pass ? 'PASS' : 'FAIL'}; ${s.E2.bothEstablished.length} (case, rung) both established; ${s.E2.unequal.length} with unequal counts ${JSON.stringify(s.E2.unequal)}`);
p(`E-3 (ten-case part), sense 2: ${s.E3.sense2.sameCountResults} same-count results; unamended ${s.E3.sense2.passUnamended ? 'PASS' : 'FAIL'} (${s.E3.sense2.unamendedFailures.length} failures); A-1 ${s.E3.sense2.passAmendedA1 ? 'PASS' : 'FAIL'} (${s.E3.sense2.amendedFailures.length} failures); ${s.E3.sense2.bitIdenticalEventsInSameCountResults} of ${s.E3.sense2.eventsInSameCountResults} events bit-identical`);
p(`E-3 sense 1 (apparent() grid, ten F windows): ${s.E3.sense1.pass ? 'PASS' : 'FAIL'}; ${s.E3.sense1.calls} calls per tree, ${s.E3.sense1.differing} differ, ${s.E3.sense1.threw} threw`);
p(`every body but the Moon, whole result bit-identical: ${s.nonMoonCheck.wholeResultIdentical} of ${s.nonMoonCheck.results}; counts and events identical: ${s.nonMoonCheck.countsAndEventsIdentical} of ${s.nonMoonCheck.results}`);
p();
p('pack effect on version 1 (this pack against the earlier run\'s recorded v1 ladder on 4cc6f85a):');
for (const z of run.packEffectOnV1) {
  if (!z.comparable) { p(`  ${z.id} ${z.rung}: not comparable`); continue; }
  if (z.countsEqual && z.eventsBitIdentical) continue;
  p(`  ${z.id} ${z.rung}: recorded ${JSON.stringify(z.recordedOnPack4cc6f85a)} | here ${JSON.stringify(z.thisPack9856b50f)}; events bit-identical ${z.eventsBitIdentical}; lost by section 5 ${z.sameEventLost}`);
}
p(`  (${run.packEffectOnV1.filter((z) => z.comparable && z.countsEqual && z.eventsBitIdentical).length} of ${run.packEffectOnV1.length} (case, rung) identical in counts and events)`);
p(`#860's own V-4 (corpus-v4.json) reproduced on the deflected rung: v1 ${run.v4Reproduction.filter((z) => z.v1Reproduced).length} of ${run.v4Reproduction.length}, #860 ${run.v4Reproduction.filter((z) => z.v2Reproduced).length} of ${run.v4Reproduction.length}`);
process.stdout.write(`${out.join('\n')}\n`);
