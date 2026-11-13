import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { encodeChartLink } from '../lib/share';
import { encodePositionsLink, POSITION_BODY_ORDER } from '../lib/share-positions';
import {
  bigThreeFromPositions,
  comparisonPath,
  manualBigThreeReadings,
  parseSharedChartUrl,
} from './SomeoneElseChart';

const detailsToken = encodeChartLink({
  date: '1990-06-15',
  time: '14:30',
  timeKnown: true,
  lat: 40.7128,
  lon: -74.006,
  tz: 'America/New_York',
  name: 'A friend',
  place: 'New York, United States',
  houseSystem: 'whole',
});

const positionsToken = encodePositionsLink({
  bodies: POSITION_BODY_ORDER.map((body, index) => ({
    body,
    lon: index === 0 ? 5 : index === 1 ? 46 : index * 20,
  })),
  angles: { asc: 95, mc: 5 },
  houseSystem: 'whole',
  engineVersion: '0.1.0',
})!;

describe('someone-else shared chart validation', () => {
  it('accepts canonical and localized Zodiacs detail links', () => {
    expect(parseSharedChartUrl(`https://zodiacs.org/birth-chart/#c=${detailsToken}`)).toMatchObject({
      kind: 'details',
      input: { name: 'A friend', date: '1990-06-15' },
    });
    expect(parseSharedChartUrl(`https://www.zodiacs.org/fr/birth-chart/#c=${detailsToken}`)?.kind)
      .toBe('details');
    expect(parseSharedChartUrl(`https://zodiacs.org/birth-chart/#c=${detailsToken}&subject=other`)?.kind)
      .toBe('details');
  });

  it('accepts positions-only links and derives their Big Three', () => {
    const parsed = parseSharedChartUrl(`https://zodiacs.org/birth-chart/#p=${positionsToken}`);
    expect(parsed?.kind).toBe('positions');
    if (parsed?.kind !== 'positions') throw new Error('Expected positions link');
    expect(bigThreeFromPositions(parsed.chart)).toEqual({
      sun: 'aries',
      moon: 'taurus',
      rising: 'cancer',
    });
  });

  it('allows the current local preview host while rejecting lookalikes and ambiguous links', () => {
    expect(parseSharedChartUrl(
      `http://127.0.0.1:4329/birth-chart/#c=${detailsToken}`,
      'http://127.0.0.1:4329',
    )?.kind).toBe('details');
    expect(parseSharedChartUrl(`https://zodiacs.org.evil.test/birth-chart/#c=${detailsToken}`)).toBeNull();
    expect(parseSharedChartUrl(`https://zodiacs.org/birth-chart/#c=${detailsToken}&p=${positionsToken}`)).toBeNull();
    expect(parseSharedChartUrl(`https://zodiacs.org/compatibility/#c=${detailsToken}`)).toBeNull();
  });
});

describe('someone-else comparison path', () => {
  it('opens the canonical Sun-sign guide when both signs are known', () => {
    expect(comparisonPath('pisces', 'aries')).toBe('/compatibility/aries-pisces/');
  });

  it('falls back to the full calculator without inventing the visitor sign', () => {
    expect(comparisonPath(null, 'aries')).toBe('/compatibility/#calculator');
    expect(comparisonPath('pisces', '')).toBe('/compatibility/#calculator');
  });
});

describe('manual Big Three profile', () => {
  it('uses the existing interpretation corpus and omits signs that were not supplied', () => {
    const readings = manualBigThreeReadings({ sun: 'aries', moon: 'taurus' });
    expect(readings.map(({ kind, slug }) => ({ kind, slug }))).toEqual([
      { kind: 'sun', slug: 'aries' },
      { kind: 'moon', slug: 'taurus' },
    ]);
    expect(readings[0].reading).toContain('Your core engine is ignition');
  });
});

describe('someone-else private mine handoff', () => {
  it('preserves public mine input but scrubs a marked profile-origin handoff on revoke', async () => {
    const source = await readFile(new URL('./SomeoneElseChart.tsx', import.meta.url), 'utf8');
    const revoke = source.slice(
      source.indexOf('useProfileAccessGeneration(() => {'),
      source.indexOf('const latestChart = useMemo'),
    );
    expect(revoke).toContain('if (!currentMineProfileOrigin.current) return;');
    expect(revoke).toContain('currentMineProfileOrigin.current = false;');
    expect(revoke).toContain('setCurrentMine(null);');
    expect(source).toContain('const profileOrigin = profileHandoffOriginsFromHash(hash).mine;');
    // The fragment leaves the address bar before the handoff is read.
    const reader = source.slice(source.indexOf('const hash = window.location.hash;'), source.indexOf('const mine = mineHandoffFromHash(hash);'));
    expect(reader.indexOf('history.replaceState(')).toBeGreaterThan(-1);
    expect(reader.indexOf('history.replaceState(')).toBeLessThan(reader.indexOf('takeChartHandoff(hash)'));
    expect(source).toContain('setPendingProfileMineId(mine.id);');
    expect(source).toContain('if (!profile.charts.some((chart) => chart.id === id)) return;');
    expect(source).toContain('mineProfileOrigin: comparisonMineProfileOrigin');
    expect(source).toContain('const comparisonMineProfileOrigin = currentMine !== null');
  });
});
