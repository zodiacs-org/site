import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIG_THREE_STORY_FILENAME, seasonStoryContent, seasonStoryFilename, wrapStoryText } from './story-card';
import { bigThreeStoryRows } from './big-three-story-card';
import { SHARE_CARD_COPY } from './share-card-copy';
import { SIGNS } from './signs';

const DASHES = /[‒–—―]/u;
const sagittarius = { start: '2026-11-22T07:23:34.315Z', end: '2026-12-21T20:50:20.394Z' };
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('story card file names', () => {
  it('name the kind of card and the season, and nothing about the person', () => {
    expect(BIG_THREE_STORY_FILENAME).toBe('zodiacs-big-three-story.png');
    for (const sign of SIGNS) expect(seasonStoryFilename(sign.slug)).toBe(`zodiacs-${sign.slug}-season.png`);
    expect(() => seasonStoryFilename('1990-05-01')).toThrow();
    expect(() => seasonStoryFilename('../aries')).toThrow();
    // No digits at all: no birth year, date or time can reach a story file name.
    for (const name of [BIG_THREE_STORY_FILENAME, ...SIGNS.map((sign) => seasonStoryFilename(sign.slug))]) {
      expect(name).toMatch(/^zodiacs-[a-z-]+\.png$/u);
    }
  });

  it('are the only names the story code saves under', () => {
    const bigThree = source('./big-three-story-card.ts');
    expect(bigThree).toContain('filename: BIG_THREE_STORY_FILENAME');
    expect(source('./story-card.ts')).toContain('filename: seasonStoryFilename(sign.slug)');
  });
});

describe('season story content', () => {
  it('writes the season’s days in the zone it is given', () => {
    const utc = seasonStoryContent({ slug: 'sagittarius', ...sagittarius, theme: 'A month for horizons.', timeZone: 'UTC' });
    expect(utc.title).toBe('Sagittarius season');
    expect(utc.dates).toBe('November 22 to December 21, 2026');
    expect(utc.reader).toBeNull();
    expect(utc.filename).toBe('zodiacs-sagittarius-season.png');
    // In Honolulu the Sun enters on the evening of the 21st.
    expect(seasonStoryContent({ slug: 'sagittarius', ...sagittarius, theme: 'x', timeZone: 'Pacific/Honolulu' }).dates)
      .toBe('November 21 to December 21, 2026');
    const capricorn = seasonStoryContent({ slug: 'capricorn', start: '2026-12-21T20:50:20.394Z', end: '2027-01-20T07:30:01.008Z', theme: 'x', timeZone: 'UTC' });
    expect(capricorn.dates).toBe('December 21, 2026 to January 20, 2027');
  });

  it('adds a chosen sign’s line with its reading confidence', () => {
    const content = seasonStoryContent({
      slug: 'sagittarius', ...sagittarius, theme: 'x', timeZone: 'UTC',
      reader: { slug: 'aries', line: 'This is your month for the horizon.', confidence: 40 },
    });
    expect(content.reader).toEqual({
      heading: 'For Aries',
      line: 'This is your month for the horizon.',
      confidence: 'Reading confidence 40%',
      hue: '#DE8E79',
    });
  });

  it('keeps the brand’s own ring on the season card and turns it to the Sun sign on the big three', () => {
    expect(source('./story-card.ts')).toContain('await drawStoryLockup(ctx, null);');
    expect(source('./big-three-story-card.ts')).toContain('await drawStoryLockup(ctx, cardRingFront(chart));');
  });
});

describe('wrapStoryText', () => {
  const ctx = { measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics };
  it('wraps on word breaks and refuses rather than cutting a sentence', () => {
    expect(wrapStoryText(ctx, 'one two three four', 100, 3)).toEqual(['one two', 'three four']);
    expect(wrapStoryText(ctx, 'one two three four', 40, 3)).toBeNull();
  });
});

describe('big three story rows', () => {
  const lon = (sign: string, degree: number) => SIGNS.findIndex((row) => row.slug === sign) * 30 + degree;

  it('lists Sun, Moon and rising with their degrees for a timed chart', () => {
    const rows = bigThreeStoryRows({
      bodies: [{ body: 'Sun', lon: lon('sagittarius', 3.4) }, { body: 'Moon', lon: lon('pisces', 12.25) }],
      angles: { asc: lon('leo', 20.5), mc: lon('aries', 10.5) },
    });
    expect(rows.map((row) => [row.kind, row.name, row.degree, row.settled])).toEqual([
      ['sun', 'Sagittarius', '3.4°', true],
      ['moon', 'Pisces', '12.3°', true],
      ['rising', 'Leo', '20°', true],
    ]);
  });

  it('keeps a rising row that says it needs a birth time, and leaves out degrees', () => {
    const rows = bigThreeStoryRows({
      bodies: [{ body: 'Sun', lon: lon('sagittarius', 3.4) }, { body: 'Moon', lon: lon('pisces', 29.8) }],
      angles: null,
      moonSignCandidates: [],
    });
    expect(rows.map((row) => [row.kind, row.name, row.degree, row.slug])).toEqual([
      ['sun', 'Sagittarius', null, 'sagittarius'],
      ['moon', 'Needs a birth time', null, ''],
      ['rising', 'Needs a birth time', null, ''],
    ]);
    const settledMoon = bigThreeStoryRows({
      bodies: [{ body: 'Sun', lon: lon('sagittarius', 3.4) }, { body: 'Moon', lon: lon('pisces', 12) }],
      angles: null,
      moonSignCandidates: ['pisces'],
    });
    expect(settledMoon[1]).toMatchObject({ name: 'Pisces', degree: null, settled: true });
  });

  it('carries no dashes in the story copy, in any locale', () => {
    for (const [locale, copy] of Object.entries(SHARE_CARD_COPY)) {
      for (const key of ['storyTitle', 'storyAction', 'storyShare', 'storyDownload', 'storyNote', 'risingNeedsTime'] as const) {
        expect(copy[key], `${locale} ${key}`).not.toMatch(DASHES);
      }
    }
  });
});
