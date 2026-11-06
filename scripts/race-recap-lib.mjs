/**
 * State of the Race — weekly recap renderer (Zodiac Games R2.2).
 *
 * Pure functions: live standings in, platform drafts out. The section
 * labels and skeleton come verbatim from the approved pack (ZODIAC-GAMES.md
 * Part 2 §H); the twelve sign lines are §F. Drafts carry standings facts
 * only — never a price, balance, address, or market word — and NOTHING here
 * posts anywhere. The caller writes drafts for a person to review.
 *
 * §H has no wording for signs level on points. The level lines (levelSentence
 * and the "level at the top" subject) are new copy, kept in this file.
 */

export const SIGN_NAMES = Object.freeze({
  aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer',
  leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio',
  sagittarius: 'Sagittarius', capricorn: 'Capricorn',
  aquarius: 'Aquarius', pisces: 'Pisces',
});

/** §F — plain, warm, astrology-culture humor. Verbatim. */
export const SIGN_LINES = Object.freeze({
  aries: 'First in the zodiac. Hates being second anywhere.',
  taurus: 'Slow to start. Immovable once ahead.',
  gemini: 'One team, despite the twins.',
  cancer: 'Home-team energy, wherever it plays.',
  leo: 'Expects the trophy. Always has.',
  virgo: 'Read the scoring rules. All of them. Twice.',
  libra: 'Wants a fair race. Then wants to win it.',
  scorpio: 'Says nothing. Climbs anyway.',
  sagittarius: 'Aims high. Occasionally at the wrong target.',
  capricorn: 'Checks in, says nothing, goes back to work.',
  aquarius: 'Joins late. Rewrites the strategy.',
  pisces: 'Dreams big. Sometimes remembers to check in.',
});

const RACE_URL = 'zodiacs.org/race';
const OPEN_BOARD_LINE =
  'The board is open. Points come from people — the first joins set the order.';

function assertStandingsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('A standings payload is required.');
  }
  const { seasonId, seasonName, seasonSign, daysLeft, isoYear, isoWeek, standings } = payload;
  if (typeof seasonId !== 'string' || !/^[a-z]+-20\d{2}$/.test(seasonId)) {
    throw new TypeError('seasonId must be a season instance id.');
  }
  if (typeof seasonName !== 'string' || !seasonName) {
    throw new TypeError('seasonName is required.');
  }
  if (!Object.hasOwn(SIGN_NAMES, seasonSign)) {
    throw new TypeError('seasonSign must be a canonical slug.');
  }
  if (!Number.isInteger(daysLeft) || daysLeft < 0 || daysLeft > 40) {
    throw new TypeError('daysLeft must be a small integer.');
  }
  if (!Number.isInteger(isoYear) || !Number.isInteger(isoWeek)
    || isoWeek < 1 || isoWeek > 53) {
    throw new TypeError('isoYear/isoWeek must be an ISO week stamp.');
  }
  if (!Array.isArray(standings) || standings.length !== 12) {
    throw new TypeError('standings must carry all twelve signs.');
  }
  for (const row of standings) {
    if (!Object.hasOwn(SIGN_NAMES, row?.sign)
      || !Number.isFinite(row?.points) || row.points < 0) {
      throw new TypeError('every standings row needs a known sign and points.');
    }
  }
}

function name(slug) {
  return SIGN_NAMES[slug];
}

function points(value) {
  return `${value.toLocaleString('en')} ${value === 1 ? 'point' : 'points'}`;
}

function dayWord(daysLeft) {
  return daysLeft === 1 ? 'day' : 'days';
}

const signList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/**
 * The rows on the same points as `sign`, in standings order. Equal points
 * rank in zodiac order (zeroFilledStandings in src/lib/games/server.ts), so
 * the order inside the group is only the tiebreak.
 */
export function levelWith(standings, sign) {
  const row = standings.find((entry) => entry.sign === sign);
  return row ? standings.filter((entry) => entry.points === row.points) : [];
}

/** "Aries and Capricorn are level on 100 points." for two or more rows. */
function levelSentence(level) {
  const who = level.length === Object.keys(SIGN_NAMES).length
    ? 'All twelve signs'
    : signList.format(level.map((row) => name(row.sign)));
  return `${who} are level on ${points(level[0].points)}.`;
}

