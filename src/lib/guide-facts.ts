/**
 * The sign guide's quick facts, from the canonical sign table and the
 * shared lore: every note is a fixed fact about the sign's element,
 * modality, polarity, ruler or principal star, worded once here.
 */
import type { Modality, Sign } from './signs';

/** From each sign guide's FAQ answer about its modality. */
const MODALITY_NOTE: Record<Modality, string> = {
  cardinal: 'Opens a season',
  fixed: 'Holds the middle of a season',
  mutable: 'Closes a season',
};

/** From the opening line of each planet's Learn page. */
const RULER_NOTE: Record<string, string> = {
  Sun: 'Identity, vitality, direction',
  Moon: 'Emotional needs, instincts, habits',
  Mercury: 'How you think, speak, and process',
  Venus: 'Love, attraction, taste, value',
  Mars: 'Drive, desire, conflict style',
  Jupiter: 'Growth, opportunity, belief',
  Saturn: 'Structure, consequences, earned results',
  Uranus: 'Disruption, independence, invention',
  Neptune: 'Imagination, idealism, escape',
  Pluto: 'Power, depth, transformation',
};

/** From the glossary's day sign and night sign entries. */
const POLARITY_NOTE = { day: 'Outward-facing', night: 'Inward-facing' } as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

export interface GuideFacts {
  /** 'March 21 to April 19'. */
  longRange: string;
  modalityNote: string;
  rulerNote: string;
  polarityNote: string;
  starNote: string;
}

export function guideFacts(sign: Sign, star: { name: string; note: string }): GuideFacts {
  const ruler = RULER_NOTE[sign.ruler];
  if (!ruler) throw new Error(`guideFacts: no note for ruler ${sign.ruler}`);
  // The lore's star note runs "“head of the ram” — α Arietis"; the guide
  // keeps the plain gloss before the dash.
  const gloss = star.note.split(/\s+[—–]\s+/u)[0].replace(/[“”"]/gu, '').trim();
  return {
    longRange: `${MONTHS[sign.start[0] - 1]} ${sign.start[1]} to ${MONTHS[sign.end[0] - 1]} ${sign.end[1]}`,
    modalityNote: MODALITY_NOTE[sign.modality],
    rulerNote: sign.classicRuler ? `Traditionally ${sign.classicRuler}` : ruler,
    polarityNote: POLARITY_NOTE[sign.polarity],
    starNote: gloss.charAt(0).toUpperCase() + gloss.slice(1),
  };
}

/** 'first' for index 0 (Aries) through 'twelfth' for Pisces. */
export function signOrdinal(index: number): string {
  const word = ORDINALS[index];
  if (!word) throw new Error(`signOrdinal: no sign at ${index}`);
  return word;
}

/** 'The Ram' from the lore epithet 'The Ram. Where the year begins.' */
export function signFigure(epithet: string): string {
  return epithet.split('.')[0].trim();
}

/** Whole minutes at 230 words a minute, counting prose words only. */
export function guideReadingMinutes(body: string, extra: readonly string[] = []): number {
  const prose = [body, ...extra]
    .join(' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\]\([^)]*\)/gu, ']')
    .replace(/[#*_[\]`>-]/gu, ' ');
  const words = prose.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.max(1, Math.round(words / 230));
}
