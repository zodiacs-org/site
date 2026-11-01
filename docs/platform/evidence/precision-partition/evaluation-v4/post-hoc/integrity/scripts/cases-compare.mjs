// Compare the case definitions of the earlier holdouts with the cases #860's
// unmodified harness rebuilt from --epoch (post hoc check of the holdouts report).
import fs from 'node:fs';
const [,, bundleRun, unmodRun] = process.argv;
const b = JSON.parse(fs.readFileSync(bundleRun, 'utf8'));
const u = JSON.parse(fs.readFileSync(unmodRun, 'utf8'));
const byId = new Map(u.cases.map(c => [c.id, c]));
let same = 0, diff = [];
for (const c of b.cases) {
  const x = byId.get(c.id);
  if (!x) { diff.push([c.id, 'missing']); continue; }
  const ok = x.body === c.body && x.from === c.fromIso && x.to === c.toIso && x.targetDeg === c.targetDeg;
  if (ok) same++; else diff.push([c.id, c.body, c.fromIso, c.toIso, c.targetDeg, '|', x.body, x.from, x.to, x.targetDeg]);
}
console.log(JSON.stringify({ bundleCases: b.cases.length, unmodCases: u.cases.length, same, diff }));
