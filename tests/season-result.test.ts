import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { championEntryFrom } from '../scripts/race-close-lib.mjs';
import type { SeasonChampionEntry } from '../src/lib/games/champions';
import { zeroFilledStandings } from '../src/lib/games/server';
import { announcementResult, hallResult, levelWithChampion } from '../src/pages/games/_season-result';

/**
 * A Trophy Hall entry built the way the close workflow builds one: the
 * board as the standings API orders it (points, then zodiac order), then
 * championEntryFrom. A change to either one shows up here.
 */
function closedSeason(seasonId: string, rows: Array<{ sign: string; points: number }>): SeasonChampionEntry {
  const seasonSign = seasonId.split('-')[0]!;
  return championEntryFrom({
    seasonId,
    seasonSign,
    seasonName: seasonSign.charAt(0).toUpperCase() + seasonSign.slice(1),
    seasonEndsAt: 0,
    closed: true,
    standings: zeroFilledStandings(rows),
  }) as SeasonChampionEntry;
}

const page = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('how a season was won', () => {
  it('gives the winning margin in points', () => {
    const leo = closedSeason('leo-2026', [{ sign: 'scorpio', points: 350 }, { sign: 'leo', points: 225 }]);
    expect(levelWithChampion(leo)).toEqual([]);
    expect(hallResult(leo)).toBe('won by 125 points');
    expect(announcementResult(leo)).toBe('Won by 125 points over Leo.');

    const close = closedSeason('libra-2026', [{ sign: 'gemini', points: 126 }, { sign: 'aries', points: 125 }]);
    expect(hallResult(close)).toBe('won by 1 point');
    expect(announcementResult(close)).toBe('Won by 1 point over Aries.');

    const wide = closedSeason('scorpio-2026', [{ sign: 'pisces', points: 1350 }, { sign: 'leo', points: 100 }]);
    expect(hallResult(wide)).toBe('won by 1,250 points');
  });

  it('says a season level on points was won on the zodiac-order tiebreak', () => {
    // Virgo 2026 as archived: Aries and Capricorn on 100 each. Capricorn is
    // listed first so that only the zodiac-order tiebreak can crown Aries.
    const virgo = closedSeason('virgo-2026', [{ sign: 'capricorn', points: 100 }, { sign: 'aries', points: 100 }]);
    expect(virgo).toMatchObject({ champion: 'aries', runnerUp: 'capricorn', marginPoints: 0 });
    expect(levelWithChampion(virgo).map((sign) => sign.slug)).toEqual(['capricorn']);
    expect(hallResult(virgo)).toBe('level with Capricorn on 100 points, won on the zodiac-order tiebreak');
    expect(announcementResult(virgo))
      .toBe('Level with Capricorn on 100 points, won on the zodiac-order tiebreak.');
  });

  it('names every sign level with the champion', () => {
    const tie = closedSeason('libra-2026', [
      { sign: 'capricorn', points: 225 },
      { sign: 'leo', points: 225 },
      { sign: 'taurus', points: 225 },
      { sign: 'aries', points: 100 },
    ]);
    expect(tie).toMatchObject({ champion: 'taurus', runnerUp: 'leo', marginPoints: 0 });
    expect(hallResult(tie)).toBe('level with Leo and Capricorn on 225 points, won on the zodiac-order tiebreak');
  });

  it('never prints a zero margin or a dash', () => {
    const seasons = [
      closedSeason('virgo-2026', [{ sign: 'aries', points: 100 }, { sign: 'capricorn', points: 100 }]),
      closedSeason('leo-2026', [{ sign: 'scorpio', points: 350 }, { sign: 'leo', points: 225 }]),
      closedSeason('aries-2026', [{ sign: 'pisces', points: 1 }, { sign: 'virgo', points: 1 }]),
    ];
    for (const season of seasons) {
      for (const line of [hallResult(season), announcementResult(season)]) {
        expect(line).not.toMatch(/\bby 0\b/);
        expect(line).not.toMatch(/[–—]/);
      }
    }
    expect(hallResult(seasons[2]!)).toBe('level with Pisces on 1 point, won on the zodiac-order tiebreak');
  });

  it('is the wording both pages print', async () => {
    const hall = await page('src/pages/games/history/index.astro');
    expect(hall).toContain("import { hallResult } from '../_season-result';");
    expect(hall).toContain('{hallResult(entry)}');
    expect(hall).not.toMatch(/won by \{/i);

    const race = await page('src/pages/race/index.astro');
    expect(race).toContain("import { announcementResult } from '../games/_season-result';");
    expect(race).toContain('{announcementResult(champion)} Engraved. Permanent.');
    expect(race).not.toMatch(/won by \{/i);
  });
});
