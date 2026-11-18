/**
 * Write the one-time Phase 1 scope allowance a publication pull request needs
 * when its only protected changes are the twelve generated sign pages.
 *
 * The daily package (and the other publishers that run build-sign-pages.mjs)
 * regenerate public/registry/<sign>/index.html, which the protected-scope
 * guard freezes. A publication used to reach main by a direct push, where no
 * guard ran; now it must pass Build & Check on a pull request, so it carries
 * the same base-pinned, exact allowance a hand-carried edition carries, and
 * that sitemap-daily-allowance.mjs already accepts beside a daily package.
 *
 * Fails closed: if any other protected path changed, it writes nothing and the
 * guard stops the pull request for a person, exactly as before.
 *
 * Usage: node scripts/write-sign-page-allowance.mjs <base-commit> [<head>]
 * Prints "written" when it wrote the file, "none" when nothing was needed and
 * "refused" when other protected paths changed.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { oneTimeAllowancePath, parseNameStatus, protectedPathLabels, resolveOneTimeAllowance } from './phase1-scope-guard.mjs';

export const signPage = /^public\/registry\/(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\/index\.html$/u;

/** The allowance for `changed`, or null when none is needed, or false when refused. */
export function signPageAllowance({ baseCommit, changed, id }) {
  const protectedChanged = [...new Set(changed.filter((path) => protectedPathLabels(path).length > 0))].sort();
  if (protectedChanged.length === 0) return null;
  if (protectedChanged.some((path) => !signPage.test(path))) return false;
  return { version: 1, id, baseCommit, protectedPaths: protectedChanged };
}

function main() {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) throw new Error('usage: write-sign-page-allowance.mjs <base-commit> [<head>]');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const baseCommit = git('rev-parse', '--verify', `${base}^{commit}`).trim();
  const changed = parseNameStatus(git('diff', '--name-status', '-z', '--no-renames', baseCommit, head))
    .filter((path) => path !== oneTimeAllowancePath);
  const id = `generated-sign-pages-${baseCommit.slice(0, 12)}`;
  const allowance = signPageAllowance({ baseCommit, changed, id });
  if (allowance === null) return console.log('none');
  if (allowance === false) return console.log('refused');
  // Prove the guard will accept it before writing anything.
  resolveOneTimeAllowance({ allowance, baseCommit, changed: [...changed, oneTimeAllowancePath] });
  writeFileSync(oneTimeAllowancePath, `${JSON.stringify(allowance, null, 2)}\n`);
  console.log('written');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
