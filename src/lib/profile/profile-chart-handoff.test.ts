import { describe, expect, it } from 'vitest';
import { profileChartEditInput, profileChartRunInput } from './profile-chart-handoff';
import type { SavedChart } from './schema';

const partial: SavedChart = { id: 'partial', name: 'Own chart', relationship: 'self', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', birth: { date: '1990-02-01', time: null, timeKnown: false, place: null }, summary: { engineVersion: '0.1.1-rc.15', utcISO: '1990-02-01T12:00:00Z', houseSystem: 'placidus', bodies: [], angles: null, flags: ['no-time'] } };
describe('canonical chart editor handoff', () => {
  it('preserves known input and house settings while requesting only the missing birthplace', () => {
    expect(profileChartRunInput([partial], 'partial')).toBeNull();
    expect(profileChartEditInput([partial], 'partial')).toEqual({ date: partial.birth.date, time: '', timeKnown: false, city: null, houseSystem: 'placidus', subjectMode: 'self', name: partial.name });
    expect(profileChartEditInput([partial], 'deleted')).toBeNull();
  });
});
