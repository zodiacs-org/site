/**
 * Trending on X: match the names people are talking about today to the Year
 * Ahead directory (src/data/year-people.json) and draft one post per match for
 * the marketing team. Names the directory does not have are left out of the
 * report unless the run asks for them (--list-unmatched): trending names
 * include private people, minors and victims.
 *
 * Nothing here publishes anything: it never adds a person to the directory and
 * never posts. Drafts are plain text for a human to read, edit and post by hand.
 * Pure: no network, storage or logging (the X fetch lives in the script).
 */
import { YEAR_PEOPLE, personKey, type YearPerson } from './people';
import { rangeWorthShowing } from './range';

/** A post on X fits in 280 characters; a link counts as 23 of them. */
export const X_POST_LIMIT = 280;
const X_LINK_LENGTH = 23;
const MAX_INPUT_NAMES = 200;

/** "#ElonMusk", "@elonmusk" and "Elon Musk" all compare as "elonmusk". */
export function compactKey(text: string): string {
  return personKey(text.replace(/^[#@]/u, '')).replaceAll(' ', '');
}

const BY_COMPACT = new Map<string, YearPerson>();
for (const person of YEAR_PEOPLE) {
  for (const key of [person.name, person.slug, ...person.aliases]) BY_COMPACT.set(compactKey(key), person);
}

/** What a draft reads from a get_year_score answer (src/ai-tools/features/year-score.ts). */
export interface DraftScore {
  status: 'found' | 'not-in-directory';
  score: number | null;
  label: string | null;
  best: { name: string } | null;
  hardest: { name: string } | null;
  drivers: { title: string }[];
  confidenceLabel: string | null;
  /** Without a birth time: the lowest and highest score across the birth day, as the figure's page shows it. */
  scoreRange?: { low: number; high: number } | null;
}

export interface TrendInput { name: string; volume?: number | null }
export interface TrendMatch { trend: string; volume: number | null; person: YearPerson }
export interface TrendReport { matches: TrendMatch[]; unmatched: TrendInput[] }

/** Words that are never a person's name on their own, so a trend made of them is not offered for review. */
const NOT_A_NAME = /^[#@]?(?:\d+|(?:breaking|news|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|good|happy|national|world)\w*)$/iu;

export function matchTrends(trends: readonly TrendInput[]): TrendReport {
  const matches: TrendMatch[] = [];
  const unmatched: TrendInput[] = [];
  const seen = new Set<string>();
  for (const trend of trends.slice(0, MAX_INPUT_NAMES)) {
    const name = trend.name.trim();
    if (!name || name.length > 80) continue;
    const key = compactKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const person = BY_COMPACT.get(key);
    if (person) {
      if (!matches.some((match) => match.person.slug === person.slug)) matches.push({ trend: name, volume: trend.volume ?? null, person });
    } else if (!NOT_A_NAME.test(name)) unmatched.push({ name, volume: trend.volume ?? null });
  }
  return { matches, unmatched };
}

/**
 * What a draft must never carry (Dias, 9 November 2026): a price, stock or
 * crypto call, a buy or sell signal, a diagnosis or medical timing, a death
 * prediction, a legal win or loss, doom, or the en and em dashes the site's
 * copy leaves out. Money, career, wellbeing and legal themes read the
 * traditional way are fine. A draft that trips this is withheld from the
 * report, never softened silently.
 */
export const DRAFT_BANNED = /\b(?:buy|sell|selling|price targets?|stocks?|crypto\w*|bitcoin|btc|tokens?|coins?|diagnos\w*|prognos\w*|surger\w*|surgical|operations?|treatments?|medica\w*|illness\w*|diseases?|cancer|pregnan\w*|recover(?:y|ies)|cure\w*|death|die|dies|dying|doom\w*|disaster|ruin\w*|crash\w*|collapse\w*|catastroph\w*|guarantee\w*)\b|\b(?:will|going to) (?:win|lose)\b|[\u2013\u2014]/iu;


/**
 * The fixed note every draft ends with. A person trends for a reason the draft
 * cannot see (results day, a final, an arrest), so the draft says what it is.
 */
export const DRAFT_NOTE = 'A reading of a public birth date, not of a company, a team or a result.';

/** A draft post for one match, under X's limit with its link counted as 23 characters, or null if it trips the guard. */
export function draftPost(person: YearPerson, data: DraftScore, url: string): string | null {
  // No score, no wording or no confidence label: no draft, rather than one with a gap in it.
  if (data.status !== 'found' || data.score === null || !data.label || !data.confidenceLabel) return null;
  // The same range, in the same words, as the figure's /year/ page shows beside its score.
  const range = data.scoreRange ?? null;
  const between = rangeWorthShowing(range) ? ` (between ${range.low.toFixed(1)} and ${range.high.toFixed(1)} without a birth time)` : '';
  const headline = `${person.name}'s next twelve months on the Zodiacs Year Ahead Score: ${data.score.toFixed(1)}/10${between}, ${data.label.charAt(0).toLowerCase()}${data.label.slice(1)}.`;
  // No month is named, for anyone: next to a person in the news, a best or
  // hardest month reads as a stock call, a sports pick or worse.
  const transit = data.drivers[0] ? `Main transit: ${data.drivers[0].title.replace(' your ', ` ${person.name.split(' ')[0]}'s `)}.` : null;
  const ending = [`${data.confidenceLabel}.`, DRAFT_NOTE];
  const fits = (text: string) => text.length + 1 + X_LINK_LENGTH <= X_POST_LIMIT;
  const full = [headline, ...(transit ? [transit] : []), ...ending].join(' ');
  if (DRAFT_BANNED.test(full)) return null;
  // Too long: the main transit goes first. The confidence label and the note are never dropped.
  const text = fits(full) ? full : [headline, ...ending].join(' ');
  return fits(text) ? `${text}\n${url}` : null;
}

/** What a reviewer must check before posting any draft. Printed under every match. */
export const REVIEW_CHECKLIST = [
  'Before posting, find out why this name is trending.',
  'Do not post if it is a death, an illness or injury, an arrest, charge or trial, an election,',
  'company results or a deal, or a match or contest within seven days.',
] as const;

export interface ReportMatch {
  trend: string;
  volume: number | null;
  slug: string;
  name: string;
  score: number | null;
  label: string | null;
  url: string;
  draft: string | null;
}

export interface ReportInput {
  date: string;
  source: string;
  namesRead: number;
  matches: readonly ReportMatch[];
  unmatched: readonly TrendInput[];
  /** Only with --list-unmatched. Off by default, and the workflow never turns it on. */
  listUnmatched: boolean;
}

/** The Markdown and JSON report for one run. Matches only, unless the run asked for the unmatched names. */
export function buildTrendingReport(input: ReportInput): { markdown: string; json: string } {
  const { date, source, namesRead, matches, unmatched, listUnmatched } = input;
  const lines = [
    `# Trending on X: ${date}`,
    '',
    `Source: ${source}. ${namesRead} names read, ${matches.length} in the Year Ahead directory${listUnmatched ? `, ${unmatched.length} not in it` : ''}.`,
    '',
    'Nothing here has been posted or published. Drafts are for the marketing team to read, edit and post by hand. Check each draft before posting: no price or trading calls, no diagnoses, no death predictions, no legal outcomes.',
    '',
    'Each draft links to the figure\'s /year/ page, which is live only once PUBLIC_YEAR_PEOPLE_ENABLED is on. Open the link before posting.',
    '',
    '## Matches and draft posts',
    '',
    ...(matches.length ? matches.flatMap((match) => [
      `### ${match.name} (trend: ${match.trend}${match.volume ? `, ${match.volume} posts` : ''})`,
      '',
      match.draft ? ['```text', match.draft, '```'].join('\n') : '_No draft: the score could not be worded within the rules or the length. Write one by hand or skip._',
      '',
      ...REVIEW_CHECKLIST.map((line) => `> ${line}`),
      '',
    ]) : ['None today.', '']),
    ...(listUnmatched ? [
      '## Not in the directory (for human review)',
      '',
      'Add a person only after checking: an adult public figure known for their work, a public birth date with a cited source, and no dispute between sources. Never a minor.',
      '',
      ...(unmatched.length ? unmatched.map((row) => `- ${row.name}${row.volume ? ` (${row.volume} posts)` : ''}`) : ['None.']),
      '',
    ] : []),
  ];
  const json = {
    schema: 'zodiacs.trending-x.v1',
    date,
    source,
    matches: matches.map((match) => ({ ...match, matchedTrend: match.trend, reviewRequired: true as const })),
    ...(listUnmatched ? { unmatched } : {}),
    posted: false,
  };
  return { markdown: lines.join('\n'), json: `${JSON.stringify(json, null, 2)}\n` };
}
