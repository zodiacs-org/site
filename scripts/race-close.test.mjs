/**
 * Season-close contracts (Zodiac Games R2.3): the previous-season id walk
 * (including both year boundaries) and the immutable champion entry.
 */
import { describe, expect, it } from 'vitest';
import {
  ZODIAC_ORDER,
  championEntryFrom,
  engraveSeasons,
  previousSeasonIdOf,
  seasonsToEngrave,
} from './race-close-lib.mjs';

function closedPayload(overrides = {}) {
  return {
    seasonId: 'leo-2026',
    seasonSign: 'leo',
    seasonName: 'Leo',
    seasonEndsAt: Date.UTC(2026, 7, 23),
    closed: true,
    standings: [
      { sign: 'scorpio', points: 350, joins: 3, checkins: 2 },
      { sign: 'leo', points: 225, joins: 2, checkins: 1 },
      ...ZODIAC_ORDER.filter((sign) => !['scorpio', 'leo'].includes(sign))
        .map((sign) => ({ sign, points: 0, joins: 0, checkins: 0 })),
    ],
    ...overrides,
  };
}

describe('season close', () => {
  it('walks the zodiac calendar backward, including both year boundaries', () => {
    expect(previousSeasonIdOf('virgo-2026')).toBe('leo-2026');
    expect(previousSeasonIdOf('aries-2026')).toBe('pisces-2026');
    expect(previousSeasonIdOf('aquarius-2027')).toBe('capricorn-2026');
    expect(previousSeasonIdOf('capricorn-2026')).toBe('sagittarius-2026');
    expect(() => previousSeasonIdOf('dragon-2026')).toThrow();
  });

  it('walking forward through a full year returns to the start', () => {
    let id = 'aries-2026';
    for (let step = 0; step < 12; step += 1) id = previousSeasonIdOf(id);
    expect(id).toBe('aries-2025');
  });

  it('engraves champion, runner-up, margin, and the full final board', () => {
    const entry = championEntryFrom(closedPayload());
    expect(entry).toMatchObject({
      seasonId: 'leo-2026',
      seasonName: 'Leo',
      year: 2026,
      endedAtUtc: Date.UTC(2026, 7, 23),
      champion: 'scorpio',
      runnerUp: 'leo',
      marginPoints: 125,
    });
    expect(entry.finalStandings).toHaveLength(12);
    expect(entry.finalStandings[0]).toEqual({ sign: 'scorpio', points: 350 });
    expect(Object.keys(entry.finalStandings[0])).toEqual(['sign', 'points']);
  });

  it('refuses open seasons and never crowns an empty board', () => {
    expect(() => championEntryFrom(closedPayload({ closed: false }))).toThrow();
    expect(championEntryFrom(closedPayload({
      standings: ZODIAC_ORDER.map((sign) => ({ sign, points: 0 })),
    }))).toBeNull();
  });
});

