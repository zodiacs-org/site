/**
 * The three spreads Zodiacs lays out: one card, three cards (past, present, future) and the Celtic Cross. The
 * position prompts are written for the site.
 */
export const SPREAD_IDS = ['one-card', 'three-card', 'celtic-cross'] as const;
export type SpreadId = typeof SPREAD_IDS[number];

export interface SpreadPosition {
  key: string;
  name: string;
  /** What to consider about the card in this place. */
  prompt: string;
}

export interface Spread {
  id: SpreadId;
  name: string;
  description: string;
  positions: readonly SpreadPosition[];
}

export const SPREADS: Readonly<Record<SpreadId, Spread>> = Object.freeze({
  'one-card': {
    id: 'one-card',
    name: 'One card',
    description: 'A single card to think with: a quick check-in, or a theme to carry through the day.',
    positions: [
      { key: 'focus', name: 'The card', prompt: 'What this card brings to mind about where you are right now.' },
    ],
  },
  'three-card': {
    id: 'three-card',
    name: 'Three cards: past, present, future',
    description: 'Three cards in a row. The first looks at what led here, the second at where things stand, and the third at where things are heading.',
    positions: [
      { key: 'past', name: 'Past', prompt: 'What has led to this point, and what you might still be carrying from it.' },
      { key: 'present', name: 'Present', prompt: 'Where things stand now, and what most needs your attention.' },
      { key: 'future', name: 'Future', prompt: 'Where things are heading if they carry on as they are.' },
    ],
  },
  'celtic-cross': {
    id: 'celtic-cross',
    name: 'Celtic Cross',
    description: 'Ten cards: a cross of six about the situation itself, and a staff of four beside it about you, the people around you, and where things are heading.',
    positions: [
      { key: 'heart', name: 'The heart of it', prompt: 'The centre of the situation as it stands.' },
      { key: 'crossing', name: 'What crosses it', prompt: 'The tension or obstacle laid across it, which may also be what the situation is asking you to work with.' },
      { key: 'foundation', name: 'Beneath', prompt: 'What lies underneath: roots, older causes, or what you have not quite said.' },
      { key: 'behind', name: 'Behind', prompt: 'What is passing, or recently passed, and still colouring things.' },
      { key: 'above', name: 'Above', prompt: 'What you are aiming for, or what seems possible at best.' },
      { key: 'ahead', name: 'Ahead', prompt: 'What comes into view next, and is worth preparing for.' },
      { key: 'self', name: 'You', prompt: 'How you are approaching this, and the part you play in it.' },
      { key: 'surroundings', name: 'Around you', prompt: 'The people, places and circumstances around you, and how they bear on it.' },
      { key: 'hopes-fears', name: 'Hopes and fears', prompt: 'What you hope for, what you are wary of, and where the two are the same thing.' },
      { key: 'direction', name: 'Where it leads', prompt: 'Where the whole spread points if things carry on as they are.' },
    ],
  },
});
