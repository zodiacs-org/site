import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import august from './transits-2026-08.json';
import eclipseData from './eclipses.json';

const articleUrls = [
  new URL('../content/almanac/sky-2026-08.mdx', import.meta.url),
  new URL('../content/almanac/reading-a-childs-chart.mdx', import.meta.url),
];

function body(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function wordCount(source: string): number {
  return body(source)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#|*_`>]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

describe('Almanac launch corpus', () => {
  it('keeps both articles within the packet structure and voice rails', () => {
    const banned = /done properly|computed properly|shows its work|like a human|no mush|not vibes|\bvibes\b|cosmic energy|the universe wants|\bmanifest\b|\babundance\b|financial|market|it's important to note|in many ways|stunning|powerful portal|!/i;
    for (const url of articleUrls) {
      const source = readFileSync(url, 'utf8');
      const count = wordCount(source);
      const headings = body(source).match(/^## /gm) ?? [];
      expect(count).toBeGreaterThanOrEqual(900);
      expect(count).toBeLessThanOrEqual(1400);
      expect(headings.length).toBeGreaterThanOrEqual(4);
      expect(headings.length).toBeLessThanOrEqual(6);
      expect(source).not.toMatch(banned);
      expect(body(source).trimEnd()).toMatch(/## On this site\n\n[^#]+$/);
    }
  });

  it('pins the cited August dates and degrees to the committed calculation', () => {
    const article = readFileSync(articleUrls[0], 'utf8');
    const augustEclipses = eclipseData.eclipses.filter(({ peak }) => peak.startsWith('2026-08'));
    expect(august.month).toBe('2026-08');
    expect(august.stations).toEqual([]);
    expect(august.ingresses).toEqual([
      { planet: 'Venus', at: '2026-08-06T19:13:53.712Z', sign: 'libra', retrograde: false },
      { planet: 'Mercury', at: '2026-08-09T16:28:16.308Z', sign: 'leo', retrograde: false },
      { planet: 'Mars', at: '2026-08-11T08:31:07.807Z', sign: 'cancer', retrograde: false },
      { planet: 'Sun', at: '2026-08-23T02:19:10.274Z', sign: 'virgo', retrograde: false },
      { planet: 'Mercury', at: '2026-08-25T11:04:25.568Z', sign: 'virgo', retrograde: false },
    ]);
    expect(august.lunations).toEqual([
      {
        type: 'new',
        at: '2026-08-12T17:36:41.548Z',
        sign: 'leo',
        degree: expect.closeTo(20.032472554545393, 10),
      },
      {
        type: 'full',
        at: '2026-08-28T04:18:31.156Z',
        sign: 'pisces',
        degree: expect.closeTo(4.901645502897509, 10),
      },
    ]);
    expect(augustEclipses).toEqual([
      {
        type: 'solar', kind: 'total', peak: '2026-08-12T17:45:53.037Z',
        sign: 'leo', lon: 140.04, degree: 20, obscuration: 1,
      },
      {
        type: 'lunar', kind: 'partial', peak: '2026-08-28T04:12:55.340Z',
        sign: 'pisces', lon: 334.85, degree: 4.9, obscuration: 0.966,
      },
    ]);
    expect(august.aspects.at(-1)).toEqual({
      a: 'Jupiter',
      b: 'Saturn',
      type: 'trine',
      orb: 0,
      at: '2026-08-31T22:05:22.447Z',
      aSign: 'leo',
      aDegree: expect.closeTo(13.68239518548694, 10),
      bSign: 'aries',
      bDegree: expect.closeTo(13.682395005434444, 10),
    });
    for (const receipt of [
      'new moon is exact on August 12 at 17:36:41 UTC, at 20° Leo',
      'total solar eclipse reaches its global peak at 17:45:53 UTC',
      'partial lunar eclipse peaks on August 28 at 04:12:55 UTC, obscuring 96.6%',
      'full moon itself is exact at 04:18:31 UTC, at 4.9° Pisces',
      'crosses 0°00′ Libra on August 6 at 19:13 UTC',
      'crosses 0°00′ Leo on August 9 at 16:28 UTC',
      'crosses 0°00′ Cancer on August 11 at 08:31 UTC',
      'crosses 0°00′ Virgo on August 23 at 02:19 UTC',
      'crosses 0°00′ Virgo on August 25 at 11:04 UTC',
      'August 31 at 22:05 UTC. Both planets are at 13.7°',
    ]) expect(article).toContain(receipt);
  });

  it('keeps the required privacy sentence byte-identical', () => {
    const source = readFileSync(articleUrls[1], 'utf8');
    expect(source).toContain('their birth data stays on this device unless you turn sync on');
  });
});
