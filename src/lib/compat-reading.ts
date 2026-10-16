/**
 * How the English pair pages word the Sun-sign pattern behind a pairing:
 * the one-line strip under the hero, the open "Why it reads this way"
 * panel and the questions a pair page derives when its file lists none.
 *
 * The labels are compat.ts's; the notes are its notes rephrased as
 * description rather than verdict ("tends to", "can"), the register the
 * pair pages read in since the October 2026 redesign. compat.ts keeps its
 * own wording for the calculator and the assistant tools, which read it.
 */
import { pairFacts, type PairFacts } from './compat';
import { ELEMENT_LABEL, MODALITY_LABEL, type Sign } from './signs';

interface PatternNote {
  /** The short name compat.ts gives the combination ("Shared heat"). */
  label: string;
  /** What the combination tends to be like, without a verdict. */
  note: string;
}

const ELEMENT_READING: Record<string, PatternNote> = {
  'fire+fire': { label: 'Shared heat', note: 'quick chemistry, quick sparks, and usually quick repair.' },
  'earth+fire': { label: 'Spark and soil', note: 'fire tends to start and earth to finish, so a lot can get done, and pace is the usual question.' },
  'air+fire': { label: 'Oxygen', note: 'air tends to fan the flames, with lively talk, big plans and a quick pace.' },
  'fire+water': { label: 'Steam', note: 'passion meets feeling. The pull can be strong, and tempers and moods can run high, so patience tends to help.' },
  'earth+earth': { label: 'Bedrock', note: 'steady and loyal, often building something solid, with routine as the thing to watch.' },
  'air+earth': { label: 'Idea and estimate', note: 'ideas meet practicality. Each can balance the other, and one may find the other too dreamy or too cautious.' },
  'earth+water': { label: 'River and bank', note: 'water tends to soften earth and earth gives water shape, and trust often grows slowly and deeply.' },
  'air+air': { label: 'Crosswind', note: 'often friends first, with long conversations and plenty of freedom, while deep feelings can go unspoken.' },
  'air+water': { label: 'Naming the weather', note: 'head meets heart. Air tends to talk it through and water to feel it, and patience helps with the gap between.' },
  'water+water': { label: 'Deep water', note: 'two people who often read each other quickly and feel each other’s moods.' },
};

const MODALITY_READING: Record<string, PatternNote> = {
  'cardinal+cardinal': { label: 'Two starters', note: 'Plenty of drive, and the question of who leads tends to come up often.' },
  'cardinal+fixed': { label: 'Starter and keeper', note: 'One tends to begin things, the other to sustain them; agreeing on direction helps both.' },
  'cardinal+mutable': { label: 'Starter and adapter', note: 'One tends to lead and the other to adapt, which often leaves little to struggle over.' },
  'fixed+fixed': { label: 'Two anchors', note: 'Two loyal, steady signs; in an argument, neither tends to back down first.' },
  'fixed+mutable': { label: 'Anchor and sail', note: 'Stability meets flexibility, and each can balance the other.' },
  'mutable+mutable': { label: 'Two sails', note: 'Easygoing and adaptable, with few fights, though decisions can drift.' },
};

const POLARITY_READING = {
  day: { value: 'Both outgoing', note: 'An active, social pair that tends to recharge around people.' },
  night: { value: 'Both private', note: 'A quieter pair that tends to feel things deeply and to value time alone together.' },
  mixed: { value: 'One outgoing, one private', note: 'One tends to talk it out and the other to think it through, and each can balance the other.' },
} as const;

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

function comboKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

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
  const element = ELEMENT_READING[comboKey(a.element, b.element)];
  const modality = MODALITY_READING[comboKey(a.modality, b.modality)];
  const polarity = a.polarity === b.polarity ? POLARITY_READING[a.polarity] : POLARITY_READING.mixed;
  const el = (s: Sign) => ELEMENT_LABEL[s.element];
  const mo = (s: Sign) => MODALITY_LABEL[s.modality];
  return {
    facts,
    element: a.element === b.element ? `Both ${lower(el(a))}` : `${el(a)} and ${lower(el(b))}`,
    elementPair: `${el(a)} and ${lower(el(b))}`,
    elementLabel: element.label,
    elementNote: `${element.label}: ${element.note}`,
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

/**
 * The questions a pair page answers when its file lists none: the same
 * pattern, asked plainly, with no score and no verdict.
 */
export function derivedPairQuestions(slugA: string, slugB: string): { q: string; a: string }[] {
  const pattern = pairPattern(slugA, slugB);
  const { a, b, same } = pattern.facts;
  const names = same ? `two ${a.name} people` : `${a.name} and ${b.name}`;
  const element = ELEMENT_READING[comboKey(a.element, b.element)];
  const modality = MODALITY_READING[comboKey(a.modality, b.modality)];
  const questions = [
    {
      q: `How do ${names} tend to get along?`,
      a: `${element.label} is the starting pattern: ${element.note} The rest of both birth charts shapes how that pattern is lived.`,
    },
    {
      q: `Where do ${names} tend to clash?`,
      a: `${modality.label} describes how decisions and pacing meet. ${modality.note}`,
    },
    {
      q: `Are ${names} compatible?`,
      a: `We don’t score pairings or say how a relationship turns out. Sun signs describe a starting pattern, not a verdict about two people. ${pattern.polarity}: ${lower(pattern.polarityNote)} A full chart comparison also reads both Moons, Venus and Mars, and the links between the two charts.`,
    },
  ];
  if (!same) {
    questions.push({
      q: `Is ${b.name} and ${a.name} the same as ${a.name} and ${b.name}?`,
      a: `Yes. It is the same pairing either way round, so this one page covers both orders. Each of you may notice different parts of it; the “What each may want to notice” card above reads it from both sides.`,
    });
  }
  return questions;
}
