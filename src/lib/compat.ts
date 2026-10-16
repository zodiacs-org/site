/**
 * Sign-to-sign compatibility facts and synastry phrasing. Pure data
 * composition over signs.ts — no engine imports, so pair pages compute
 * their panels at build time and the synastry island ships without the
 * ephemeris. Written in the interpretations.ts voice: dry, specific,
 * warm. The notes forecast in astrology's terms what a pairing tends to be
 * like; they never guarantee how a relationship turns out.
 */
import { SIGNS, SIGN_SLUGS, signBySlug } from './signs';
import type { Element, Modality, Sign } from './signs';

/** Canonical pair slug: both signs in zodiac order, joined with a hyphen. */
export function pairSlug(a: string, b: string): string {
  const ia = SIGN_SLUGS.indexOf(a);
  const ib = SIGN_SLUGS.indexOf(b);
  if (ia < 0 || ib < 0) throw new Error(`Unknown sign in pair: ${a}, ${b}`);
  return ia <= ib ? `${a}-${b}` : `${b}-${a}`;
}

/** All 78 canonical pairs (12 same-sign + 66 cross), zodiac order. */
export const ALL_PAIRS: readonly [string, string][] = SIGNS.flatMap((a, i) =>
  SIGNS.slice(i).map((b) => [a.slug, b.slug] as [string, string]),
);

export interface InteractionNote {
  label: string;
  note: string;
}

/** Unordered element-pair key, e.g. "air+fire". */
function comboKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

const ELEMENT_NOTES: Record<string, InteractionNote> = {
  'fire+fire': {
    label: 'Shared heat',
    note: 'You two run hot: fast chemistry, quick fights and even quicker make-ups. Expect plenty of excitement.',
  },
  'earth+fire': {
    label: 'Spark and soil',
    note: 'Fire starts, earth finishes: you’ll get a lot done together, but expect clashes over pace.',
  },
  'air+fire': {
    label: 'Oxygen',
    note: 'Air fans the flames: lively talk, big plans and a fun, fast-moving bond.',
  },
  'fire+water': {
    label: 'Steam',
    note: 'Passion meets feeling: intense attraction, but tempers and moods can boil over. This pair needs patience.',
  },
  'earth+earth': {
    label: 'Bedrock',
    note: 'Steady and loyal: you build something solid together, though romance can slip into routine.',
  },
  'air+earth': {
    label: 'Idea and estimate',
    note: 'Ideas meet practicality: you balance each other, but one may find the other too dreamy or too cautious.',
  },
  'earth+water': {
    label: 'River and bank',
    note: 'One of astrology’s best pairings: water softens earth, earth gives water shape, and deep trust grows.',
  },
  'air+air': {
    label: 'Crosswind',
    note: 'Best friends first: endless conversation and plenty of freedom, though deep feelings can go unspoken.',
  },
  'air+water': {
    label: 'Naming the weather',
    note: 'Head meets heart: air wants to talk it through, water wants to feel it. Expect misunderstandings unless you’re patient.',
  },
  'water+water': {
    label: 'Deep water',
    note: 'You read each other instantly: a deep, intuitive bond, and you’ll feel each other’s moods.',
  },
};

export function elementInteraction(a: Element, b: Element): InteractionNote {
  return ELEMENT_NOTES[comboKey(a, b)];
}

const MODALITY_NOTES: Record<string, InteractionNote> = {
  'cardinal+cardinal': {
    label: 'Two starters',
    note: 'Two leaders: plenty of drive, and regular battles over who’s in charge.',
  },
  'cardinal+fixed': {
    label: 'Starter and keeper',
    note: 'One starts, one sustains: a productive team once you agree on the direction.',
  },
  'cardinal+mutable': {
    label: 'Starter and adapter',
    note: 'One leads, one adapts: an easy partnership with few power struggles.',
  },
  'fixed+fixed': {
    label: 'Two anchors',
    note: 'Two loyal, stubborn signs: a lasting bond, but neither backs down in an argument.',
  },
  'fixed+mutable': {
    label: 'Anchor and sail',
    note: 'Stability meets flexibility: you balance each other well.',
  },
  'mutable+mutable': {
    label: 'Two sails',
    note: 'Easygoing and adaptable: few fights, but decisions can drift.',
  },
};

export function modalityInteraction(a: Modality, b: Modality): InteractionNote {
  return MODALITY_NOTES[comboKey(a, b)];
}

export function polarityNote(a: Sign, b: Sign): string {
  if (a.polarity === 'day' && b.polarity === 'day') {
    return 'Both outgoing: an active, social, high-energy pair.';
  }
  if (a.polarity === 'night' && b.polarity === 'night') {
    return 'Both private: a quiet, deeply felt bond that needs time alone together.';
  }
  return 'One outgoing, one private: you balance each other, as one talks it out and the other thinks it through.';
}

/** Everything the pair-page panel renders, computed from the sign table. */
export interface PairFacts {
  a: Sign;
  b: Sign;
  slug: string;
  same: boolean;
  element: InteractionNote;
  modality: InteractionNote;
  polarity: string;
}

export function pairFacts(slugA: string, slugB: string): PairFacts {
  const ordered = SIGN_SLUGS.indexOf(slugA) <= SIGN_SLUGS.indexOf(slugB);
  const a = signBySlug(ordered ? slugA : slugB);
  const b = signBySlug(ordered ? slugB : slugA);
  return {
    a,
    b,
    slug: `${a.slug}-${b.slug}`,
    same: a.slug === b.slug,
    element: elementInteraction(a.element, b.element),
    modality: modalityInteraction(a.modality, b.modality),
    polarity: polarityNote(a, b),
  };
}

// ── Synastry phrasing ─────────────────────────────────────────────────

export const BODY_ROLE: Record<string, string> = {
  Sun: 'sense of self',
  Moon: 'emotional life',
  Mercury: 'way of thinking',
  Venus: 'way of loving',
  Mars: 'drive',
  Jupiter: 'appetite for more',
  Saturn: 'sense of duty',
  Uranus: 'independence',
  Neptune: 'imagination',
  Pluto: 'intensity',
};

const ASPECT_PHRASE: Record<string, { verb: string; gloss: string }> = {
  conjunction: {
    verb: 'sits right on top of',
    gloss: 'you’ll feel this one strongly',
  },
  sextile: {
    verb: 'works easily with',
    gloss: 'an easy spark that grows when you use it',
  },
  square: {
    verb: 'pushes against',
    gloss: 'expect friction here, especially under stress',
  },
  trine: {
    verb: 'flows with',
    gloss: 'this flows naturally and brings out the best in you both',
  },
  opposition: {
    verb: 'pulls against',
    gloss: 'a strong pull that swings between attraction and tension',
  },
};

/**
 * One readable sentence for an inter-chart aspect. Names are whatever
 * the caller displays ("Ana", "Chart B", a sign name for sun-sign mode).
 */
export function synastryLine(
  aName: string,
  aBody: string,
  bName: string,
  bBody: string,
  type: string,
): string {
  const roleA = BODY_ROLE[aBody] ?? aBody.toLowerCase();
  const roleB = BODY_ROLE[bBody] ?? bBody.toLowerCase();
  const phrase = ASPECT_PHRASE[type];
  if (!phrase) return `${aName}’s ${roleA} meets ${bName}’s ${roleB}.`;
  const subject =
    aBody === bBody
      ? `${aName}’s ${roleA} ${phrase.verb} ${bName}’s`
      : `${aName}’s ${roleA} ${phrase.verb} ${bName}’s ${roleB}`;
  return `${subject} — ${phrase.gloss}.`;
}
