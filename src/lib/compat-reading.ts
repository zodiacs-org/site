/**
 * The Sun-sign pattern behind a pairing, laid out for the English pair
 * page: the strip under the hero and the open "Why it reads this way"
 * panel. Labels and notes are compat.ts's own wording, unchanged.
 */
import { pairFacts, type PairFacts } from './compat';
import { ELEMENT_LABEL, MODALITY_LABEL, type Sign } from './signs';

interface PatternNote {
  /** The short name compat.ts gives the combination ("Shared heat"). */
  label: string;
  /** What the combination tends to be like, without a verdict. */
  note: string;
}

/** The figure each sign panel shows, for the art captions. */
export const SIGN_FIGURE: Record<string, string> = {
  aries: 'the ram',
  taurus: 'the bull',
  gemini: 'the twins',
  cancer: 'the crab',
  leo: 'the lion',
  virgo: 'the maiden',
  libra: 'the scales',
  scorpio: 'the scorpion',
  sagittarius: 'the archer',
  capricorn: 'the sea-goat',
  aquarius: 'the water bearer',
  pisces: 'the fish',
};

/**
 * Where each sign panel's figure shows its face or emblem, as a percentage
 * of the unmirrored 3:2 picture. The close details zoom in around it.
 */
export const SIGN_ART_DETAIL: Record<string, { x: number; y: number; zoom: number }> = {
  aries: { x: 35, y: 42, zoom: 2.05 },
  taurus: { x: 36, y: 44, zoom: 2 },
  gemini: { x: 46, y: 40, zoom: 1.8 },
  cancer: { x: 40, y: 50, zoom: 1.8 },
  leo: { x: 37, y: 44, zoom: 2.05 },
  virgo: { x: 42, y: 40, zoom: 2 },
  libra: { x: 36, y: 40, zoom: 1.9 },
  scorpio: { x: 42, y: 50, zoom: 1.8 },
  sagittarius: { x: 40, y: 42, zoom: 1.9 },
  capricorn: { x: 39, y: 42, zoom: 2 },
  aquarius: { x: 38, y: 44, zoom: 1.9 },
  pisces: { x: 46, y: 46, zoom: 1.8 },
};

const lower = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/** "Mars", "the Sun", "the Moon": a ruler as a sentence names it. */
export function rulerName(ruler: string): string {
  return ruler === 'Sun' || ruler === 'Moon' ? `the ${ruler}` : ruler;
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export interface PairPattern {
  facts: PairFacts;
  /** "Both fire" / "Fire and earth". */
  element: string;
  /** "Fire and fire": the panel always names both. */
  elementPair: string;
  elementNote: string;
  elementLabel: string;
  /** "fire with fire", for the hero kicker. */
  elementPhrase: string;
  /** "Both cardinal" / "Cardinal and fixed". */
  modality: string;
  modalityPair: string;
  modalityNote: string;
  modalityLabel: string;
  polarity: string;
  polarityNote: string;
  /** "Mars and the Sun" / "Both ruled by Venus". */
  rulers: string;
}

/** The pattern behind a pairing, worded for the English pair page. */
export function pairPattern(slugA: string, slugB: string): PairPattern {
  const facts = pairFacts(slugA, slugB);
  const { a, b } = facts;
  const element = facts.element;
  const modality = facts.modality;
  const [polarityValue, ...polarityRest] = facts.polarity.split(': ');
  const polarityText = polarityRest.join(': ');
  const polarity = { value: polarityValue, note: capitalise(polarityText) };
  const el = (s: Sign) => ELEMENT_LABEL[s.element];
  const mo = (s: Sign) => MODALITY_LABEL[s.modality];
  return {
    facts,
    element: a.element === b.element ? `Both ${lower(el(a))}` : `${el(a)} and ${lower(el(b))}`,
    elementPair: `${el(a)} and ${lower(el(b))}`,
    elementLabel: element.label,
    elementNote: `${element.label}. ${element.note}`,
    elementPhrase: `${lower(el(a))} with ${lower(el(b))}`,
    modality: a.modality === b.modality ? `Both ${lower(mo(a))}` : `${mo(a)} and ${lower(mo(b))}`,
    modalityPair: `${mo(a)} and ${lower(mo(b))}`,
    modalityLabel: modality.label,
    modalityNote: `${modality.label}. ${modality.note}`,
    polarity: polarity.value,
    polarityNote: polarity.note,
    rulers: a.ruler === b.ruler
      ? `Both ruled by ${rulerName(a.ruler)}`
      : `${capitalise(rulerName(a.ruler))} and ${rulerName(b.ruler)}`,
  };
}

