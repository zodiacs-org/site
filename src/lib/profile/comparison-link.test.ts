import { describe, expect, it } from 'vitest';
import { decodeChartLink } from '../share';
import { comparisonSavedPage, comparisonSideInput } from './comparison-link';
import { savedPageDraft } from './saved-pages-config';
import type { SavedPairSide } from './pairs';
import type { SavedChart } from './schema';

const chart: SavedChart = {
  id: '0f6c3c7a-3a52-4d0e-9a3b-1d2e3f4a5b6c',
  name: 'Ana · 1990-08-14',
  relationship: 'self',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  birth: {
    date: '1990-08-14',
    time: '09:30',
    timeKnown: true,
    place: { name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal', lat: 38.7167, lon: -9.1333, tz: 'Europe/Lisbon' },
  },
  summary: { engineVersion: 'fixture', utcISO: '1990-08-14T08:30:00.000Z', houseSystem: 'placidus', bodies: [], angles: null, flags: [] },
};

const saved: SavedPairSide = { kind: 'chart', chartId: chart.id, label: 'Ana' };
const typed: SavedPairSide = {
  kind: 'input',
  label: 'Ben',
  input: { date: '1992-03-02', time: null, timeKnown: false, lat: 51.5072, lon: -0.1276, tz: 'Europe/London', place: 'London', houseSystem: 'whole' },
};
const positions = { kind: 'positions', label: 'Cy', received: true, chart: {} } as unknown as SavedPairSide;

describe('comparisonSavedPage', () => {
  it('links both sides by value in the compatibility page’s own grammar', () => {
    const draft = comparisonSavedPage(saved, typed, [chart]);
    expect(draft).not.toBeNull();
    expect(draft!.kind).toBe('compatibility');
    expect(draft!.title).toBe('Ana and Ben · compatibility');
    expect(savedPageDraft(draft)).toEqual(draft);
    const fragment = new URLSearchParams(draft!.href.split('#')[1]);
    const a = decodeChartLink(fragment.get('a')!);
    const b = decodeChartLink(fragment.get('b')!);
    expect(a).toMatchObject({ date: '1990-08-14', time: '09:30', tz: 'Europe/Lisbon', name: 'Ana', houseSystem: 'placidus' });
    expect(b).toMatchObject({ date: '1992-03-02', time: null, timeKnown: false, name: 'Ben' });
  });

  it('has no link when a side carries positions only, or its chart is gone', () => {
    expect(comparisonSavedPage(saved, positions, [chart])).toBeNull();
    expect(comparisonSavedPage(saved, typed, [])).toBeNull();
    expect(comparisonSideInput({ ...saved }, [{ ...chart, birth: { ...chart.birth, place: null } }])).toBeNull();
  });
});
