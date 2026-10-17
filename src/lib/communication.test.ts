import { describe, expect, it } from 'vitest';
import { computeChart } from './engine/full';
import type { Aspect, BodyName, BodyPosition, Chart } from './engine/types';
import {
  MERCURY_ADDENDA,
  MERCURY_ASPECT,
  MERCURY_SIGN,
  MARS_SIGN,
  communicationRead,
} from './communication';
import { MOON } from './interpretations';

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

function body(bodyName: BodyName, lon: number, retrograde = false): BodyPosition {
  return { body: bodyName, lon, lat: 0, speed: retrograde ? -1 : 1, retrograde };
}

function aspect(a: BodyName, b: BodyName, type: Aspect['type'], orb: number): Aspect {
  return { a, b, type, orb, applying: false };
}

function chart({
  mercuryLon = 0,
  moonLon = 0,
  marsLon = 0,
  mercuryRetrograde = false,
  aspects = [],
  includeMercury = true,
}: {
  mercuryLon?: number;
  moonLon?: number;
  marsLon?: number;
  mercuryRetrograde?: boolean;
  aspects?: Aspect[];
  includeMercury?: boolean;
} = {}): Chart {
  return {
    // These corpus fixtures supply a settled sign explicitly.
    moonSignCandidates: [SIGNS[Math.floor(moonLon / 30)]],
    input: { utc: new Date('2000-01-01T00:00:00Z'), houseSystem: 'whole', timeKnown: false },
    bodies: [
      ...(includeMercury ? [body('Mercury', mercuryLon, mercuryRetrograde)] : []),
      body('Moon', moonLon),
      body('Mars', marsLon),
    ],
    angles: null,
    houses: null,
    aspects,
    flags: ['no-time'],
    engineVersion: 'test',
  };
}

describe('communication corpus', () => {
  it('contains every sign and all seven soft/hard aspect pairs', () => {
    expect(Object.keys(MERCURY_SIGN)).toEqual(SIGNS);
    expect(Object.keys(MOON)).toEqual(SIGNS);
    expect(Object.keys(MARS_SIGN)).toEqual(SIGNS);
    expect(Object.keys(MERCURY_SIGN)).toHaveLength(12);
    expect(Object.keys(MARS_SIGN)).toHaveLength(12);
    expect(Object.keys(MERCURY_ASPECT)).toEqual([
      'Moon', 'Mars', 'Saturn', 'Jupiter', 'Uranus', 'Neptune', 'Pluto',
    ]);
    for (const pair of Object.values(MERCURY_ASPECT)) {
      expect(Object.keys(pair)).toEqual(['soft', 'hard']);
    }
  });
});

describe('Mercury addendum precedence', () => {
  it('reads Virgo as exaltation rather than domicile', () => {
    expect(communicationRead(chart({ mercuryLon: 150 })).mercuryAddendum)
      .toBe(MERCURY_ADDENDA.exaltation);
  });

  it('reads Pisces as fall rather than detriment', () => {
    expect(communicationRead(chart({ mercuryLon: 330 })).mercuryAddendum)
      .toBe(MERCURY_ADDENDA.fall);
  });

  it('keeps the non-colliding domicile and detriment conditions', () => {
    expect(communicationRead(chart({ mercuryLon: 60 })).mercuryAddendum)
      .toBe(MERCURY_ADDENDA.domicile);
    expect(communicationRead(chart({ mercuryLon: 240 })).mercuryAddendum)
      .toBe(MERCURY_ADDENDA.detriment);
  });

  it('appends retrograde after dignity and also works alone', () => {
    expect(communicationRead(chart({ mercuryLon: 150, mercuryRetrograde: true })).mercuryAddendum)
      .toBe(`${MERCURY_ADDENDA.exaltation} ${MERCURY_ADDENDA.retrograde}`);
    expect(communicationRead(chart({ mercuryLon: 0, mercuryRetrograde: true })).mercuryAddendum)
      .toBe(MERCURY_ADDENDA.retrograde);
  });
});

describe('Mercury aspect selection', () => {
  it('handles both pair orientations, sorts a copy by orb, and caps at three', () => {
    const source = [
      aspect('Mercury', 'Pluto', 'opposition', 4),
      aspect('Mercury', 'Venus', 'sextile', 0.1),
      aspect('Moon', 'Mercury', 'conjunction', 0.4),
      aspect('Mercury', 'Mars', 'square', 2),
      aspect('Jupiter', 'Mercury', 'trine', 1.1),
    ];
    const original = [...source];

    expect(communicationRead(chart({ aspects: source })).aspects.map(({ text }) => text)).toEqual([
      MERCURY_ASPECT.Moon.soft,
      MERCURY_ASPECT.Jupiter.soft,
      MERCURY_ASPECT.Mars.hard,
    ]);
    expect(communicationRead(chart({ aspects: source })).aspects[0]).toEqual({
      target: 'Moon',
      type: 'conjunction',
      orb: 0.4,
      text: MERCURY_ASPECT.Moon.soft,
    });
    expect(source).toEqual(original);
  });

  it('classifies conjunction, trine, and sextile as soft; square and opposition as hard', () => {
    for (const type of ['conjunction', 'trine', 'sextile'] as const) {
      expect(communicationRead(chart({ aspects: [aspect('Mercury', 'Mars', type, 1)] })).aspects.map(({ text }) => text))
        .toEqual([MERCURY_ASPECT.Mars.soft]);
    }
    for (const type of ['square', 'opposition'] as const) {
      expect(communicationRead(chart({ aspects: [aspect('Mars', 'Mercury', type, 1)] })).aspects.map(({ text }) => text))
        .toEqual([MERCURY_ASPECT.Mars.hard]);
    }
  });

  it('returns no aspect lines without Mercury', () => {
    expect(communicationRead(chart({
      includeMercury: false,
      aspects: [aspect('Moon', 'Mercury', 'square', 0.2)],
    })).aspects).toEqual([]);
  });

  it('adds the Moon reading and placement slugs for all three roles', () => {
    const read = communicationRead(chart({ mercuryLon: 0, moonLon: 95, marsLon: 185 }));
    expect(read.mercurySign).toBe('aries');
    expect(read.moonSign).toBe('cancer');
    expect(read.marsSign).toBe('libra');
    expect(read.moon).toBe(MOON.cancer);
  });
});

describe('canonical fixture', () => {
  it('matches Frida Kahlo’s full communication read', () => {
    const kahlo = computeChart({
      utc: new Date('1907-07-06T15:06:36.000Z'),
      latitude: 19.35,
      longitude: -99.16,
      houseSystem: 'whole',
      timeKnown: true,
      flags: ['lmt'],
    });

    expect(communicationRead(kahlo)).toMatchInlineSnapshot(`
      {
        "aspects": [],
        "mars": "Anger gets processed like everything else: privately, on a schedule, converted into distance or doubled workload. The people close to you would rather have the sentence than the silence.",
        "marsSign": "capricorn",
        "mercury": "You communicate like a performance with an audience of one: warm, committed, a story where a sentence would do. It works because you mean it; flattery without conviction reads as static to you.",
        "mercuryAddendum": null,
        "mercurySign": "leo",
        "moon": "You settle yourself through the senses: food, comfort, routine, one unhurried evening. Emotional safety means knowing nothing important will change without warning.",
        "moonSign": "taurus",
      }
    `);
  });
});
