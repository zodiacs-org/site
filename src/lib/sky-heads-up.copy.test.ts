/*
 * What the heads-up calendar and its JSON say: sky events only, never money,
 * markets or what to do, no forbidden dashes, and nothing about the reader.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findConsumerBoundaryViolations } from '../../scripts/consumer-boundary-lib.mjs';
import { HEADS_UP_EN } from './return-visits/copy';
import {
  EVENT_COPY_BANNED,
  assertHeadsUpCopy,
  headsUpCalendar,
  headsUpCopyProblems,
  headsUpFeed,
  headsUpJson,
  headsUpStrings,
  type HeadsUpFeed,
} from './sky-heads-up';

const FIRST_BUILD = new Date('2026-11-12T00:00:00Z');
/** Every timeline row is in the window. */
const ALL = new Date('2026-01-08T00:00:00Z');

/** Every string a reader can see: the files' text plus the page copy. */
function visibleStrings(feed: HeadsUpFeed): string[] {
  return [...headsUpStrings(feed), ...Object.values(HEADS_UP_EN)];
}

/** All the checks one string must pass. */
function copyViolations(text: string): string[] {
  return [
    ...findConsumerBoundaryViolations(text, 'src/data/sky-calendar-heads-up.txt').map((v) => `${v.rule}: ${v.match}`),
    ...headsUpCopyProblems(text),
  ];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('heads-up copy', () => {
  it('bans the money and advice words the plan names', () => {
    for (const word of ['price', 'stock', 'bottom', 'dip', 'rally', 'crash', 'bull', 'bear', 'invest', 'trade', 'buy', 'sell', 'portfolio', 'profit', 'bitcoin', 'S&P', 'Nasdaq', 'market', 'financial', 'good time to']) {
      expect(EVENT_COPY_BANNED).toContain(word);
    }
  });

  it('passes the consumer boundary scanner, the banned list and the dash rule, string by string', () => {
    for (const feed of [headsUpFeed(ALL), headsUpFeed(FIRST_BUILD)]) {
      const strings = visibleStrings(feed);
      expect(strings.length).toBeGreaterThan(100);
      const failures = strings.flatMap((text) => copyViolations(text).map((v) => `${v} in "${text}"`));
      expect(failures).toEqual([]);
    }
  });

  it('passes the scanner and the dash rule as whole files', () => {
    const feed = headsUpFeed(ALL);
    const json = headsUpJson(feed);
    const ics = headsUpCalendar(feed);
    expect(findConsumerBoundaryViolations(json, 'src/data/sky-calendar-heads-up.json')).toEqual([]);
    expect(findConsumerBoundaryViolations(ics.replace(/\r\n /g, ''), 'src/data/sky-calendar-heads-up.txt')).toEqual([]);
    expect(json).not.toMatch(/[\u2012-\u2015]/u);
    expect(ics).not.toMatch(/[\u2012-\u2015]/u);
  });

  it('fails on an injected "buy the bottom" summary', () => {
    const feed = headsUpFeed(FIRST_BUILD);
    const [first, ...rest] = feed.events;
    const mutated = { ...feed, events: [{ ...first!, summary: 'A full moon: time to buy the bottom.' }, ...rest] };
    expect(copyViolations('A full moon: time to buy the bottom.')).toEqual(expect.arrayContaining(['banned word "buy"', 'banned word "bottom"']));
    expect(() => assertHeadsUpCopy(visibleStrings(mutated))).toThrow(/banned word "buy"/u);
  });

  it('runs the consumer boundary scanner for real on these paths', () => {
    expect(copyViolations('Watch the crypto market tonight.').some((v) => v.startsWith('market vocabulary'))).toBe(true);
    expect(findConsumerBoundaryViolations(JSON.stringify({ summary: 'Buy this Zodiac token today.' }), 'src/data/sky-calendar-heads-up.json').length).toBeGreaterThan(0);
  });

  it('fails on an injected en dash, em dash, figure dash or horizontal bar', () => {
    for (const dash of ['\u2012', '\u2013', '\u2014', '\u2015']) {
      const title = `Full moon ${dash} Gemini`;
      expect(copyViolations(title)).toContain('dash U+2012 to U+2015');
      const feed = headsUpFeed(FIRST_BUILD);
      const [first, ...rest] = feed.events;
      expect(() => assertHeadsUpCopy(visibleStrings({ ...feed, events: [{ ...first!, title }, ...rest] }))).toThrow(/dash/u);
    }
  });

  it('fails on other banned words and phrases, not on words that merely contain them', () => {
    for (const text of ['A good time to act.', 'The S&P moves.', 'Nasdaq', 'a bull run', 'Markets react', 'financial advice', 'invest now']) {
      expect(headsUpCopyProblems(text).length, text).toBeGreaterThan(0);
    }
    for (const text of ['The Moon stands opposite the Sun.', 'Jupiter enters Cancer.', 'Saturn and Uranus reach an exact sextile.', 'the bottomless sky']) {
      expect(headsUpCopyProblems(text), text).toEqual([]);
    }
  });
});

describe('heads-up privacy', () => {
  it('never carries birth details from the environment', () => {
    const sentinels = {
      BIRTH_DATE: '1987-03-14',
      BIRTH_TIME: '04:37',
      BIRTH_PLACE: 'Quaxleton, Vermont',
      NAME: 'Orlaith Testperson',
      ZODIACS_BIRTH_DATE: '1987-03-14',
      ZODIACS_BIRTH_PLACE: 'Quaxleton, Vermont',
      ZODIACS_NAME: 'Orlaith Testperson',
    };
    for (const [key, value] of Object.entries(sentinels)) vi.stubEnv(key, value);
    const feed = headsUpFeed(FIRST_BUILD);
    for (const text of [headsUpCalendar(feed), headsUpJson(feed)]) {
      for (const needle of ['1987-03-14', '19870314', '04:37', 'Quaxleton', 'Orlaith', 'Testperson']) {
        expect(text).not.toContain(needle);
      }
      // No link carries a query string or a fragment beyond the page's own.
      for (const url of text.match(/https:\/\/zodiacs\.org[^\s",\\]*/gu) ?? []) {
        expect(url, url).not.toContain('?');
      }
    }
  });
});
