import { describe, expect, it } from 'vitest';
import { POSITION_BODIES } from '../lib/compute-api/constants';
import { computeChart } from '../lib/engine/full';
import { houseOf } from '../lib/engine/houses';
import { OUTPUT_SCHEMAS, UNDER_13_REFUSAL } from './contracts';
import { MOMENT_CHART_TOOL } from './features/moment-chart-contract';
import { executeAiTool } from './tools';

const now = new Date('2026-11-21T02:15:00Z');
const place = { latitude: 13.7563, longitude: 100.5018 };
const dependencies = { occasions: true, coverage: true, momentChart: true, now: () => now };

describe('a chart for the sky at an event', () => {
  it.each([
    ['right now', undefined], ['today', '2026-11-21T00:30:00Z'],
    ['one hour ago', '2026-11-21T08:15:00+07:00'], ['two years ago', '2024-11-21T02:15:00Z'],
    ['a historical event', '1890-04-26T07:30:00-05:00'],
  ])('returns all the positions, angles and houses for %s', async (_, instant) => {
    const result = await executeAiTool(MOMENT_CHART_TOOL, { ...place, instant, houseSystem: 'placidus' }, dependencies);
    expect(OUTPUT_SCHEMAS.get_moment_chart.safeParse(result).success).toBe(true);
    if (!result.ok || result.tool !== MOMENT_CHART_TOOL) throw new Error('Expected a moment chart');
    const expected = computeChart({ ...place, utc: instant ? new Date(instant) : now, timeKnown: true, houseSystem: 'placidus' });
    const { data } = result;
    expect(data.instant).toBe(expected.input.utc.toISOString());
    expect(data.kind).toBe('moment');
    expect(data.angles).toEqual(expected.angles);
    expect(data.houses).toEqual({ cusps: expected.houses!.cusps, system: 'placidus', polarFallback: false });
    expect(data.houses.cusps).toHaveLength(12);
    expect(data.positions.map(row => row.body)).toEqual(POSITION_BODIES);
    for (const [i, row] of data.positions.entries()) {
      const body = expected.bodies[i];
      expect(row).toMatchObject({ longitude: body.lon, house: houseOf(body.lon, data.houses.cusps), retrograde: body.retrograde });
    }
    expect(data.aspects).toEqual(expected.aspects);
  });

  it('reports the house system used at high latitudes', async () => {
    expect(await executeAiTool(MOMENT_CHART_TOOL, { latitude: 78, longitude: 15, houseSystem: 'placidus' }, dependencies))
      .toMatchObject({ ok: true, data: { houses: { system: 'whole-sign', polarFallback: true } } });
  });

  it.each([{ instant: '2026-02-30T12:00:00Z' }, { instant: '2026-11-21T02:15:00' }, { latitude: 90 },
    { longitude: 181 }, { birthDate: '2024-11-21' }, { name: 'Example' }, { person: {} }, { purpose: 'birth' }])(
    'rejects invalid event arguments and identity fields', async extra => {
      expect(await executeAiTool(MOMENT_CHART_TOOL, { ...place, ...extra }, dependencies)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    });

  it('keeps the personal refusal at the dispatcher, including the birthday boundary in western time zones', async () => {
    for (const birthDate of ['2026-11-21', '2024-11-21', '2013-11-21', '2027-01-01']) {
      expect(await executeAiTool('get_natal_chart', { birthDate }, dependencies))
        .toEqual({ schema: 'zodiacs.ai-tool-result.v1', ok: false, tool: 'get_natal_chart', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
    }
    expect(await executeAiTool('get_natal_chart', { birthDate: '2013-11-20' }, dependencies)).toMatchObject({ ok: true });
  });
});
