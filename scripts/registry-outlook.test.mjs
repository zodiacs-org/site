import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REGISTRY_OUTLOOK_METHOD,
  REGISTRY_SIGNS,
  buildRegistryOutlook,
  buildRegistryOutlooks,
  formatRegistryOutlookShareText,
} from '../src/registry/outlook.mjs';
import { buildRegistryOutlookArtifact } from './registry-outlook-artifact.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function json(relativePath) {
  return JSON.parse(await readFile(resolve(repositoryRoot, relativePath), 'utf8'));
}

async function committedFacts(months = ['2026-08']) {
  const [ingresses, ...transitMonths] = await Promise.all([
    json('src/data/ingresses.json'),
    ...months.map((month) => json(`src/data/transits-${month}.json`)),
  ]);
  return { ingressWindows: ingresses.windows, transitMonths };
}

function emptyMonth(month, overrides = {}) {
  return {
    month,
    ingresses: [],
    lunations: [],
    stations: [],
    aspects: [],
    ...overrides,
  };
}

describe('Registry symbolic outlook', () => {
  it('builds the public artifact from the committed sky and timestamped market archive', async () => {
    const [artifact, daily] = await Promise.all([
      buildRegistryOutlookArtifact(repositoryRoot),
      json('src/data/daily.json'),
    ]);
    expect(artifact.daily.date).toBe(daily.date);
    expect(artifact.daily.marketSnapshot.suppliedSigns).toBe(12);
    expect(artifact.daily.evidence.historyDaysObserved).toBeGreaterThanOrEqual(1);
    expect(artifact.weekly.signs).toHaveLength(12);
  });

  it('builds reproducible daily and weekly editions from committed astronomy facts', async () => {
    const facts = await committedFacts();
    const first = buildRegistryOutlooks({ date: '2026-08-09', ...facts });
    const second = buildRegistryOutlooks({ date: '2026-08-09', ...facts });

    expect(first).toEqual(second);
    expect(first.daily.schema).toBe('zodiacs.registry-outlook.v1');
    expect(first.daily.horizon).toMatchObject({
      kind: 'daily',
      days: 1,
      from: '2026-08-09T00:00:00.000Z',
      toExclusive: '2026-08-10T00:00:00.000Z',
      referenceAt: '2026-08-09T12:00:00.000Z',
    });
    expect(first.weekly.horizon).toMatchObject({ kind: 'weekly', days: 7 });
    expect(first.daily.signs.map(({ sign }) => sign)).toEqual(REGISTRY_SIGNS);
    expect(first.daily.coverage).toMatchObject({ overall: 'complete', events: 'complete', occupancies: 'complete' });

    const dailyLeo = first.daily.signs.find(({ sign }) => sign === 'leo');
    const dailyCancer = first.daily.signs.find(({ sign }) => sign === 'cancer');
    expect(dailyLeo.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'ingress',
        label: 'Mercury enters Leo',
        // rc.16 full IAU 2000B shifts this ingress by 130 ms.
        at: '2026-08-09T16:28:16.438Z',
        tonePoints: 0,
        source: 'src/data/transits-2026-08.json',
      }),
      expect.objectContaining({ kind: 'occupancy', label: 'Sun in Leo' }),
      expect.objectContaining({ kind: 'occupancy', label: 'Jupiter in Leo' }),
    ]));
    expect(dailyCancer.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'occupancy', label: 'Mercury in Cancer' }),
    ]));

    const weeklyLeo = first.weekly.signs.find(({ sign }) => sign === 'leo');
    expect(weeklyLeo.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'lunation', label: 'New Moon in Leo' }),
      expect.objectContaining({ kind: 'ingress', label: 'Mercury enters Leo' }),
    ]));
    expect(first.daily.forecast).toMatchObject({
      status: 'research-only',
      priceDirection: null,
      liquidityDirection: null,
    });
    expect(first.daily.evidence.confidence).toMatchObject({
      label: 'not-yet-calibrated',
      score: null,
    });
  });

  it('applies disclosed supportive and frictional weights only to directly named signs', () => {
    const catalog = emptyMonth('2026-08', {
      aspects: [
        {
          a: 'Venus',
          b: 'Pluto',
          type: 'trine',
          orb: 0,
          at: '2026-08-10T06:00:00.000Z',
          aSign: 'libra',
          aDegree: 3,
          bSign: 'aquarius',
          bDegree: 3,
        },
        {
          a: 'Venus',
          b: 'Neptune',
          type: 'opposition',
          orb: 0,
          at: '2026-08-10T18:00:00.000Z',
          aSign: 'libra',
          aDegree: 4,
          bSign: 'aries',
          bDegree: 4,
        },
      ],
    });
    const outlook = buildRegistryOutlook({
      date: '2026-08-10',
      transitMonths: [catalog],
      ingressWindows: [],
    });
    const libra = outlook.signs.find(({ sign }) => sign === 'libra');
    const aquarius = outlook.signs.find(({ sign }) => sign === 'aquarius');
    const aries = outlook.signs.find(({ sign }) => sign === 'aries');
    const taurus = outlook.signs.find(({ sign }) => sign === 'taurus');

    expect(libra.factors).toHaveLength(2);
    expect(aquarius.scores.tone).toBeGreaterThan(0);
    expect(aries.scores.tone).toBeLessThan(0);
    expect(taurus.scores).toEqual({ attention: 0, tone: 0, volatility: 0 });
    expect(libra.factors[0]).toMatchObject({
      basePoints: REGISTRY_OUTLOOK_METHOD.eventWeights.opposition,
      horizonMultiplier: 0.8125,
      calculation: '18 attention / -12 tone / 15 event intensity × 0.8125 horizon multiplier',
    });
    expect(outlook.coverage).toMatchObject({
      overall: 'partial',
      events: 'complete',
      occupancies: 'unavailable',
    });
  });

  it('keeps live market context descriptive and completely separate from the sky score', () => {
    const baseOptions = {
      date: '2026-08-10',
      transitMonths: [emptyMonth('2026-08')],
      ingressWindows: [],
      history: { daysObserved: 42 },
    };
    const skyOnly = buildRegistryOutlook(baseOptions);
    const withMarkets = buildRegistryOutlook({
      ...baseOptions,
      marketAsOf: '2026-08-10T20:00:00.000Z',
      marketBySign: {
        aries: {
          priceUsd: 0.012,
          change24hPct: 7.5,
          marketCapUsd: 200_000,
          liquidityUsd: 30_000,
          volume24hUsd: 45_000,
        },
        taurus: {
          priceUsd: 0.02,
          change24hPct: -2,
          marketCapUsd: 100_000,
          liquidityUsd: 10_000,
          volume24hUsd: 500,
        },
      },
    });

    expect(withMarkets.signs.map(({ scores }) => scores)).toEqual(skyOnly.signs.map(({ scores }) => scores));
    expect(withMarkets.marketSnapshot).toMatchObject({
      suppliedSigns: 2,
      medians: { liquidityUsd: 20_000, marketCapUsd: 150_000 },
      freshness: { asOf: '2026-08-10T20:00:00.000Z', status: 'current-for-horizon' },
    });
    expect(withMarkets.signs.find(({ sign }) => sign === 'aries').market).toMatchObject({
      liquidityVsCollectionMedian: 1.5,
      marketCapVsCollectionMedian: 1.33,
      turnover24h: 1.5,
      liquidityBand: 'deeper',
      participationBand: 'high',
    });
    expect(withMarkets.signs.find(({ sign }) => sign === 'taurus').market).toMatchObject({
      liquidityBand: 'thinner',
      participationBand: 'low',
    });
    expect(withMarkets.evidence).toMatchObject({
      status: 'collecting',
      historyDaysObserved: 42,
      historyDaysRemaining: 138,
      directionalForecasts: 'disabled',
    });
  });

  it('reports cross-month source gaps instead of interpreting missing facts as a quiet sky', () => {
    const partial = buildRegistryOutlook({
      date: '2026-08-29',
      horizon: 'weekly',
      transitMonths: [emptyMonth('2026-08')],
      ingressWindows: [],
    });
    expect(partial.coverage).toMatchObject({
      overall: 'partial',
      events: 'partial',
      expectedTransitMonths: ['2026-08', '2026-09'],
      missingTransitMonths: ['2026-09'],
    });
  });

  it('produces a restrained share caption with the research limitation attached', async () => {
    const outlook = buildRegistryOutlook({ date: '2026-08-09', ...(await committedFacts()) });
    expect(formatRegistryOutlookShareText(outlook, 'leo')).toBe([
      'Leo · daily sky signal: Active',
      `Attention ${outlook.signs.find(({ sign }) => sign === 'leo').scores.attention}/100 · tone +0 · event intensity ${outlook.signs.find(({ sign }) => sign === 'leo').scores.volatility}/100`,
      'Main factor: Mercury enters Leo.',
      'Experimental symbolic index — not a price forecast or financial advice.',
      'https://zodiacs.org/terminal/',
    ].join('\n'));
  });

  it('rejects ambiguous dates, malformed facts, duplicate months, and negative market values', () => {
    expect(() => buildRegistryOutlook({ date: '08/10/2026' })).toThrow('YYYY-MM-DD');
    expect(() => buildRegistryOutlook({ date: '2026-02-30' })).toThrow('not a real UTC calendar day');
    expect(() => buildRegistryOutlook({
      date: '2026-08-10',
      transitMonths: [emptyMonth('2026-08'), emptyMonth('2026-08')],
    })).toThrow('Duplicate transit month');
    expect(() => buildRegistryOutlook({
      date: '2026-08-10',
      transitMonths: [emptyMonth('2026-08')],
      marketBySign: { aries: { liquidityUsd: -1 } },
    })).toThrow('cannot be negative');
  });
});
