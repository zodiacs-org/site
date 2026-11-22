/**
 * The 78 cards of the standard tarot deck: 22 Major Arcana and four suits of 14. Names and order only; the
 * meanings are Zodiacs' own (./meanings.ts). Tarot is a separate practice from astrology, and nothing here maps a
 * card to a sign or a planet.
 */
export const SUITS = ['wands', 'cups', 'swords', 'pentacles'] as const;
export type Suit = typeof SUITS[number];
export type Arcana = 'major' | 'minor';

export interface TarotCard {
  /** A stable slug, such as the-fool or queen-of-cups. */
  id: string;
  name: string;
  arcana: Arcana;
  /** Null for the Major Arcana. */
  suit: Suit | null;
  /** 0 to 21 in the Major Arcana; 1 (Ace) to 14 (King) in a suit. */
  number: number;
}

const MAJOR = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant', 'The Lovers',
  'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
  'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World',
] as const;
const RANKS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'] as const;
const SUIT_NAMES: Record<Suit, string> = { wands: 'Wands', cups: 'Cups', swords: 'Swords', pentacles: 'Pentacles' };

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/gu, '-').replace(/^-|-$/gu, '');

export const TAROT_DECK: readonly TarotCard[] = Object.freeze([
  ...MAJOR.map((name, number): TarotCard => ({ id: slug(name), name, arcana: 'major', suit: null, number })),
  ...SUITS.flatMap((suit) => RANKS.map((rank, index): TarotCard => ({ id: `${slug(rank)}-of-${suit}`, name: `${rank} of ${SUIT_NAMES[suit]}`, arcana: 'minor', suit, number: index + 1 }))),
].map((card) => Object.freeze(card)));

/** What each suit is about, in the site's words, and the Major Arcana as a group. */
export const SUIT_THEMES: Readonly<Record<Suit | 'major', { name: string; theme: string }>> = Object.freeze({
  major: { name: 'Major Arcana', theme: 'The 22 named cards, from The Fool to The World. They stand for the larger turns in a life: beginnings, choices, endings and the lessons between them.' },
  wands: { name: 'Wands', theme: 'Drive, projects and initiative: what you start, what you are excited about, and what you push for.' },
  cups: { name: 'Cups', theme: 'Feelings and relationships: affection, friendship, disappointment, and what you hold close.' },
  swords: { name: 'Swords', theme: 'Thought, decisions and honesty: clear thinking, hard conversations, worry, and conflict.' },
  pentacles: { name: 'Pentacles', theme: 'Work, money and daily life: earning, skill, home, routine, and the patience of building something.' },
});
