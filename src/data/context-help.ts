export type GlossaryCategory =
  | 'setup'
  | 'anatomy'
  | 'aspect'
  | 'dignity'
  | 'timing'
  | 'sign-quality';

export type GlossaryLevel = 'core' | 'intermediate' | 'advanced';

export interface ContextTermMetadata {
  slug: string;
  plainDefinition: string;
  aliases?: readonly string[];
  category: GlossaryCategory;
  level: GlossaryLevel;
}

/**
 * The small, client-safe slice of the glossary used by inline explanations.
 * Glossary entries absorb this metadata at build time, so the tooltip and
 * reference-page language cannot drift apart.
 */
export const CONTEXT_TERMS: readonly ContextTermMetadata[] = Object.freeze([
  {
    slug: 'birth-chart',
    plainDefinition: 'A snapshot of where the planets appeared at the moment you were born.',
    aliases: ['natal chart'],
    category: 'setup',
    level: 'core',
  },
  {
    slug: 'big-three',
    plainDefinition: 'Your Sun, Moon, and rising signs, the three quickest entry points into a birth chart.',
    aliases: ['sun moon rising'],
    category: 'setup',
    level: 'core',
  },
  {
    slug: 'house-system',
    plainDefinition: 'A method for dividing a birth chart into twelve areas of life.',
    aliases: ['houses setting'],
    category: 'setup',
    level: 'core',
  },
  {
    slug: 'whole-sign-houses',
    plainDefinition: 'A house system in which each zodiac sign becomes one complete 30° house.',
    aliases: ['whole sign', 'whole sign house system'],
    category: 'setup',
    level: 'core',
  },
  {
    slug: 'placidus',
    plainDefinition: 'A house system that uses your exact birth time and location to create houses of different sizes.',
    aliases: ['placidus houses'],
    category: 'setup',
    level: 'core',
  },
  {
    slug: 'degree',
    plainDefinition: 'A unit for locating something precisely around the 360° chart circle.',
    aliases: ['degrees'],
    category: 'anatomy',
    level: 'core',
  },
  {
    slug: 'placement',
    plainDefinition: 'A planet in a particular sign, degree, and, when birth time is known, house.',
    aliases: ['placements'],
    category: 'anatomy',
    level: 'core',
  },
  {
    slug: 'house',
    plainDefinition: 'One of twelve chart areas describing where a theme tends to show up in life.',
    aliases: ['houses'],
    category: 'anatomy',
    level: 'core',
  },
  {
    slug: 'cusp',
    plainDefinition: 'The boundary where one sign or house ends and the next begins.',
    aliases: ['house cusp'],
    category: 'anatomy',
    level: 'intermediate',
  },
  {
    slug: 'rising-sign',
    plainDefinition: 'The sign rising on the eastern horizon at your birth; it depends on an accurate time and place.',
    aliases: ['rising', 'ascendant sign'],
    category: 'anatomy',
    level: 'core',
  },
  {
    slug: 'north-node',
    plainDefinition: 'A calculated point where the Moon’s orbit crosses the Sun’s apparent path, often read as a direction of growth rather than a fixed destiny.',
    aliases: ['north lunar node'],
    category: 'anatomy',
    level: 'core',
  },
  {
    slug: 'south-node',
    plainDefinition: 'The calculated point opposite the North Node, often associated with familiar patterns and existing strengths.',
    aliases: ['south lunar node'],
    category: 'anatomy',
    level: 'core',
  },
  {
    slug: 'ascendant',
    plainDefinition: 'The exact point rising on the eastern horizon, often shortened to ASC.',
    aliases: ['asc', 'asc.'],
    category: 'anatomy',
    level: 'core',
  },
  {
    slug: 'midheaven',
    plainDefinition: 'A chart angle associated with public life and direction, often shortened to MC.',
    aliases: ['mc', 'medium coeli'],
    category: 'anatomy',
    level: 'intermediate',
  },
  {
    slug: 'aspect',
    plainDefinition: 'A measured angle between two chart points that astrologers read as a relationship between them.',
    aliases: ['aspects'],
    category: 'aspect',
    level: 'core',
  },
  {
    slug: 'conjunction',
    plainDefinition: 'A 0° aspect that concentrates two parts of the chart in the same place.',
    aliases: ['conjunct'],
    category: 'aspect',
    level: 'core',
  },
  {
    slug: 'sextile',
    plainDefinition: 'A 60° aspect read as an opportunity for two parts of the chart to cooperate.',
    category: 'aspect',
    level: 'core',
  },
  {
    slug: 'square',
    plainDefinition: 'A 90° aspect read as friction that asks for action or adjustment.',
    category: 'aspect',
    level: 'core',
  },
  {
    slug: 'trine',
    plainDefinition: 'A 120° aspect read as an easy-flowing connection between two parts of the chart.',
    category: 'aspect',
    level: 'core',
  },
  {
    slug: 'opposition',
    plainDefinition: 'A 180° aspect that places two chart points across from one another.',
    aliases: ['opposite'],
    category: 'aspect',
    level: 'core',
  },
  {
    slug: 'orb',
    plainDefinition: 'How far an aspect is from exact; a smaller orb means a tighter aspect.',
    aliases: ['aspect orb'],
    category: 'aspect',
    level: 'intermediate',
  },
  {
    slug: 'applying',
    plainDefinition: 'An aspect moving closer to its exact angle.',
    aliases: ['applying aspect'],
    category: 'aspect',
    level: 'intermediate',
  },
  {
    slug: 'separating',
    plainDefinition: 'An aspect moving away from its exact angle.',
    aliases: ['separating aspect'],
    category: 'aspect',
    level: 'intermediate',
  },
  {
    slug: 'essential-dignity',
    plainDefinition: 'A traditional system for describing how supported a planet is considered in a sign.',
    aliases: ['dignity', 'dignities'],
    category: 'dignity',
    level: 'intermediate',
  },
  {
    slug: 'domicile',
    plainDefinition: 'A traditional dignity label meaning a planet is in a sign it rules.',
    aliases: ['rulership dignity'],
    category: 'dignity',
    level: 'intermediate',
  },
  {
    slug: 'exaltation',
    plainDefinition: 'A traditional dignity label meaning a planet is considered especially supported in that sign.',
    aliases: ['exalted'],
    category: 'dignity',
    level: 'intermediate',
  },
  {
    slug: 'detriment',
    plainDefinition: 'A traditional dignity label for a planet in the sign opposite one it rules.',
    category: 'dignity',
    level: 'intermediate',
  },
  {
    slug: 'fall',
    plainDefinition: 'A traditional dignity label for a planet in the sign opposite its exaltation.',
    category: 'dignity',
    level: 'intermediate',
  },
  {
    slug: 'retrograde',
    plainDefinition: 'A period when a planet appears to move backward from Earth; it has not reversed its orbit.',
    aliases: ['rx', 'retrograde motion'],
    category: 'timing',
    level: 'core',
  },
  {
    slug: 'station',
    plainDefinition: 'The moment a planet appears to stop before changing between direct and retrograde motion.',
    aliases: ['stations', 'station direct', 'station retrograde'],
    category: 'timing',
    level: 'intermediate',
  },
  {
    slug: 'ingress',
    plainDefinition: 'The exact moment a planet enters a new zodiac sign.',
    aliases: ['enters a sign'],
    category: 'timing',
    level: 'intermediate',
  },
  {
    slug: 'transit',
    plainDefinition: 'A current moving planet compared with a fixed point in a birth chart.',
    aliases: ['transits'],
    category: 'timing',
    level: 'core',
  },
  {
    slug: 'progression',
    plainDefinition: 'A symbolic timing technique that advances a birth chart by a set rule.',
    aliases: ['progressed chart', 'progressions'],
    category: 'timing',
    level: 'advanced',
  },
  {
    slug: 'solar-return',
    plainDefinition: 'The yearly moment when the Sun returns to its exact birth-chart position.',
    aliases: ['solar return chart'],
    category: 'timing',
    level: 'intermediate',
  },
  {
    slug: 'element',
    plainDefinition: 'A sign family (fire, earth, air, or water) used to describe its basic style.',
    aliases: ['elements'],
    category: 'sign-quality',
    level: 'core',
  },
  {
    slug: 'modality',
    plainDefinition: 'A sign family (cardinal, fixed, or mutable) describing how it begins, sustains, or adapts.',
    aliases: ['modalities', 'quality'],
    category: 'sign-quality',
    level: 'core',
  },
  {
    slug: 'cardinal',
    plainDefinition: 'The modality associated with beginning, initiating, and setting direction.',
    category: 'sign-quality',
    level: 'intermediate',
  },
  {
    slug: 'fixed',
    plainDefinition: 'The modality associated with sustaining, concentrating, and holding steady.',
    category: 'sign-quality',
    level: 'intermediate',
  },
  {
    slug: 'mutable',
    plainDefinition: 'The modality associated with adapting, transitioning, and making changes.',
    category: 'sign-quality',
    level: 'intermediate',
  },
  {
    slug: 'stellium',
    plainDefinition: 'A cluster of three or more major chart bodies in the same sign or house.',
    aliases: ['stelliums'],
    category: 'anatomy',
    level: 'intermediate',
  },
] satisfies readonly ContextTermMetadata[]);

export const BEGINNER_TERM_SLUGS = Object.freeze([
  'birth-chart',
  'big-three',
  'rising-sign',
  'house-system',
  'whole-sign-houses',
  'placidus',
  'house',
  'aspect',
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
  'retrograde',
  'transit',
] as const);

export function normalizeContextTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const contextTermsByKey = new Map<string, ContextTermMetadata>();
for (const entry of CONTEXT_TERMS) {
  contextTermsByKey.set(normalizeContextTerm(entry.slug), entry);
  for (const alias of entry.aliases ?? []) {
    contextTermsByKey.set(normalizeContextTerm(alias), entry);
  }
}

export function resolveContextTerm(value: string): ContextTermMetadata | undefined {
  return contextTermsByKey.get(normalizeContextTerm(value));
}