/**
 * Adjacent pair with the smallest gap where both signs have scored — a
 * rivalry needs two teams on the board. Null while fewer than two score.
 *
 * A level pair counts. A gap of 0 is the closest a rivalry gets, and
 * skipping it would name a wider pair as the closest. The drafts word it as
 * level (levelSentence), never as "0 points behind".
 */
export function closestRivalry(standings) {
  let best = null;
  for (let index = 0; index + 1 < standings.length; index += 1) {
    const ahead = standings[index];
    const behind = standings[index + 1];
    if (behind.points === 0) break;
    const gap = ahead.points - behind.points;
    if (!best || gap < best.gap) best = { ahead: ahead.sign, behind: behind.sign, gap };
  }
  return best;
}

/**
 * Biggest rank climb against the previous same-season snapshot. Ties go to
 * the sign now ranked higher. Null without a comparable snapshot or when
 * nobody climbed.
 */
export function biggestMover(standings, previous) {
  if (!previous || !Array.isArray(previous.standings)) return null;
  const before = new Map(previous.standings.map((row, index) => [row.sign, index]));
  let best = null;
  standings.forEach((row, index) => {
    const was = before.get(row.sign);
    if (typeof was !== 'number') return;
    const climbed = was - index;
    if (climbed > 0 && (!best || climbed > best.climbed)) {
      best = { sign: row.sign, climbed, rank: index + 1 };
    }
  });
  return best;
}

/**
 * The sign leading alone on points, or null when nobody leads: an empty
 * board, or one level at the top, where the first sign is first only on the
 * tiebreak.
 */
function soleLeader(standings) {
  const [first, second] = standings;
  if (!first || first.points === 0 || second?.points === first.points) return null;
  return first.sign;
}

/**
 * §H subject: "Week [N]: [Leader] holds on / [Mover] makes a move". With the
 * top level on points nobody leads, so nobody holds on or takes the lead.
 * previousLeader is last week's sole leader, null when nobody led then (an
 * empty board or a level top), and undefined without a comparable week.
 */
export function recapSubject({ isoWeek, leader, previousLeader, mover, levelTop = false }) {
  if (levelTop) {
    return `Week ${isoWeek}: level at the top`;
  }
  if (previousLeader !== undefined && leader !== previousLeader) {
    return `Week ${isoWeek}: ${name(leader)} takes the lead`;
  }
  if (mover && mover.climbed >= 2) {
    return `Week ${isoWeek}: ${name(mover.sign)} makes a move`;
  }
  return `Week ${isoWeek}: ${name(leader)} holds on`;
}

/** One §F line, rotated deterministically by week so every sign gets turns. */
export function oneMoreThing(isoWeek, leaderSlug) {
  const order = Object.keys(SIGN_NAMES);
  const slug = order[(isoWeek + order.indexOf(leaderSlug)) % order.length];
  return `${name(slug)} — ${SIGN_LINES[slug]}`;
}

/**
 * Renders every platform draft from one standings payload plus the previous
 * week's snapshot (optional). Deterministic: same inputs, same drafts.
 */
