import { describe, expect, it } from 'vitest';
import { savedChartContinuationFailures } from './search-learning-checks.mjs';

const profile = JSON.stringify({
  version: 1,
  settings: { houseSystem: 'whole' },
  charts: [{
    id: '11111111-1111-4111-8111-111111111111', name: 'Learning fixture', relationship: 'other',
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
    birth: {
      date: '1907-07-06', time: '08:30', timeKnown: true,
      place: { name: 'Coyoacán', admin1: 'Ciudad de México', country: 'MX', lat: 19.35, lon: -99.16, tz: 'America/Mexico_City' },
    },
    summary: {
      engineVersion: 'test', utcISO: '1907-07-06T15:06:36.000Z', houseSystem: 'whole',
      bodies: [{ body: 'Sun', lon: 103.91, retrograde: false }, { body: 'Moon', lon: 59.44, retrograde: false }],
      angles: { asc: 143.2, mc: 58.4 }, flags: [],
    },
  }],
});
const observed = (prefix = '') => ({
  pathname: `${prefix}/birth-chart/`, hash: '', date: '1907-07-06', time: '08:30',
  subjectMode: 'other',
  subjectNotices: [prefix === '/es'
    ? 'Estás leyendo la carta de Learning fixture. El “tú” de abajo se refiere a Learning fixture.'
    : 'You’re reading Learning fixture’s chart. “You” below means Learning fixture.'],
  computedEvents: [{ mode: 'full', sunSign: 'cancer' }],
  profile,
});

describe('saved-chart continuation browser evidence', () => {
  it.each(['', '/es'])('accepts the named other-person result in %s', (prefix) => {
    expect(savedChartContinuationFailures(observed(prefix), prefix)).toEqual([]);
  });

  it.each([
    { subjectMode: 'self' }, { subjectNotices: [] }, { subjectNotices: ['Someone else’s chart.'] },
  ])('rejects a lost or wrong saved subject: %j', (patch) => {
    expect(savedChartContinuationFailures({ ...observed(), ...patch }, ''))
      .toContain('named other-person result is missing');
  });

  it.each([
    { computedEvents: [] },
    { computedEvents: [{ mode: 'moon', sunSign: 'cancer' }] },
    { computedEvents: [{ mode: 'full', sunSign: 'leo' }] },
  ])('rejects cached-only, partial, or wrong computation: %j', (patch) => {
    expect(savedChartContinuationFailures({ ...observed(), ...patch }, ''))
      .toContain('fresh full-chart computation did not finish with the expected Sun sign');
  });

  it('permits refresh of derived summaries while preserving the saved source', () => {
    const refreshed = JSON.parse(profile);
    refreshed.charts[0].summary = { ...refreshed.charts[0].summary,
      engineVersion: '0.1.1-rc.15', bodies: [], flags: ['lmt'] };
    expect(savedChartContinuationFailures({ ...observed(), profile: JSON.stringify(refreshed) }, ''))
      .toEqual([]);
  });

  it.each(['birth', 'name', 'relationship', 'houseSystem'])('rejects stored source mutation: %s', (field) => {
    const changed = JSON.parse(profile);
    if (field === 'birth') changed.charts[0].birth.time = '12:00';
    else if (field === 'houseSystem') changed.charts[0].summary.houseSystem = 'placidus';
    else changed.charts[0][field] = 'changed';
    expect(savedChartContinuationFailures({ ...observed(), profile: JSON.stringify(changed) }, ''))
      .toContain('saved private profile was changed');
  });

  it('rejects changed birth input, locale fallback, private fragments, and profile mutation', () => {
    const state = { ...observed('/es'), pathname: '/birth-chart/', hash: '#profileChartId=fixture',
      time: '12:00', profile: '{}' };
    expect(savedChartContinuationFailures(state, '/es')).toEqual([
      'wrong chart route', 'private chart handoff was not consumed',
      'saved birth inputs were not restored', 'saved private profile was changed',
    ]);
  });
});
