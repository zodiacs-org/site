import { describe, expect, it } from 'vitest';
import {
  championShareSnapshot,
  RACE_SHARE_CARD_BRAND_LAYOUT,
  raceShareAccessibleDescription,
  raceShareSnapshot,
} from './share-card';
import { zeroFilledStandings } from './server';
import { ordinalLabel } from './share-copy';
import { SIGNS, SIGN_SLUGS } from '../signs';

// A live-looking board: strictly descending points, zodiac order broken up.
const BOARD = [
  { sign: 'scorpio', points: 4225 },
  { sign: 'leo', points: 3383 },
  { sign: 'virgo', points: 3150 },
  { sign: 'aries', points: 2975 },
  { sign: 'pisces', points: 2650 },
  { sign: 'gemini', points: 2400 },
  { sign: 'libra', points: 2250 },
  { sign: 'taurus', points: 2100 },
  { sign: 'sagittarius', points: 1950 },
  { sign: 'aquarius', points: 1775 },
  { sign: 'capricorn', points: 1650 },
  { sign: 'cancer', points: 1500 },
];

const WEEK_INPUT = {
  seasonName: 'Virgo',
  daysLeft: 7,
  isoWeek: 35,
  standings: BOARD,
};

describe('raceShareSnapshot', () => {
  it('keeps the logo in the top-right safe area and the race URL in the footer', () => {
    expect(RACE_SHARE_CARD_BRAND_LAYOUT).toMatchObject({
      wordmarkX: 1014,
      centerY: 76,
      iconSize: 44,
      fontSize: 22,
      gap: 0,
    });
  });

  it('produces the §G copy shapes for every one of the twelve signs', () => {
    for (const row of BOARD) {
      const snapshot = raceShareSnapshot({ ...WEEK_INPUT, sign: row.sign });
      expect(snapshot.sign.slug).toBe(row.sign);
      expect(snapshot.footerLine).toBe('zodiacs.org/race');
      expect(snapshot.strip).toHaveLength(12);
      expect(snapshot.strip.filter((entry) => entry.mine)).toHaveLength(1);
      expect(snapshot.strip.find((entry) => entry.mine)!.slug).toBe(row.sign);
      if (row.sign === 'scorpio') {
        expect(snapshot.variant).toBe('weekly');
        expect(snapshot.standingLine).toBe('1st this week');
        expect(snapshot.contextLine).toBe('Week 35 · The Zodiac Games');
      } else {
        expect(snapshot.variant).toBe('rivalry');
        expect(snapshot.standingLine).toBe(
          `${(4225 - row.points).toLocaleString('en')} points behind Scorpio`,
        );
        expect(snapshot.contextLine).toBe('7 days left in Virgo Season');
      }
    }
  });

  it('matches the calibration line: Leo is 842 points behind Scorpio', () => {
    const snapshot = raceShareSnapshot({
      ...WEEK_INPUT,
      sign: 'leo',
      standings: [
        { sign: 'scorpio', points: 2000 },
        { sign: 'leo', points: 1158 },
      ],
    });
    expect(snapshot.standingLine).toBe('842 points behind Scorpio');
  });

  it('speaks singular for the last day of a season', () => {
    const snapshot = raceShareSnapshot({ ...WEEK_INPUT, sign: 'leo', daysLeft: 1 });
    expect(snapshot.contextLine).toBe('1 day left in Virgo Season');
  });

  it('keeps hue and glyph identical to the site sign table', () => {
    const snapshot = raceShareSnapshot({ ...WEEK_INPUT, sign: 'pisces' });
    const pisces = SIGNS.find((sign) => sign.slug === 'pisces')!;
    expect(snapshot.sign.hue).toBe(pisces.hue);
    expect(snapshot.sign.glyph).toBe(pisces.glyph);
  });

  it('rejects boards missing the sign, junk signs, and junk data', () => {
    expect(() => raceShareSnapshot({ ...WEEK_INPUT, sign: 'ophiuchus' })).toThrow();
    expect(() => raceShareSnapshot({
      ...WEEK_INPUT, sign: 'leo', standings: [{ sign: 'aries', points: 5 }],
    })).toThrow();
    expect(() => raceShareSnapshot({
      ...WEEK_INPUT, sign: 'leo', standings: [{ sign: 'leo', points: -1 }],
    })).toThrow();
    expect(() => raceShareSnapshot({ ...WEEK_INPUT, sign: 'leo', isoWeek: 0 })).toThrow();
    expect(() => raceShareSnapshot({ ...WEEK_INPUT, sign: 'leo', daysLeft: 99 })).toThrow();
  });
});

/** A board as the standings API serves it: all twelve, points then zodiac order. */
function liveBoard(points: Record<string, number>) {
  return zeroFilledStandings(Object.entries(points).map(([sign, value]) => ({ sign, points: value })))
    .map(({ sign, points: value }) => ({ sign, points: value }));
}

