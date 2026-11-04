/**
 * Season-close helpers (Zodiac Games R2.3), plain JS so the close workflow
 * runs them without a bundler. The season id math mirrors
 * src/lib/games/season.ts, which pins it with tests on both sides.
 */

export const ZODIAC_ORDER = Object.freeze([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);

export const SEASON_ID_PATTERN =
  /^(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)-20[0-9]{2}$/;

/**
 * The id of the season that closed immediately before the given one.
 * Seasons follow zodiac order through the calendar year; only the step
 * back from Aquarius crosses into the prior year, because Capricorn's
 * instance is named for the December it starts in.
 */
export function previousSeasonIdOf(seasonId) {
  const match = SEASON_ID_PATTERN.exec(seasonId ?? '');
  if (!match) throw new Error(`Malformed season id: ${seasonId}`);
  const sign = match[1];
  const year = Number(seasonId.slice(sign.length + 1));
  const index = ZODIAC_ORDER.indexOf(sign);
  const previousSign = ZODIAC_ORDER[(index + 11) % 12];
  const previousYear = sign === 'aquarius' ? year - 1 : year;
  return `${previousSign}-${previousYear}`;
}

/** How far back one run may reach for seasons the Hall never received. */
export const CATCH_UP_LIMIT = 12;

/**
 * The season ids the Trophy Hall still owes, oldest first: every season
 * after the newest one it holds, through `newestClosedId`. On a normal
 * morning that is the season that closed overnight. After runs that could
 * not publish it is several (23 Sep to 4 Nov 2026 missed both Virgo and
 * Libra), and the next run that can publish engraves them all, in order.
 * An empty Hall starts with the newest closed season alone; the walk never
 * reaches back more than `limit` seasons.
 */
export function seasonsToEngrave(newestClosedId, engravedIds, limit = CATCH_UP_LIMIT) {
  if (!SEASON_ID_PATTERN.test(newestClosedId ?? '')) {
    throw new Error(`Malformed season id: ${newestClosedId}`);
  }
  const engraved = new Set(engravedIds);
  if (engraved.size === 0) return [newestClosedId];
  const owed = [];
  for (let id = newestClosedId; owed.length < limit && !engraved.has(id); id = previousSeasonIdOf(id)) {
    owed.unshift(id);
  }
  return owed;
}

/**
 * Appends the owed seasons to the Hall record (`{ seasons: [...] }`, oldest
 * first) and returns the entries it added. `archive(seasonId)` resolves to
 * `{ payload }` with that closed season's archived standings, or `{ skip }`
 * when the archive cannot answer. The Hall only appends, so the walk stops
 * at the first season it cannot read rather than engrave a later one past
 * it (that would lock the earlier season out for good); the next run
 * resumes there. An uncounted season crowns nobody and is passed over, and
 * nothing already in the Hall, or older than its newest entry, is written.
 */
export async function engraveSeasons(champions, owed, archive, log = () => {}) {
  const added = [];
  for (const seasonId of owed) {
    if (champions.seasons.some((entry) => entry.seasonId === seasonId)) continue;
    const archived = await archive(seasonId);
    if (archived.skip) {
      log(`stopped at ${seasonId}, ${archived.skip}; the next run resumes here.`);
      break;
    }
    if (archived.payload?.seasonId !== seasonId) {
      throw new Error(`The archive answered ${archived.payload?.seasonId} for ${seasonId}.`);
    }
    const entry = championEntryFrom(archived.payload);
    if (!entry) {
      log(`${seasonId} ended with an empty board, so it is not counted and crowns no champion.`);
      continue;
    }
    const newest = champions.seasons.at(-1);
    if (newest && entry.endedAtUtc <= newest.endedAtUtc) {
      log(`${seasonId} closed before ${newest.seasonId}, the newest Hall entry; the Hall only appends.`);
      continue;
    }
    champions.seasons.push(entry);
    added.push(entry);
    log(`engraved ${entry.champion}, ${entry.seasonName} Season Champion · ${entry.year} (won by ${entry.marginPoints}).`);
  }
  return added;
}

/**
 * Builds the immutable Trophy Hall entry from a CLOSED season's archived
 * standings payload. Returns null for an uncounted season (nobody scored) —
 * an empty board crowns no champion.
 */
export function championEntryFrom(payload) {
  if (!payload || payload.closed !== true) {
    throw new Error('A champion entry requires a closed-season payload.');
  }
  const standings = payload.standings;
  if (!Array.isArray(standings) || standings.length !== 12) {
    throw new Error('A champion entry requires the full 12-sign board.');
  }
  if (standings.every((row) => row.points === 0)) return null;
  return {
    seasonId: payload.seasonId,
    seasonName: payload.seasonName,
    year: Number(payload.seasonId.slice(payload.seasonSign.length + 1)),
    endedAtUtc: payload.seasonEndsAt,
    champion: standings[0].sign,
    runnerUp: standings[1].sign,
    marginPoints: standings[0].points - standings[1].points,
    finalStandings: standings.map(({ sign, points }) => ({ sign, points })),
  };
}