export function buildRecap(payload, previous = null) {
  assertStandingsPayload(payload);
  const { seasonId, seasonName, daysLeft, isoYear, isoWeek, standings } = payload;
  const comparable = previous
    && previous.seasonId === seasonId
    && !(previous.isoYear === isoYear && previous.isoWeek === isoWeek)
    ? previous
    : null;

  const leader = standings[0];
  const open = standings.every((row) => row.points === 0);
  const topLevel = open ? [] : levelWith(standings, leader.sign);
  const levelTop = topLevel.length > 1;
  const rivalry = closestRivalry(standings);
  const rivalryLevel = rivalry?.gap === 0 ? levelWith(standings, rivalry.ahead) : null;
  const mover = biggestMover(standings, comparable);
  const subject = open
    ? `Week ${isoWeek}: the board is open`
    : recapSubject({
      isoWeek,
      leader: leader.sign,
      previousLeader: Array.isArray(comparable?.standings)
        ? soleLeader(comparable.standings)
        : undefined,
      mover,
      levelTop,
    });

  // Top three, but never padded with unscored signs on a young board.
  const scored = standings.slice(0, 3).filter((row) => row.points > 0);
  const topThree = scored
    .map((row, index) => `${index + 1}. ${name(row.sign)} — ${points(row.points)}`);
  const waiting = scored.length < 3 ? ' The rest of the board is waiting.' : '';
  const standingsLine = open ? OPEN_BOARD_LINE : `${topThree.join(' · ')}.${waiting}`;
  const rivalryLine = rivalryLevel
    ? levelSentence(rivalryLevel)
    : rivalry
      ? `${name(rivalry.behind)} is ${points(rivalry.gap)} behind ${name(rivalry.ahead)}.`
      : 'No rivalry yet — the first joins will start one.';
  const moverLine = mover
    ? `${name(mover.sign)} climbed ${mover.climbed} ${mover.climbed === 1 ? 'place' : 'places'} to ${mover.rank}${['st', 'nd', 'rd'][mover.rank - 1] ?? 'th'}.`
    : comparable
      ? 'No movers this week — everyone held their place.'
      : 'First stamp of the season — no movers yet.';
  const trophyLine = `${daysLeft} ${dayWord(daysLeft)} until ${seasonName} Season closes.`;
  const extraLine = oneMoreThing(isoWeek, leader.sign);

  // §H skeleton, labels verbatim.
  const site = [
    `# State of the Race — Week ${isoWeek}`,
    '',
    `**Standings.** ${standingsLine}`,
    `**Closest rivalry.** ${rivalryLine}`,
    `**Biggest mover.** ${moverLine}`,
    `**The trophy.** ${trophyLine}`,
    `**One more thing.** ${extraLine}`,
    '',
    `Standings: ${RACE_URL}`,
  ].join('\n');

  const email = {
    subject,
    text: [
      `State of the Race — Week ${isoWeek}`,
      '',
      `Standings. ${standingsLine}`,
      `Closest rivalry. ${rivalryLine}`,
      `Biggest mover. ${moverLine}`,
      `The trophy. ${trophyLine}`,
      `One more thing. ${extraLine}`,
      '',
      `Standings: ${RACE_URL} · Share your sign’s card from the Race page`,
      'Unsubscribe: one tap, no questions — {{unsubscribe_url}}',
    ].join('\n'),
  };

  const shortLead = open
    ? OPEN_BOARD_LINE
    : levelTop
      ? levelSentence(topLevel)
      : `${name(leader.sign)} leads with ${points(leader.points)}.`;
  // A level top is the closest rivalry too, and the lead already says it.
  const shortRivalry = !rivalry || (levelTop && rivalry.ahead === leader.sign)
    ? ''
    : rivalryLevel
      ? ` ${levelSentence(rivalryLevel)}`
      : ` ${name(rivalry.behind)} is ${rivalry.gap.toLocaleString('en')} behind.`;
  const x = [
    `Week ${isoWeek} · The Zodiac Games`,
    `${shortLead}${shortRivalry}`,
    trophyLine,
    RACE_URL,
  ].join('\n');

  const caption = [
    `State of the Race — Week ${isoWeek}.`,
    shortLead + shortRivalry,
    trophyLine,
    `It’s free. It stays free. ${RACE_URL}`,
  ].join('\n');

  const telegram = [
    `State of the Race — Week ${isoWeek}`,
    '',
    `Standings. ${standingsLine}`,
    `Closest rivalry. ${rivalryLine}`,
    `The trophy. ${trophyLine}`,
    '',
    RACE_URL,
  ].join('\n');

  return {
    seasonId,
    isoYear,
    isoWeek,
    subject,
    site,
    email,
    x,
    instagram: caption,
    tiktok: caption,
    telegram,
    snapshot: {
      seasonId,
      isoYear,
      isoWeek,
      standings: standings.map(({ sign, points: value }) => ({ sign, points: value })),
    },
  };
}

/** The full review bundle a person reads before posting anything anywhere. */
export function draftDocument(recap) {
  return [
    recap.site,
    '',
    '---',
    '',
    '## Email draft',
    '',
    `Subject: ${recap.email.subject}`,
    '',
    recap.email.text,
    '',
    '## X draft',
    '',
    recap.x,
    '',
    '## Instagram caption',
    '',
    recap.instagram,
    '',
    '## TikTok caption',
    '',
    recap.tiktok,
    '',
    '## Telegram draft',
    '',
    recap.telegram,
    '',
    '---',
    '',
    '*Drafts only. Nothing auto-posts — review, edit, and post by hand.*',
  ].join('\n');
}