describe('season close catch-up', () => {
  const virgo = closedPayload({
    seasonId: 'virgo-2026', seasonSign: 'virgo', seasonName: 'Virgo', seasonEndsAt: Date.UTC(2026, 8, 23),
  });
  const libra = closedPayload({
    seasonId: 'libra-2026', seasonSign: 'libra', seasonName: 'Libra', seasonEndsAt: Date.UTC(2026, 9, 23),
  });
  const hallWithLeo = () => ({ version: 1, seasons: [championEntryFrom(closedPayload())] });
  const ids = (champions) => champions.seasons.map((entry) => entry.seasonId);

  function archiveOf(payloads) {
    const calls = [];
    const archive = async (seasonId) => {
      calls.push(seasonId);
      return payloads[seasonId]
        ? { payload: payloads[seasonId] }
        : { skip: `standings&season=${seasonId} answered 502 (unavailable)` };
    };
    return { archive, calls };
  }

  it('owes the season that closed overnight, and nothing once it is engraved', () => {
    expect(seasonsToEngrave('virgo-2026', ['leo-2026'])).toEqual(['virgo-2026']);
    expect(seasonsToEngrave('leo-2026', ['leo-2026'])).toEqual([]);
    expect(seasonsToEngrave('leo-2026', [])).toEqual(['leo-2026']);
    expect(seasonsToEngrave('libra-2026', ['leo-2026'], 1)).toEqual(['libra-2026']);
    expect(() => seasonsToEngrave('dragon-2026', ['leo-2026'])).toThrow();
  });

  it('owes every season that closed while runs could not publish, oldest first', () => {
    // 23 Sep to 4 Nov 2026: Virgo and Libra closed and neither reached main.
    expect(seasonsToEngrave('libra-2026', ['leo-2026'])).toEqual(['virgo-2026', 'libra-2026']);
    expect(seasonsToEngrave('aquarius-2027', ['sagittarius-2026']))
      .toEqual(['capricorn-2026', 'aquarius-2027']);
    const bounded = seasonsToEngrave('libra-2026', ['leo-2025']);
    expect(bounded).toHaveLength(12);
    expect(bounded[0]).toBe('scorpio-2025');
    expect(bounded.at(-1)).toBe('libra-2026');
  });

  it('engraves the missed seasons once, in order, and a rerun adds nothing', async () => {
    const champions = hallWithLeo();
    const { archive } = archiveOf({ 'virgo-2026': virgo, 'libra-2026': libra });

    const added = await engraveSeasons(champions, seasonsToEngrave('libra-2026', ids(champions)), archive);
    expect(added.map((entry) => entry.seasonId)).toEqual(['virgo-2026', 'libra-2026']);
    expect(ids(champions)).toEqual(['leo-2026', 'virgo-2026', 'libra-2026']);

    expect(seasonsToEngrave('libra-2026', ids(champions))).toEqual([]);
    expect(await engraveSeasons(champions, ['virgo-2026', 'libra-2026'], archive)).toEqual([]);
    expect(ids(champions)).toEqual(['leo-2026', 'virgo-2026', 'libra-2026']);
  });

  it('stops at a season the archive cannot read and resumes there next run', async () => {
    const blocked = hallWithLeo();
    const first = archiveOf({ 'libra-2026': libra });
    expect(await engraveSeasons(blocked, ['virgo-2026', 'libra-2026'], first.archive)).toEqual([]);
    expect(first.calls).toEqual(['virgo-2026']);
    expect(ids(blocked)).toEqual(['leo-2026']);

    const partial = hallWithLeo();
    const second = archiveOf({ 'virgo-2026': virgo });
    const added = await engraveSeasons(partial, ['virgo-2026', 'libra-2026'], second.archive);
    expect(added.map((entry) => entry.seasonId)).toEqual(['virgo-2026']);
    expect(seasonsToEngrave('libra-2026', ids(partial))).toEqual(['libra-2026']);
  });

  it('passes over an uncounted season and never writes out of order', async () => {
    const champions = hallWithLeo();
    const emptyVirgo = { ...virgo, standings: ZODIAC_ORDER.map((sign) => ({ sign, points: 0 })) };
    const { archive } = archiveOf({ 'virgo-2026': emptyVirgo, 'libra-2026': libra });
    const added = await engraveSeasons(champions, ['virgo-2026', 'libra-2026'], archive);
    expect(added.map((entry) => entry.seasonId)).toEqual(['libra-2026']);

    const late = archiveOf({ 'virgo-2026': virgo });
    expect(await engraveSeasons(champions, ['virgo-2026'], late.archive)).toEqual([]);
    expect(ids(champions)).toEqual(['leo-2026', 'libra-2026']);
  });

  it('refuses an archive answer for a different season', async () => {
    const { archive } = archiveOf({ 'virgo-2026': libra });
    await expect(engraveSeasons(hallWithLeo(), ['virgo-2026'], archive)).rejects.toThrow();
  });
});
