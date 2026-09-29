import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import type { PairSummary } from '../../lib/engine/synastry';
import type { PositionsShareInput } from '../../lib/share-positions';
import { computeBodies } from '../../lib/engine/full';
import { decodeSynastryLink, encodeSynastryLink } from '../../lib/share-synastry';
import { imagePositions } from '../../lib/share-card';
import { SendBackCard, bigThreeCardSource, sendBackToken } from './SendBackExperience';

const BODY_NAMES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
] as const;

function positions(withAngles: boolean): PositionsShareInput {
  return {
    bodies: BODY_NAMES.map((body, index) => ({ body, lon: index * 27.5 })),
    angles: withAngles ? { asc: 48, mc: 312 } : null,
    houseSystem: 'whole',
    engineVersion: 'phase4-test',
  };
}

function person(label: string, withAngles: boolean) {
  const chart = positions(withAngles);
  return {
    label,
    bodies: chart.bodies.map((body) => ({ ...body })),
    asc: chart.angles?.asc ?? null,
    positions: chart,
  };
}

describe('Phase 4 send-back share surfaces', () => {
  it("offers B's Big Three card at an invitation completion without birth input", () => {
    const markup = render(h(SendBackCard, {
      a: person('Frida', true),
      b: person('Me', true),
      summary: {} as PairSummary,
      inviterLabel: 'Frida',
    }));

    expect(markup).toContain('Send the result back.');
    expect(markup).toContain('data-share-card-action="big-three"');
    expect(markup).toContain('Share the big three');
    expect(markup).not.toMatch(/birth date|birth time|birth place|latitude|longitude/i);
  });

  it('offers the same picture and positions-only link on a plain result, phrased as sending', () => {
    const markup = render(h(SendBackCard, {
      a: person('Me', true),
      b: person('Sam', true),
      summary: {} as PairSummary,
      inviterLabel: 'Sam',
      variant: 'share',
    }));

    expect(markup).toContain('Send this to Sam.');
    expect(markup).not.toContain('Send the result back.');
    expect(markup).toContain('Copy the private link');
    expect(markup).toContain('data-share-card-action="big-three"');
    expect(markup).not.toMatch(/birth date|birth time|birth place|latitude|longitude/i);
  });

  it('keeps the Big Three action absent for a no-time chart', () => {
    const markup = render(h(SendBackCard, {
      a: person('Frida', true),
      b: person('Me', false),
      summary: {} as PairSummary,
      inviterLabel: 'Frida',
    }));

    expect(markup).not.toContain('data-share-card-action="big-three"');
    expect(markup).not.toContain('Share the big three');
  });
});

describe('the send-back link', () => {
  const round = (lon: number) => {
    const value = Math.round(lon * 1000) / 1000;
    return value >= 360 ? 0 : value;
  };

  it('carries a side computed here without a birth time as the sky at 12:00 UTC on its date, and a received side unchanged', async () => {
    const received = person('Frida', false);
    const own = { ...person('Me', false), untimedDate: '1990-04-11' };
    const decoded = decodeSynastryLink((await sendBackToken(received, own))!)!;
    expect(decoded.sides[0].chart.bodies.map(({ lon }) => lon))
      .toEqual(received.positions.bodies.map(({ lon }) => round(lon)));
    // Not the chart's own positions (noon at the birthplace), which give the place away.
    const noonUtc = computeBodies(new Date('1990-04-11T12:00:00Z'));
    expect(decoded.sides[1].chart.bodies.map(({ body, lon }) => [body, lon]))
      .toEqual(BODY_NAMES.map((body) => [body, round(noonUtc.find((row) => row.body === body)!.lon)]));
    expect(decoded.sides.map(({ timeKnown }) => timeKnown)).toEqual([false, false]);
    expect(await sendBackToken(received, { ...own, untimedDate: '1990-02-30' })).toBeNull();
  });

  it('keeps sides with a birth time on a whole UTC minute, and received sides, as they are', async () => {
    const a = person('Frida', true);
    const b = { ...person('Me', true), utc: '1990-04-11T06:15:00.000Z' };
    expect(await sendBackToken(a, b)).toBe(encodeSynastryLink({
      sides: [{ chart: a.positions, label: a.label }, { chart: b.positions, label: b.label }],
    }));
  });

  it('carries a side computed here with a birth time whose instant has seconds at the whole minute', async () => {
    // Buffalo, 15 June 1870, 14:30 on its own mean time: 19:45:31 UTC.
    const received = person('Frida', true);
    const own = { ...person('Me', true), utc: '1870-06-15T19:45:31.000Z' };
    const decoded = decodeSynastryLink((await sendBackToken(received, own))!)!;
    expect(decoded.sides[0].chart.bodies.map(({ lon }) => lon))
      .toEqual(received.positions.bodies.map(({ lon }) => round(lon)));
    const minute = computeBodies(new Date('1870-06-15T19:46:00Z'));
    expect(decoded.sides[1].chart.bodies.map(({ body, lon }) => [body, lon]))
      .toEqual(BODY_NAMES.map((body) => [body, round(minute.find((row) => row.body === body)!.lon)]));
    // The angles stay the chart's, to the whole degree.
    expect(decoded.sides[1].chart.angles).toEqual({ asc: 48.5, mc: 312.5 });
    expect(await sendBackToken(received, { ...own, utc: 'not a date' })).toBeNull();
  });

  it('draws B’s Big Three card from a side computed here at its whole minute, as its link does', async () => {
    const utc = new Date('1870-06-15T19:45:31Z');
    const side = {
      ...person('Me', true),
      positions: { ...positions(true), bodies: computeBodies(utc).map(({ body, lon }) => ({ body, lon })) },
      utc,
    };
    expect((await imagePositions(bigThreeCardSource(side))).bodies).toEqual(computeBodies(new Date('1870-06-15T19:46:00Z')));
    // A received side brings no instant and is drawn as it arrived.
    const received = person('Them', true);
    expect((await imagePositions(bigThreeCardSource(received))).bodies).toEqual(received.positions.bodies);
  });
});
