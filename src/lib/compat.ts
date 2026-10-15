/**
 * Sign-to-sign compatibility facts and synastry phrasing. Pure data
 * composition over signs.ts — no engine imports, so pair pages compute
 * their panels at build time and the synastry island ships without the
 * ephemeris. Written in the interpretations.ts voice: dry, specific,
 * warm, no verdicts pretending to be scores. The notes describe what the
 * tradition reads into a pairing; they never forecast how a relationship
 * goes (the AI compatibility tool shows them beside that promise).
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
    note: 'Two fire signs share a pace: quick to start, quick to forgive, and rarely short of energy.',
  },
  'earth+fire': {
    label: 'Spark and soil',
    note: 'Fire tends to start things and earth to see them through: two different speeds, each covering what the other leaves.',
  },
  'air+fire': {
    label: 'Oxygen',
    note: 'Air feeds fire and fire warms air: a quick, talkative and restless combination.',
  },
  'fire+water': {
    label: 'Steam',
    note: 'Impulse meets feeling, and each holds what the other tends to lack. Astrology reads it as a strong mix, in both directions.',
  },
  'earth+earth': {
    label: 'Bedrock',
    note: 'Two earth signs share a taste for what is practical and lasting: a steady, grounded combination.',
  },
  'air+earth': {
    label: 'Idea and estimate',
    note: 'Air brings possibilities and earth asks what they would cost: ideas meeting practice.',
  },
  'earth+water': {
    label: 'River and bank',
    note: 'Water softens earth and earth gives water shape: astrology’s classic pairing of quiet strength.',
  },
  'air+air': {
    label: 'Crosswind',
    note: 'Endless conversation and plenty of room for each other. Two air signs tend to meet in ideas first and feelings second.',
  },
  'air+water': {
    label: 'Naming the weather',
    note: 'Air wants a feeling named; water wants it felt. Two different languages for the same weather.',
  },
  'water+water': {
    label: 'Deep water',
    note: 'Two water signs read each other without subtitles and tend to share a mood as it arrives.',
  },
};

export function elementInteraction(a: Element, b: Element): InteractionNote {
  return ELEMENT_NOTES[comboKey(a, b)];
}

const MODALITY_NOTES: Record<string, InteractionNote> = {
  'cardinal+cardinal': {
    label: 'Two starters',
    note: 'Both signs open a season, and both tend to arrive with a plan of their own.',
  },
  'cardinal+fixed': {
    label: 'Starter and keeper',
    note: 'One tends to launch and the other to sustain: two halves of getting something done.',
  },
  'cardinal+mutable': {
    label: 'Starter and adapter',
    note: 'One tends to set the direction and the other to adjust course along the way.',
  },
  'fixed+fixed': {
    label: 'Two anchors',
    note: 'Two fixed signs: steady, loyal and slow to change course.',
  },
  'fixed+mutable': {
    label: 'Anchor and sail',
    note: 'Stability meets flexibility, each supplying what the other tends to skip.',
  },
  'mutable+mutable': {
    label: 'Two sails',
    note: 'Both signs adapt easily and rarely dig in, so decisions tend to stay open longer.',
  },
};

export function modalityInteraction(a: Modality, b: Modality): InteractionNote {
  return MODALITY_NOTES[comboKey(a, b)];
}

export function polarityNote(a: Sign, b: Sign): string {
  if (a.polarity === 'day' && b.polarity === 'day') {
    return 'Both day signs: energy runs outward on both sides, toward action and expression.';
  }
  if (a.polarity === 'night' && b.polarity === 'night') {
    return 'Both night signs: both tend to process inward before anything shows.';
  }
  return 'One day sign, one night sign: one tends to think out loud, the other to think first.';
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
    gloss: 'the two blend and are hard to tell apart',
  },
  sextile: {
    verb: 'works easily with',
    gloss: 'an easy link, traditionally read as an opening',
  },
  square: {
    verb: 'pushes against',
    gloss: 'a tension, traditionally read as friction to work with',
  },
  trine: {
    verb: 'flows with',
    gloss: 'a natural fit, traditionally read as support',
  },
  opposition: {
    verb: 'pulls against',
    gloss: 'a pull between the two, traditionally read as a call for balance',
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
