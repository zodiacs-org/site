/** Validate the sole non-rendering file permitted beside a daily package.
 * The workflow still rejects every other path, deletion and rewritten research item.
 * This reuses, rather than relaxes, the protected-scope guard's exact-base rules.
 */
import { execFileSync } from 'node:child_process';
import { oneTimeAllowancePath, parseNameStatus, resolveOneTimeAllowance } from './phase1-scope-guard.mjs';

const [base, head] = process.argv.slice(2);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const baseCommit = git('rev-parse', '--verify', `${base}^{commit}`).trim();
const headCommit = git('rev-parse', '--verify', `${head}^{commit}`).trim();
const status = git('diff', '--name-status', '--no-renames', baseCommit, headCommit, '--', oneTimeAllowancePath).trim();
if (!['A', 'M'].includes(status.split('\t')[0])) {
  throw new Error('The daily scope allowance must be added or modified, never deleted.');
}
const changed = parseNameStatus(git('diff', '--name-status', '-z', '--no-renames', baseCommit, headCommit));
const allowance = JSON.parse(git('show', `${headCommit}:${oneTimeAllowancePath}`));
const allowed = resolveOneTimeAllowance({ allowance, baseCommit, changed });
const signPage = /^public\/registry\/(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\/index\.html$/u;
if (!allowed.size || [...allowed].some((path) => !signPage.test(path))) {
  throw new Error('A daily scope allowance may cover only the changed generated sign pages.');
}
console.log(`Validated the daily scope allowance for ${allowed.size} generated sign page(s).`);
