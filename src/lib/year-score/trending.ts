/**
 * Trending on X: match the names people are talking about today to the Year
 * Ahead directory (src/data/year-people.json), list the names it does not have
 * for a person to review, and draft one post per match for the marketing team.
 *
 * Nothing here publishes anything: it never adds a person to the directory and
 * never posts. Drafts are plain text for a human to read, edit and post by hand.
 * Pure: no network, storage or logging (the X fetch lives in the script).
 */
import { YEAR_PEOPLE, personKey, type YearPerson } from './people';

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
export const DRAFT_BANNED = /\b(?:buy|sell|selling|price targets?|stocks?|crypto\w*|bitcoin|btc|tokens?|coins?|diagnos\w*|prognos\w*|death|die|dies|dying|doom\w*|disaster|ruin\w*|crash\w*|collapse\w*|catastroph\w*|guarantee\w*)\b|\b(?:will|going to) (?:win|lose)\b|[\u2013\u2014]/iu;


/** A draft post for one match, under X's limit with its link counted as 23 characters, or null if it trips the guard. */
export function draftPost(person: YearPerson, data: DraftScore, url: string): string | null {
  if (data.status !== 'found' || data.score === null || !data.label) return null;
  const lines = [
    `${person.name}'s next twelve months on the Zodiacs Year Ahead Score: ${data.score.toFixed(1)}/10, ${data.label.charAt(0).toLowerCase()}${data.label.slice(1)}.`,
  ];
  if (data.best) lines.push(`Strongest month: ${data.best.name}.`);
  if (data.hardest) lines.push(`Most pressure: ${data.hardest.name}.`);
  if (data.drivers[0]) lines.push(`Main transit: ${data.drivers[0].title.replace(' your ', ` ${person.name.split(' ')[0]}'s `)}.`);
  lines.push(`${data.confidenceLabel}.`);
  let text = lines.join(' ');
  if (DRAFT_BANNED.test(text)) return null;
  // Drop the optional lines from the end of the middle until it fits.
  while (text.length + 1 + X_LINK_LENGTH > X_POST_LIMIT && lines.length > 2) {
    lines.splice(lines.length - 2, 1);
    text = lines.join(' ');
  }
  if (text.length + 1 + X_LINK_LENGTH > X_POST_LIMIT) return null;
  return `${text}\n${url}`;
}
