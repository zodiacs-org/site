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
import { YEAR_PEOPLE, figureDriverTitle, personKey, yearPersonPath, type YearPerson } from './people';
import { rangeWorthShowing } from './range';
import { SCORE_ASPECTS, SCORE_POINTS, SLOW_PLANETS } from './core';
import { driverTitle } from './reading';
import { scoreTier } from './tier';

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
  /** get_year_score gives a figure's titles with their name in place of "your", and each driver's planet, aspect and point. */
  drivers: { title: string; planet?: string; aspect?: string; point?: string }[];
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

/** A score, or either end of its range, as the figure's page prints it: a number from 0 to 10. */
const isScore = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 10;

/**
 * What a draft may be built from (Dias, 9 November 2026; allowlist decision,
 * 20 November 2026): official wording only, so nothing a draft says can read
 * as a price, stock or crypto call, a buy or sell signal, a diagnosis or
 * medical timing, a death prediction, a legal win or loss, doom, a date or a
 * dash. The label must be one of the five tier labels (./tier.ts), the name a
 * figure in the Year Ahead directory, the main transit one of the transit
 * titles the reading gives (driverTitle in ./reading.ts) and the confidence
 * label "Reading confidence NN%". The link is part of the allowlist too: the
 * figure's own /year/ page on zodiacs.org and nothing else. Anything else
 * withholds the draft: it is never softened or rewritten.
 */
export const OFFICIAL_TIER_LABELS: ReadonlySet<string> = new Set([8, 6.5, 3.5, 2, 0].map((value) => scoreTier(value).label));
/** The directory's own record for each official name. A draft is built from this record, never from the caller's copy of it. */
const OFFICIAL_FIGURES: ReadonlyMap<string, YearPerson> = new Map(YEAR_PEOPLE.map((person) => [person.name, person]));
export const OFFICIAL_FIGURE_NAMES: ReadonlySet<string> = new Set(OFFICIAL_FIGURES.keys());
/** Each official transit title, with the planet, aspect and point it names. */
const OFFICIAL_TRANSITS: ReadonlyMap<string, { planet: string; aspect: string; point: string }> = new Map(
  SLOW_PLANETS.flatMap((planet) => SCORE_ASPECTS.flatMap((aspect) => SCORE_POINTS.map((point) => [driverTitle({ planet, aspect, point }), { planet, aspect, point }] as const))),
);
export const OFFICIAL_TRANSIT_TITLES: ReadonlySet<string> = new Set(OFFICIAL_TRANSITS.keys());
/**
 * The same titles as get_year_score words them for each directory figure
 * (figureDriverTitle: "Uranus trine Jensen Huang's Mercury"), each mapped back
 * to its official title. Only that figure's own full name is accepted.
 */
const FIGURE_TRANSIT_TITLES: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(
  [...OFFICIAL_FIGURE_NAMES].map((name) => [name, new Map([...OFFICIAL_TRANSIT_TITLES].map((title) => [figureDriverTitle(title, name), title]))]),
);

/**
 * The official title of a main transit, or null: the title exactly, or the
 * figure's own wording of it from get_year_score. Where the driver carries its
 * planet, aspect and point, they must be the ones that title names.
 */
export function officialTransitTitle(person: YearPerson, driver: DraftScore['drivers'][number]): string | null {
  const title = OFFICIAL_TRANSITS.has(driver.title) ? driver.title : FIGURE_TRANSIT_TITLES.get(person.name)?.get(driver.title) ?? null;
  if (title === null) return null;
  const named = OFFICIAL_TRANSITS.get(title)!;
  const fields = [driver.planet, driver.aspect, driver.point];
  if (fields.every((field) => field === undefined)) return title;
  return driver.planet === named.planet && driver.aspect === named.aspect && driver.point === named.point ? title : null;
}
const OFFICIAL_CONFIDENCE_LABEL = /^Reading confidence (?:100|[1-9]?\d)%$/u;

/**
 * The fixed note every draft ends with. A person trends for a reason the draft
 * cannot see (results day, a final, an arrest), so the draft says what it is.
 */
export const DRAFT_NOTE = 'A reading of a public birth date, not of a company, a team or a result.';

/** The one site a draft links to. */
export const DRAFT_ORIGIN = 'https://zodiacs.org';
/** The only link a figure's draft may carry: their own /year/ page. */
export const draftLink = (person: Pick<YearPerson, 'slug'>): string => `${DRAFT_ORIGIN}${yearPersonPath(person.slug)}`;

/**
 * A draft post for one match, under X's limit with its link counted as 23
 * characters, or null unless every word it carries is official wording and
 * its link is exactly the figure's own /year/ page on zodiacs.org. The draft
 * is built from the directory's own record for the figure, never from the
 * caller's copy.
 */
export function draftPost(person: YearPerson, data: DraftScore, url: string): string | null {
  // No score, no wording or no confidence label: no draft, rather than one with a gap in it.
  if (data.status !== 'found' || data.score === null || !data.label || !data.confidenceLabel) return null;
  // Official wording only: anything else withholds the draft.
  // The directory's own record, matched on name and slug together. The link must be that figure's own page, to the character.
  const figure = OFFICIAL_FIGURES.get(person.name);
  if (!figure || figure.slug !== person.slug || url !== draftLink(figure)) return null;
  if (!isScore(data.score) || !OFFICIAL_TIER_LABELS.has(data.label)) return null;
  if (!OFFICIAL_CONFIDENCE_LABEL.test(data.confidenceLabel)) return null;
  const main = data.drivers[0];
  const mainTitle = main ? officialTransitTitle(figure, main) : null;
  if (main && mainTitle === null) return null;
  // The same range, in the same words, as the figure's /year/ page shows beside its score.
  const range = data.scoreRange ?? null;
  if (range && (!isScore(range.low) || !isScore(range.high) || range.low > range.high)) return null;
  const between = rangeWorthShowing(range) ? ` (between ${range.low.toFixed(1)} and ${range.high.toFixed(1)} without a birth time)` : '';
  const headline = `${figure.name}'s next twelve months on the Zodiacs Year Ahead Score: ${data.score.toFixed(1)}/10${between}, ${data.label.charAt(0).toLowerCase()}${data.label.slice(1)}.`;
  // No month is named, for anyone: next to a person in the news, a best or
  // hardest month reads as a stock call, a sports pick or worse.
  // Always printed from the official title, whichever wording the caller gave.
  const transit = mainTitle ? `Main transit: ${mainTitle.replace(' your ', ` ${figure.name.split(' ')[0]}'s `)}.` : null;
  const ending = [`${data.confidenceLabel}.`, DRAFT_NOTE];
  const fits = (text: string) => text.length + 1 + X_LINK_LENGTH <= X_POST_LIMIT;
  const full = [headline, ...(transit ? [transit] : []), ...ending].join(' ');
  // Too long: the main transit goes first. The confidence label and the note are never dropped.
  const text = fits(full) ? full : [headline, ...ending].join(' ');
  return fits(text) ? `${text}\n${draftLink(figure)}` : null;
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
