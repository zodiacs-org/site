import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { natalAspectLine, type ChartWeather } from '../../lib/natal';
import { SIGNS, signEssence } from '../../lib/signs';
import ReadingPath, {
  readingScrollBehavior,
  type ReadingPathPlacement,
} from './ReadingPath';

const placements: ReadingPathPlacement[] = [
  { body: 'Sun', lon: 3, house: 1 },
  { body: 'Moon', lon: 65, house: 3 },
  { body: 'Mercury', lon: 8, house: 1 },
  { body: 'Venus', lon: 94, house: 4 },
  { body: 'Mars', lon: 124, house: 5 },
  { body: 'Jupiter', lon: 154, house: 6 },
  { body: 'Saturn', lon: 184, house: 7 },
  { body: 'Uranus', lon: 214, house: 8 },
  { body: 'Neptune', lon: 244, house: 9 },
  { body: 'Pluto', lon: 274, house: 10 },
];

const weather: ChartWeather = {
  lines: [
    'Fire carries four of the ten planets — the chart runs hot.',
    'Cardinal count five of ten: strong at starting.',
  ],
  elements: { fire: 4, earth: 2, air: 2, water: 2 },
  modalities: { cardinal: 5, fixed: 3, mutable: 2 },
};

const topAspects = [
  { a: 'Sun', b: 'Moon', type: 'sextile', orb: 1.2, applying: true },
  { a: 'Mercury', b: 'Saturn', type: 'square', orb: 2.1, applying: false },
] as const;

const baseProps = {
  placements,
  topAspects,
  weather,
  risingLon: 332,
  housesKnown: true,
  selection: { kind: 'body', body: 'Sun' } as const,
  onShowOnChart: () => {},
};

describe('ReadingPath', () => {
  it('renders the four personalized story cards and twelve-house map', () => {
    const markup = render(h(ReadingPath, baseProps));

    expect(markup).toContain('data-reading-card="big-three"');
    expect(markup).toContain('data-reading-card="places"');
    expect(markup).toContain('data-reading-card="aspects"');
    expect(markup).toContain('data-reading-card="pattern"');
    expect(markup.match(/data-reading-house=/g)).toHaveLength(12);
    expect(markup).toContain('Sun sextile Moon');
    expect(markup).toContain('Show on chart: Sun in Aries');
    expect(markup).toContain('Highlighted on chart');
    expect(markup).toContain('Trace this aspect');
    expect(markup).toContain('Spotlight rising');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('See all placements');
    expect(markup).toContain('href="/learn/placements/moon-in-gemini/"');
    expect(markup).toContain('Read Moon in Gemini →');
  });

  it('uses the twelve-sign fallback and explains why houses are absent', () => {
    const markup = render(h(ReadingPath, {
      ...baseProps,
      placements: placements.map((placement) => ({ ...placement, house: null })),
      risingLon: null,
      housesKnown: false,
      selection: null,
    }));

    expect(markup.match(/data-reading-sign=/g)).toHaveLength(12);
    expect(markup).toContain('Birth time is unknown, so houses are not shown.');
    expect(markup).toContain('Birth time needed');
    expect(markup).not.toContain('data-reading-house=');
  });

  it('reads two conjunctions through their planet pairs and retains their exact highlights', () => {
    const markup = render(h(ReadingPath, {
      ...baseProps,
      topAspects: [
        { a: 'Neptune', b: 'Sun', type: 'conjunction', orb: 0.6, applying: false },
        { a: 'Venus', b: 'Pluto', type: 'conjunction', orb: 1.1, applying: false },
      ],
      selection: { kind: 'aspect', a: 'Neptune', b: 'Sun', type: 'conjunction' },
    }));
    expect(markup).toContain(natalAspectLine('Sun', 'conjunction', 'Neptune'));
    expect(markup).toContain(natalAspectLine('Venus', 'conjunction', 'Pluto'));
    expect(markup).toContain('Imagination can be woven into your sense of self');
    expect(markup).toContain('Affection and taste can invite deep investment');
    expect(markup).toContain('0.6° orb');
    expect(markup).toContain('1.1° orb');
    expect(markup).toContain('Show on chart: Neptune conjunction Sun');
    expect(markup).toContain('Show on chart: Venus conjunction Pluto');
    expect(markup).toContain('Highlighted on chart');
  });

  it('keeps the first step as a locator without repeating sign interpretations', () => {
    const markup = render(h(ReadingPath, baseProps));
    expect(markup).toContain('Locate your big three');
    expect(markup).toContain('The part of you that chooses a direction.');
    expect(markup).toContain('What you need in order to feel steady.');
    expect(markup).toContain('How people first meet you.');
    expect(markup).not.toContain(signEssence(SIGNS[0]));
    expect(markup).not.toContain(signEssence(SIGNS[2]));
  });

  it('only smooth-scrolls for pointer activation without reduced motion', () => {
    expect(readingScrollBehavior(1, false)).toBe('smooth');
    expect(readingScrollBehavior(0, false)).toBe('instant');
    expect(readingScrollBehavior(1, true)).toBe('instant');
  });
});
