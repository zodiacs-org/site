/**
 * Trending on X, the daily job: take today's trending names, match them to
 * the Year Ahead directory, and write a report for people to review.
 *
 * - Matches get a Year Ahead Score from get_year_score's own code and one
 *   draft post each, for the marketing team to read, edit and post by hand.
 * - Names the directory does not have are listed for a person to review.
 *   Nothing is added to the directory automatically.
 * - Nothing is posted. This script has no code that posts.
 *
 * Input, in this order: --names <file> (one name per line, # for comments),
 * --names-list "<a>,<b>", or --x-trends, which reads X's trends for a place
 * (GET https://api.x.com/2/trends/by/woeid/{id}, default 1 = worldwide)
 * with the bearer token in X_BEARER_TOKEN. The token is read from the
 * environment, sent only to api.x.com and never printed.
 *
 *   npx vite-node --script scripts/trending-x.ts -- --names-list "Elon Musk,#JensenHuang" --out trending-report
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLocalTimeModule } from '../api/_compute/local-time.mjs';
import { getYearScore } from '../src/ai-tools/features/year-score';
import { draftPost, matchTrends, type TrendInput } from '../src/lib/year-score/trending';
import { yearPageStart, yearPersonPath } from '../src/lib/year-score/people';

const ORIGIN = 'https://zodiacs.org';
const args = process.argv.slice(2);
const flag = (name: string) => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };

async function xTrends(woeid: string): Promise<TrendInput[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error('--x-trends needs X_BEARER_TOKEN in the environment.');
  if (!/^\d{1,10}$/u.test(woeid)) throw new Error('--woeid must be a number.');
  const response = await fetch(`https://api.x.com/2/trends/by/woeid/${woeid}?max_trends=50`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`X trends request failed with HTTP ${response.status}.`);
  const body = await response.json() as { data?: { trend_name?: unknown; tweet_count?: unknown }[] };
  return (body.data ?? []).filter((row) => typeof row.trend_name === 'string')
    .map((row) => ({ name: row.trend_name as string, volume: typeof row.tweet_count === 'number' ? row.tweet_count : null }));
}

async function input(): Promise<{ source: string; trends: TrendInput[] }> {
  const file = flag('--names');
  if (file) return { source: `list file ${file}`, trends: readFileSync(file, 'utf8').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((name) => ({ name })) };
  const list = flag('--names-list');
  if (list !== undefined) return { source: 'names given to the run', trends: list.split(',').map((name) => ({ name: name.trim() })).filter((row) => row.name) };
  if (args.includes('--x-trends')) { const woeid = flag('--woeid') ?? '1'; return { source: `X trends, WOEID ${woeid}`, trends: await xTrends(woeid) }; }
  throw new Error('Give --names <file>, --names-list "<a>,<b>" or --x-trends.');
}

const { source, trends } = await input();
const now = new Date();
const today = now.toISOString().slice(0, 10);
const out = flag('--out') ?? 'trending-report';
const report = matchTrends(trends);
const clock = createLocalTimeModule();
const matches = [];
for (const match of report.matches) {
  // Scored from the same day as the figure's page, so the draft's number is the one the link shows.
  const { data } = await getYearScore({ person: match.person.slug, from: yearPageStart(now) }, now, clock, ORIGIN);
  const url = `${ORIGIN}${yearPersonPath(match.person.slug)}`;
  matches.push({ trend: match.trend, volume: match.volume, slug: match.person.slug, name: match.person.name, score: data.score, label: data.label, url, draft: draftPost(match.person, data, url) });
}
clock.dispose();

const lines = [
  `# Trending on X: ${today}`,
  '',
  `Source: ${source}. ${trends.length} names read, ${matches.length} in the Year Ahead directory, ${report.unmatched.length} not in it.`,
  '',
  'Nothing here has been posted or published. Drafts are for the marketing team to read, edit and post by hand. Check each draft before posting: no price or trading calls, no diagnoses, no death predictions, no legal outcomes.',
  '',
  '## Matches and draft posts',
  '',
  ...(matches.length ? matches.flatMap((match) => [
    `### ${match.name} (trend: ${match.trend}${match.volume ? `, ${match.volume} posts` : ''})`,
    '',
    match.draft ? ['```text', match.draft, '```'].join('\n') : '_No draft: the score could not be worded within the rules or the length. Write one by hand or skip._',
    '',
  ]) : ['None today.', '']),
  '## Not in the directory (for human review)',
  '',
  'Add a person only after checking: an adult public figure known for their work, a public birth date with a cited source, and no dispute between sources. Never a minor.',
  '',
  ...(report.unmatched.length ? report.unmatched.map((row) => `- ${row.name}${row.volume ? ` (${row.volume} posts)` : ''}`) : ['None.']),
  '',
];
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `trending-${today}.md`), lines.join('\n'));
writeFileSync(join(out, `trending-${today}.json`), `${JSON.stringify({ schema: 'zodiacs.trending-x.v1', date: today, source, matches, unmatched: report.unmatched, posted: false }, null, 2)}\n`);
console.log(`Wrote ${join(out, `trending-${today}.md`)}: ${matches.length} matches, ${report.unmatched.length} for review. Nothing was posted.`);
