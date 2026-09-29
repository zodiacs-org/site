import { describe, expect, it } from 'vitest';
import { POSITION_BODY_ORDER } from '../share-positions';
import {
  cleanInviteLabel,
  deriveInviteChartFromSyncedPayload,
  isEmptyJsonBody,
  parseCreateInviteBody,
  parseInviteIdBody,
  positionsFromStored,
} from './validate';

function savedChart(timed = true): Record<string, unknown> {
  return {
    id: '99fdb58f-5dbe-4ce3-8afa-08edee193229',
    name: '  Private\nChart  ',
    birth: {
      date: '1907-07-06',
      time: timed ? '08:30' : null,
      timeKnown: timed,
      place: {
        name: 'Coyoacán',
        country: 'Mexico',
        lat: 19.36,
        lon: -99.16,
        tz: 'America/Mexico_City',
      },
    },
    summary: {
      engineVersion: 'zodiacs-1.0.0',
      utcISO: '1907-07-06T15:07:00.000Z',
      houseSystem: 'whole',
      bodies: POSITION_BODY_ORDER.map((body, index) => ({
        body,
        lon: index * 27.1,
        retrograde: index % 2 === 0,
      })),
      angles: timed ? { asc: 124.5, mc: 30.25 } : null,
      flags: [],
    },
  };
}

