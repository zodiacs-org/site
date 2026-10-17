import { describe, expect, it } from 'vitest';
import type { Aspect, BodyName, BodyPosition, Chart } from './engine/types';
import { chartSignature } from './chart-signature';
import { signForLongitude } from './signs';

function body(bodyName: BodyName, lon: number): BodyPosition {
  return { body: bodyName, lon, lat: 0, speed: 1, retrograde: false };
}

function aspect(a: BodyName, b: BodyName, type: Aspect['type'], orb: number): Aspect {
  return { a, b, type, orb, applying: false };
}

function chart(
  bodies: BodyPosition[],
  options: { aspects?: Aspect[]; rising?: number | null } = {},
): Pick<Chart, 'bodies' | 'angles' | 'aspects' | 'moonSignCandidates'> {
  const rising = options.rising === undefined ? null : options.rising;
  return {
    bodies,
    // Ranking fixtures assume a settled Moon; unknown-time evidence has its own suite.
    moonSignCandidates: bodies.filter((body) => body.body === 'Moon').map((body) => signForLongitude(body.lon).slug),
    angles: rising == null ? null : {
      asc: rising,
      dsc: (rising + 180) % 360,
      mc: (rising + 90) % 360,
      ic: (rising + 270) % 360,
    },
    aspects: options.aspects ?? [],
  };
}

describe('chartSignature', () => {
  it('uses a supported dignity when there is no tighter positive aspect', () => {
    const signature = chartSignature(chart([
      body('Mercury', 150), // Virgo, exaltation
      body('Sun', 40),
    ]));

    expect(signature).toMatchObject({
      kind: 'dignity',
      title: 'Mercury in Virgo',
      detail: 'exaltation',
      signSlugs: ['virgo'],
      bodies: ['Mercury'],
    });
    expect(`${signature.title} ${signature.summary}`).not.toMatch(/rare|destiny|will happen/i);
  });

  it('prioritizes a tight supportive personal aspect over dignity', () => {
    const signature = chartSignature(chart([
      body('Mercury', 150),
      body('Sun', 40),
    ], {
      aspects: [aspect('Mercury', 'Sun', 'trine', 0.1)],
    }));

    expect(signature.kind).toBe('aspect');
    expect(signature.title).toBe('Mercury trine Sun');
  });

  it('selects a tight flowing personal aspect when no planet is supported by dignity', () => {
    const signature = chartSignature(chart([
      body('Sun', 40),
      body('Moon', 65),
      body('Mars', 130),
    ], {
      aspects: [
        aspect('Moon', 'Mars', 'sextile', 1.4),
        aspect('Sun', 'Mars', 'trine', 0.8),
      ],
    }));

    expect(signature.kind).toBe('aspect');
    expect(signature.title).toBe('Sun trine Mars');
    expect(signature.detail).toBe('0.8° orb');
    expect(signature.summary).toMatch(/Your Sun.*your Mars/i);
    expect(signature.summary).toContain('Purpose and action can reinforce each other');
  });

  it('finds a sign stellium before whole-chart balance', () => {
    const signature = chartSignature(chart([
      body('Uranus', 301),
      body('Neptune', 307),
      body('Pluto', 318),
    ]));

    expect(signature).toMatchObject({
      kind: 'stellium',
      title: '3-planet Aquarius stellium',
      signSlugs: ['aquarius'],
      bodies: ['Uranus', 'Neptune', 'Pluto'],
    });
  });

  it('allows only explicitly curated positive conjunctions into the brag slot', () => {
    const bodies = [body('Sun', 40), body('Moon', 42), body('Saturn', 44)];
    const positive = chartSignature(chart(bodies, {
      aspects: [aspect('Moon', 'Sun', 'conjunction', 0.4)],
    }));
    const unsafe = chartSignature(chart(bodies, {
      aspects: [aspect('Moon', 'Saturn', 'conjunction', 0.2)],
    }));

    expect(positive).toMatchObject({ kind: 'aspect', title: 'Sun conjunction Moon' });
    expect(unsafe.kind).not.toBe('aspect');
  });

  it('does not promote a lunar-node contact as a personal-planet advantage', () => {
    const signature = chartSignature(chart([
      body('Sun', 40),
      body('Moon', 70),
      body('North Node', 130),
    ], {
      aspects: [aspect('Sun', 'North Node', 'trine', 0.1)],
    }));

    expect(signature.kind).not.toBe('aspect');
  });

  it('uses a uniquely dominant element when there is no tighter signature', () => {
    const signature = chartSignature(chart([
      body('Sun', 250),
      body('Moon', 130),
      body('Mercury', 10),
      body('Venus', 140),
      body('Jupiter', 40),
      body('Saturn', 160),
      body('Mars', 70),
      body('Uranus', 190),
      body('Neptune', 220),
      body('Pluto', 340),
    ]));

    expect(signature.kind).toBe('element');
    expect(signature.title).toBe('Fire leads the chart');
    expect(signature.detail).toBe('4 of 10 planets');
  });

  it('uses modality only when no element reaches the threshold', () => {
    const signature = chartSignature(chart([
      body('Sun', 100),
      body('Moon', 190),
      body('Mercury', 280),
      body('Venus', 110),
      body('Mars', 200),
      body('Jupiter', 40),
      body('Saturn', 220),
      body('Uranus', 70),
      body('Neptune', 250),
      body('Pluto', 160),
    ]));

    expect(signature.kind).toBe('modality');
    expect(signature.title).toBe('Cardinal energy leads');
    expect(signature.detail).toBe('5 of 10 planets');
  });

  it('falls back to an honest Big Three fingerprint', () => {
    const signature = chartSignature(chart([
      body('Sun', 40),
      body('Moon', 70),
    ], { rising: 190 }));

    expect(signature).toMatchObject({
      kind: 'big-three',
      title: 'Taurus Sun · Gemini Moon · Libra Rising',
      detail: 'Your Big Three',
      signSlugs: ['taurus', 'gemini', 'libra'],
    });
  });

  it('depends only on computed chart evidence', () => {
    const signature = chartSignature(chart([body('Sun', 40), body('Moon', 70)]));
    const serialized = JSON.stringify(signature);

    expect(serialized).not.toMatch(/1990|08:30|New York|latitude|longitude|coordinates/i);
  });
});
