import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapBirthDate, under13, UNDER_13 } from './AstrocartographyMap';

describe('the astrocartography page', () => {
  it('draws no map for a birth date less than 13 years before today, or still to come', () => {
    const now = new Date(2026, 10, 9, 12);
    expect(under13('2013-11-10', now)).toBe(true);
    expect(under13('2027-01-01', now)).toBe(true);
    expect(under13('2013-11-09', now)).toBe(false);
    expect(under13('1990-05-03', now)).toBe(false);
  });

  it('reads the age on the date the map is drawn for, after a typed date is converted', async () => {
    const now = new Date(2026, 10, 9, 12);
    // A leading space was compared as text before the date was converted, so it passed the check and drew a child's map.
    expect(under13(' 2020-01-01', now)).toBe(false);
    for (const typed of [' 2020-01-01', '  2020-01-01', '2020-01-01 ', '2020-1-1', '2020/01/01']) {
      expect(await mapBirthDate(typed, 'gregorian', now), typed).toEqual({ error: UNDER_13 });
    }
    expect(await mapBirthDate('2020-01-01', 'gregorian', now)).toEqual({ error: UNDER_13 });
    expect(await mapBirthDate(' 1990-05-03', 'gregorian', now)).toEqual({ date: '1990-05-03' });
    expect(await mapBirthDate('2013-11-09', 'gregorian', now)).toEqual({ date: '2013-11-09' });
  });

  it('checks the converted date before it loads the calculation', () => {
    const source = readFileSync(new URL('./AstrocartographyMap.tsx', import.meta.url), 'utf8');
    const draw = source.slice(source.indexOf('async function draw('));
    expect(draw.indexOf('mapBirthDate(date, calendar)')).toBeGreaterThan(0);
    expect(draw.indexOf('mapBirthDate(date, calendar)')).toBeLessThan(draw.indexOf("import('./astrocartography/compute')"));
    expect(draw.indexOf('mapBirthDate(date, calendar)')).toBeLessThan(draw.indexOf('computeAstrocartography('));
    expect(draw.slice(0, draw.indexOf('mapBirthDate(date, calendar)'))).not.toMatch(/under13\(date\)/u);
  });
});
