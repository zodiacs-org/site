import { describe, expect, it } from 'vitest';
import {
  CURATED_WING_ENTRIES,
  SEARCH_KINDS,
  extractPageMetadata,
  firstSentence,
  glossarySearchEntries,
  htmlFileToPath,
  inferSearchKind,
  isEnglishHtml,
  searchIndexShapeFailures,
  shouldIndexPath,
  sortSearchEntries,
  truncateAtWord,
} from './search-index-lib.mjs';

const BANNED_MARKET_WORDS = /\b(?:market|markets|price|prices|pricing|token|tokens|sale|sales|trade|trades|trading|buy|buying|sell|selling|investment|investments|liquidity|exchange|exchanges|speculation)\b/i;
const BANNED_TRANSACTION_WORDS = /\b(?:sale|sales|trade|trades|trading|buy|buying|sell|selling|investment|investments|liquidity|exchange|exchanges|speculation)\b/i;
const INFRASTRUCTURE_JARGON = /\b(?:solana|ethereum|jupiter|dex|spl|erc-20)\b/i;
const SIGN_PROFILE_PATH = /^\/registry\/(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\/$/u;

describe('search-index HTML extraction', () => {
  it('extracts normalized title and description regardless of meta attribute order', () => {
    const html = `<!doctype html>
      <html><head>
        <meta content="Charts &amp; exact times" name="description">
        <title>Birth Chart &amp; Rising Sign | Zodiacs.org</title>
      </head><body></body></html>`;

    expect(extractPageMetadata(html)).toEqual({
      title: 'Birth Chart & Rising Sign',
      description: 'Charts & exact times',
      noindex: false,
      searchable: true,
    });
    expect(isEnglishHtml('<html lang="en-US"><head></head></html>')).toBe(true);
    expect(isEnglishHtml('<html lang="es"><head></head></html>')).toBe(false);
  });

  it('recognizes noindex among mixed robots directives', () => {
    const html = `<title>Private | Zodiacs.org</title>
      <meta name='description' content='Not for search'>
      <meta content='nofollow, NOINDEX' name='robots'>`;
    expect(extractPageMetadata(html).noindex).toBe(true);
    expect(extractPageMetadata(html).searchable).toBe(false);
  });

  it('keeps a page noindexed only by the shared template rule searchable', () => {
    const html = `<title>Aries and Leo | Zodiacs.org</title>
      <meta name="description" content="A pair">
      <meta name="robots" data-noindex-rule="compatibility pair pages" content="noindex, follow, max-image-preview:large">`;
    expect(extractPageMetadata(html)).toMatchObject({ noindex: true, searchable: true });
  });

  it('maps built files, exclusions, and kinds deterministically', () => {
    expect(htmlFileToPath('index.html')).toBe('/');
    expect(htmlFileToPath('learn/houses/index.html')).toBe('/learn/houses/');
    expect(htmlFileToPath('404.html')).toBe('/404.html');
    expect(shouldIndexPath('/es/learn/')).toBe(false);
    expect(shouldIndexPath('/registry/aries/')).toBe(false);
    expect(shouldIndexPath('/learn/page/2/')).toBe(false);
    expect(shouldIndexPath('/learn/pages/3/')).toBe(false);
    expect(shouldIndexPath('/learn/page-4.html')).toBe(false);
    expect(inferSearchKind('/aries/')).toBe('sign');
    expect(inferSearchKind('/compatibility/aries-taurus/')).toBe('pairing');
    expect(inferSearchKind('/horoscopes/aries/')).toBe('horoscope');
    expect(inferSearchKind('/learn/aspects/')).toBe('learn');
    expect(inferSearchKind('/birth-chart/')).toBe('tool');
    expect(inferSearchKind('/lunar-return/')).toBe('tool');
    expect(inferSearchKind('/numerology/')).toBe('tool');
    expect(inferSearchKind('/numerology/life-path/7/')).toBe('tool');
    expect(inferSearchKind('/void-of-course-moon/')).toBe('tool');
    expect(inferSearchKind('/big-three/')).toBe('tool');
    expect(inferSearchKind('/solar-return/')).toBe('tool');
    expect(inferSearchKind('/about/')).toBe('page');
  });
});

describe('glossary search entries', () => {
  it('maps fixture terms to anchored entries using the first definition sentence', () => {
    const entries = glossarySearchEntries([
      {
        slug: 'orb',
        term: 'Orb',
        definition: 'An orb is the distance from exact. A second sentence stays out.',
      },
      {
        slug: 'utc',
        term: 'UTC',
        definition: 'UTC is one time standard worldwide. Location resolves local time.',
      },
    ]);

    expect(entries).toEqual([
      {
        path: '/learn/glossary/#orb',
        title: 'Orb',
        description: 'An orb is the distance from exact.',
        kind: 'term',
      },
      {
        path: '/learn/glossary/#utc',
        title: 'UTC',
        description: 'UTC is one time standard worldwide.',
        kind: 'term',
      },
    ]);
    expect(firstSentence('zodiacs.org uses one standard. Another follows.'))
      .toBe('zodiacs.org uses one standard.');
  });

  it('sorts paths, trims at word boundaries, and reports corrupt shapes', () => {
    const sorted = sortSearchEntries([
      { path: '/z/', title: 'Z', description: 'Z page', kind: 'page' },
      { path: '/a/', title: 'A', description: 'A page', kind: 'page' },
    ]);
    expect(sorted.map((entry) => entry.path)).toEqual(['/a/', '/z/']);

    const trimmed = truncateAtWord('one two three four five', 15);
    expect(trimmed).toBe('one two three…');
    expect(trimmed).not.toContain('fou');

    expect(searchIndexShapeFailures(sorted, { minEntries: 1 })).toEqual([]);
    expect(searchIndexShapeFailures(null, { minEntries: 1 })).toEqual(['root must be an array']);
    expect(searchIndexShapeFailures([
      ...sorted,
      { path: '/a/', title: '', description: 'duplicate', kind: 'mystery', keywords: [''] },
      { path: '/../outside', title: 'Outside', description: 'Escapes dist', kind: 'page' },
      { path: '/learn/glossary/#orb#alias', title: 'Alias', description: 'Alias term', kind: 'term' },
      { path: '/learn/glossary/#%6Frb', title: 'Encoded', description: 'Encoded term', kind: 'term' },
      { path: '/about/#team', title: 'Team', description: 'Page fragment', kind: 'page' },
    ], { minEntries: 1 })).toEqual(expect.arrayContaining([
      'entry 2 has invalid title',
      'duplicate path /a/',
      'entry 2 has unknown kind mystery',
      'entry 2 has invalid keywords',
      'entries are not sorted at /a/',
      'entry 3 path contains a parent segment',
      'entry 4 path contains multiple fragments',
      'entry 4 term path is not canonical',
      'entry 5 term path is not canonical',
      'entry 6 non-term path contains a fragment',
    ]));
  });
});

describe('curated wing search entries', () => {
  it('freezes Astrofolio, Terminal, and fifteen records-register destinations with validated kinds', () => {
    expect(SEARCH_KINDS).toContain('terminal');
    expect(SEARCH_KINDS).toContain('astrofolio');
    expect(SEARCH_KINDS).toContain('registry');
    expect(CURATED_WING_ENTRIES).toHaveLength(17);
    expect(Object.isFrozen(CURATED_WING_ENTRIES)).toBe(true);
    expect(CURATED_WING_ENTRIES.every((entry) => (
      Object.isFrozen(entry) && Object.isFrozen(entry.keywords)
    ))).toBe(true);
    expect(CURATED_WING_ENTRIES.map((entry) => entry.path)).toEqual([
      '/astrofolio/',
      '/terminal/',
      '/registry/',
      '/thesis/',
      '/sdk/',
      '/registry/aries/',
      '/registry/taurus/',
      '/registry/gemini/',
      '/registry/cancer/',
      '/registry/leo/',
      '/registry/virgo/',
      '/registry/libra/',
      '/registry/scorpio/',
      '/registry/sagittarius/',
      '/registry/capricorn/',
      '/registry/aquarius/',
      '/registry/pisces/',
    ]);
    expect(CURATED_WING_ENTRIES.slice(0, 5)).toEqual([
      expect.objectContaining({
        path: '/astrofolio/',
        title: 'Astrofolio',
        description: 'Choose your sign and explore the twelve-part Zodiac collection.',
      }),
      expect.objectContaining({
        path: '/terminal/',
        title: 'Terminal',
        description: 'See current prices, charts, standings, and research for all twelve Zodiac tokens.',
      }),
      expect.objectContaining({
        path: '/registry/',
        title: 'The 12 Zodiac Profiles',
        description: 'Choose your Zodiac sign, meet famous people who share it, compare recent Wikipedia views, and see today’s market standings.',
      }),
      expect.objectContaining({
        path: '/thesis/',
        title: 'Why Zodiacs Matter',
        description: 'Why a sign people already know can become a shared digital identity.',
      }),
      expect.objectContaining({
        path: '/sdk/',
        title: 'Zodiacs SDK',
        description: 'Open tools for building astrology apps — charts, icons, and the registry interface.',
      }),
    ]);
    expect(CURATED_WING_ENTRIES[5]).toEqual(expect.objectContaining({
      path: '/registry/aries/',
      title: 'Aries Zodiac profile',
      description: 'Aries dates, famous birthdays, Wikipedia views, current price and rank, and verified token address.',
    }));
    expect(searchIndexShapeFailures(
      sortSearchEntries(CURATED_WING_ENTRIES),
      { minEntries: 0 },
    )).toEqual([]);
  });

  it('keeps non-market destinations neutral while describing profile prices plainly', () => {
    const profiles = CURATED_WING_ENTRIES.filter(({ path }) => SIGN_PROFILE_PATH.test(path));
    expect(profiles).toHaveLength(12);

    for (const entry of profiles) {
      expect(entry.description).toMatch(/current price and rank/iu);
      expect(`${entry.title} ${entry.description}`).not.toMatch(BANNED_TRANSACTION_WORDS);
      expect(`${entry.title} ${entry.description}`).not.toMatch(INFRASTRUCTURE_JARGON);
    }

    for (const entry of CURATED_WING_ENTRIES.filter(({ path }) => (
      path !== '/terminal/' && path !== '/registry/' && !SIGN_PROFILE_PATH.test(path)
    ))) {
      expect(`${entry.title} ${entry.description}`).not.toMatch(BANNED_MARKET_WORDS);
    }
  });
});