describe('Phase 4 invite validation', () => {
  it('derives only positions from a synchronized saved chart', () => {
    const result = deriveInviteChartFromSyncedPayload(savedChart());
    expect(result).toMatchObject({
      label: 'Private Chart',
      timeKnown: true,
      positions: {
        h: 'w',
        v: 'zodiacs-1.0.0',
        // ASC 124.5° and MC 30.25° go to the invitee as the middle of their whole degree.
        a: [124.5, 30.5],
      },
    });
    expect(result?.positions.b).toHaveLength(12);
    expect(JSON.stringify(result)).not.toMatch(
      /1907|Coyoacán|Mexico|America\/Mexico|19\.36|-99\.16|retrograde/iu,
    );
  });

  it('shares a no-time chart as the sky at 12:00 UTC on its date, with no angles, and makes none without an ephemeris', () => {
    const asked: string[] = [];
    // A stand-in ephemeris: the invitation must use whatever it gives for noon UTC.
    const bodiesAt = (utc: Date) => {
      asked.push(utc.toISOString());
      return POSITION_BODY_ORDER.map((body, index) => ({ body, lon: 100 + index * 13.1234 }));
    };
    const result = deriveInviteChartFromSyncedPayload(savedChart(false), bodiesAt);
    expect(asked).toEqual(['1907-07-06T12:00:00.000Z']);
    expect(result?.timeKnown).toBe(false);
    expect(result?.positions).not.toHaveProperty('a');
    // Not the chart's own positions (noon at the birthplace), which give the place away.
    expect(result?.positions.b).toEqual(POSITION_BODY_ORDER.map((_, index) => Math.round((100 + index * 13.1234) * 1000) / 1000));
    expect(result?.sunSign).toBe('cancer');
    expect(JSON.stringify(result)).not.toMatch(/1907|Coyoacán|Mexico|America\/Mexico|19\.36|-99\.16/iu);
    expect(deriveInviteChartFromSyncedPayload(savedChart(false))).toBeNull();
  });

  it('shares a chart with a birth time at its whole UTC minute, and makes none from an instant with seconds and no ephemeris', () => {
    // Mexico City kept its own mean time, −6:36:36, until 1922, so 08:30 there
    // was 15:06:36 UTC, and those seconds would give the birthplace's longitude.
    const meanTime = savedChart();
    (meanTime.summary as { utcISO: string }).utcISO = '1907-07-06T15:06:36.000Z';
    const asked: string[] = [];
    const bodiesAt = (utc: Date) => {
      asked.push(utc.toISOString());
      return POSITION_BODY_ORDER.map((body, index) => ({ body, lon: 200 + index * 7.4321 }));
    };
    const result = deriveInviteChartFromSyncedPayload(meanTime, bodiesAt);
    expect(asked).toEqual(['1907-07-06T15:07:00.000Z']);
    expect(result?.positions.b).toEqual(POSITION_BODY_ORDER.map((_, index) => Math.round((200 + index * 7.4321) * 1000) / 1000));
    expect(result?.positions.a).toEqual([124.5, 30.5]);
    expect(deriveInviteChartFromSyncedPayload(meanTime)).toBeNull();

    // A whole minute keeps the chart's own positions and asks the ephemeris nothing.
    const own = deriveInviteChartFromSyncedPayload(savedChart(), () => { throw new Error('not asked'); });
    expect(own?.positions.b).toEqual(POSITION_BODY_ORDER.map((_, index) => Math.round(index * 27.1 * 1000) / 1000));
    // A chart with a birth time and no instant makes none.
    const missing = savedChart();
    delete (missing.summary as { utcISO?: string }).utcISO;
    expect(deriveInviteChartFromSyncedPayload(missing, bodiesAt)).toBeNull();
  });

  it('rejects malformed chart summaries and time/angle disagreement', () => {
    const missing = savedChart();
    (missing.summary as { bodies: unknown[] }).bodies.pop();
    expect(deriveInviteChartFromSyncedPayload(missing)).toBeNull();

    const disagree = savedChart(false);
    (disagree.summary as { angles: unknown }).angles = { asc: 1, mc: 2 };
    // Unknown-time input deliberately ignores stale angles.
    const bodiesAt = () => POSITION_BODY_ORDER.map((body, index) => ({ body, lon: index * 27.1 }));
    expect(deriveInviteChartFromSyncedPayload(disagree, bodiesAt)?.positions).not.toHaveProperty('a');
    const badDate = savedChart(false);
    (badDate.birth as { date: string }).date = '1907-02-30';
    expect(deriveInviteChartFromSyncedPayload(badDate, bodiesAt)).toBeNull();
  });

  it('accepts exact create/id/empty bodies only', () => {
    const id = '99fdb58f-5dbe-4ce3-8afa-08edee193229';
    expect(parseCreateInviteBody({ chartId: id, consent: true, notify: false }))
      .toEqual({ chartId: id, consent: true, notify: false });
    expect(parseCreateInviteBody({ chartId: id, consent: false, notify: false })).toBeNull();
    expect(parseCreateInviteBody({
      chartId: id,
      consent: true,
      notify: false,
      positions: {},
    })).toBeNull();
    expect(parseInviteIdBody({ id })).toBe(id);
    expect(parseInviteIdBody({ id, token: 'no' })).toBeNull();
    expect(isEmptyJsonBody(undefined)).toBe(true);
    expect(isEmptyJsonBody('{}')).toBe(true);
    expect(isEmptyJsonBody({ birth: 'no' })).toBe(false);
  });

  it('rejects forbidden or noncanonical stored payloads', () => {
    const result = deriveInviteChartFromSyncedPayload(savedChart())!;
    expect(positionsFromStored(result.positions)).not.toBeNull();
    expect(positionsFromStored({ ...result.positions, birthDate: '1907-07-06' })).toBeNull();
    expect(positionsFromStored({ ...result.positions, b: [1, 2] })).toBeNull();
  });

  it('bounds and cleans labels', () => {
    expect(cleanInviteLabel(' A\n B ')).toBe('A B');
    expect(cleanInviteLabel('')).toBeNull();
    expect(cleanInviteLabel('x'.repeat(25))).toBeNull();
  });

  it('safely bounds older saved-chart names for an invitation', () => {
    const longName = savedChart();
    longName.name = `  ${'A'.repeat(30)}  `;
    expect(deriveInviteChartFromSyncedPayload(longName)?.label).toBe('A'.repeat(24));
  });
});