describe('raceShareSnapshot when signs are level on points', () => {
  // Virgo 2026 ended Aries 100, Capricorn 100. Aries is first on the board
  // only because equal points rank in zodiac order.
  const virgoFinal = liveBoard({ aries: 100, capricorn: 100 });
  const level = (sign: string, standings: { sign: string; points: number }[]) =>
    raceShareSnapshot({ ...WEEK_INPUT, sign, standings });

  it('says a sign level with the leader is level, not 0 points behind', () => {
    const snapshot = level('capricorn', virgoFinal);
    expect(snapshot.variant).toBe('rivalry');
    expect(snapshot.standingLine).toBe('Level with Aries on 100 points');
    expect(snapshot.contextLine).toBe('7 days left in Virgo Season');
    const capricorn = SIGNS.find((sign) => sign.slug === 'capricorn')!;
    expect(raceShareAccessibleDescription(snapshot)).toBe(
      `${capricorn.glyph} Capricorn · Level with Aries on 100 points. 7 days left in Virgo Season. zodiacs.org/race.`,
    );
  });

  it('does not call the sign first on the tiebreak 1st this week', () => {
    const snapshot = level('aries', virgoFinal);
    expect(snapshot.variant).toBe('rivalry');
    expect(snapshot.standingLine).toBe('Level with Capricorn on 100 points');
    expect(snapshot.contextLine).toBe('7 days left in Virgo Season');
  });

  it('keeps the gap below a tie at the top, and a lower tie behind a clear leader', () => {
    expect(level('leo', virgoFinal).standingLine).toBe('100 points behind Aries');
    const lowerTie = liveBoard({ scorpio: 350, leo: 225, aries: 225 });
    expect(level('scorpio', lowerTie).standingLine).toBe('1st this week');
    expect(level('aries', lowerTie).standingLine).toBe('125 points behind Scorpio');
    expect(level('leo', lowerTie).standingLine).toBe('125 points behind Scorpio');
  });

  it('names one or two rivals and counts three or more, so the line fits the card', () => {
    const threeWay = liveBoard({ aries: 100, leo: 100, capricorn: 100, pisces: 75 });
    expect(level('capricorn', threeWay).standingLine).toBe('Level with Aries and Leo on 100 points');
    expect(level('aries', threeWay).standingLine).toBe('Level with Leo and Capricorn on 100 points');
    expect(level('pisces', threeWay).standingLine).toBe('25 points behind Aries');
    const fourWay = liveBoard({ taurus: 25, gemini: 25, cancer: 25, scorpio: 25 });
    expect(level('scorpio', fourWay).standingLine).toBe('Level with 3 other signs on 25 points');
    expect(level('taurus', liveBoard({ taurus: 1, virgo: 1 })).standingLine)
      .toBe('Level with Virgo on 1 point');
  });

  it('says all signs start level while nobody has scored, for every sign', () => {
    const open = liveBoard({});
    for (const row of open) {
      const snapshot = level(row.sign, open);
      expect(snapshot.variant).toBe('rivalry');
      expect(snapshot.standingLine).toBe('All signs start level');
      expect(snapshot.contextLine).toBe('7 days left in Virgo Season');
    }
  });

  it('never prints a zero gap, and the new lines carry no em or en dash', () => {
    const boards = [
      virgoFinal,
      liveBoard({}),
      liveBoard({ aries: 100, leo: 100, capricorn: 100, pisces: 75 }),
      liveBoard({ scorpio: 350, leo: 225, aries: 225 }),
      liveBoard(Object.fromEntries(SIGN_SLUGS.map((slug) => [slug, 25]))),
    ];
    for (const standings of boards) {
      for (const row of standings) {
        const line = level(row.sign, standings).standingLine;
        expect(line, `${row.sign}: ${line}`).not.toMatch(/^0 points behind/);
        expect(line).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});

describe('championShareSnapshot', () => {
  it('produces the §G champion card for every sign', () => {
    for (const slug of SIGN_SLUGS) {
      const snapshot = championShareSnapshot({
        sign: slug, seasonName: 'Virgo', year: 2026,
      });
      expect(snapshot.variant).toBe('champion');
      expect(snapshot.standingLine).toBe('Virgo Season Champion · 2026');
      expect(snapshot.contextLine).toBe('The Zodiac Games');
      expect(snapshot.footerLine).toBe('zodiacs.org/race');
      expect(snapshot.strip.find((entry) => entry.mine)!.slug).toBe(slug);
    }
  });

  it('rejects implausible years', () => {
    expect(() => championShareSnapshot({ sign: 'leo', seasonName: 'Virgo', year: 1999 })).toThrow();
  });
});

describe('raceShareAccessibleDescription', () => {
  it('reads the whole card as one sentence set', () => {
    const weekly = raceShareAccessibleDescription(
      raceShareSnapshot({ ...WEEK_INPUT, sign: 'scorpio' }),
    );
    expect(weekly).toBe(
      '♏ Scorpio · 1st this week. Week 35 · The Zodiac Games. zodiacs.org/race.',
    );
    const champion = raceShareAccessibleDescription(
      championShareSnapshot({ sign: 'scorpio', seasonName: 'Virgo', year: 2026 }),
    );
    expect(champion).toBe(
      '♏ Scorpio. Virgo Season Champion · 2026. The Zodiac Games · zodiacs.org/race.',
    );
  });
});

describe('ordinalLabel', () => {
  it('covers all twelve ranks', () => {
    expect([...Array(12)].map((_, index) => ordinalLabel(index + 1))).toEqual([
      '1st', '2nd', '3rd', '4th', '5th', '6th',
      '7th', '8th', '9th', '10th', '11th', '12th',
    ]);
  });
});
