/**
 * How a Trophy Hall entry says its season was won, on the Hall
 * (/games/history/) and in the champion announcement on /race/.
 *
 * Most seasons are won on points: "won by 125 points". A season can also end
 * level at the top. Equal points rank in zodiac order, Aries first
 * (zeroFilledStandings in src/lib/games/server.ts), so the earlier sign takes
 * the title and the entry records a margin of 0. Those seasons say they were
 * level and won on the tiebreak, never "won by 0 points" (Virgo 2026: Aries
 * and Capricorn on 100 each).
 *
 * This sits beside the pages rather than in src/lib because every file under
 * src/lib feeds the Phase 1 screenshot fingerprint
 * (tests/visual/phase1-evidence-contract.mjs), and no Phase 1 page shows it.
 */
import type { SeasonChampionEntry } from '../../lib/games/champions';
import { signBySlug, type Sign } from '../../lib/signs';

const signList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

function points(count: number): string {
  return `${count.toLocaleString('en')} ${count === 1 ? 'point' : 'points'}`;
}

/**
 * The signs that finished level on points with the champion, in final
 * standings order. Empty when the champion won on points.
 */
export function levelWithChampion(entry: SeasonChampionEntry): Sign[] {
  if (entry.marginPoints !== 0) return [];
  const top = entry.finalStandings[0]!.points;
  const level = entry.finalStandings.slice(1)
    .filter((row) => row.points === top)
    .map((row) => row.sign);
  return (level.length > 0 ? level : [entry.runnerUp]).map((slug) => signBySlug(slug));
}

function tieClause(entry: SeasonChampionEntry, level: Sign[]): string {
  const names = signList.format(level.map((sign) => sign.name));
  return `level with ${names} on ${points(entry.finalStandings[0]!.points)}, won on the zodiac-order tiebreak`;
}

/** The result on a Hall line: "won by 125 points", or how a tie was won. */
export function hallResult(entry: SeasonChampionEntry): string {
  const level = levelWithChampion(entry);
  return level.length > 0 ? tieClause(entry, level) : `won by ${points(entry.marginPoints)}`;
}

/** The result sentence in the /race/ champion announcement. */
export function announcementResult(entry: SeasonChampionEntry): string {
  const level = levelWithChampion(entry);
  if (level.length === 0) {
    return `Won by ${points(entry.marginPoints)} over ${signBySlug(entry.runnerUp).name}.`;
  }
  const clause = tieClause(entry, level);
  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`;
}
