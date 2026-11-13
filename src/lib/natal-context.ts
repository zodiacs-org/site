/**
 * Beginner-first placement context for the chart inspector.
 *
 * This module is deliberately pure: it turns chart facts into a stable
 * What / How / Where / Why hierarchy without knowing anything about the DOM.
 * Authored interpretation remains English-only; localized chart chrome lives
 * with the consuming component.
 */
import type { BodyName } from './engine/types';
import { NATAL_HOUSE_THEME } from './natal';
import { signBySlug, type Sign } from './signs';
import { signTagline } from './sign-display';

interface BodyTheme {
  what: string;
  topic: string;
}

/** The plain-language role of every selectable natal body. */
export const NATAL_BODY_THEME: Readonly<Record<BodyName, BodyTheme>> = Object.freeze({
  Sun: {
    what: 'The Sun represents identity, vitality, and the direction you grow into over time.',
    topic: 'identity and direction',
  },
  Moon: {
    what: 'The Moon represents emotional needs, instinctive reactions, memory, and what helps you feel safe.',
    topic: 'emotional needs and instincts',
  },
  Mercury: {
    what: 'Mercury represents how you think, learn, speak, and make sense of what is happening.',
    topic: 'thinking and communication',
  },
  Venus: {
    what: 'Venus represents attraction, affection, taste, pleasure, and how you create harmony with other people.',
    topic: 'affection, pleasure, and values',
  },
  Mars: {
    what: 'Mars represents drive, desire, anger, courage, and how you act when something matters.',
    topic: 'drive and self-assertion',
  },
  Jupiter: {
    what: 'Jupiter represents growth, confidence, belief, opportunity, and where you look for a wider horizon.',
    topic: 'growth and belief',
  },
  Saturn: {
    what: 'Saturn represents limits, responsibility, patience, and the skills you build through sustained effort.',
    topic: 'responsibility and long-term growth',
  },
  Uranus: {
    what: 'Uranus represents independence, disruption, invention, and the part of you that resists an inherited script.',
    topic: 'independence and change',
  },
  Neptune: {
    what: 'Neptune represents imagination, ideals, longing, sensitivity, and the places where boundaries can blur.',
    topic: 'imagination and ideals',
  },
  Pluto: {
    what: 'Pluto represents power, compulsion, release, and the slow changes that remake something from the roots.',
    topic: 'power and deep change',
  },
  'North Node': {
    what: 'The North Node is a calculated point where the Moon’s orbit crosses the Sun’s apparent path. Modern astrology treats it as a direction of growth, not a fixed destiny.',
    topic: 'a direction of growth',
  },
  'South Node': {
    what: 'The South Node is the calculated point exactly opposite the North Node. Modern astrology associates it with familiar patterns and existing strengths, not a fixed past or destiny.',
    topic: 'familiar patterns and existing strengths',
  },
});

export interface PlacementContext {
  what: string;
  how: string;
  where: string;
  synthesis: string;
  /** Present only when the signed speed needs a beginner explanation. */
  motionNote?: string;
}

const ORDINAL = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
] as const;

function isNode(body: BodyName): body is 'North Node' | 'South Node' {
  return body === 'North Node' || body === 'South Node';
}

function signContext(sign: Sign): string {
  const essence = signTagline(sign);
  return `In ${sign.name}, it takes on a ${sign.modality} ${sign.element} style. ${essence}`;
}

function houseContext(house: number | null): string {
  if (house == null) {
    return 'A birth time is needed to place it in a house, so this chart cannot say which area of life carries it.';
  }
  const theme = NATAL_HOUSE_THEME[house];
  if (!theme) return `It falls in house ${house}, the life area where this placement is most likely to show up.`;
  return `The ${ORDINAL[house] ?? `${house}th`} house brings it into ${theme}.`;
}

function motionContext(body: BodyName, speed: number | undefined): string | undefined {
  if (speed == null) return undefined;
  if (isNode(body)) {
    return speed < 0
      ? 'The negative speed is normal: lunar nodes usually move backward through the zodiac. Astrologers do not read this like a retrograde planet.'
      : 'The true node can briefly move forward. That motion does not make it a planet or make this interpretation stronger.';
  }
  if (speed >= 0) return undefined;
  return `${body} appeared to move backward from Earth when you were born. Astrology calls this retrograde; the planet did not reverse its orbit.`;
}

/**
 * Explain one placement from the body outward: role, sign style, house area,
 * then a deliberately non-deterministic synthesis. `speed` is optional so
 * callers without motion data can use the same pure context.
 */
export function placementContext(
  body: BodyName,
  signSlug: string,
  house: number | null,
  speed?: number,
): PlacementContext {
  const theme = NATAL_BODY_THEME[body];
  const sign = signBySlug(signSlug);
  const location = houseContext(house);
  const housePhrase = house == null
    ? 'The missing birth time means the life area remains open.'
    : `The ${ORDINAL[house] ?? `${house}th`} house shows the life area where that pattern is most visible.`;
  const synthesis = isNode(body)
    ? `${sign.name} describes the style of ${theme.topic}. ${housePhrase} This is a symbolic lens, not a prediction or fixed destiny.`
    : `${sign.name} shapes your ${theme.topic}; ${housePhrase} It describes a tendency, not a guarantee of what will happen.`;

  return {
    what: theme.what,
    how: signContext(sign),
    where: location,
    synthesis,
    motionNote: motionContext(body, speed),
  };
}
