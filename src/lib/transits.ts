/**
 * Phrasing for transits: the current sky acting on a natal chart.
 * Framework-free and engine-free — the transit tool feeds it aspects it
 * already found via findInterAspects, so this stays in the eager bundle
 * without pulling the ephemeris along.
 *
 * The synastry glosses in compat.ts are voiced for two people; a moving
 * planet pressing on a fixed point of one chart needs its own register,
 * so only BODY_ROLE is shared.
 */
import { BODY_ROLE } from './compat';
import type { TodayContact } from './today';

/** Max orb, in degrees, for a transit to count as active. */
export const TRANSIT_ORB = 3;

/**
 * What each transiting planet brings while it passes, sized to how long
 * the pass actually lasts — hours for the Moon, years for Pluto.
 */
const MOVER: Record<string, string> = {
  Sun: 'a few days of spotlight',
  Moon: 'a few hours of weather',
  Mercury: 'a busy stretch for messages and errands',
  Venus: 'a soft stretch of warmth and appetite',
  Mars: 'a charged stretch of heat and urgency',
  Jupiter: 'a generous stretch of confidence',
  Saturn: 'a long season of pressure and accounting',
  Uranus: 'a jolt of disruption that repeats for months',
  Neptune: 'a slow fog of longing and blur',
  Pluto: 'a years-long excavation',
};

const ASPECT_VERB: Record<string, { verb: string; gloss: string }> = {
  conjunction: {
    verb: 'sits on',
    gloss: 'and for a while it colors everything there',
  },
  sextile: {
    verb: 'opens a door for',
    gloss: 'an opening that rewards you if you take it',
  },
  square: {
    verb: 'pushes against',
    gloss: 'friction that will not resolve on its own',
  },
  trine: {
    verb: 'flows through',
    gloss: 'help that arrives without being asked',
  },
  opposition: {
    verb: 'stands opposite',
    gloss: 'a tension best met head-on rather than absorbed',
  },
};

/**
 * One readable sentence for a transit: transiting `transiting` makes
 * `type` to natal `natal`. "Saturn pushes against your emotional life —
 * a long season of pressure and accounting, friction that will not
 * resolve on its own."
 */
export function transitLine(transiting: string, type: string, natal: string): string {
  const role = BODY_ROLE[natal] ?? `natal ${natal}`;
  const mover = MOVER[transiting];
  const phrase = ASPECT_VERB[type];
  if (!phrase || !mover) return `${transiting} aspects your ${role}.`;
  return `${transiting} ${phrase.verb} your ${role} — ${mover}, ${phrase.gloss}.`;
}

/** Compact, reproducible evidence for a saved daily contact. */
export function contactReceipt(contact: TodayContact): string {
  const point = contact.natal === 'Ascendant'
    ? 'ASC'
    : contact.natal === 'Midheaven'
      ? 'MC'
      : contact.natal;
  return `${contact.transiting}${contact.transitingRetrograde ? ' Rx' : ''} ${contact.type} natal ${point}${contact.natalRetrograde ? ' Rx' : ''} · ${contact.orb.toFixed(1)}° from exact`;
}
