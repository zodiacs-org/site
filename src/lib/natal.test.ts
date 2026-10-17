import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  NATAL_HOUSE_THEME,
  NATAL_ASPECT_LINES,
  chartWeather,
  natalAspectLine,
  planetInHouseLine,
  topAspects,
} from './natal';
import type { Aspect, AspectType } from './engine/types';

const PLANETS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
];
const TYPES: AspectType[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

/** Voice tells banned on new surfaces (CLAUDE.md) — none may be composed. */
const BANNED = [
  'done properly',
  'computed properly',
  'shows its work',
  'like a human',
  'no mush',
  'not vibes',
];

describe('planetInHouseLine', () => {
  it('composes a non-empty, house-referencing line for every planet in every house', () => {
    for (const p of PLANETS) {
      for (let h = 1; h <= 12; h++) {
        const line = planetInHouseLine(p, h);
        expect(line.length).toBeGreaterThan(40);
        expect(line).toContain('house');
        expect(line.startsWith('Your ')).toBe(true);
        for (const tell of BANNED) expect(line.toLowerCase()).not.toContain(tell);
      }
    }
  });

  it('serves curated lines where they exist', () => {
    expect(planetInHouseLine('Sun', 1)).toContain('first minute');
    expect(planetInHouseLine('Saturn', 12)).toContain('nobody watches');
  });

  it('falls back sanely for unknown bodies', () => {
    expect(planetInHouseLine('Chiron', 5)).toContain('fifth house');
  });

  it('drops the theme tail on repeat mentions of a house', () => {
    const repeat = planetInHouseLine('Uranus', 7, { withTheme: false });
    expect(repeat).toContain('seventh house too');
    expect(repeat).not.toContain('—');
  });
});

describe('natalAspectLine', () => {
  it('composes for every planet pair and aspect type without banned tells', () => {
    for (let i = 0; i < PLANETS.length; i++) {
      for (let j = i + 1; j < PLANETS.length; j++) {
        for (const t of TYPES) {
          const line = natalAspectLine(PLANETS[i], t, PLANETS[j]);
          expect(line.length).toBeGreaterThan(40);
          expect(line.startsWith('Your ')).toBe(true);
          for (const tell of BANNED) expect(line.toLowerCase()).not.toContain(tell);
        }
      }
    }
  });

  it('covers the approved 36 natal combinations in either planet order', () => {
    const expectedKeys = [
    'Moon:square:Saturn',
    'Sun:conjunction:Mercury',
    'Sun:conjunction:Moon',
    'Sun:opposition:Moon',
    'Sun:square:Moon',
    'Venus:conjunction:Mars',
    'Sun:sextile:Mars',
    'Sun:square:Neptune',
    'Sun:trine:Jupiter',
    'Sun:conjunction:Venus',
    'Sun:trine:Pluto',
    'Sun:sextile:Pluto',
    'Sun:square:Mars',
    'Sun:sextile:Uranus',
    'Sun:sextile:Saturn',
    'Sun:square:Saturn',
    'Mars:sextile:Uranus',
    'Sun:sextile:Neptune',
    'Sun:square:Pluto',
    'Sun:conjunction:Jupiter',
    'Sun:square:Jupiter',
    'Sun:conjunction:Mars',
    'Sun:trine:Mars',
    'Mercury:trine:Saturn',
    'Sun:trine:Neptune',
    'Mars:trine:Neptune',
    'Sun:opposition:Mars',
    'Sun:conjunction:Neptune',
    'Venus:conjunction:Pluto',
    'Mars:opposition:Neptune',
    'Venus:conjunction:Jupiter',
    'Sun:sextile:Moon',
    'Sun:trine:Moon',
    'Moon:conjunction:Mercury',
    'Moon:square:Mercury',
    'Moon:trine:Venus',
    ];
    expect(Object.keys(NATAL_ASPECT_LINES).sort()).toEqual(expectedKeys.sort());
    for (const key of expectedKeys) {
      const [a, type, b] = key.split(':');
      expect(natalAspectLine(a, type, b)).toBe(NATAL_ASPECT_LINES[key]);
      expect(natalAspectLine(b, type, a)).toBe(natalAspectLine(a, type, b));
    }
  });

  it('keeps the six original aspect readings and eight original house readings intact', () => {
    const originals = [
      planetInHouseLine('Sun', 1),
      planetInHouseLine('Moon', 4),
      planetInHouseLine('Saturn', 12),
      planetInHouseLine('Pluto', 1),
      planetInHouseLine('Neptune', 10),
      planetInHouseLine('Mars', 7),
      planetInHouseLine('Venus', 2),
      planetInHouseLine('Mercury', 3),
      natalAspectLine('Sun', 'conjunction', 'Moon'),
      natalAspectLine('Sun', 'opposition', 'Moon'),
      natalAspectLine('Sun', 'square', 'Moon'),
      natalAspectLine('Venus', 'conjunction', 'Mars'),
      natalAspectLine('Moon', 'square', 'Saturn'),
      natalAspectLine('Sun', 'conjunction', 'Mercury'),
    ];
    expect(createHash('sha256').update(JSON.stringify(originals)).digest('hex'))
      .toBe('ba76a698d494c90faf4f0e88c94fba0ba4abbc2bf455825d3e10adf0864e88ba');
  });

  it('gives different conjunctions different meanings beyond the planet names', () => {
    // Everything after the opening planet clause ("Your Sun is fused to your Neptune.").
    const reading = (line: string) => line.match(/^Your \S+ [^.,]+ your \S+[.,] (.+)$/u)?.[1];
    const imagination = reading(natalAspectLine('Sun', 'conjunction', 'Neptune'));
    const affection = reading(natalAspectLine('Venus', 'conjunction', 'Pluto'));
    expect(imagination).toContain('Imagination');
    expect(affection).toContain('Affection');
    expect(affection).not.toBe(imagination);
    expect(new Set(Object.values(NATAL_ASPECT_LINES).map(reading)).size)
      .toBe(36);
  });

  it('keeps the general reader for pairs outside the authored coverage', () => {
    expect(natalAspectLine('Jupiter', 'trine', 'Neptune')).toBe(
      'Your Jupiter runs downhill into your Neptune. Your appetite for more and your imagination help each other so smoothly the gift is easy to miss.',
    );
    expect(natalAspectLine('Chiron', 'unknown', 'Moon')).toBe('Your Chiron aspects your Moon.');
  });

  it('serves the full-moon curated line', () => {
    expect(natalAspectLine('Sun', 'opposition', 'Moon')).toContain('full-moon birth');
  });
});

describe('topAspects', () => {
  const asp = (a: string, b: string, type: AspectType, orb: number): Aspect => ({
    a: a as Aspect['a'],
    b: b as Aspect['b'],
    type,
    orb,
    applying: false,
  });

  it('prefers a looser luminary aspect over a slightly tighter planetary one', () => {
    const list = [asp('Mercury', 'Venus', 'trine', 1.0), asp('Sun', 'Saturn', 'square', 2.0)];
    expect(topAspects(list, 1)[0].a).toBe('Sun');
  });

  it('caps at n and does not mutate input order', () => {
    const list = [
      asp('Mars', 'Jupiter', 'sextile', 3),
      asp('Venus', 'Neptune', 'square', 0.2),
      asp('Mercury', 'Pluto', 'trine', 2),
    ];
    const before = list.map((x) => x.a).join();
    expect(topAspects(list, 2)).toHaveLength(2);
    expect(list.map((x) => x.a).join()).toBe(before);
  });
});

describe('chartWeather', () => {
  // Longitudes put bodies in known signs: Aries 0–30 (fire), Taurus 30–60
  // (earth), Gemini 60–90 (air), Cancer 90–120 (water), Leo 120–150 (fire),
  // Sagittarius 240–270 (fire).
  const fireHeavy = [
    { body: 'Sun', lon: 5, sign: 'aries' },
    { body: 'Moon', lon: 125, sign: 'leo' },
    { body: 'Mercury', lon: 15, sign: 'aries' },
    { body: 'Venus', lon: 250, sign: 'sagittarius' },
    { body: 'Mars', lon: 28, sign: 'aries' },
    { body: 'Jupiter', lon: 45, sign: 'taurus' },
    { body: 'Saturn', lon: 65, sign: 'gemini' },
    { body: 'Uranus', lon: 70, sign: 'gemini' },
    { body: 'Neptune', lon: 75, sign: 'gemini' },
    { body: 'Pluto', lon: 40, sign: 'taurus' },
  ];

  it('reports a dominant element and a missing one', () => {
    const w = chartWeather(fireHeavy);
    expect(w.elements.fire).toBe(5);
    expect(w.lines.some((l) => l.includes('Fire carries 5'))).toBe(true);
    expect(w.lines.some((l) => l.includes('no planet in water'))).toBe(true);
  });

  it('detects a sign stellium', () => {
    const w = chartWeather(fireHeavy);
    expect(w.lines.some((l) => l.includes('Aries') && l.includes('stellium'))).toBe(true);
  });

  it('detects a house stellium only when houses are known', () => {
    const houseOf = (b: string) => (['Sun', 'Mercury', 'Mars'].includes(b) ? 10 : 3);
    const withHouses = chartWeather(fireHeavy, houseOf);
    expect(withHouses.lines.some((l) => l.includes('tenth house'))).toBe(true);
    const without = chartWeather(fireHeavy);
    expect(without.lines.some((l) => l.includes('tenth house'))).toBe(false);
  });

  it('mentions retrogrades only at three or more', () => {
    const two = fireHeavy.map((b, i) => ({ ...b, retrograde: i < 2 }));
    expect(chartWeather(two).lines.some((l) => l.includes('retrograde'))).toBe(false);
    const three = fireHeavy.map((b, i) => ({ ...b, retrograde: i < 3 }));
    expect(chartWeather(three).lines.some((l) => l.includes('3 planets were retrograde'))).toBe(
      true,
    );
  });

  it('keeps every composed line free of banned tells', () => {
    const w = chartWeather(fireHeavy, () => 10);
    for (const line of w.lines) {
      for (const tell of BANNED) expect(line.toLowerCase()).not.toContain(tell);
    }
  });

  it('has a theme for all twelve houses', () => {
    for (let h = 1; h <= 12; h++) expect(NATAL_HOUSE_THEME[h]).toBeTruthy();
  });
});
