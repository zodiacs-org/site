import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasCompleteLiveHoroscopeMonth, parseMonthlyHoroscopeEntry } from './horoscope-freshness-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function formatMonthLabel(month) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 7) !== month) {
    throw new Error(`invalid YYYY-MM month: ${String(month)}`);
  }
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export async function loadMonthlyEntries(horoscopesDir = resolve(root, 'src/content/horoscopes')) {
  const names = (await readdir(horoscopesDir)).filter((name) => name.endsWith('.mdx')).sort();
  return Promise.all(
    names.map(async (name) => {
      const source = await readFile(resolve(horoscopesDir, name), 'utf8');
      return parseMonthlyHoroscopeEntry(source, `src/content/horoscopes/${name}`);
    }),
  );
}

export function decideMonthlyReminder({ month, label, monthlyEntries, listOpenIssues, createIssue, issueBody }) {
  if (hasCompleteLiveHoroscopeMonth(monthlyEntries, month)) {
    return { action: 'skip-complete', message: `All twelve live ${label} entries are already in the tree` };
  }
  const openCount = listOpenIssues(label);
  if (!Number.isInteger(openCount) || openCount < 0) {
    throw new Error(`issue lookup returned an invalid count: ${String(openCount)}`);
  }
  if (openCount > 0) {
    return { action: 'skip-open', message: 'Issue already open' };
  }
  const title = `Write the ${label} horoscopes`;
  const body = issueBody.replaceAll('__MONTH__', month).replaceAll('__LABEL__', label);
  createIssue({ title, body });
  return { action: 'created', message: `Created reminder issue: ${title}` };
}

function runGh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed (${result.status}): ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout.trim();
}

export async function runMonthlyHoroscopeReminder({
  month = process.env.MONTH,
  issueBody = process.env.ISSUE_BODY ?? '',
  horoscopesDir = resolve(root, 'src/content/horoscopes'),
} = {}) {
  const label = formatMonthLabel(month);
  const monthlyEntries = await loadMonthlyEntries(horoscopesDir);
  const outcome = decideMonthlyReminder({
    month,
    label,
    monthlyEntries,
    issueBody,
    listOpenIssues: (monthLabel) => {
      const out = runGh([
        'issue', 'list',
        '--search', `in:title "Write the ${monthLabel} horoscopes"`,
        '--json', 'number',
        '--jq', 'length',
      ]);
      const parsed = Number.parseInt(out, 10);
      if (!/^\d+$/u.test(out) || Number.isNaN(parsed)) {
        throw new Error(`unexpected gh issue list output: ${JSON.stringify(out)}`);
      }
      return parsed;
    },
    createIssue: ({ title, body }) => {
      runGh(['issue', 'create', '--title', title, '--body', body]);
    },
  });
  console.log(outcome.message);
  return outcome;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runMonthlyHoroscopeReminder();
}
