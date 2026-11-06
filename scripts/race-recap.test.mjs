/**
 * State of the Race renderer contract (Zodiac Games R2.2). The drafts must
 * follow the approved §H skeleton verbatim, carry standings facts only, and
 * stay inside each platform's practical bounds.
 */
import { describe, expect, it } from 'vitest';
import {
  SIGN_LINES,
  SIGN_NAMES,
  biggestMover,
  buildRecap,
  closestRivalry,
  draftDocument,
  levelWith,
  oneMoreThing,
} from './race-recap-lib.mjs';

const ORDER = Object.keys(SIGN_NAMES);

function payload(overrides = {}) {
  const standings = [
    { sign: 'scorpio', points: 350 },
    { sign: 'leo', points: 225 },
    { sign: 'aries', points: 100 },
    ...ORDER.filter((sign) => !['scorpio', 'leo', 'aries'].includes(sign))
      .map((sign) => ({ sign, points: 0 })),
  ];
  return {
    seasonId: 'leo-2026',
    seasonSign: 'leo',
    seasonName: 'Leo',
    daysLeft: 4,
    isoYear: 2026,
    isoWeek: 34,
    standings,
    ...overrides,
  };
}

describe('State of the Race drafts', () => {
  it('renders the §H skeleton with its labels verbatim', () => {
    const recap = buildRecap(payload());
    for (const label of ['**Standings.**', '**Closest rivalry.**', '**Biggest mover.**', '**The trophy.**', '**One more thing.**']) {
      expect(recap.site).toContain(label);
    }
    expect(recap.site).toContain('State of the Race — Week 34');
    expect(recap.site).toContain('1. Scorpio — 350 points');
    expect(recap.site).toContain('Leo is 125 points behind Scorpio.');
    expect(recap.site).toContain('4 days until Leo Season closes.');
    expect(recap.site).toContain('zodiacs.org/race');
  });

  it('keeps every platform draft free of market language and smug tells', () => {
    const recap = buildRecap(payload());
    const drafts = [recap.site, recap.email.text, recap.x, recap.instagram, recap.tiktok, recap.telegram]
      .join('\n')
      .toLowerCase();
    for (const banned of [
      'token', 'price', 'market', 'wallet', 'buy', 'holder',
      'properly', 'shows its work', 'no mush', 'not vibes', 'like a human',
    ]) {
      expect(drafts, `draft must not say "${banned}"`).not.toContain(banned);
    }
  });

  it('keeps the X draft inside 280 characters for every board shape', () => {
    for (const shape of [
      payload(),
      payload({ standings: ORDER.map((sign) => ({ sign, points: 0 })) }),
      payload({
        standings: ORDER.map((sign, index) => ({ sign, points: 1_000_000 - index * 12_345 })),
        daysLeft: 1,
        isoWeek: 53,
      }),
      // Level lines: eleven signs named at the top, all twelve level, and
      // the longest draft, a leader with the other eleven level below it.
      payload({
        standings: ORDER.map((sign, index) => ({ sign, points: index < 11 ? 1_000_000 : 0 })),
        daysLeft: 1,
        isoWeek: 53,
      }),
      payload({ standings: ORDER.map((sign) => ({ sign, points: 1_000_000 })), isoWeek: 53 }),
      payload({
        standings: ORDER.map((sign, index) => ({ sign, points: index === 0 ? 9_999_999 : 9_999_975 })),
        daysLeft: 1,
        isoWeek: 53,
      }),
    ]) {
      expect([...buildRecap(shape).x].length).toBeLessThanOrEqual(280);
    }
  });

  it('keeps the short rivalry on an untied board', () => {
    const recap = buildRecap(payload());
    for (const draft of [recap.x, recap.instagram, recap.tiktok]) {
      expect(draft).toContain('\nScorpio leads with 350 points. Leo is 125 behind.\n');
    }
  });

  it('subjects follow holds-on / makes-a-move / takes-the-lead rules', () => {
    const previous = { seasonId: 'leo-2026', isoYear: 2026, isoWeek: 33, standings: payload().standings };
    expect(buildRecap(payload(), previous).subject).toBe('Week 34: Scorpio holds on');

    const climbed = payload({
      standings: [
        { sign: 'scorpio', points: 350 },
        { sign: 'aries', points: 300 },
        { sign: 'leo', points: 225 },
        ...ORDER.filter((sign) => !['scorpio', 'leo', 'aries'].includes(sign))
          .map((sign) => ({ sign, points: 0 })),
      ],
    });
    const wayBack = {
      seasonId: 'leo-2026',
      isoYear: 2026,
      isoWeek: 33,
      standings: [
        { sign: 'scorpio', points: 350 },
        { sign: 'leo', points: 225 },
        { sign: 'taurus', points: 120 },
        { sign: 'gemini', points: 110 },
        { sign: 'aries', points: 100 },
        ...ORDER.filter((sign) => !['scorpio', 'leo', 'aries', 'taurus', 'gemini'].includes(sign))
          .map((sign) => ({ sign, points: 0 })),
      ],
    };
    expect(buildRecap(climbed, wayBack).subject).toBe('Week 34: Aries makes a move');

    const newLeader = payload({
      standings: [
        { sign: 'leo', points: 400 },
        { sign: 'scorpio', points: 350 },
        ...ORDER.filter((sign) => !['scorpio', 'leo'].includes(sign))
          .map((sign) => ({ sign, points: 0 })),
      ],
    });
    expect(buildRecap(newLeader, previous).subject).toBe('Week 34: Leo takes the lead');
  });

  it('handles the open board and the first stamp of a season honestly', () => {
    const open = buildRecap(payload({ standings: ORDER.map((sign) => ({ sign, points: 0 })) }));
    expect(open.subject).toBe('Week 34: the board is open');
    expect(open.site).toContain('The board is open.');
    expect(open.site).toContain('No rivalry yet');

    const fresh = buildRecap(payload());
    expect(fresh.site).toContain('First stamp of the season — no movers yet.');

    const otherSeason = {
      seasonId: 'cancer-2026', isoYear: 2026, isoWeek: 30, standings: payload().standings,
    };
    expect(buildRecap(payload(), otherSeason).site)
      .toContain('First stamp of the season — no movers yet.');
  });

  it('finds the closest rivalry and the biggest mover', () => {
    // Scorpio→Leo and Leo→Aries both sit at 125; ties go to the top pair.
    expect(closestRivalry(payload().standings)).toEqual({ ahead: 'scorpio', behind: 'leo', gap: 125 });
    expect(closestRivalry(ORDER.map((sign) => ({ sign, points: 0 })))).toBeNull();

    const previous = {
      standings: [
        { sign: 'scorpio', points: 1 },
        { sign: 'leo', points: 1 },
        { sign: 'pisces', points: 1 },
        { sign: 'aries', points: 1 },
        ...ORDER.filter((sign) => !['scorpio', 'leo', 'aries', 'pisces'].includes(sign))
          .map((sign) => ({ sign, points: 0 })),
      ],
    };
    expect(biggestMover(payload().standings, previous)).toEqual({ sign: 'aries', climbed: 1, rank: 3 });
  });

  it('rotates the §F sign line deterministically and quotes it verbatim', () => {
    const line = oneMoreThing(34, 'scorpio');
    const [signName, rest] = line.split(' — ');
    const slug = ORDER.find((entry) => SIGN_NAMES[entry] === signName);
    expect(SIGN_LINES[slug]).toBe(rest);
    expect(oneMoreThing(34, 'scorpio')).toBe(line);
    expect(oneMoreThing(35, 'scorpio')).not.toBe(line);
  });

  describe('when signs are level on points', () => {
    /** All twelve rows in API order: points, then zodiac order. */
    function board(scores) {
      return ORDER
        .map((sign) => ({ sign, points: scores[sign] ?? 0 }))
        .sort((a, b) => b.points - a.points || ORDER.indexOf(a.sign) - ORDER.indexOf(b.sign));
    }
    // Virgo 2026 ended Aries 100, Capricorn 100; Aries is first on the tiebreak.
    const virgoFinal = () => payload({
      seasonId: 'virgo-2026',
      seasonSign: 'virgo',
      seasonName: 'Virgo',
      daysLeft: 1,
      isoWeek: 38,
      standings: board({ aries: 100, capricorn: 100 }),
    });
    const drafts = (recap) => [
      recap.site, recap.email.subject, recap.email.text, recap.x,
      recap.instagram, recap.tiktok, recap.telegram,
    ].join('\n');

    it('counts a level pair as the closest rivalry and says it is level', () => {
      expect(closestRivalry(virgoFinal().standings))
        .toEqual({ ahead: 'aries', behind: 'capricorn', gap: 0 });
      const recap = buildRecap(virgoFinal());
      expect(recap.site).toContain('**Closest rivalry.** Aries and Capricorn are level on 100 points.');
      expect(recap.email.text).toContain('Closest rivalry. Aries and Capricorn are level on 100 points.');
      expect(recap.telegram).toContain('Closest rivalry. Aries and Capricorn are level on 100 points.');
      expect(drafts(recap)).not.toMatch(/\b0 points behind|is 0 behind/);
    });

    it('leads the short drafts with the tie, not with a leader', () => {
      const recap = buildRecap(virgoFinal());
      expect(recap.x).toBe([
        'Week 38 · The Zodiac Games',
        'Aries and Capricorn are level on 100 points.',
        '1 day until Virgo Season closes.',
        'zodiacs.org/race',
      ].join('\n'));
      expect(recap.instagram.split('\n')[1]).toBe('Aries and Capricorn are level on 100 points.');
      expect(drafts(recap)).not.toContain('leads with');
    });

    it('never says a sign took the lead or held on when it is only first on the tiebreak', () => {
      const week37 = (scores) => ({
        seasonId: 'virgo-2026', isoYear: 2026, isoWeek: 37, standings: board(scores),
      });
      // Capricorn led alone, then Aries drew level: not "Aries takes the lead".
      expect(buildRecap(virgoFinal(), week37({ capricorn: 100, aries: 75 })).subject)
        .toBe('Week 38: level at the top');
      // Aries led alone, then Capricorn drew level: not "Aries holds on".
      expect(buildRecap(virgoFinal(), week37({ aries: 100, capricorn: 75 })).subject)
        .toBe('Week 38: level at the top');
      expect(buildRecap(virgoFinal()).subject).toBe('Week 38: level at the top');

      // Nobody led a level or an empty week, so a sole leader now takes the
      // lead rather than holding on to a lead it only had on the tiebreak.
      const aheadNow = payload({
        seasonId: 'virgo-2026', seasonSign: 'virgo', seasonName: 'Virgo', isoWeek: 38,
        standings: board({ aries: 125, capricorn: 100 }),
      });
      expect(buildRecap(aheadNow, week37({ aries: 100, capricorn: 100 })).subject)
        .toBe('Week 38: Aries takes the lead');
      expect(buildRecap(aheadNow, week37({})).subject).toBe('Week 38: Aries takes the lead');
      expect(buildRecap(aheadNow, week37({ aries: 100, capricorn: 75 })).subject)
        .toBe('Week 38: Aries holds on');
      expect(buildRecap(aheadNow).subject).toBe('Week 38: Aries holds on');
    });

    it('names every sign in a level group, and keeps the leader above a lower tie', () => {
      const threeWay = buildRecap(payload({ standings: board({ aries: 100, leo: 100, capricorn: 100 }) }));
      expect(threeWay.site).toContain('Aries, Leo, and Capricorn are level on 100 points.');
      expect(threeWay.x).toContain('\nAries, Leo, and Capricorn are level on 100 points.\n');

      const allTwelve = buildRecap(payload({ standings: board(Object.fromEntries(ORDER.map((sign) => [sign, 25]))) }));
      expect(allTwelve.site).toContain('**Closest rivalry.** All twelve signs are level on 25 points.');

      const lowerTie = buildRecap(payload({ standings: board({ scorpio: 350, leo: 225, aries: 225, pisces: 100 }) }));
      expect(lowerTie.subject).toBe('Week 34: Scorpio holds on');
      expect(lowerTie.site).toContain('**Closest rivalry.** Aries and Leo are level on 225 points.');
      expect(lowerTie.x).toContain('\nScorpio leads with 350 points. Aries and Leo are level on 225 points.\n');
      expect(levelWith(lowerTie.snapshot.standings, 'leo').map((row) => row.sign)).toEqual(['aries', 'leo']);
    });

    it('keeps the new level lines free of em and en dashes', () => {
      for (const recap of [
        buildRecap(virgoFinal()),
        buildRecap(payload({ standings: board({ scorpio: 350, leo: 225, aries: 225 }) })),
      ]) {
        const lines = drafts(recap).split('\n').filter((line) => line.includes('level'));
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) expect(line).not.toMatch(/[\u2013\u2014]/);
      }
    });
  });

  it('bundles every platform section and the nothing-auto-posts note', () => {
    const doc = draftDocument(buildRecap(payload()));
    for (const section of ['## Email draft', '## X draft', '## Instagram caption', '## TikTok caption', '## Telegram draft']) {
      expect(doc).toContain(section);
    }
    expect(doc).toContain('Nothing auto-posts');
    expect(doc).toContain('{{unsubscribe_url}}');
  });
});
