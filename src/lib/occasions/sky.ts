/**
 * The sky at one moment, for an occasion card: where the Sun, Moon and
 * planets stand, which planets are retrograde, and the Moon's phase. Facts
 * only; the card's interpretation lines are chosen elsewhere.
 */
import { moonPhase, positions, type BodyName } from '@zodiacs/engine';

/** The bodies an occasion card names, in the order it names them. */
export const OCCASION_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const satisfies readonly BodyName[];
export type OccasionBody = (typeof OCCASION_BODIES)[number];

export interface OccasionBodyPlace {
  body: OccasionBody;
  /** Sign slug, as the rest of the site keys signs: 'gemini'. */
  sign: string;
  /** Degrees inside the sign, one decimal. */
  degree: number;
  retrograde: boolean;
}

export interface OccasionSkyFacts {
  instant: string;
  bodies: OccasionBodyPlace[];
  moon: {
    phase: string;
    /** Lit fraction of the disc, a whole percentage. */
    illuminationPercent: number;
    waxing: boolean;
  };
  /** Planets retrograde at the instant, in card order. */
  retrograde: OccasionBody[];
}

export function skyAt(instant: Date): OccasionSkyFacts {
  if (Number.isNaN(instant.getTime())) throw new RangeError('skyAt needs a valid instant.');
  const rows = positions(instant);
  const bodies = OCCASION_BODIES.map((body) => {
    const row = rows.find((candidate) => candidate.body === body);
    if (!row) throw new Error(`The engine returned no position for ${body}.`);
    return {
      body,
      sign: String(row.sign),
      degree: Math.round(row.degree * 10) / 10,
      retrograde: body !== 'Sun' && body !== 'Moon' && row.retrograde,
    };
  });
  const phase = moonPhase(instant);
  return {
    instant: instant.toISOString(),
    bodies,
    moon: {
      phase: phase.name,
      illuminationPercent: Math.round(phase.illumination * 100),
      waxing: phase.waxing,
    },
    retrograde: bodies.filter((row) => row.retrograde).map((row) => row.body),
  };
}
